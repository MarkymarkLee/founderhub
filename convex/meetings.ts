import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, mutation } from "./_generated/server";
import type { Output } from "./agents";
import { addEvent, writableProject } from "./lib";
import { insertEvidence } from "./research";

export const create = mutation({
  args: { contactId: v.id("contacts"), startTime: v.number() },
  handler: async (ctx, { contactId, startTime }) => {
    const contact = await ctx.db.get(contactId);
    if (!contact) throw new ConvexError("Contact not found.");
    await writableProject(ctx, contact.projectId);
    await ctx.db.patch(contactId, { status: "meeting booked" });
    return ctx.db.insert("meetings", {
      projectId: contact.projectId,
      contactId,
      startTime,
      status: "booked",
    });
  },
});

export const pasteTranscript = mutation({
  args: { meetingId: v.id("meetings"), transcript: v.string() },
  handler: async (ctx, { meetingId, transcript }) => {
    const meeting = await ctx.db.get(meetingId);
    if (!meeting) throw new ConvexError("Meeting not found.");
    await writableProject(ctx, meeting.projectId);
    const text = transcript.trim();
    if (text.length < 200) throw new ConvexError("That transcript looks too short.");
    await ctx.db.patch(meetingId, { transcriptText: text.slice(0, 200_000), status: "ended" });
    await addEvent(ctx, meeting.projectId, "meeting.ended", {
      message: "Founder → Meeting analyzer: transcript saved",
      from: "Founder",
      meetingId,
    });
    await ctx.scheduler.runAfter(0, internal.meetings.analyze, { meetingId });
  },
});

export const forAnalysis = internalQuery({
  args: { meetingId: v.id("meetings") },
  handler: async (ctx, { meetingId }) => {
    const meeting = await ctx.db.get(meetingId);
    if (!meeting) return null;
    const contact = await ctx.db.get(meeting.contactId);
    return { meeting, contact };
  },
});

// Interviewee lines only; the founder's own words never count as evidence.
export const intervieweeText = (transcript: string) =>
  transcript
    .split("\n")
    .filter((l) => !/^\s*(\[[^\]]*\]\s*)?(founder|me|interviewer)\s*:/i.test(l))
    .join("\n");

export const saveTranscriptSource = internalMutation({
  args: { meetingId: v.id("meetings") },
  handler: async (ctx, { meetingId }) => {
    const meeting = (await ctx.db.get(meetingId))!;
    const contact = await ctx.db.get(meeting.contactId);
    const sourceId = await ctx.db.insert("sources", {
      projectId: meeting.projectId,
      url: `meeting:${meetingId}`,
      title: `Interview with ${contact?.name ?? "a customer"}`,
      sourceType: "interview",
      text: intervieweeText(meeting.transcriptText ?? ""),
      publishedAt: new Date(meeting.startTime).toISOString().slice(0, 10),
      fetchedAt: Date.now(),
      extractedAt: Date.now(),
    });
    await ctx.db.patch(meetingId, { transcriptSourceId: sourceId, status: "analyzing" });
    await ctx.scheduler.runAfter(0, internal.tools.embed, { sourceId });
    return sourceId;
  },
});

export const analyze = internalAction({
  args: { meetingId: v.id("meetings") },
  handler: async (ctx, { meetingId }) => {
    const data = await ctx.runQuery(internal.meetings.forAnalysis, { meetingId });
    if (!data?.meeting.transcriptText) return;
    const sourceId = await ctx.runMutation(internal.meetings.saveTranscriptSource, { meetingId });
    const { hypotheses } = await ctx.runQuery(internal.research.briefAndHypotheses, {
      projectId: data.meeting.projectId,
    });
    const runId = await ctx.runAction(internal.agents.run, {
      projectId: data.meeting.projectId,
      agent: "meeting",
      inputs: {
        interviewee: {
          name: data.contact?.name,
          role: data.contact?.role,
          company: data.contact?.company,
        },
        hypotheses,
        transcript: data.meeting.transcriptText.slice(0, 150_000),
      },
      context: { meetingId, sourceId },
    });
    if (!runId) await ctx.runMutation(internal.meetings.setFailed, { meetingId });
  },
});

export const setFailed = internalMutation({
  args: { meetingId: v.id("meetings") },
  handler: (ctx, { meetingId }) => ctx.db.patch(meetingId, { status: "failed" }),
});

export const onAnalyzed = internalMutation({
  args: {
    projectId: v.id("projects"),
    runId: v.id("agentRuns"),
    output: v.any(),
    context: v.any(),
  },
  handler: async (ctx, { projectId, output, context }) => {
    const out = output as Output<"meeting">;
    const meetingId = context.meetingId as Id<"meetings">;
    const sourceId = context.sourceId as Id<"sources">;
    const meeting = (await ctx.db.get(meetingId))!;
    const contact = await ctx.db.get(meeting.contactId);
    const date = new Date(meeting.startTime).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const speaker = `${[contact?.role, contact?.company].filter(Boolean).join(" at ") || contact?.name || "Interviewee"}, interview ${date}`;

    const touched = new Map<Id<"hypotheses">, Id<"evidence">>();
    let best: { id: Id<"evidence">; quote: string; c: number } | null = null;
    let rejected = 0;
    for (const item of out.items) {
      const id = await insertEvidence(ctx, projectId, { ...item, sourceId, speaker });
      if (!id) {
        rejected++;
        continue;
      }
      touched.set(item.hypothesisId as Id<"hypotheses">, id);
      if (!best || item.confidence > best.c) best = { id, quote: item.quote, c: item.confidence };
    }
    for (const [hypothesisId, causeId] of touched)
      await ctx.scheduler.runAfter(0, internal.judge.rescore, { hypothesisId, causeId });

    await ctx.db.patch(meetingId, {
      summary: out.summary,
      personalLine: out.personalLine,
      status: "analyzed",
    });
    if (contact)
      await ctx.db.patch(contact._id, {
        status: "interviewed",
        keyQuote: best?.quote ?? contact.keyQuote,
        keyEvidenceId: best?.id ?? contact.keyEvidenceId,
      });
    await ctx.db.patch(projectId, { lastEvidenceAt: Date.now() });
    await addEvent(ctx, projectId, "meeting.analyzed", {
      message: `Meeting analyzer → Grok Bot: ${touched.size ? `${out.items.length - rejected} quotes added` : "call processed"}, send a thank-you`,
      from: "Meeting analyzer",
      meetingId,
      contactId: meeting.contactId,
    });
    return `${out.items.length - rejected} quotes from the call`;
  },
});
