import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type QueryCtx,
} from "./_generated/server";
import type { Output } from "./agents";
import { rag } from "./ai";
import { addEvent, quoteAppearsIn, SOURCE_WEIGHTS } from "./lib";
import { searchWeb } from "./tools";

export const source = internalQuery({
  args: { sourceId: v.id("sources") },
  handler: (ctx, { sourceId }) => ctx.db.get(sourceId),
});

export const setRagKey = internalMutation({
  args: { sourceId: v.id("sources"), ragKey: v.string() },
  handler: (ctx, { sourceId, ragKey }) => ctx.db.patch(sourceId, { ragKey }),
});

export type BriefAndHypotheses = Awaited<ReturnType<typeof loadBriefAndHypotheses>>;

export const briefAndHypotheses = internalQuery({
  args: { projectId: v.id("projects") },
  handler: (ctx, { projectId }) => loadBriefAndHypotheses(ctx, projectId),
});

async function loadBriefAndHypotheses(ctx: QueryCtx, projectId: Id<"projects">) {
  {
    const brief = await ctx.db
      .query("ideaBriefs")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .order("desc")
      .first();
    const hypotheses = await ctx.db
      .query("hypotheses")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    return {
      brief: brief && {
        problem: brief.problem,
        customer: brief.customer,
        solution: brief.solution,
        model: brief.model,
      },
      hypotheses: hypotheses.map((h) => ({
        id: h._id,
        type: h.type,
        statement: h.statement,
        disproveIf: h.disproveIf,
        score: h.score,
        quotes: h.strength.quotes,
      })),
    };
  }
}

/** Kick off a research round: planner → scouts → extractors → judge. */
export const start = internalAction({
  args: {
    projectId: v.id("projects"),
    focus: v.optional(v.array(v.id("hypotheses"))),
    taskId: v.optional(v.id("tasks")),
  },
  handler: async (ctx, { projectId, focus, taskId }) => {
    const data: BriefAndHypotheses = await ctx.runQuery(internal.research.briefAndHypotheses, {
      projectId,
    });
    if (!data.hypotheses.length) return;
    await ctx.runAction(internal.agents.run, {
      projectId,
      agent: "planner",
      inputs: { ...data, focusHypothesisIds: focus ?? [] },
      taskId,
    });
  },
});

export const onPlan = internalMutation({
  args: {
    projectId: v.id("projects"),
    runId: v.id("agentRuns"),
    output: v.any(),
    context: v.any(),
  },
  handler: async (ctx, { projectId, output }) => {
    const plan = output as Output<"planner">;
    await addEvent(ctx, projectId, "research.planned", {
      message: `Query planner → Scouts: ${plan.searches.length} searches`,
      from: "Query planner",
    });
    await ctx.scheduler.runAfter(0, internal.agents.run, {
      projectId,
      agent: "scout",
      inputs: { searches: plan.searches, competitors: plan.competitors },
    });
    return `Planned ${plan.searches.length} searches`;
  },
});

/** Scouts without Creao: run each planned search through the guarded tool layer. */
export const scoutLocal = internalAction({
  args: { projectId: v.id("projects"), runId: v.id("agentRuns"), inputs: v.any() },
  handler: async (ctx, { projectId, runId, inputs }) => {
    const searches = (inputs.searches ?? []) as Output<"planner">["searches"];
    let fetched = 0;
    let skipped = 0;
    // A few at a time, so one slow site does not hold up the round.
    for (let i = 0; i < searches.length; i += 4) {
      const results = await Promise.all(
        searches.slice(i, i + 4).map((s) =>
          searchWeb(ctx, {
            projectId,
            agentRunId: runId,
            agent: "Scouts",
            query: s.query,
            kind: s.kind,
          }).catch((e) => {
            console.warn("search failed", s.query, e);
            return { sources: [], skipped: 1 };
          }),
        ),
      );
      for (const r of results) {
        fetched += r.sources.length;
        skipped += r.skipped;
      }
    }
    await ctx.runMutation(internal.agents.finish, {
      runId,
      output: {
        fetched,
        skipped,
        memory: `Last round: ${fetched} sources fetched, ${skipped} skipped.`,
      },
      costUsd: 0, // tool costs are already counted by the guard
    });
  },
});

export const onScout = internalMutation({
  args: {
    projectId: v.id("projects"),
    runId: v.id("agentRuns"),
    output: v.any(),
    context: v.any(),
  },
  handler: async (ctx, { projectId, output }) => {
    const { fetched, skipped } = output as Output<"scout">;
    await addEvent(ctx, projectId, "evidence.fetched", {
      message: `Scouts → Extractors: ${fetched} sources fetched${skipped ? `, ${skipped} skipped` : ""}`,
      from: "Scouts",
    });
    await ctx.scheduler.runAfter(5000, internal.research.extractAll, { projectId, attempt: 1 });
    return `${fetched} sources, ${skipped} skipped`;
  },
});

export const pendingSources = internalQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const all = await ctx.db
      .query("sources")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    return all.filter((s) => !s.extractedAt);
  },
});

export const markExtracted = internalMutation({
  args: { sourceIds: v.array(v.id("sources")) },
  handler: async (ctx, { sourceIds }) => {
    for (const id of sourceIds) await ctx.db.patch(id, { extractedAt: Date.now() });
  },
});

/** Once new sources are embedded, run one extractor per hypothesis over the chunks RAG finds for it. */
export const extractAll = internalAction({
  args: { projectId: v.id("projects"), attempt: v.number() },
  handler: async (ctx, { projectId, attempt }) => {
    const pending: Doc<"sources">[] = await ctx.runQuery(internal.research.pendingSources, {
      projectId,
    });
    if (!pending.length) return;
    if (pending.some((s) => !s.ragKey) && attempt < 6) {
      await ctx.scheduler.runAfter(10_000, internal.research.extractAll, {
        projectId,
        attempt: attempt + 1,
      });
      return;
    }
    await ctx.runMutation(internal.research.markExtracted, {
      sourceIds: pending.map((s) => s._id),
    });
    const { brief, hypotheses }: BriefAndHypotheses = await ctx.runQuery(
      internal.research.briefAndHypotheses,
      { projectId },
    );
    const pendingIds = new Set<string>(pending.map((s) => s._id));
    const byId = new Map(pending.map((s) => [s._id as string, s]));

    await Promise.all(
      hypotheses.map(async (h) => {
        let chunks: { sourceId: string; sourceType: string; url: string; text: string }[];
        try {
          const { results, entries } = await rag.search(ctx, {
            namespace: projectId,
            query: `${h.statement} ${h.disproveIf}`,
            // wide search: most top hits are older, already-extracted sources that get filtered out below
            limit: 40,
            chunkContext: { before: 1, after: 1 },
          });
          const keyOf = new Map(entries.map((e) => [e.entryId, e.key]));
          chunks = results
            .map((r) => ({
              key: keyOf.get(r.entryId),
              text: r.content.map((c) => c.text).join("\n"),
            }))
            .filter((c) => c.key && pendingIds.has(c.key))
            .map((c) => {
              const s = byId.get(c.key!)!;
              return { sourceId: s._id, sourceType: s.sourceType, url: s.url, text: c.text };
            })
            .slice(0, 12);
        } catch (e) {
          // shortcut: without embeddings, fall back to the start of each new source
          console.warn("RAG search failed", e);
          chunks = pending.map((s) => ({
            sourceId: s._id,
            sourceType: s.sourceType,
            url: s.url,
            text: s.text.slice(0, 3000),
          }));
        }
        if (!chunks.length) return;
        await ctx.runAction(internal.agents.run, {
          projectId,
          agent: "extractor",
          inputs: { targetCustomer: brief?.customer, hypothesis: h, chunks },
          context: { hypothesisId: h.id },
        });
      }),
    );
  },
});

/** Store a quote only if it appears in the fetched text; otherwise reject it. */
export async function insertEvidence(
  ctx: { db: import("./_generated/server").MutationCtx["db"] },
  projectId: Id<"projects">,
  item: {
    sourceId: string;
    hypothesisId: string;
    quote: string;
    speaker: string;
    stance: "supports" | "disproves";
    confidence: number;
  },
): Promise<Id<"evidence"> | null> {
  const src = await ctx.db.get(item.sourceId as Id<"sources">).catch(() => null);
  const hyp = await ctx.db.get(item.hypothesisId as Id<"hypotheses">).catch(() => null);
  if (!src || !hyp || src.projectId !== projectId || hyp.projectId !== projectId) return null;
  if (item.confidence < 0.4) return null; // weak, tangential matches would move scores for no reason
  if (!quoteAppearsIn(item.quote, src.text)) return null;
  const dupes = await ctx.db
    .query("evidence")
    .withIndex("by_source", (q) => q.eq("sourceId", src._id))
    .collect();
  if (dupes.some((d) => d.hypothesisId === hyp._id && d.quote === item.quote)) return null;
  return ctx.db.insert("evidence", {
    projectId,
    hypothesisId: hyp._id,
    sourceId: src._id,
    quote: item.quote.slice(0, 300),
    speaker: item.speaker,
    stance: item.stance,
    confidence: Math.min(1, Math.max(0, item.confidence)),
    weight: SOURCE_WEIGHTS[(src as Doc<"sources">).sourceType],
    createdAt: Date.now(),
  });
}

export const onExtract = internalMutation({
  args: {
    projectId: v.id("projects"),
    runId: v.id("agentRuns"),
    output: v.any(),
    context: v.any(),
  },
  handler: async (ctx, { projectId, output }) => {
    const { items, contacts } = output as Output<"extractor">;
    const project = (await ctx.db.get(projectId))!;
    const touched = new Map<Id<"hypotheses">, Id<"evidence">>();
    let rejected = 0;
    for (const item of items) {
      const id = await insertEvidence(ctx, projectId, item);
      if (id) touched.set(item.hypothesisId as Id<"hypotheses">, id);
      else rejected++;
    }

    let newContacts = 0;
    const existing = await ctx.db
      .query("contacts")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    for (const c of contacts) {
      if (existing.some((e) => e.name === c.name && (e.company ?? "") === (c.company ?? "")))
        continue;
      const contactId = await ctx.db.insert("contacts", {
        projectId,
        name: c.name,
        role: c.role,
        company: c.company,
        email: c.email,
        linkedinUrl: c.linkedinUrl,
        origin: "scout",
        status: project.coldOutreach ? "queued" : "found",
        fitScore: c.fitScore,
        fitReason: c.fitReason,
        createdAt: Date.now(),
      });
      newContacts++;
      // Scraped people are only contacted while cold outreach is on.
      if (project.coldOutreach)
        await addEvent(ctx, projectId, "contacts.queued", {
          message: `Scouts → Grok Bot: queued ${c.name}`,
          from: "Scouts",
          contactIds: [contactId],
        });
    }

    for (const [hypothesisId, evidenceId] of touched)
      await ctx.scheduler.runAfter(0, internal.judge.rescore, {
        hypothesisId,
        causeId: evidenceId,
      });
    if (touched.size) await ctx.db.patch(projectId, { lastEvidenceAt: Date.now() });
    const added = items.length - rejected;
    await addEvent(ctx, projectId, "hypothesis.changed", {
      message: `Extractors → Judge: ${added} quotes added${rejected ? `, ${rejected} rejected (not found in source)` : ""}${newContacts ? `, ${newContacts} people found` : ""}`,
      from: "Evidence extractors",
    });
    return `${added} quotes, ${rejected} rejected`;
  },
});

/** Extract quotes from one source (a waitlist answer or a reply) for the matching hypothesis types. */
export const extractSource = internalAction({
  args: { projectId: v.id("projects"), sourceId: v.id("sources"), types: v.array(v.string()) },
  handler: async (ctx, { projectId, sourceId, types }) => {
    const s: Doc<"sources"> | null = await ctx.runQuery(internal.research.source, { sourceId });
    if (!s) return;
    const { brief, hypotheses }: BriefAndHypotheses = await ctx.runQuery(
      internal.research.briefAndHypotheses,
      { projectId },
    );
    const chunk = {
      sourceId: s._id,
      sourceType: s.sourceType,
      url: s.url,
      text: s.text.slice(0, 6000),
    };
    await Promise.all(
      hypotheses
        .filter((h) => !types.length || types.includes(h.type))
        .map((h) =>
          ctx.runAction(internal.agents.run, {
            projectId,
            agent: "extractor",
            inputs: { targetCustomer: brief?.customer, hypothesis: h, chunks: [chunk] },
            context: { hypothesisId: h.id },
          }),
        ),
    );
  },
});

/** A new hypothesis: score it against everything already collected, then search for what is missing. */
export const cover = internalAction({
  args: { projectId: v.id("projects"), hypothesisId: v.id("hypotheses") },
  handler: async (ctx, { projectId, hypothesisId }) => {
    const { brief, hypotheses }: BriefAndHypotheses = await ctx.runQuery(
      internal.research.briefAndHypotheses,
      { projectId },
    );
    const h = hypotheses.find((x) => x.id === hypothesisId);
    if (!h) return;
    const { results, entries } = await rag
      .search(ctx, {
        namespace: projectId,
        query: `${h.statement} ${h.disproveIf}`,
        limit: 10,
        chunkContext: { before: 1, after: 1 },
      })
      .catch(() => ({ results: [], entries: [] }));
    const entryById = new Map(entries.map((e) => [e.entryId, e]));
    const chunks = results.flatMap((r) => {
      const e = entryById.get(r.entryId);
      return e?.key
        ? [
            {
              sourceId: e.key,
              sourceType: e.filterValues.find((f) => f.name === "sourceType")?.value,
              url: e.title,
              text: r.content.map((c) => c.text).join("\n"),
            },
          ]
        : [];
    });
    if (chunks.length)
      await ctx.runAction(internal.agents.run, {
        projectId,
        agent: "extractor",
        inputs: { targetCustomer: brief?.customer, hypothesis: h, chunks },
        context: { hypothesisId },
      });
    await ctx.runAction(internal.research.start, { projectId, focus: [hypothesisId] });
  },
});
