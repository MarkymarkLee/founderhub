import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  httpAction,
  internalMutation,
  mutation,
  type MutationCtx,
  query,
} from "./_generated/server";
import { addEvent, capKey, OUTREACH_EVENTS, requireUser, sha256, today } from "./lib";

// ── Personal tokens (Settings page and the Connect card) ─────────────────

export const createToken = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const token = `fh_${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
    await ctx.db.insert("mcpTokens", {
      userId,
      tokenHash: await sha256(token),
      createdAt: Date.now(),
    });
    return token; // shown once; only the hash is stored
  },
});

export const tokens = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const rows = await ctx.db
      .query("mcpTokens")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return rows.map(({ _id, createdAt, lastUsedAt, revokedAt }) => ({
      _id,
      createdAt,
      lastUsedAt,
      revokedAt,
    }));
  },
});

export const revokeToken = mutation({
  args: { tokenId: v.id("mcpTokens") },
  handler: async (ctx, { tokenId }) => {
    const userId = await requireUser(ctx);
    const t = await ctx.db.get(tokenId);
    if (t?.userId !== userId) throw new ConvexError("Not found.");
    await ctx.db.patch(tokenId, { revokedAt: Date.now() });
  },
});

export const userForToken = internalMutation({
  args: { tokenHash: v.string() },
  handler: async (ctx, { tokenHash }) => {
    const t = await ctx.db
      .query("mcpTokens")
      .withIndex("by_hash", (q) => q.eq("tokenHash", tokenHash))
      .unique();
    if (!t || t.revokedAt) return null;
    await ctx.db.patch(t._id, { lastUsedAt: Date.now() });
    return t.userId;
  },
});

// ── Tools ─────────────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "get_daily_quota",
    description:
      "What is left today per channel for each FounderHub project. Call this first on every run.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_pending_events",
    description: "Outreach events waiting for you, oldest first.",
    inputSchema: { type: "object", properties: { limit: { type: "number", default: 10 } } },
  },
  {
    name: "ack_event",
    description:
      "Mark an event handled, with a short note of what you did (start with 'skipped' if you did nothing).",
    inputSchema: {
      type: "object",
      properties: { eventId: { type: "string" }, result: { type: "string" } },
      required: ["eventId", "result"],
    },
  },
  {
    name: "get_contact",
    description:
      "Who a contact is, how to reach them, why they match, and a personal hook for the first line.",
    inputSchema: {
      type: "object",
      properties: { contactId: { type: "string" } },
      required: ["contactId"],
    },
  },
  {
    name: "get_interview_brief",
    description: "The idea in two sentences, the questions to ask, and the founder's free slots.",
    inputSchema: {
      type: "object",
      properties: { projectId: { type: "string" } },
      required: ["projectId"],
    },
  },
  {
    name: "log_touch",
    description:
      "Log every send, follow-up, connection request, DM, reply, thank-you, invite or bounce. Refused past the daily cap. Replies are stored as evidence.",
    inputSchema: {
      type: "object",
      properties: {
        contactId: { type: "string" },
        channel: { type: "string", enum: ["email", "linkedin"] },
        kind: {
          type: "string",
          enum: ["send", "follow-up", "reply", "connection", "dm", "thank-you", "invite", "bounce"],
        },
        text: { type: "string" },
      },
      required: ["contactId", "channel", "kind"],
    },
  },
  {
    name: "log_meeting",
    description: "Record a booked call after you create the calendar event.",
    inputSchema: {
      type: "object",
      properties: {
        contactId: { type: "string" },
        startTime: { type: "string", description: "ISO 8601" },
        meetLink: { type: "string" },
      },
      required: ["contactId", "startTime"],
    },
  },
  {
    name: "get_meeting_summary",
    description: "The call summary and one personal line for the thank-you email.",
    inputSchema: {
      type: "object",
      properties: { meetingId: { type: "string" } },
      required: ["meetingId"],
    },
  },
];

class ToolError extends Error {}

async function ownedProjects(ctx: MutationCtx, userId: Id<"users">) {
  return (
    await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect()
  ).filter((p) => p.status !== "drafting");
}

async function own<T extends "contacts" | "meetings" | "events" | "projects">(
  ctx: MutationCtx,
  userId: Id<"users">,
  table: T,
  id: unknown,
): Promise<Doc<T>> {
  const doc = (await ctx.db.get(String(id) as Id<T>).catch(() => null)) as Doc<T> | null;
  const projectId =
    doc &&
    (table === "projects" ? doc._id : (doc as unknown as { projectId: Id<"projects"> }).projectId);
  const project = projectId ? await ctx.db.get(projectId as Id<"projects">) : null;
  if (!doc || project?.userId !== userId)
    throw new ToolError(`No ${table.slice(0, -1)} with id ${String(id)}`);
  return doc;
}

async function remaining(ctx: MutationCtx, p: Doc<"projects">) {
  const used = await ctx.db
    .query("quotaUsage")
    .withIndex("by_project_date", (q) => q.eq("projectId", p._id).eq("date", today()))
    .collect();
  const count = (channel: string) => used.find((u) => u.channel === channel)?.count ?? 0;
  const bounced = count("bounce") >= 2; // stop cold email for the day after two bounces
  const left = Object.fromEntries(
    Object.entries(p.dailyCaps).map(([k, cap]) => [k, Math.max(0, cap - count(k))]),
  ) as Record<keyof Doc<"projects">["dailyCaps"], number>;
  if (bounced) left.coldEmail = 0;
  return left;
}

async function bump(ctx: MutationCtx, projectId: Id<"projects">, channel: string) {
  const row = await ctx.db
    .query("quotaUsage")
    .withIndex("by_project_date", (q) =>
      q.eq("projectId", projectId).eq("date", today()).eq("channel", channel),
    )
    .unique();
  if (row) await ctx.db.patch(row._id, { count: row.count + 1 });
  else await ctx.db.insert("quotaUsage", { projectId, date: today(), channel, count: 1 });
}

function clearedForOutreach(contact: Doc<"contacts">, project: Doc<"projects">) {
  return contact.origin !== "scout" || project.coldOutreach;
}

const STATUS_AFTER: Partial<Record<Doc<"touches">["kind"], Doc<"contacts">["status"]>> = {
  send: "emailed",
  "follow-up": "emailed",
  connection: "emailed",
  dm: "emailed",
  reply: "replied",
  "thank-you": "thanked",
};
const RANK: Doc<"contacts">["status"][] = [
  "found",
  "queued",
  "emailed",
  "replied",
  "meeting booked",
  "interviewed",
  "thanked",
];

export const callTool = internalMutation({
  args: { userId: v.id("users"), name: v.string(), args: v.any() },
  handler: async (ctx, { userId, name, args: a }) => {
    a ??= {};
    switch (name) {
      case "get_daily_quota": {
        const projects = await ownedProjects(ctx, userId);
        for (const p of projects)
          if (!p.grokConnectedAt) {
            await ctx.db.patch(p._id, { grokConnectedAt: Date.now() });
            await addEvent(ctx, p._id, "grok.connected", {
              message: "Grok Bot connected",
              from: "Grok Bot outreach",
            });
          }
        return Promise.all(
          projects.map(async (p) => ({
            projectId: p._id,
            idea: p.ideaText,
            remainingToday: await remaining(ctx, p),
            thankYouEmails: "no cap, only to people actually interviewed",
          })),
        );
      }
      case "get_pending_events": {
        const limit = Math.min(Math.max(Number(a.limit) || 10, 1), 50);
        const out: unknown[] = [];
        for (const p of await ownedProjects(ctx, userId)) {
          if (p.status === "paused") continue;
          const pending = await ctx.db
            .query("events")
            .withIndex("by_project_status", (q) => q.eq("projectId", p._id).eq("status", "pending"))
            .take(limit);
          for (const e of pending) {
            if (!OUTREACH_EVENTS.includes(e.type)) continue;
            const { message: _message, from: _from, ...payload } = e.payload ?? {};
            out.push({
              eventId: e._id,
              projectId: p._id,
              type: e.type,
              createdAt: new Date(e.createdAt).toISOString(),
              ...payload,
            });
          }
        }
        return (out as { createdAt: string }[])
          .sort((x, y) => x.createdAt.localeCompare(y.createdAt))
          .slice(0, limit);
      }
      case "ack_event": {
        const e = await own(ctx, userId, "events", a.eventId);
        const result = String(a.result ?? "").slice(0, 500);
        await ctx.db.patch(e._id, {
          status: /^skip/i.test(result) ? "skipped" : "done",
          ackedAt: Date.now(),
          result,
        });
        return { ok: true };
      }
      case "get_contact": {
        const c = await own(ctx, userId, "contacts", a.contactId);
        const p = (await ctx.db.get(c.projectId))!;
        if (!clearedForOutreach(c, p))
          throw new ToolError(
            "This person was found online and cold outreach is off. Do not contact them.",
          );
        const touches = await ctx.db
          .query("touches")
          .withIndex("by_contact", (q) => q.eq("contactId", c._id))
          .collect();
        return {
          contactId: c._id,
          name: c.name,
          role: c.role,
          company: c.company,
          email: c.email,
          linkedinUrl: c.linkedinUrl,
          source: c.origin,
          status: c.status,
          whyTheyMatch:
            c.fitReason ??
            (c.origin === "waitlist" ? "Joined the waitlist" : "Added by the founder"),
          personalHook: c.keyQuote,
          previousTouches: touches.map((t) => ({
            channel: t.channel,
            kind: t.kind,
            at: new Date(t.at).toISOString(),
          })),
          saidNo: touches.some((t) => t.kind === "reply" && /^\s*no\b/i.test(t.text ?? "")),
        };
      }
      case "get_interview_brief": {
        const p = await own(ctx, userId, "projects", a.projectId);
        const brief = await ctx.db
          .query("ideaBriefs")
          .withIndex("by_project", (q) => q.eq("projectId", p._id))
          .order("desc")
          .first();
        const hyps = await ctx.db
          .query("hypotheses")
          .withIndex("by_project", (q) => q.eq("projectId", p._id))
          .collect();
        return {
          idea: brief ? `${brief.problem} ${brief.solution}` : p.ideaText,
          questions: hyps
            .sort((x, y) => Math.abs(x.score - 50) - Math.abs(y.score - 50))
            .map((h) => h.nextQuestion ?? `Ask about: ${h.statement}`)
            .slice(0, 6),
          founderFreeSlots: p.freeSlots ?? [],
          landingPage: p.pagesUrl,
        };
      }
      case "log_touch": {
        const c = await own(ctx, userId, "contacts", a.contactId);
        const p = (await ctx.db.get(c.projectId))!;
        const channel = a.channel === "linkedin" ? "linkedin" : "email";
        const kind = String(a.kind) as Doc<"touches">["kind"];
        if (!(kind in STATUS_AFTER) && kind !== "invite" && kind !== "bounce")
          throw new ToolError(`Unknown kind ${a.kind}`);
        if (kind !== "reply" && kind !== "bounce" && !clearedForOutreach(c, p))
          throw new ToolError("Cold outreach is off for people found online.");
        const key = capKey(channel, kind);
        if (key) {
          const left = await remaining(ctx, p);
          if (left[key] <= 0)
            throw new ToolError(`Daily cap reached for ${key}. Try again tomorrow.`);
          await bump(ctx, p._id, key);
        }
        if (kind === "bounce") await bump(ctx, p._id, "bounce");
        const text = typeof a.text === "string" ? a.text.slice(0, 5000) : undefined;
        await ctx.db.insert("touches", {
          contactId: c._id,
          projectId: p._id,
          channel,
          kind,
          at: Date.now(),
          text,
        });
        const next = STATUS_AFTER[kind];
        await ctx.db.patch(c._id, {
          lastTouchAt: Date.now(),
          ...(next && RANK.indexOf(next) > RANK.indexOf(c.status) ? { status: next } : {}),
        });
        // A reply is a customer's own words: keep it as evidence.
        if (kind === "reply" && text && text.length >= 20) {
          const sourceId = await ctx.db.insert("sources", {
            projectId: p._id,
            url: `${channel}:${c._id}:${Date.now()}`,
            title: `${channel === "email" ? "Email" : "LinkedIn"} reply from ${c.name}`,
            sourceType: channel,
            text: `${[c.role, c.company].filter(Boolean).join(" at ") || c.name}: ${text}`,
            fetchedAt: Date.now(),
            extractedAt: Date.now(),
          });
          await ctx.scheduler.runAfter(0, internal.research.extractSource, {
            projectId: p._id,
            sourceId,
            types: [],
          });
        }
        return { ok: true, remainingToday: await remaining(ctx, p) };
      }
      case "log_meeting": {
        const c = await own(ctx, userId, "contacts", a.contactId);
        const p = (await ctx.db.get(c.projectId))!;
        const startTime = Date.parse(String(a.startTime));
        if (Number.isNaN(startTime)) throw new ToolError("startTime must be ISO 8601");
        if ((await remaining(ctx, p)).invite <= 0)
          throw new ToolError("Daily cap reached for calendar invites.");
        await bump(ctx, p._id, "invite");
        const meetingId = await ctx.db.insert("meetings", {
          projectId: p._id,
          contactId: c._id,
          startTime,
          meetLink: typeof a.meetLink === "string" ? a.meetLink : undefined,
          status: "booked",
        });
        await ctx.db.patch(c._id, { status: "meeting booked", lastTouchAt: Date.now() });
        await addEvent(ctx, p._id, "meeting.booked", {
          message: `Grok Bot outreach: booked a call with ${c.name}`,
          from: "Grok Bot outreach",
          meetingId,
        });
        return { meetingId };
      }
      case "get_meeting_summary": {
        const m = await own(ctx, userId, "meetings", a.meetingId);
        if (m.status !== "analyzed") throw new ToolError("This call has not been analysed yet.");
        const c = await ctx.db.get(m.contactId);
        return {
          contactId: m.contactId,
          name: c?.name,
          email: c?.email,
          summary: m.summary,
          personalLine: m.personalLine,
        };
      }
      default:
        throw new ToolError(`Unknown tool ${name}`);
    }
  },
});

export const safeCall = internalMutation({
  args: { userId: v.id("users"), name: v.string(), args: v.any() },
  handler: async (ctx, a): Promise<{ ok: boolean; result: unknown }> => {
    try {
      return { ok: true, result: await ctx.runMutation(internal.mcp.callTool, a) };
    } catch (e) {
      // Tool errors go back to Grok Bot as text; the failed sub-mutation rolls back on its own.
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, result: message.replace(/^Uncaught \w+: /, "").split("\n")[0] };
    }
  },
});

// ── JSON-RPC over HTTP (MCP streamable HTTP, JSON responses, stateless) ──

const rpc = (id: unknown, result: unknown) => Response.json({ jsonrpc: "2.0", id, result });
const rpcError = (id: unknown, code: number, message: string, status = 200) =>
  Response.json({ jsonrpc: "2.0", id, error: { code, message } }, { status });

export const handle = httpAction(async (ctx, req) => {
  if (req.method !== "POST")
    return new Response("Method not allowed", { status: 405, headers: { Allow: "POST" } });
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const userId = token
    ? await ctx.runMutation(internal.mcp.userForToken, { tokenHash: await sha256(token) })
    : null;
  if (!userId) return rpcError(null, -32001, "Invalid or revoked FounderHub token", 401);

  const msg = (await req.json().catch(() => null)) as {
    id?: unknown;
    method?: string;
    params?: any;
  } | null;
  if (!msg?.method) return rpcError(null, -32600, "Invalid request", 400);
  if (msg.id === undefined) return new Response(null, { status: 202 }); // notification

  switch (msg.method) {
    case "initialize":
      return rpc(msg.id, {
        protocolVersion: msg.params?.protocolVersion ?? "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "FounderHub", version: "1.0.0" },
        instructions:
          "Call get_daily_quota first, then get_pending_events. Log every send with log_touch.",
      });
    case "ping":
      return rpc(msg.id, {});
    case "tools/list":
      return rpc(msg.id, { tools: TOOLS });
    case "tools/call": {
      const { ok, result } = await ctx.runMutation(internal.mcp.safeCall, {
        userId,
        name: String(msg.params?.name),
        args: msg.params?.arguments ?? {},
      });
      return rpc(msg.id, {
        content: [
          {
            type: "text",
            text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
          },
        ],
        isError: !ok,
      });
    }
    default:
      return rpcError(msg.id, -32601, `Unknown method ${msg.method}`);
  }
});
