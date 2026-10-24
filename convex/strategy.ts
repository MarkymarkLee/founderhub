import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  type QueryCtx,
} from "./_generated/server";
import type { Output } from "./agents";
import { addEvent, today, writableProject, short, stripIds } from "./lib";

export const PERSONAS = [
  { name: "Skeptical VC", question: "Why will this not be a venture-scale business?" },
  { name: "Target customer", question: "Would I switch from what I use today?" },
  { name: "Industry analyst", question: "What do the numbers say about size and growth?" },
  { name: "Competitor PM", question: "How would I copy or crush this?" },
];

const MIN = 60_000;

async function lastRunOf(ctx: QueryCtx, projectId: Id<"projects">, agent: string) {
  const runs = await ctx.db
    .query("agentRuns")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .order("desc")
    .take(200);
  return runs.find((r) => r.agent === agent);
}

/** Active projects that are within budget and have new evidence since `agent` last ran. */
export const due = internalQuery({
  args: { agent: v.string() },
  handler: async (ctx, { agent }) => {
    const active = await ctx.db
      .query("projects")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    const out: Id<"projects">[] = [];
    for (const p of active) {
      // The seeded sample only moves when someone acts on it, so it never burns credits on its own.
      if (p.sample || p.spentUsd >= p.budgetUsd) continue;
      const last = await lastRunOf(ctx, p._id, agent);
      if (last?.status === "running") continue;
      if (!last || (p.lastEvidenceAt ?? 0) > last.startedAt) out.push(p._id);
    }
    return out;
  },
});

export const snapshot = internalQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const project = (await ctx.db.get(projectId))!;
    const hypotheses = await ctx.db
      .query("hypotheses")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    const withQuotes = await Promise.all(
      hypotheses.map(async (h) => {
        const ev = await ctx.db
          .query("evidence")
          .withIndex("by_hypothesis", (q) => q.eq("hypothesisId", h._id))
          .collect();
        return {
          id: h._id,
          type: h.type,
          statement: h.statement,
          score: h.score,
          quotes: h.strength.quotes,
          sourceTypes: h.strength.sourceTypes,
          unknowns: h.unknowns,
          evidence: ev
            .sort((a, b) => b.weight * b.confidence - a.weight * a.confidence)
            .slice(0, 8)
            .map((e) => ({ id: e._id, quote: e.quote, speaker: e.speaker, stance: e.stance })),
        };
      }),
    );
    const openTasks = await ctx.db
      .query("tasks")
      .withIndex("by_project_status", (q) => q.eq("projectId", projectId).eq("status", "open"))
      .collect();
    const notes = await ctx.db
      .query("personaNotes")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .order("desc")
      .take(32);
    const quota = await ctx.db
      .query("quotaUsage")
      .withIndex("by_project_date", (q) => q.eq("projectId", projectId).eq("date", today()))
      .collect();
    return {
      project: { idea: project.ideaText, budgetUsd: project.budgetUsd, spentUsd: project.spentUsd },
      hypotheses: withQuotes,
      openTasks: openTasks.map((t) => ({
        team: t.team,
        title: t.title,
        hypothesisId: t.hypothesisId,
      })),
      personaNotes: notes.map((n) => ({
        persona: n.persona,
        hypothesisId: n.hypothesisId,
        verdict: n.verdict,
        note: n.note,
      })),
      quotaUsedToday: quota.map((q) => ({ channel: q.channel, count: q.count })),
    };
  },
});

// ── Chief of staff ────────────────────────────────────────────────────────

export const chiefTick = internalAction({
  args: {},
  handler: async (ctx) => {
    for (const projectId of await ctx.runQuery(internal.strategy.due, {
      agent: "Chief of staff",
    })) {
      const inputs = await ctx.runQuery(internal.strategy.snapshot, { projectId });
      await ctx.runAction(internal.agents.run, { projectId, agent: "chief", inputs });
    }
  },
});

export const onChief = internalMutation({
  args: {
    projectId: v.id("projects"),
    runId: v.id("agentRuns"),
    output: v.any(),
    context: v.any(),
  },
  handler: async (ctx, { projectId, output }) => {
    const out = output as Output<"chief">;
    const own = async (id: string | null) => {
      const h = id ? await ctx.db.get(id as Id<"hypotheses">).catch(() => null) : null;
      return h?.projectId === projectId ? h : null;
    };
    for (const t of out.tasks) {
      const h = await own(t.hypothesisId);
      const taskId = await ctx.db.insert("tasks", {
        projectId,
        team: t.team,
        title: t.title,
        hypothesisId: h?._id,
        priority: t.priority,
        budgetUsd: t.budgetUsd,
        status: "open",
        createdBy: "Chief of staff",
        createdAt: Date.now(),
      });
      const team = t.team[0].toUpperCase() + t.team.slice(1);
      await addEvent(ctx, projectId, "task.created", {
        message: `Chief of staff → ${team}: ${t.title}${t.budgetUsd ? ` ($${t.budgetUsd})` : ""}`,
        from: "Chief of staff",
        taskId,
      });
      if (t.team === "research")
        await ctx.scheduler.runAfter(0, internal.research.start, {
          projectId,
          focus: h ? [h._id] : undefined,
          taskId,
        });
      // A strategy task settles a debate: the judge re-reads both sides.
      if (t.team === "strategy" && h) {
        await ctx.scheduler.runAfter(0, internal.judge.rescore, { hypothesisId: h._id });
        await ctx.db.patch(taskId, { status: "done", claimedBy: "Hypothesis judge" });
      }
    }
    for (const id of out.needsInterviews) {
      const h = await own(id);
      if (!h) continue;
      await addEvent(ctx, projectId, "hypothesis.needs_interviews", {
        message: `Chief of staff → Grok Bot: prioritise interviews on "${short(h.statement)}"`,
        from: "Chief of staff",
        hypothesisId: h._id,
        question: h.nextQuestion ?? h.disproveIf,
      });
    }
    return `${out.tasks.length} tasks, ${out.needsInterviews.length} interview asks`;
  },
});

// ── Personas and report ──────────────────────────────────────────────────

export const personaTick = internalAction({
  args: { projectId: v.optional(v.id("projects")) },
  handler: async (ctx, { projectId }) => {
    const ids = projectId
      ? [projectId]
      : await ctx.runQuery(internal.strategy.due, { agent: "Persona analysts" });
    for (const id of ids) {
      const inputs = await ctx.runQuery(internal.strategy.snapshot, { projectId: id });
      await Promise.all(
        PERSONAS.map((p) =>
          ctx.runAction(internal.agents.run, {
            projectId: id,
            agent: "persona",
            inputs: { persona: p.name, question: p.question, ...inputs },
            context: { persona: p.name },
          }),
        ),
      );
    }
  },
});

export const runPersonasNow = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    await writableProject(ctx, projectId);
    await ctx.scheduler.runAfter(0, internal.strategy.personaTick, { projectId });
  },
});

export const onPersona = internalMutation({
  args: {
    projectId: v.id("projects"),
    runId: v.id("agentRuns"),
    output: v.any(),
    context: v.any(),
  },
  handler: async (ctx, { projectId, output, context }) => {
    const out = output as Output<"persona">;
    const persona = context.persona as string;
    let flagged = 0;
    for (const n of out.notes) {
      const h = await ctx.db.get(n.hypothesisId as Id<"hypotheses">).catch(() => null);
      if (!h || h.projectId !== projectId) continue;
      const evidenceIds: Id<"evidence">[] = [];
      for (const id of n.evidenceIds) {
        const e = await ctx.db.get(id as Id<"evidence">).catch(() => null);
        if (e?.projectId === projectId) evidenceIds.push(e._id);
      }
      await ctx.db.insert("personaNotes", {
        projectId,
        persona,
        hypothesisId: h._id,
        note: stripIds(n.note),
        verdict: n.verdict,
        evidenceIds,
        createdAt: Date.now(),
      });
      if (n.verdict === "weak") {
        flagged++;
        await addEvent(ctx, projectId, "persona.flagged", {
          message: `${persona} flags "${short(h.statement)}" as weak`,
          from: persona,
          hypothesisId: h._id,
        });
      }
    }
    // When all four personas have spoken this round, the synthesizer writes a new report.
    const recent = await ctx.db
      .query("personaNotes")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .order("desc")
      .take(40);
    const voices = new Set(
      recent.filter((n) => n.createdAt > Date.now() - 10 * MIN).map((n) => n.persona),
    );
    voices.add(persona);
    const lastReport = await ctx.db
      .query("reports")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .order("desc")
      .first();
    if (
      voices.size >= PERSONAS.length &&
      (!lastReport || lastReport.createdAt < Date.now() - 10 * MIN)
    )
      await ctx.scheduler.runAfter(0, internal.strategy.synthesize, { projectId });
    return `${out.notes.length} notes, ${flagged} flagged weak`;
  },
});

export const reportInputs = internalQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const lastReport = await ctx.db
      .query("reports")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .order("desc")
      .first();
    const sources = await ctx.db
      .query("sources")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    const marketSources = sources
      .filter(
        (s) =>
          s.sourceType === "report" || s.sourceType === "public data" || s.sourceType === "web",
      )
      .slice(-20)
      .map((s) => ({ id: s._id, title: s.title, url: s.url, excerpt: s.text.slice(0, 800) }));
    const events = await ctx.db
      .query("pageEvents")
      .withIndex("by_project_type", (q) => q.eq("projectId", projectId))
      .collect();
    const visitors = new Set(events.filter((e) => e.type === "pageview").map((e) => e.visitorId))
      .size;
    const signups = events.filter((e) => e.type === "signup").length;
    return {
      lastReport: lastReport && { version: lastReport.version, body: lastReport.body },
      marketSources,
      waitlist: { visitors, signups },
    };
  },
});

export const synthesize = internalAction({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const snap = await ctx.runQuery(internal.strategy.snapshot, { projectId });
    const extra = await ctx.runQuery(internal.strategy.reportInputs, { projectId });
    await ctx.runAction(internal.agents.run, {
      projectId,
      agent: "synthesizer",
      inputs: { ...snap, ...extra },
    });
  },
});

export const onReport = internalMutation({
  args: {
    projectId: v.id("projects"),
    runId: v.id("agentRuns"),
    output: v.any(),
    context: v.any(),
  },
  handler: async (ctx, { projectId, output }) => {
    const out = output as Output<"synthesizer">;
    const ownSource = async (id: string | null) => {
      const s = id ? await ctx.db.get(id as Id<"sources">).catch(() => null) : null;
      return s?.projectId === projectId ? s._id : undefined;
    };
    const lines = async (ls: Output<"synthesizer">["market"]["topDown"]) =>
      Promise.all(
        ls.map(async ({ sourceId, ...l }) => ({ ...l, sourceId: await ownSource(sourceId) })),
      );
    const last = await ctx.db
      .query("reports")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .order("desc")
      .first();
    const notes = await ctx.db
      .query("personaNotes")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .order("desc")
      .take(16);
    const version = (last?.version ?? 0) + 1;
    await ctx.db.insert("reports", {
      projectId,
      version,
      body: stripIds(out.body),
      whatChanged: stripIds(out.whatChanged),
      validated: out.validated,
      shaky: out.shaky,
      experiments: out.experiments,
      personaNotes: notes.map((n) => ({
        persona: n.persona,
        hypothesisId: n.hypothesisId,
        note: n.note,
        evidenceIds: n.evidenceIds,
      })),
      market: {
        topDown: await lines(out.market.topDown),
        bottomUp: await lines(out.market.bottomUp),
      },
      createdAt: Date.now(),
    });
    await addEvent(ctx, projectId, "report.published", {
      message: `Report synthesizer: report v${version} published`,
      from: "Report synthesizer",
    });
    return `Report v${version}`;
  },
});
