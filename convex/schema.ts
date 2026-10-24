import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const vHypothesisType = v.union(
  v.literal("problem"),
  v.literal("customer"),
  v.literal("willingness to pay"),
  v.literal("channel"),
  v.literal("competition"),
  v.literal("market size"),
);
export const vSourceType = v.union(
  v.literal("report"),
  v.literal("public data"),
  v.literal("reddit"),
  v.literal("forum"),
  v.literal("web"),
  v.literal("interview"),
  v.literal("email"),
  v.literal("linkedin"),
  v.literal("waitlist"),
);
export const vStance = v.union(v.literal("supports"), v.literal("disproves"));
export const vTeam = v.union(
  v.literal("lead"),
  v.literal("research"),
  v.literal("strategy"),
  v.literal("growth"),
  v.literal("operations"),
);
export const vContactStatus = v.union(
  v.literal("found"),
  v.literal("queued"),
  v.literal("emailed"),
  v.literal("replied"),
  v.literal("meeting booked"),
  v.literal("interviewed"),
  v.literal("thanked"),
);
export const vChannel = v.union(v.literal("email"), v.literal("linkedin"));
export const vTouchKind = v.union(
  v.literal("send"),
  v.literal("follow-up"),
  v.literal("reply"),
  v.literal("connection"),
  v.literal("dm"),
  v.literal("thank-you"),
  v.literal("invite"),
  v.literal("bounce"),
);
export const vDailyCaps = v.object({
  coldEmail: v.number(),
  followUp: v.number(),
  linkedinConnection: v.number(),
  linkedinDm: v.number(),
  invite: v.number(),
});
export const vMarketLine = v.object({
  label: v.string(),
  value: v.number(), // USD per year for money lines, a count for customer lines
  unit: v.union(v.literal("usd"), v.literal("count"), v.literal("ratio")),
  note: v.string(),
  sourceId: v.optional(v.id("sources")),
});

export default defineSchema({
  ...authTables,
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    githubLogin: v.optional(v.string()),
    githubToken: v.optional(v.string()), // never returned by a query
  }).index("email", ["email"]),

  mcpTokens: defineTable({
    userId: v.id("users"),
    tokenHash: v.string(),
    createdAt: v.number(),
    lastUsedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
  })
    .index("by_hash", ["tokenHash"])
    .index("by_user", ["userId"]),

  projects: defineTable({
    userId: v.optional(v.id("users")), // unset for the public sample project
    sample: v.optional(v.boolean()),
    slug: v.string(),
    ideaText: v.string(),
    threadId: v.optional(v.string()),
    // Problem, audience and solution as the founder confirms them in the idea chat
    draft: v.optional(
      v.object({
        problem: v.optional(v.string()),
        customer: v.optional(v.string()),
        solution: v.optional(v.string()),
      }),
    ),
    status: v.union(v.literal("drafting"), v.literal("active"), v.literal("paused")),
    pauseReason: v.optional(v.string()),
    budgetUsd: v.number(),
    spentUsd: v.number(),
    dailyCaps: vDailyCaps,
    coldOutreach: v.boolean(),
    grokConnectedAt: v.optional(v.number()),
    landingRepo: v.optional(v.string()),
    pagesUrl: v.optional(v.string()),
    landingStatus: v.optional(
      v.union(
        v.literal("building"),
        v.literal("publishing"),
        v.literal("live"),
        v.literal("failed"),
      ),
    ),
    landingError: v.optional(v.string()),
    freeSlots: v.optional(v.array(v.string())),
    lastEvidenceAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_slug", ["slug"])
    .index("by_thread", ["threadId"])
    .index("by_status", ["status"]),

  ideaBriefs: defineTable({
    projectId: v.id("projects"),
    problem: v.string(),
    customer: v.string(),
    solution: v.string(),
    model: v.string(),
    version: v.number(),
  }).index("by_project", ["projectId", "version"]),

  hypotheses: defineTable({
    projectId: v.id("projects"),
    type: vHypothesisType,
    statement: v.string(),
    disproveIf: v.string(),
    score: v.number(), // 0-100 confidence
    strength: v.object({ quotes: v.number(), sourceTypes: v.number() }),
    topSupportId: v.optional(v.id("evidence")),
    topDisproveId: v.optional(v.id("evidence")),
    topSupportWhy: v.optional(v.string()),
    topDisproveWhy: v.optional(v.string()),
    unknowns: v.optional(v.string()),
    nextQuestion: v.optional(v.string()),
    scoreHistory: v.array(
      v.object({ at: v.number(), score: v.number(), evidenceId: v.optional(v.id("evidence")) }),
    ),
    judgedAt: v.optional(v.number()),
  }).index("by_project", ["projectId"]),

  sources: defineTable({
    projectId: v.id("projects"),
    url: v.string(),
    title: v.optional(v.string()),
    sourceType: vSourceType,
    text: v.string(), // the fetched text, so every quote can be checked against it
    meta: v.optional(v.string()), // e.g. "212 upvotes"
    publishedAt: v.optional(v.string()),
    fetchedAt: v.number(),
    ragKey: v.optional(v.string()),
    extractedAt: v.optional(v.number()),
  })
    .index("by_project", ["projectId"])
    .index("by_project_url", ["projectId", "url"]),

  evidence: defineTable({
    projectId: v.id("projects"),
    hypothesisId: v.id("hypotheses"),
    sourceId: v.id("sources"),
    quote: v.string(),
    speaker: v.string(),
    stance: vStance,
    confidence: v.number(),
    weight: v.number(),
    createdAt: v.number(),
  })
    .index("by_hypothesis", ["hypothesisId"])
    .index("by_project", ["projectId"])
    .index("by_source", ["sourceId"]),

  contacts: defineTable({
    projectId: v.id("projects"),
    name: v.string(),
    role: v.optional(v.string()),
    company: v.optional(v.string()),
    email: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    origin: v.union(v.literal("scout"), v.literal("waitlist"), v.literal("manual")),
    status: vContactStatus,
    fitScore: v.optional(v.number()),
    fitReason: v.optional(v.string()),
    keyQuote: v.optional(v.string()),
    keyEvidenceId: v.optional(v.id("evidence")),
    priority: v.optional(v.number()),
    lastTouchAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_email", ["projectId", "email"]),

  touches: defineTable({
    contactId: v.id("contacts"),
    projectId: v.id("projects"),
    channel: vChannel,
    kind: vTouchKind,
    at: v.number(),
    text: v.optional(v.string()),
  }).index("by_contact", ["contactId"]),

  meetings: defineTable({
    projectId: v.id("projects"),
    contactId: v.id("contacts"),
    startTime: v.number(),
    meetLink: v.optional(v.string()),
    transcriptText: v.optional(v.string()),
    transcriptSourceId: v.optional(v.id("sources")),
    summary: v.optional(v.string()),
    personalLine: v.optional(v.string()),
    status: v.union(
      v.literal("booked"),
      v.literal("ended"),
      v.literal("analyzing"),
      v.literal("analyzed"),
      v.literal("failed"),
    ),
  })
    .index("by_project", ["projectId"])
    .index("by_contact", ["contactId"]),

  tasks: defineTable({
    projectId: v.id("projects"),
    team: vTeam,
    title: v.string(),
    hypothesisId: v.optional(v.id("hypotheses")),
    priority: v.number(),
    budgetUsd: v.number(),
    status: v.union(v.literal("open"), v.literal("claimed"), v.literal("done")),
    claimedBy: v.optional(v.string()),
    createdBy: v.string(),
    createdAt: v.number(),
  }).index("by_project_status", ["projectId", "status"]),

  events: defineTable({
    projectId: v.id("projects"),
    type: v.string(),
    payload: v.any(),
    status: v.union(v.literal("pending"), v.literal("done"), v.literal("skipped")),
    createdAt: v.number(),
    ackedAt: v.optional(v.number()),
    result: v.optional(v.string()),
  })
    .index("by_project_status", ["projectId", "status"])
    .index("by_project", ["projectId"]),

  agentRuns: defineTable({
    projectId: v.id("projects"),
    agent: v.string(),
    team: vTeam,
    taskId: v.optional(v.id("tasks")),
    context: v.optional(v.any()),
    inputs: v.optional(v.any()), // kept for Creao runs so a malformed answer can be redone on Claude
    creaoRunId: v.optional(v.string()),
    backend: v.union(v.literal("creao"), v.literal("claude"), v.literal("convex")),
    status: v.union(v.literal("running"), v.literal("done"), v.literal("failed")),
    summary: v.optional(v.string()),
    error: v.optional(v.string()),
    costUsd: v.number(),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
  })
    .index("by_project", ["projectId"])
    .index("by_creao_run", ["creaoRunId"]),

  toolCalls: defineTable({
    projectId: v.id("projects"),
    agentRunId: v.optional(v.id("agentRuns")),
    agent: v.string(),
    tool: v.string(),
    target: v.string(),
    allowed: v.boolean(),
    reason: v.optional(v.string()),
    costUsd: v.number(),
    at: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_domain", ["projectId", "target"]),

  quotaUsage: defineTable({
    projectId: v.id("projects"),
    date: v.string(),
    channel: v.string(),
    count: v.number(),
  }).index("by_project_date", ["projectId", "date", "channel"]),

  reports: defineTable({
    projectId: v.id("projects"),
    version: v.number(),
    body: v.string(),
    whatChanged: v.string(),
    validated: v.array(v.string()),
    shaky: v.array(v.string()),
    experiments: v.array(v.string()),
    personaNotes: v.array(
      v.object({
        persona: v.string(),
        hypothesisId: v.optional(v.id("hypotheses")),
        note: v.string(),
        evidenceIds: v.array(v.id("evidence")),
      }),
    ),
    market: v.optional(v.object({ topDown: v.array(vMarketLine), bottomUp: v.array(vMarketLine) })),
    createdAt: v.number(),
  }).index("by_project", ["projectId", "version"]),

  personaNotes: defineTable({
    projectId: v.id("projects"),
    persona: v.string(),
    hypothesisId: v.optional(v.id("hypotheses")),
    note: v.string(),
    verdict: v.union(v.literal("strong"), v.literal("weak"), v.literal("unclear")),
    evidenceIds: v.array(v.id("evidence")),
    createdAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_hypothesis", ["hypothesisId"]),

  agentMemory: defineTable({
    agent: v.string(),
    projectId: v.id("projects"),
    notes: v.string(),
    updatedAt: v.number(),
  }).index("by_project_agent", ["projectId", "agent"]),

  pageEvents: defineTable({
    projectId: v.id("projects"),
    type: v.union(v.literal("pageview"), v.literal("form_focus"), v.literal("signup")),
    visitorId: v.string(),
    referrer: v.optional(v.string()),
    utm: v.optional(v.string()),
    at: v.number(),
  }).index("by_project_type", ["projectId", "type"]),
});
