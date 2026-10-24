import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";
import type { Output } from "./agents";
import { addEvent, scoreOf, short, stripIds } from "./lib";

const THIN = 3; // fewer quotes than this asks for more research and interviews

/** Recompute a hypothesis score from its quotes, then ask the judge to pick the top quotes. */
export const rescore = internalMutation({
  args: { hypothesisId: v.id("hypotheses"), causeId: v.optional(v.id("evidence")) },
  handler: async (ctx, { hypothesisId, causeId }) => {
    const h = await ctx.db.get(hypothesisId);
    if (!h) return;
    const evidence = await ctx.db
      .query("evidence")
      .withIndex("by_hypothesis", (q) => q.eq("hypothesisId", hypothesisId))
      .collect();
    const score = scoreOf(evidence);
    const sourceTypes = new Set<string>();
    for (const e of evidence) {
      const s = await ctx.db.get(e.sourceId);
      if (s) sourceTypes.add(s.sourceType);
    }
    const changed = score !== h.score;
    await ctx.db.patch(hypothesisId, {
      score,
      strength: { quotes: evidence.length, sourceTypes: sourceTypes.size },
      scoreHistory: changed
        ? [...h.scoreHistory, { at: Date.now(), score, evidenceId: causeId }]
        : h.scoreHistory,
    });
    if (changed)
      await addEvent(ctx, h.projectId, "hypothesis.rescored", {
        message: `Hypothesis judge: "${short(h.statement)}" ${h.score}% → ${score}%`,
        from: "Hypothesis judge",
        hypothesisId,
      });

    if (evidence.length < THIN) {
      const open = await ctx.db
        .query("tasks")
        .withIndex("by_project_status", (q) => q.eq("projectId", h.projectId).eq("status", "open"))
        .collect();
      if (!open.some((t) => t.hypothesisId === hypothesisId)) {
        await ctx.db.insert("tasks", {
          projectId: h.projectId,
          team: "research",
          title: `Find more evidence: ${h.statement.slice(0, 80)}`,
          hypothesisId,
          priority: 4,
          budgetUsd: 1,
          status: "open",
          createdBy: "Hypothesis judge",
          createdAt: Date.now(),
        });
        await addEvent(ctx, h.projectId, "hypothesis.needs_interviews", {
          message: `Hypothesis judge → Grok Bot: needs interviews for "${short(h.statement)}"`,
          from: "Hypothesis judge",
          hypothesisId,
          question: h.nextQuestion ?? h.disproveIf,
        });
      }
    }

    if (!evidence.length) return;
    const quotes = await Promise.all(
      evidence
        .sort((a, b) => b.weight * b.confidence - a.weight * a.confidence)
        .slice(0, 30)
        .map(async (e) => ({
          id: e._id,
          quote: e.quote,
          speaker: e.speaker,
          stance: e.stance,
          sourceType: (await ctx.db.get(e.sourceId))?.sourceType,
          confidence: e.confidence,
        })),
    );
    await ctx.scheduler.runAfter(0, internal.agents.run, {
      projectId: h.projectId,
      agent: "judge",
      inputs: {
        hypothesis: { statement: h.statement, type: h.type, disproveIf: h.disproveIf },
        score,
        quotes,
      },
      context: { hypothesisId },
    });
  },
});

export const onJudge = internalMutation({
  args: {
    projectId: v.id("projects"),
    runId: v.id("agentRuns"),
    output: v.any(),
    context: v.any(),
  },
  handler: async (ctx, { output, context }) => {
    const out = output as Output<"judge">;
    const hypothesisId = context.hypothesisId as Id<"hypotheses">;
    // The judge may only cite this hypothesis's own quotes, on the matching side.
    const pick = async (id: string | null, stance: "supports" | "disproves") => {
      if (!id) return undefined;
      const e = await ctx.db.get(id as Id<"evidence">).catch(() => null);
      return e && e.hypothesisId === hypothesisId && e.stance === stance ? e._id : undefined;
    };
    const topSupportId = await pick(out.topSupportId, "supports");
    const topDisproveId = await pick(out.topDisproveId, "disproves");
    await ctx.db.patch(hypothesisId, {
      topSupportId,
      topSupportWhy: topSupportId ? (out.topSupportWhy ?? undefined) : undefined,
      topDisproveId,
      topDisproveWhy: topDisproveId ? (out.topDisproveWhy ?? undefined) : undefined,
      unknowns: stripIds(out.unknowns),
      nextQuestion: stripIds(out.nextQuestion),
      judgedAt: Date.now(),
    });
    return "Picked the strongest quotes";
  },
});
