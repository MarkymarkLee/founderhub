import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export type SourceType = Doc<"sources">["sourceType"];

// Spec: interview 3, waitlist 2.5, reply 2, report or public data 1.5, Reddit/forum 1.
export const SOURCE_WEIGHTS: Record<SourceType, number> = {
  interview: 3,
  waitlist: 2.5,
  email: 2,
  linkedin: 2,
  report: 1.5,
  "public data": 1.5,
  reddit: 1,
  forum: 1,
  web: 1,
};

export const DEFAULT_CAPS: Doc<"projects">["dailyCaps"] = {
  coldEmail: 15,
  followUp: 10,
  linkedinConnection: 10,
  linkedinDm: 10,
  invite: 5,
};

// Which daily cap a logged touch counts against; thank-yous and replies are uncapped.
export function capKey(
  channel: Doc<"touches">["channel"],
  kind: Doc<"touches">["kind"],
): keyof Doc<"projects">["dailyCaps"] | null {
  if (channel === "email" && kind === "send") return "coldEmail";
  if (channel === "email" && kind === "follow-up") return "followUp";
  if (channel === "email" && kind === "invite") return "invite";
  if (channel === "linkedin" && kind === "connection") return "linkedinConnection";
  if (channel === "linkedin" && (kind === "dm" || kind === "send" || kind === "follow-up"))
    return "linkedinDm";
  return null;
}

/** score = sigmoid(sum of weight * stance * confidence), as 0-100. */
export function scoreOf(
  evidence: { stance: "supports" | "disproves"; confidence: number; weight: number }[],
) {
  const sum = evidence.reduce(
    (acc, e) => acc + e.weight * (e.stance === "supports" ? 1 : -1) * e.confidence,
    0,
  );
  return Math.round(100 / (1 + Math.exp(-sum)));
}

/** A quote only counts if it really appears in the fetched text (ignoring case, spacing and quote marks). */
export function quoteAppearsIn(quote: string, text: string) {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[‘’“”"'`]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  const q = norm(quote);
  return q.length >= 12 && norm(text).includes(q);
}

/** Agents sometimes cite raw document ids in prose; founders should only ever read words. */
export const stripIds = (s: string) =>
  s.replace(/\s*\(?\b[a-z0-9]{32}\b\)?/g, "").replace(/\s+([,.])/g, "$1");

/** Shortens text for one-line feed messages. */
export const short = (s: string, n = 60) => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s);

export const today = () => new Date().toISOString().slice(0, 10);

export async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function slugify(text: string) {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32)
    .replace(/-$/, "");
  return `${base || "idea"}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function requireUser(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new ConvexError("Sign in first.");
  return userId;
}

/** Owner or the public sample project. Writes to the sample need any signed-in user. */
export async function readableProject(ctx: QueryCtx, projectId: Id<"projects">) {
  const project = await ctx.db.get(projectId);
  if (!project) return null;
  if (project.sample) return project;
  const userId = await getAuthUserId(ctx);
  return userId && project.userId === userId ? project : null;
}

export async function writableProject(ctx: MutationCtx, projectId: Id<"projects">) {
  const userId = await requireUser(ctx);
  const project = await ctx.db.get(projectId);
  if (!project || (!project.sample && project.userId !== userId))
    throw new ConvexError("Project not found.");
  return project;
}

// Events Grok Bot handles; every other event is an internal handoff, logged as done for the feed.
export const OUTREACH_EVENTS = [
  "contacts.queued",
  "waitlist.signup",
  "meeting.ended",
  "meeting.analyzed",
  "hypothesis.needs_interviews",
];

/** payload.message is the line the handoff feed shows, e.g. "Scouts → Extractors: 12 sources". */
export async function addEvent(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  type: string,
  payload: { message: string } & Record<string, unknown>,
) {
  const status = OUTREACH_EVENTS.includes(type) ? "pending" : "done";
  return ctx.db.insert("events", { projectId, type, payload, status, createdAt: Date.now() });
}
