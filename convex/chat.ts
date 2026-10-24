import {
  Agent,
  createTool,
  listUIMessages,
  stepCountIs,
  syncStreams,
  vStreamArgs,
} from "@convex-dev/agent";
import { hasToolCall } from "ai";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { z } from "zod";
import { components, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalAction, mutation, query } from "./_generated/server";
import { claude } from "./ai";
import {
  addEvent,
  DEFAULT_CAPS,
  readableProject,
  requireUser,
  slugify,
  writableProject,
} from "./lib";

type BriefArgs = {
  threadId: string;
  problem: string;
  customer: string;
  solution: string;
  model: string;
  hypotheses: { type: Doc<"hypotheses">["type"]; statement: string; disproveIf: string }[];
};

const submitBrief = createTool({
  description:
    "Save the Idea Brief and 5-8 testable hypotheses once you know who it is for, what they do today, what they would pay, and why now.",
  inputSchema: z.object({
    problem: z.string(),
    customer: z
      .string()
      .describe("The target customer, specific enough to find on Reddit or LinkedIn"),
    solution: z.string(),
    model: z.string().describe("Business model and price"),
    hypotheses: z
      .array(
        z.object({
          type: z.enum([
            "problem",
            "customer",
            "willingness to pay",
            "channel",
            "competition",
            "market size",
          ]),
          statement: z.string(),
          disproveIf: z
            .string()
            .describe(
              'What evidence would disprove it, e.g. "Fewer than 1 in 10 interviewees spend 2+ hours a week on X"',
            ),
        }),
      )
      .min(5)
      .max(8),
  }),
  execute: async (ctx, input): Promise<string> => {
    const { problem, customer, solution, model, hypotheses } = input;
    const args: BriefArgs = {
      threadId: ctx.threadId!,
      problem,
      customer,
      solution,
      model,
      hypotheses,
    };
    await ctx.runMutation(internal.projects.saveBrief, args);
    return "Saved. The brief is shown beside the chat, so reply with one sentence asking the founder to check it and press Approve and start research.";
  },
});

const FIELD = z.enum(["problem", "customer", "solution"]);

const askChoice = createTool({
  description:
    "Show the founder a multiple-choice question about one part of the idea. They can pick several options and add their own answer.",
  inputSchema: z.object({
    field: FIELD,
    question: z.string().describe("Short question, under 12 words"),
    options: z
      .array(
        z.object({
          label: z.string().describe("Under 8 words"),
          detail: z.string().describe("One plain sentence that makes the option concrete"),
        }),
      )
      .min(3)
      .max(4),
  }),
  execute: async (): Promise<string> =>
    "The options are on screen. The founder's pick arrives as the next message.",
});

const confirmPoint = createTool({
  description:
    "Save one part of the idea as a single sentence that combines everything the founder picked or wrote for it.",
  inputSchema: z.object({
    field: FIELD,
    text: z.string().describe("One plain sentence"),
  }),
  execute: async (ctx, { field, text }): Promise<string> => {
    await ctx.runMutation(internal.projects.confirmPoint, { threadId: ctx.threadId!, field, text });
    return `Saved the ${field}.`;
  },
});

// Structure follows Anthropic's prompting guidance: say why, separate sections with XML tags,
// state the format positively, and show an example of good options.
const IDEA_PROMPT = `<role>
You are FounderHub's idea coach. You help a student founder turn a one-line startup idea into a clear Idea Brief before a fleet of research agents spends hours and real budget testing it.
</role>

<why>
The research agents search Reddit, reports and LinkedIn using the words in the brief. A vague problem or a broad audience such as "students" or "small businesses" produces vague searches and evidence that proves nothing. A specific problem, an early-adopter segment someone could find this week, and a concrete solution produce hypotheses that can actually be disproved. The founder is busy building, so each question should take seconds to answer, and the options themselves should teach them what a sharp answer looks like.
</why>

<process>
Clarify three parts in order: the problem, the target audience, the solution.
For each part, call askChoice with 3 or 4 options you wrote for this specific idea. The founder can pick several options and can add their own words under "Something else". Their reply arrives as a message such as "Problem: option A; option B; something else: their words".
When a reply arrives, combine everything they picked or wrote into one sentence and call confirmPoint with it. In the same turn, call askChoice for the next part.
If a reply is too vague to search for, call askChoice again for the same part with sharper options built from what they said, instead of confirming it.
After the solution is confirmed, call submitBrief. Infer a sensible business model and price unless the founder gave one. The brief appears beside the chat, so close with one sentence pointing the founder to it rather than restating it.
If the founder asks you to just write it, fill any unconfirmed part with your strongest option and call submitBrief.
</process>

<good_options>
Make each option a genuinely different, plausible take rather than a rewording, so choosing between them is a real decision.
Problem options describe a painful, frequent situation in the customer's own terms, what they do today instead, and what it costs them in time, money or risk.
Audience options name a narrow early-adopter segment: who they are, their situation, and where they gather. Narrow beats broad.
Solution options are the smallest thing that solves the chosen problem for the chosen audience, each taking a different approach, such as a tool, a service or a marketplace.
Build later options on earlier answers: audience options should be people who have the chosen problem, and solution options should fit both.
</good_options>

<example>
Idea: "An app for booking study rooms on campus"
askChoice for the problem, with options like:
label "Rooms booked but sitting empty", detail "Groups reserve rooms for whole afternoons and never show, so others wander floors looking for space."
label "No space during finals week", detail "Students camp outside the library at 7am because every room is gone by 8."
label "Booking sites are a maze", detail "Each library uses a different system, so students give up and work in loud cafes."
</example>

<style>
Before each askChoice, write one short sentence that says what you are asking and why it matters for the research. The options appear as buttons, so your sentence introduces them rather than repeating them.
Write in plain conversational sentences, because the chat shows text exactly as written. Keep a warm, direct tone with everyday words, and use commas or full stops where you might reach for a dash.
</style>

<hypotheses>
Each hypothesis in submitBrief must be falsifiable: it names the evidence that would disprove it. Cover a mix of types: problem, customer, willingness to pay, channel, competition, market size.
</hypotheses>`;

const ideaAgent = new Agent(components.agent, {
  name: "Idea agent",
  languageModel: claude,
  instructions: IDEA_PROMPT,
  tools: { askChoice, confirmPoint, submitBrief },
  // a question ends the turn: the founder's pick is the next message
  stopWhen: [stepCountIs(4), hasToolCall("askChoice")],
});

export const createProject = mutation({
  args: { ideaText: v.string(), budgetUsd: v.number() },
  handler: async (ctx, { ideaText, budgetUsd }) => {
    const userId = await requireUser(ctx);
    const idea = ideaText.trim();
    if (idea.length < 8) throw new ConvexError("Describe the idea in a sentence.");
    if (![5, 20, 50].includes(budgetUsd)) throw new ConvexError("Pick a budget.");
    const { threadId } = await ideaAgent.createThread(ctx, { userId });
    const projectId = await ctx.db.insert("projects", {
      userId,
      slug: slugify(idea),
      ideaText: idea,
      threadId,
      status: "drafting",
      budgetUsd,
      spentUsd: 0,
      dailyCaps: DEFAULT_CAPS,
      coldOutreach: false,
      createdAt: Date.now(),
    });
    const { messageId } = await ideaAgent.saveMessage(ctx, { threadId, userId, prompt: idea });
    await ctx.scheduler.runAfter(0, internal.chat.respond, {
      threadId,
      promptMessageId: messageId,
    });
    return projectId;
  },
});

export const send = mutation({
  args: { projectId: v.id("projects"), prompt: v.string() },
  handler: async (ctx, { projectId, prompt }) => {
    const project = await writableProject(ctx, projectId);
    if (!project.threadId || !prompt.trim()) return;
    const { messageId } = await ideaAgent.saveMessage(ctx, {
      threadId: project.threadId,
      userId: project.userId,
      prompt: prompt.trim(),
    });
    await ctx.scheduler.runAfter(0, internal.chat.respond, {
      threadId: project.threadId,
      promptMessageId: messageId,
    });
  },
});

export const respond = internalAction({
  args: { threadId: v.string(), promptMessageId: v.string() },
  handler: async (ctx, { threadId, promptMessageId }) => {
    const result = await ideaAgent.streamText(
      ctx,
      { threadId },
      { promptMessageId },
      { saveStreamDeltas: true },
    );
    await result.consumeStream();
  },
});

export const messages = query({
  args: {
    projectId: v.id("projects"),
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
    streamArgs: vStreamArgs,
  },
  handler: async (ctx, { projectId, threadId, paginationOpts, streamArgs }) => {
    const project = await readableProject(ctx, projectId);
    if (!project || project.threadId !== threadId) throw new ConvexError("Not found");
    const paginated = await listUIMessages(ctx, components.agent, { threadId, paginationOpts });
    const streams = await syncStreams(ctx, components.agent, { threadId, streamArgs });
    return { ...paginated, streams };
  },
});

export const editBrief = mutation({
  args: {
    projectId: v.id("projects"),
    problem: v.string(),
    customer: v.string(),
    solution: v.string(),
    model: v.string(),
  },
  handler: async (ctx, { projectId, ...brief }) => {
    await writableProject(ctx, projectId);
    const last = await ctx.db
      .query("ideaBriefs")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .order("desc")
      .first();
    await ctx.db.insert("ideaBriefs", { projectId, ...brief, version: (last?.version ?? 0) + 1 });
  },
});

/** The founder approves: start the research and landing-page fleets. */
export const approve = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const project = await writableProject(ctx, projectId);
    if (project.status !== "drafting") return;
    const brief = await ctx.db
      .query("ideaBriefs")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .first();
    if (!brief) throw new ConvexError("Finish the chat first; there is no brief yet.");
    await ctx.db.patch(projectId, { status: "active", landingStatus: "building" });
    await addEvent(ctx, projectId, "brief.approved", {
      message: "Founder → Chief of staff: brief approved, research and landing page started",
      from: "Founder",
    });
    await ctx.scheduler.runAfter(0, internal.research.start, { projectId });
    await ctx.scheduler.runAfter(0, internal.landing.build, { projectId });
  },
});
