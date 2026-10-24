import { v } from "convex/values";
import { z } from "zod";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import type { FunctionReference } from "convex/server";
import { askClaude, GUARDRAIL } from "./ai";
import { vTeam } from "./schema";

const memory = z
  .string()
  .describe("Short notes for your next run: what worked, what to avoid. Max 600 chars.");

export const schemas = {
  planner: z.object({
    searches: z
      .array(
        z.object({
          hypothesisId: z.string(),
          query: z.string(),
          kind: z.enum(["forum", "web", "public data"]),
        }),
      )
      .max(12),
    competitors: z.array(z.string()).max(6),
    memory,
  }),
  scout: z.object({ fetched: z.number(), skipped: z.number(), memory }),
  extractor: z.object({
    items: z
      .array(
        z.object({
          sourceId: z.string(),
          hypothesisId: z.string(),
          quote: z.string().max(300).describe("Copied word for word from the source text"),
          speaker: z
            .string()
            .describe(
              'Who said it, e.g. "r/startups commenter, 212 upvotes" or "Gartner press release"',
            ),
          stance: z.enum(["supports", "disproves"]),
          confidence: z.number().min(0).max(1),
        }),
      )
      .max(12),
    contacts: z
      .array(
        z.object({
          name: z.string(),
          role: z.string().optional(),
          company: z.string().optional(),
          email: z.string().optional().describe("Only a work email printed on a public page"),
          linkedinUrl: z.string().optional(),
          fitScore: z.number().min(0).max(100),
          fitReason: z.string(),
        }),
      )
      .max(5)
      .describe(
        "Public professional info only. Never home addresses, phone numbers or sensitive categories.",
      ),
    memory,
  }),
  judge: z.object({
    topSupportId: z.string().nullable(),
    topSupportWhy: z.string().nullable(),
    topDisproveId: z.string().nullable(),
    topDisproveWhy: z.string().nullable(),
    unknowns: z
      .string()
      .describe('What we still do not know, e.g. "No interviewee has mentioned price yet."'),
    nextQuestion: z.string().describe("The next question to ask in interviews"),
    memory,
  }),
  persona: z.object({
    notes: z
      .array(
        z.object({
          hypothesisId: z.string(),
          verdict: z.enum(["strong", "weak", "unclear"]),
          note: z.string().max(400),
          evidenceIds: z
            .array(z.string())
            .describe("Evidence ids you cite. No citation, no claim."),
        }),
      )
      .max(8),
    memory,
  }),
  synthesizer: z.object({
    body: z.string().describe("The report in plain markdown, under 400 words"),
    whatChanged: z.string().describe("What changed since the last report and why, citing quotes"),
    validated: z.array(z.string()).max(5),
    shaky: z.array(z.string()).max(5),
    experiments: z.array(z.string()).length(3),
    market: z.object({
      topDown: z.array(
        z.object({
          label: z.string(),
          value: z.number(),
          unit: z.enum(["usd", "count", "ratio"]),
          note: z.string(),
          sourceId: z.string().nullable(),
        }),
      ),
      bottomUp: z.array(
        z.object({
          label: z.string(),
          value: z.number(),
          unit: z.enum(["usd", "count", "ratio"]),
          note: z.string(),
          sourceId: z.string().nullable(),
        }),
      ),
    }),
    memory,
  }),
  chief: z.object({
    tasks: z
      .array(
        z.object({
          team: z.enum(["research", "strategy", "growth", "operations"]),
          title: z.string(),
          hypothesisId: z.string().nullable(),
          priority: z.number().min(1).max(5),
          budgetUsd: z.number().min(0),
        }),
      )
      .max(4),
    needsInterviews: z
      .array(z.string())
      .max(3)
      .describe("At most 3 hypothesis ids that most need interviews"),
    memory,
  }),
  landing: z.object({
    html: z.string().describe("A complete static index.html"),
    memory,
  }),
  meeting: z.object({
    items: z
      .array(
        z.object({
          hypothesisId: z.string(),
          quote: z
            .string()
            .max(300)
            .describe("The interviewee's own words, copied exactly from the transcript"),
          stance: z.enum(["supports", "disproves"]),
          confidence: z.number().min(0).max(1),
        }),
      )
      .max(12),
    summary: z.string().describe("Three sentences"),
    personalLine: z.string().describe("One specific thing they said, for the thank-you email"),
    memory,
  }),
};
export type AgentKey = keyof typeof schemas;
export type Output<K extends AgentKey> = z.infer<(typeof schemas)[K]>;

type Handler = FunctionReference<
  "mutation",
  "internal",
  { projectId: Id<"projects">; runId: Id<"agentRuns">; output: any; context: any },
  string
>;

type AgentDef = {
  name: string;
  team: "lead" | "research" | "strategy" | "growth" | "operations";
  creaoEnv?: string;
  prompt: string;
  onResult: Handler;
  // Convex code that does the work when Creao is not configured, instead of Claude
  local?: FunctionReference<
    "action",
    "internal",
    { projectId: Id<"projects">; runId: Id<"agentRuns">; inputs: any }
  >;
};

export const AGENTS: Record<AgentKey, AgentDef> = {
  planner: {
    name: "Query planner",
    team: "research",
    creaoEnv: "CREAO_APP_QUERY_PLANNER",
    prompt:
      'You turn startup hypotheses into searches. For each hypothesis, plan 1-2 searches that would find people talking about it in their own words (kind "forum": plain keywords searched across Hacker News comments, no site: operators) or public numbers (kind "web" or "public data": government data, press releases, public summaries of market reports). Prefer searches likely to find evidence AGAINST the hypothesis too. Give focus hypotheses more searches.',
    onResult: internal.research.onPlan,
  },
  scout: {
    name: "Scouts",
    team: "research",
    // Scouts fetch in Convex: the guard layer has to see every request, and a Creao scout
    // without an HTTP tool reported sources it never fetched.
    prompt:
      "You fetch public pages for each search using the FounderHub tools: search_web, then scrape_page or run_actor on the best 2 results. Public pages only; never log in, never fetch paywalled content. Report how many sources you fetched and skipped.",
    onResult: internal.research.onScout,
    local: internal.research.scoutLocal,
  },
  extractor: {
    name: "Evidence extractors",
    team: "research",
    creaoEnv: "CREAO_APP_EXTRACTOR",
    prompt:
      "You pull short quotes from source text that support or disprove a hypothesis. Copy quotes word for word from the given text; never paraphrase or invent. Only include a quote if it directly supports or contradicts this hypothesis as stated; a quote about a neighbouring topic does not count. If unsure, leave it out. Confidence reflects how directly the quote bears on the hypothesis. Also list up to 5 people who match the target customer, with public professional info only.",
    onResult: internal.research.onExtract,
  },
  judge: {
    name: "Hypothesis judge",
    team: "strategy",
    prompt:
      "You judge one startup hypothesis using only the quotes given. Pick the single most convincing supporting quote and the single most convincing disproving quote by id (null if none) and write one line on why each matters. Then say what is still unknown and the next interview question. Every claim must cite a quote; no quote, no claim. In the text fields refer to quotes by their words or speaker, never by id.",
    onResult: internal.judge.onJudge,
  },
  persona: {
    name: "Persona analysts",
    team: "strategy",
    creaoEnv: "CREAO_APP_PERSONA",
    prompt:
      "You are one persona analyst challenging a startup's hypotheses. Stay in character. Rate each hypothesis strong, weak or unclear from your viewpoint and cite evidence ids for every claim in evidenceIds; in the note itself refer to quotes by their words or speaker, never by id. Flag a hypothesis as weak when its evidence is thin or comes from a single kind of source.",
    onResult: internal.strategy.onPersona,
  },
  synthesizer: {
    name: "Report synthesizer",
    team: "strategy",
    creaoEnv: "CREAO_APP_SYNTHESIZER",
    prompt:
      "You merge hypothesis scores, persona critiques and sources into a short founder report: what is validated, what is shaky, the next three experiments, and what changed since the last report. Refer to quotes by their words or speaker, never by id. Also size the market two ways, citing source ids for each number: top-down (total market -> segment share -> reachable share) and bottom-up (number of target customers x expected yearly price). Use only numbers present in the sources or evidence; if a number is missing, say so in its note and use your best clearly-labelled estimate. In each method list lines in order: the first usd line is the TAM and the last usd line is the SAM. Do not compute SOM; FounderHub derives it from the observed waitlist conversion.",
    onResult: internal.strategy.onReport,
  },
  chief: {
    name: "Chief of staff",
    team: "lead",
    creaoEnv: "CREAO_APP_CHIEF_OF_STAFF",
    prompt:
      "You are chief of staff for a one-founder startup. Read hypothesis scores, quote counts, persona flags, open tasks and spend. Create at most 4 new tasks, steering budget toward the hypotheses with the fewest quotes or a weak persona flag. Research tasks fetch more evidence; growth tasks prioritise interviews. When two personas disagree, open a strategy task to settle it. List hypotheses that need interviews.",
    onResult: internal.strategy.onChief,
  },
  landing: {
    name: "Landing-page builder",
    team: "growth",
    creaoEnv: "CREAO_APP_LANDING_BUILDER",
    prompt:
      'You write one static landing page (a single index.html with inline CSS, no external scripts) for a startup idea, aimed at its target customer. Plain, specific copy; one clear headline; no fake testimonials, logos or numbers. Include exactly one form with id="waitlist" containing inputs named email (required), role, company_size (a select: Just me, 2-10, 11-50, 51-200, 200+) and use_case (a textarea, "What would you use this for?"), and a submit button. Do not add any script; FounderHub injects the form handler.',
    onResult: internal.landing.onBuilt,
  },
  meeting: {
    name: "Meeting analyzer",
    team: "operations",
    prompt:
      "You analyse a customer interview transcript. Pull the interviewee's own words that support or disprove each hypothesis, copied exactly. Ignore the founder's lines. Then write a three-sentence summary and one specific, warm line for the thank-you email.",
    onResult: internal.meetings.onAnalyzed,
  },
};

const CREAO_RUN_COST_USD = 0.05; // shortcut: flat estimate per Creao run, replace once Creao reports credits per run

/** Start one agent run. Skips (returns null) when the project is paused or over budget. */
export const run = internalAction({
  args: {
    projectId: v.id("projects"),
    agent: v.string(),
    inputs: v.any(),
    // small ids the result handler needs (hypothesisId, meetingId, persona), kept on the run
    context: v.optional(v.any()),
    taskId: v.optional(v.id("tasks")),
  },
  handler: async (
    ctx,
    { projectId, agent, inputs, context, taskId },
  ): Promise<Id<"agentRuns"> | null> => {
    const key = agent as AgentKey;
    const def = AGENTS[key];
    const creaoApp = def.creaoEnv ? process.env[def.creaoEnv] : undefined;
    const backend =
      creaoApp && process.env.CREAO_API_KEY ? "creao" : def.local ? "convex" : "claude";
    const started: { runId: Id<"agentRuns">; memory: string } | null = await ctx.runMutation(
      internal.agents.start,
      {
        projectId,
        agent: def.name,
        team: def.team,
        key,
        backend,
        taskId,
        context,
      },
    );
    if (!started) return null;
    const { runId, memory: notes } = started;
    const fullInputs = { ...inputs, memory: notes };

    if (backend === "creao") {
      const site = process.env.CONVEX_SITE_URL;
      try {
        const res = await fetch(`https://agent.creao.ai/api/v1/apps/${creaoApp}/runs`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.CREAO_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: {
              instructions: `${def.prompt}\n\n${GUARDRAIL}\n\nAnswer with only a JSON object matching this JSON schema:\n${JSON.stringify(z.toJSONSchema(schemas[key]))}`,
              toolsBaseUrl: `${site}/tools`,
              toolsToken: process.env.CREAO_WEBHOOK_SECRET,
              projectId,
              runId,
              data: JSON.stringify(fullInputs),
            },
            webhookUrl: `${site}/creao/webhook?run=${runId}&secret=${process.env.CREAO_WEBHOOK_SECRET}`,
          }),
        });
        if (!res.ok) throw new Error(`Creao ${res.status}: ${(await res.text()).slice(0, 200)}`);
        const { id } = (await res.json()) as { id: string };
        await ctx.runMutation(internal.agents.setCreaoRun, {
          runId,
          creaoRunId: id,
          inputs: fullInputs,
        });
        // Webhooks are best-effort, so poll as a fallback.
        await ctx.scheduler.runAfter(90_000, internal.agents.pollCreao, { runId, attempt: 1 });
        return runId;
      } catch (e) {
        // Creao unavailable: fall through to the local path so the demo keeps moving.
        console.warn(`Creao failed for ${def.name}, falling back`, e);
        await ctx.runMutation(internal.agents.setBackend, {
          runId,
          backend: def.local ? "convex" : "claude",
        });
      }
    }

    try {
      if (def.local) {
        await ctx.runAction(def.local, { projectId, runId, inputs: fullInputs });
        return runId;
      }
      const { object, costUsd } = await askClaude(
        `${def.prompt}\n\n${GUARDRAIL}`,
        JSON.stringify(fullInputs),
        schemas[key] as z.ZodType<unknown>,
      );
      await ctx.runMutation(internal.agents.finish, { runId, output: object, costUsd });
    } catch (e) {
      await ctx.runMutation(internal.agents.fail, { runId, error: String(e).slice(0, 500) });
    }
    return runId;
  },
});

export const start = internalMutation({
  args: {
    projectId: v.id("projects"),
    agent: v.string(),
    key: v.string(),
    team: vTeam,
    backend: v.union(v.literal("creao"), v.literal("claude"), v.literal("convex")),
    taskId: v.optional(v.id("tasks")),
    context: v.optional(v.any()),
  },
  handler: async (ctx, a) => {
    const project = await ctx.db.get(a.projectId);
    if (!project || project.status === "paused") return null;
    if (project.spentUsd >= project.budgetUsd) {
      await ctx.db.patch(a.projectId, {
        status: "paused",
        pauseReason: "Budget reached. Raise it to continue.",
      });
      return null;
    }
    const mem = await ctx.db
      .query("agentMemory")
      .withIndex("by_project_agent", (q) => q.eq("projectId", a.projectId).eq("agent", a.key))
      .unique();
    const runId = await ctx.db.insert("agentRuns", {
      projectId: a.projectId,
      agent: a.agent,
      team: a.team,
      taskId: a.taskId,
      context: a.context,
      backend: a.backend,
      status: "running",
      costUsd: 0,
      startedAt: Date.now(),
    });
    if (a.taskId) await ctx.db.patch(a.taskId, { status: "claimed", claimedBy: a.agent });
    return { runId, memory: mem?.notes ?? "" };
  },
});

export const setCreaoRun = internalMutation({
  args: { runId: v.id("agentRuns"), creaoRunId: v.string(), inputs: v.any() },
  handler: (ctx, { runId, creaoRunId, inputs }) => ctx.db.patch(runId, { creaoRunId, inputs }),
});

export const setBackend = internalMutation({
  args: { runId: v.id("agentRuns"), backend: v.union(v.literal("claude"), v.literal("convex")) },
  handler: (ctx, { runId, backend }) => ctx.db.patch(runId, { backend }),
});

export const inputsFor = internalQuery({
  args: { runId: v.id("agentRuns") },
  handler: async (ctx, { runId }) => ctx.db.get(runId),
});

/** Validate an agent's output, hand it to the agent's handler, then close the run. */
export const finish = internalMutation({
  args: { runId: v.id("agentRuns"), output: v.any(), costUsd: v.number() },
  handler: async (ctx, { runId, output, costUsd }) => {
    const run = await ctx.db.get(runId);
    if (!run || run.status !== "running") return; // Creao delivers at least once
    const key = (Object.keys(AGENTS) as AgentKey[]).find((k) => AGENTS[k].name === run.agent)!;
    const parsed = schemas[key].safeParse(output);
    if (!parsed.success) {
      await ctx.db.patch(runId, {
        status: "failed",
        error: `Output did not match the schema: ${parsed.error.message.slice(0, 300)}`,
        costUsd,
        finishedAt: Date.now(),
      });
      return;
    }
    const summary: string = await ctx.runMutation(AGENTS[key].onResult, {
      projectId: run.projectId,
      runId,
      output: parsed.data,
      context: run.context ?? null,
    });
    await ctx.db.patch(runId, { status: "done", summary, costUsd, finishedAt: Date.now() });
    if (run.taskId) await ctx.db.patch(run.taskId, { status: "done" });
    const project = await ctx.db.get(run.projectId);
    if (project) await ctx.db.patch(run.projectId, { spentUsd: project.spentUsd + costUsd });

    const mem = await ctx.db
      .query("agentMemory")
      .withIndex("by_project_agent", (q) => q.eq("projectId", run.projectId).eq("agent", key))
      .unique();
    const notes = (parsed.data as { memory: string }).memory.slice(0, 600);
    if (mem) await ctx.db.patch(mem._id, { notes, updatedAt: Date.now() });
    else
      await ctx.db.insert("agentMemory", {
        agent: key,
        projectId: run.projectId,
        notes,
        updatedAt: Date.now(),
      });
  },
});

export const fail = internalMutation({
  args: { runId: v.id("agentRuns"), error: v.string() },
  handler: async (ctx, { runId, error }) => {
    const run = await ctx.db.get(runId);
    if (run?.status === "running")
      await ctx.db.patch(runId, { status: "failed", error, finishedAt: Date.now() });
  },
});

/** Pull the JSON object out of a Creao text answer (it may be wrapped in prose or a code fence). */
export function parseJsonAnswer(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("No JSON object in the agent's answer");
  return JSON.parse(text.slice(start, end + 1));
}

// Creao puts the agent's final answer in result.text or result.chatText depending on the app,
// so try each and keep the first that matches the agent's schema.
export const completeFromCreao = internalAction({
  args: { runId: v.id("agentRuns"), status: v.string(), texts: v.array(v.string()) },
  handler: async (ctx, { runId, status, texts }) => {
    if (status !== "completed" || !texts.length) {
      await ctx.runMutation(internal.agents.fail, { runId, error: `Creao run ${status}` });
      return;
    }
    const run = await ctx.runQuery(internal.agents.inputsFor, { runId });
    const key = (Object.keys(AGENTS) as AgentKey[]).find((k) => AGENTS[k].name === run?.agent);
    const parsed = texts.flatMap((t) => {
      try {
        return [parseJsonAnswer(t)];
      } catch {
        return [];
      }
    });
    const output = parsed.find((o) => key && schemas[key].safeParse(o).success);
    if (output === undefined) {
      // The Creao app answered in its own format: redo this run on Claude with the same prompt and inputs.
      if (!key || !run?.inputs) {
        await ctx.runMutation(internal.agents.fail, {
          runId,
          error: "Creao answer did not match the schema",
        });
        return;
      }
      await ctx.runMutation(internal.agents.setBackend, { runId, backend: "claude" });
      try {
        const { object, costUsd } = await askClaude(
          `${AGENTS[key].prompt}\n\n${GUARDRAIL}`,
          JSON.stringify(run.inputs),
          schemas[key] as z.ZodType<unknown>,
        );
        await ctx.runMutation(internal.agents.finish, {
          runId,
          output: object,
          costUsd: costUsd + CREAO_RUN_COST_USD,
        });
      } catch (e) {
        await ctx.runMutation(internal.agents.fail, { runId, error: String(e).slice(0, 500) });
      }
      return;
    }
    await ctx.runMutation(internal.agents.finish, { runId, output, costUsd: CREAO_RUN_COST_USD });
  },
});

export const pollCreao = internalAction({
  args: { runId: v.id("agentRuns"), attempt: v.number() },
  handler: async (ctx, { runId, attempt }) => {
    const run = await ctx.runQuery(internal.agents.inputsFor, { runId });
    if (!run || run.status !== "running" || !run.creaoRunId) return;
    const key = (Object.keys(AGENTS) as AgentKey[]).find((k) => AGENTS[k].name === run.agent)!;
    const app = process.env[AGENTS[key].creaoEnv!];
    const res = await fetch(`https://agent.creao.ai/api/v1/apps/${app}/runs/${run.creaoRunId}`, {
      headers: { Authorization: `Bearer ${process.env.CREAO_API_KEY}` },
    });
    const body = res.ok
      ? ((await res.json()) as { status: string; result?: { text?: string; chatText?: string } })
      : { status: "pending" };
    if (["completed", "failed", "cancelled"].includes(body.status)) {
      await ctx.runAction(internal.agents.completeFromCreao, {
        runId,
        status: body.status,
        texts: [body.result?.text, body.result?.chatText].filter((t): t is string => !!t),
      });
    } else if (attempt < 10) {
      await ctx.scheduler.runAfter(60_000, internal.agents.pollCreao, {
        runId,
        attempt: attempt + 1,
      });
    } else {
      await ctx.runMutation(internal.agents.fail, { runId, error: "Creao run timed out" });
    }
  },
});
