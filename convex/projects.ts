import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query, type QueryCtx } from "./_generated/server";
import { addEvent, readableProject, SOURCE_WEIGHTS, writableProject, short } from "./lib";
import { vHypothesisType } from "./schema";

const NEW_MS = 15 * 60_000;

async function withSource(ctx: QueryCtx, e: Doc<"evidence"> | null) {
  if (!e) return null;
  const s = await ctx.db.get(e.sourceId);
  return {
    _id: e._id,
    quote: e.quote,
    speaker: e.speaker,
    stance: e.stance,
    confidence: e.confidence,
    weight: e.weight,
    createdAt: e.createdAt,
    isNew: Date.now() - e.createdAt < NEW_MS,
    sourceType: s?.sourceType ?? "web",
    // Internal sources (interviews, waitlist, replies) have no public link.
    url: s && /^https?:/.test(s.url) ? s.url : null,
    sourceTitle: s?.title,
  };
}

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const own = userId
      ? await ctx.db
          .query("projects")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .order("desc")
          .collect()
      : [];
    const sample = (
      await ctx.db
        .query("projects")
        .withIndex("by_user", (q) => q.eq("userId", undefined))
        .collect()
    ).filter((p) => p.sample);
    return [...own, ...sample].map((p) => ({
      _id: p._id,
      ideaText: p.ideaText,
      status: p.status,
      sample: !!p.sample,
    }));
  },
});

export const get = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const project = await readableProject(ctx, projectId);
    if (!project) return null;
    const brief = await ctx.db
      .query("ideaBriefs")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .order("desc")
      .first();
    const hyps = await ctx.db
      .query("hypotheses")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    const hypotheses = await Promise.all(
      hyps.map(async (h) => ({
        ...h,
        support: await withSource(ctx, h.topSupportId ? await ctx.db.get(h.topSupportId) : null),
        disprove: await withSource(ctx, h.topDisproveId ? await ctx.db.get(h.topDisproveId) : null),
      })),
    );
    // Most uncertain first, so the founder sees where to dig.
    hypotheses.sort((a, b) => Math.abs(a.score - 50) - Math.abs(b.score - 50));
    return { project, brief, hypotheses, canEdit: !!(await getAuthUserId(ctx)) };
  },
});

export const hypothesis = query({
  args: { hypothesisId: v.id("hypotheses") },
  handler: async (ctx, { hypothesisId }) => {
    const h = await ctx.db.get(hypothesisId);
    if (!h || !(await readableProject(ctx, h.projectId))) return null;
    const evidence = await ctx.db
      .query("evidence")
      .withIndex("by_hypothesis", (q) => q.eq("hypothesisId", hypothesisId))
      .collect();
    const quotes = (await Promise.all(evidence.map((e) => withSource(ctx, e)))).filter(
      (e) => e !== null,
    );
    quotes.sort((a, b) => b.weight * b.confidence - a.weight * a.confidence);
    const history = await Promise.all(
      h.scoreHistory.map(async (p) => {
        const e = p.evidenceId ? await ctx.db.get(p.evidenceId) : null;
        return {
          at: p.at,
          score: p.score,
          cause: e
            ? { id: e._id, quote: e.quote, stance: e.stance, weight: e.weight * e.confidence }
            : null,
        };
      }),
    );
    const notes = await ctx.db
      .query("personaNotes")
      .withIndex("by_hypothesis", (q) => q.eq("hypothesisId", hypothesisId))
      .order("desc")
      .take(12);
    // Latest note per persona.
    const personas = [...new Map(notes.map((n) => [n.persona, n])).values()];
    return { hypothesis: h, quotes, history, personas, weights: SOURCE_WEIGHTS };
  },
});

export const customers = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const project = await readableProject(ctx, projectId);
    if (!project) return null;
    const contacts = await ctx.db
      .query("contacts")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    const meetings = await ctx.db
      .query("meetings")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    const events = await ctx.db
      .query("pageEvents")
      .withIndex("by_project_type", (q) => q.eq("projectId", projectId))
      .collect();
    const views = events.filter((e) => e.type === "pageview");
    const unique = new Set(views.map((e) => e.visitorId)).size;
    const formStarts = new Set(
      events.filter((e) => e.type === "form_focus").map((e) => e.visitorId),
    ).size;
    const signups = events.filter((e) => e.type === "signup").length;
    const order = [
      "meeting booked",
      "replied",
      "interviewed",
      "queued",
      "emailed",
      "thanked",
      "found",
    ];
    contacts.sort(
      (a, b) =>
        order.indexOf(a.status) - order.indexOf(b.status) || (b.fitScore ?? 0) - (a.fitScore ?? 0),
    );
    return {
      contacts,
      meetings: meetings.sort((a, b) => b.startTime - a.startTime),
      landing: {
        status: project.landingStatus,
        error: project.landingError,
        pagesUrl: project.pagesUrl,
        repo: project.landingRepo,
        visits: views.length,
        unique,
        formStarts,
        signups,
        conversion: unique ? signups / unique : 0,
      },
      grokConnectedAt: project.grokConnectedAt,
      coldOutreach: project.coldOutreach,
      mcpUrl: `${process.env.CONVEX_SITE_URL}/mcp`,
    };
  },
});

export const reports = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    if (!(await readableProject(ctx, projectId))) return null;
    const reports = await ctx.db
      .query("reports")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .order("desc")
      .take(20);
    const sourceIds = new Set(
      reports.flatMap((r) =>
        [...(r.market?.topDown ?? []), ...(r.market?.bottomUp ?? [])].map((l) => l.sourceId),
      ),
    );
    const sources: Record<string, { url: string; title?: string; sourceType: string }> = {};
    for (const id of sourceIds) {
      const s = id ? await ctx.db.get(id) : null;
      if (s) sources[s._id] = { url: s.url, title: s.title, sourceType: s.sourceType };
    }
    return { reports, sources };
  },
});

export const fleet = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const project = await readableProject(ctx, projectId);
    if (!project) return null;
    const runs = await ctx.db
      .query("agentRuns")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .order("desc")
      .take(300);
    const feed = await ctx.db
      .query("events")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .order("desc")
      .take(60);
    const calls = await ctx.db
      .query("toolCalls")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .order("desc")
      .take(500);
    const openTasks = await ctx.db
      .query("tasks")
      .withIndex("by_project_status", (q) => q.eq("projectId", projectId).eq("status", "open"))
      .collect();

    const agents: Record<
      string,
      { running: number; lastAt: number; spent: number; lastSummary?: string; team: string }
    > = {};
    for (const r of runs) {
      const a = (agents[r.agent] ??= { running: 0, lastAt: 0, spent: 0, team: r.team });
      if (r.status === "running") a.running++;
      a.lastAt = Math.max(a.lastAt, r.finishedAt ?? r.startedAt);
      a.spent += r.costUsd;
      a.lastSummary ??= r.summary ?? r.error;
    }
    for (const c of calls) {
      const a = (agents[c.agent] ??= { running: 0, lastAt: 0, spent: 0, team: "research" });
      a.spent += c.costUsd;
    }
    for (const e of feed) {
      const from = e.payload?.from as string | undefined;
      if (from && agents[from]) agents[from].lastAt = Math.max(agents[from].lastAt, e.createdAt);
      else if (from) agents[from] = { running: 0, lastAt: e.createdAt, spent: 0, team: "growth" };
    }
    return {
      budgetUsd: project.budgetUsd,
      spentUsd: project.spentUsd,
      status: project.status,
      pauseReason: project.pauseReason,
      agents,
      feed: feed.map((e) => ({
        _id: e._id,
        at: e.createdAt,
        type: e.type,
        message: (e.payload?.message as string) ?? e.type,
        status: e.status,
        result: e.result,
      })),
      openTasks: openTasks.sort((a, b) => b.priority - a.priority),
      failures: runs
        .filter((r) => r.status === "failed")
        .slice(0, 5)
        .map(({ _id, agent, startedAt, error }) => ({ _id, agent, startedAt, error })),
    };
  },
});

export const audit = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    if (!(await readableProject(ctx, projectId))) return null;
    return ctx.db
      .query("toolCalls")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .order("desc")
      .take(150);
  },
});

// ── Founder decisions ───────────────────────────────────────────────────

export const setColdOutreach = mutation({
  args: { projectId: v.id("projects"), on: v.boolean() },
  handler: async (ctx, { projectId, on }) => {
    await writableProject(ctx, projectId);
    await ctx.db.patch(projectId, { coldOutreach: on });
    if (!on) return;
    // Queue the people scouts already found.
    const found = (
      await ctx.db
        .query("contacts")
        .withIndex("by_project", (q) => q.eq("projectId", projectId))
        .collect()
    ).filter((c) => c.origin === "scout" && c.status === "found");
    for (const c of found) await ctx.db.patch(c._id, { status: "queued" });
    if (found.length)
      await addEvent(ctx, projectId, "contacts.queued", {
        message: `Founder → Grok Bot: cold outreach on, ${found.length} people queued`,
        from: "Founder",
        contactIds: found.map((c) => c._id),
      });
  },
});

export const setBudget = mutation({
  args: { projectId: v.id("projects"), budgetUsd: v.number() },
  handler: async (ctx, { projectId, budgetUsd }) => {
    const p = await writableProject(ctx, projectId);
    if (budgetUsd < 1 || budgetUsd > 500)
      throw new ConvexError("Budget must be between $1 and $500.");
    const resume =
      p.status === "paused" && p.pauseReason?.startsWith("Budget") && budgetUsd > p.spentUsd;
    await ctx.db.patch(projectId, {
      budgetUsd,
      ...(resume ? { status: "active", pauseReason: undefined } : {}),
    });
  },
});

export const setPaused = mutation({
  args: { projectId: v.id("projects"), paused: v.boolean() },
  handler: async (ctx, { projectId, paused }) => {
    const p = await writableProject(ctx, projectId);
    if (p.status === "drafting") return;
    await ctx.db.patch(
      projectId,
      paused
        ? { status: "paused", pauseReason: "Paused by you" }
        : { status: "active", pauseReason: undefined },
    );
  },
});

export const setFreeSlots = mutation({
  args: { projectId: v.id("projects"), slots: v.array(v.string()) },
  handler: async (ctx, { projectId, slots }) => {
    await writableProject(ctx, projectId);
    await ctx.db.patch(projectId, {
      freeSlots: slots
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 10),
    });
  },
});

export const addContact = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    role: v.optional(v.string()),
    company: v.optional(v.string()),
    email: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
  },
  handler: async (ctx, { projectId, ...c }) => {
    await writableProject(ctx, projectId);
    if (!c.name.trim()) throw new ConvexError("Name is required.");
    if (!c.email && !c.linkedinUrl) throw new ConvexError("Add an email or a LinkedIn URL.");
    if (c.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email))
      throw new ConvexError("That email looks wrong.");
    const contactId = await ctx.db.insert("contacts", {
      projectId,
      ...c,
      name: c.name.trim(),
      email: c.email?.trim().toLowerCase() || undefined,
      origin: "manual",
      status: "queued",
      priority: 1,
      createdAt: Date.now(),
    });
    await addEvent(ctx, projectId, "contacts.queued", {
      message: `Founder → Grok Bot: reach out to ${c.name.trim()}`,
      from: "Founder",
      contactIds: [contactId],
    });
  },
});

/** Delete a person's data when they ask. */
export const deleteContact = mutation({
  args: { contactId: v.id("contacts") },
  handler: async (ctx, { contactId }) => {
    const c = await ctx.db.get(contactId);
    if (!c) return;
    await writableProject(ctx, c.projectId);
    for (const t of await ctx.db
      .query("touches")
      .withIndex("by_contact", (q) => q.eq("contactId", contactId))
      .collect())
      await ctx.db.delete(t._id);
    for (const m of await ctx.db
      .query("meetings")
      .withIndex("by_contact", (q) => q.eq("contactId", contactId))
      .collect())
      await ctx.db.delete(m._id);
    await ctx.db.delete(contactId);
  },
});

export const addHypothesis = mutation({
  args: {
    projectId: v.id("projects"),
    type: vHypothesisType,
    statement: v.string(),
    disproveIf: v.string(),
  },
  handler: async (ctx, { projectId, ...h }) => {
    await writableProject(ctx, projectId);
    if (h.statement.trim().length < 10 || h.disproveIf.trim().length < 10)
      throw new ConvexError("Write the hypothesis and what would disprove it.");
    const hypothesisId = await ctx.db.insert("hypotheses", {
      projectId,
      ...h,
      score: 50,
      strength: { quotes: 0, sourceTypes: 0 },
      scoreHistory: [{ at: Date.now(), score: 50 }],
    });
    // Score it against everything collected so far, then look for what is missing.
    await ctx.scheduler.runAfter(0, internal.research.cover, { projectId, hypothesisId });
    return hypothesisId;
  },
});

export const editHypothesis = mutation({
  args: { hypothesisId: v.id("hypotheses"), statement: v.string(), disproveIf: v.string() },
  handler: async (ctx, { hypothesisId, statement, disproveIf }) => {
    const h = await ctx.db.get(hypothesisId);
    if (!h) throw new ConvexError("Not found.");
    await writableProject(ctx, h.projectId);
    await ctx.db.patch(hypothesisId, { statement, disproveIf });
  },
});

export const askScouts = mutation({
  args: { hypothesisId: v.id("hypotheses") },
  handler: async (ctx, { hypothesisId }) => {
    const h = await ctx.db.get(hypothesisId);
    if (!h) throw new ConvexError("Not found.");
    const p = await writableProject(ctx, h.projectId);
    if (p.status !== "active") throw new ConvexError("Resume the project first.");
    const taskId = await ctx.db.insert("tasks", {
      projectId: h.projectId,
      team: "research",
      title: `Founder asked: more data on "${short(h.statement)}"`,
      hypothesisId,
      priority: 5,
      budgetUsd: 1,
      status: "open",
      createdBy: "Founder",
      createdAt: Date.now(),
    });
    await addEvent(ctx, h.projectId, "task.created", {
      message: `Founder → Research: more data on "${short(h.statement)}"`,
      from: "Founder",
    });
    await ctx.scheduler.runAfter(0, internal.research.start, {
      projectId: h.projectId,
      focus: [hypothesisId as Id<"hypotheses">],
      taskId,
    });
  },
});

export const confirmPoint = internalMutation({
  args: {
    threadId: v.string(),
    field: v.union(v.literal("problem"), v.literal("customer"), v.literal("solution")),
    text: v.string(),
  },
  handler: async (ctx, { threadId, field, text }) => {
    const project = await ctx.db
      .query("projects")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .unique();
    if (!project || project.status !== "drafting") return;
    await ctx.db.patch(project._id, { draft: { ...project.draft, [field]: text } });
  },
});

export const saveBrief = internalMutation({
  args: {
    threadId: v.string(),
    problem: v.string(),
    customer: v.string(),
    solution: v.string(),
    model: v.string(),
    hypotheses: v.array(
      v.object({ type: vHypothesisType, statement: v.string(), disproveIf: v.string() }),
    ),
  },
  handler: async (ctx, { threadId, hypotheses, ...brief }) => {
    const project = await ctx.db
      .query("projects")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .unique();
    if (!project) throw new Error("No project for this thread");
    const last = await ctx.db
      .query("ideaBriefs")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .order("desc")
      .first();
    await ctx.db.insert("ideaBriefs", {
      projectId: project._id,
      ...brief,
      version: (last?.version ?? 0) + 1,
    });
    // While drafting, a new brief replaces the hypotheses; after approval they are edited one by one.
    if (project.status === "drafting") {
      const old = await ctx.db
        .query("hypotheses")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect();
      for (const h of old) await ctx.db.delete(h._id);
      for (const h of hypotheses)
        await ctx.db.insert("hypotheses", {
          projectId: project._id,
          ...h,
          score: 50,
          strength: { quotes: 0, sourceTypes: 0 },
          scoreHistory: [{ at: Date.now(), score: 50 }],
        });
    }
  },
});
