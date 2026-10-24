// mock: the seeded FounderHub-on-FounderHub sample project. People, quotes and numbers are illustrative.
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, type MutationCtx, query } from "./_generated/server";
import { DEFAULT_CAPS, requireUser, scoreOf, SOURCE_WEIGHTS, type SourceType } from "./lib";

/** Pasted live in the demo; the meeting analyzer turns it into quotes. */
export const SAMPLE_TRANSCRIPT = `Founder: Thanks for making time. How do you decide whether an idea is worth building?
Rosa: Honestly, I ask three friends and then start coding. I know that's not real validation.
Founder: What stops you from doing interviews?
Rosa: Finding people takes forever. Last semester I spent two weekends just getting five calls booked.
Rosa: The research part is the part I always skip when midterms hit.
Founder: If a tool did the research and showed you the quotes, what would you pay?
Rosa: Twenty dollars a month is a lot for a student. I'd pay five, maybe ten, if my club covered part of it.
Rosa: I would pay more right before a pitch competition, but not every month.
Founder: Where do you hear about tools like this?
Rosa: Our founders Discord. If someone posts a tool there, half the club tries it the same day.
Founder: Anything else?
Rosa: Show me where every number comes from. I've been burned by market sizes that were made up.`;

const H = {
  problem: "Student founders skip customer validation because it takes more than 5 hours a week.",
  wtp: "Student founders will pay $20 a month for research they can trust.",
  customer: "First-time founders in accelerators feel this pain more than repeat founders.",
  channel: "Campus founder clubs can bring 100 waitlist signups in a week.",
  competition: "No current tool ties every market number to a source a founder can open.",
  market: "More than 30,000 US student-led startups form each year.",
} as const;
type HKey = keyof typeof H;

const HYPOTHESES: {
  key: HKey;
  type: Doc<"hypotheses">["type"];
  disproveIf: string;
  next: string;
  unknowns: string;
}[] = [
  {
    key: "problem",
    type: "problem",
    disproveIf: "Fewer than 1 in 3 interviewees say validation takes them 5+ hours a week.",
    next: "Walk me through the last time you tried to validate an idea. How long did it take?",
    unknowns: "We have no time estimates from founders outside Berkeley yet.",
  },
  {
    key: "wtp",
    type: "willingness to pay",
    disproveIf: "Fewer than 1 in 5 interviewees name a price of $15 a month or more.",
    next: "What have you paid for in the last month to help your startup, and who paid for it?",
    unknowns: "No one has said whether a club or school would pay instead of the founder.",
  },
  {
    key: "customer",
    type: "customer",
    disproveIf: "Repeat founders report the same hours spent on validation as first-timers.",
    next: "Is this your first startup? How did you validate the last one?",
    unknowns: "Only one repeat founder has been interviewed.",
  },
  {
    key: "channel",
    type: "channel",
    disproveIf: "One post in a founder club brings fewer than 20 signups.",
    next: "Where did you hear about the last tool you started using?",
    unknowns: "We have not tested a club post yet, only asked about it.",
  },
  {
    key: "competition",
    type: "competition",
    disproveIf: "A tool with cited market sizing already has more than 1,000 student users.",
    next: "What do you use today to size a market? Do you trust the numbers?",
    unknowns: "We have not compared against AI research assistants that cite sources.",
  },
  {
    key: "market",
    type: "market size",
    disproveIf: "Public counts show fewer than 10,000 student-led startups a year.",
    next: "How many founders are in your club, and how many have a live project?",
    unknowns: "No national count of student startups; estimates come from incubator reports.",
  },
];

type SeedSource = {
  key: string;
  type: SourceType;
  title: string;
  meta?: string;
  daysAgo: number;
  text: string;
};
const SOURCES: SeedSource[] = [
  {
    key: "r1",
    type: "reddit",
    title: "r/startups thread on validation",
    meta: "41 upvotes",
    daysAgo: 6,
    text: "Honestly validation was the fun part. Building was what dragged. I did twenty calls in a week.",
  },
  {
    key: "r2",
    type: "reddit",
    title: "r/college thread on side projects",
    meta: "212 upvotes",
    daysAgo: 6,
    text: "I know I should do interviews. I just never find the afternoon for it between classes and lab.",
  },
  {
    key: "r3",
    type: "reddit",
    title: "r/SaaS thread on student pricing",
    meta: "88 upvotes",
    daysAgo: 5,
    text: "Students don't pay for tools. We use free tiers until someone makes us, or until the school pays.",
  },
  {
    key: "r4",
    type: "reddit",
    title: "r/startups thread on research tools",
    meta: "56 upvotes",
    daysAgo: 5,
    text: "I'd pay for it if every number links back to where it came from. Most tools just make things up.",
  },
  {
    key: "r5",
    type: "reddit",
    title: "r/EntrepreneurRideAlong thread",
    meta: "19 upvotes",
    daysAgo: 4,
    text: "Twenty bucks a month is fine if it saves me a weekend of Googling market reports.",
  },
  {
    key: "p1",
    type: "report",
    title: "Campus incubator annual summary (public)",
    daysAgo: 5,
    text: "Campus incubators report far fewer formal startups than club rosters suggest. Most student teams never register a company.",
  },
  {
    key: "p2",
    type: "public data",
    title: "National student entrepreneurship survey summary",
    daysAgo: 5,
    text: "Roughly 1 in 20 undergraduates report working on a startup idea in a given year.",
  },
  {
    key: "p3",
    type: "public data",
    title: "Undergraduate enrollment statistics (public)",
    daysAgo: 5,
    text: "About 15.4 million students were enrolled in US undergraduate programs.",
  },
  {
    key: "w1",
    type: "web",
    title: "Startup tooling roundup",
    daysAgo: 4,
    text: "Most market sizing decks I see cite nothing below the headline TAM. Founders copy numbers from slides.",
  },
  {
    key: "w2",
    type: "web",
    title: "Student software spending article",
    daysAgo: 3,
    text: "Students pay for software when a club or department covers part of the cost; individual subscriptions churn after the semester.",
  },
  {
    key: "e1",
    type: "email",
    title: "Email reply from Haas MBA student",
    daysAgo: 3,
    text: "MBA student at Haas: Students don't pay for tools. Our club would expense it if it helped us win the pitch competition.",
  },
  {
    key: "e2",
    type: "email",
    title: "Email reply from student org officer",
    daysAgo: 3,
    text: "Student org officer: Club newsletters get opened by maybe a dozen people. Discord gets way more attention.",
  },
  {
    key: "wl1",
    type: "waitlist",
    title: "Waitlist answer",
    daysAgo: 2,
    text: "Role: solo founder. What would you use this for? Before every pitch I need a market size I can defend in front of judges.",
  },
  {
    key: "wl2",
    type: "waitlist",
    title: "Waitlist answer",
    daysAgo: 2,
    text: "Role: club lead. What would you use this for? Posted in the founders Discord and got 38 signups before lunch for our own event.",
  },
  {
    key: "i1",
    type: "interview",
    title: "Interview with an accelerator founder",
    daysAgo: 2,
    text: "Our cohort's first homework was 20 interviews. Half of us faked it. I spent maybe eight hours a week on research and still felt behind.",
  },
];

// Chronological; the score history replays these through the real scoring formula.
type SeedEvidence = {
  h: HKey;
  s: string;
  quote: string;
  speaker: string;
  stance: "supports" | "disproves";
  c: number;
};
const EVIDENCE: SeedEvidence[] = [
  {
    h: "problem",
    s: "r2",
    quote: "I know I should do interviews. I just never find the afternoon for it",
    speaker: "r/college commenter, 212 upvotes",
    stance: "supports",
    c: 0.8,
  },
  {
    h: "problem",
    s: "r1",
    quote: "Honestly validation was the fun part. Building was what dragged.",
    speaker: "r/startups commenter, 41 upvotes",
    stance: "disproves",
    c: 0.6,
  },
  {
    h: "wtp",
    s: "r4",
    quote: "I'd pay for it if every number links back to where it came from.",
    speaker: "r/startups commenter, 56 upvotes",
    stance: "supports",
    c: 0.7,
  },
  {
    h: "wtp",
    s: "r5",
    quote: "Twenty bucks a month is fine if it saves me a weekend of Googling market reports.",
    speaker: "r/EntrepreneurRideAlong commenter",
    stance: "supports",
    c: 0.8,
  },
  {
    h: "competition",
    s: "w1",
    quote: "Most market sizing decks I see cite nothing below the headline TAM.",
    speaker: "Startup tooling roundup",
    stance: "supports",
    c: 0.7,
  },
  {
    h: "market",
    s: "p2",
    quote: "Roughly 1 in 20 undergraduates report working on a startup idea in a given year.",
    speaker: "Student entrepreneurship survey",
    stance: "supports",
    c: 0.6,
  },
  {
    h: "market",
    s: "p1",
    quote: "Campus incubators report far fewer formal startups than club rosters suggest.",
    speaker: "Campus incubator summary",
    stance: "disproves",
    c: 0.7,
  },
  {
    h: "wtp",
    s: "r3",
    quote: "Students don't pay for tools. We use free tiers until someone makes us",
    speaker: "r/SaaS commenter, 88 upvotes",
    stance: "disproves",
    c: 0.8,
  },
  {
    h: "wtp",
    s: "w2",
    quote: "individual subscriptions churn after the semester",
    speaker: "Student software spending article",
    stance: "disproves",
    c: 0.6,
  },
  {
    h: "wtp",
    s: "e1",
    quote:
      "Students don't pay for tools. Our club would expense it if it helped us win the pitch competition.",
    speaker: "MBA student at Haas, email reply",
    stance: "disproves",
    c: 0.7,
  },
  {
    h: "channel",
    s: "e2",
    quote: "Club newsletters get opened by maybe a dozen people.",
    speaker: "Student org officer, email reply",
    stance: "disproves",
    c: 0.7,
  },
  {
    h: "channel",
    s: "wl2",
    quote: "Posted in the founders Discord and got 38 signups before lunch",
    speaker: "Club lead, waitlist answer",
    stance: "supports",
    c: 0.8,
  },
  {
    h: "wtp",
    s: "wl1",
    quote: "Before every pitch I need a market size I can defend in front of judges.",
    speaker: "Solo founder, waitlist answer",
    stance: "supports",
    c: 0.5,
  },
  {
    h: "customer",
    s: "i1",
    quote: "Our cohort's first homework was 20 interviews. Half of us faked it.",
    speaker: "Accelerator founder, interview",
    stance: "supports",
    c: 0.8,
  },
  {
    h: "problem",
    s: "i1",
    quote: "I spent maybe eight hours a week on research and still felt behind.",
    speaker: "Accelerator founder, interview",
    stance: "supports",
    c: 0.9,
  },
];

const CONTACTS: (Omit<Doc<"contacts">, "_id" | "_creationTime" | "projectId" | "createdAt"> & {
  key: string;
})[] = [
  {
    key: "rosa",
    name: "Rosa Okafor",
    role: "CS senior",
    company: "Berkeley",
    email: "rosa.okafor@example.com",
    origin: "waitlist",
    status: "meeting booked",
    fitScore: 92,
    fitReason: "First-time founder, joined the waitlist",
    keyQuote: "Before every pitch I need a market size I can defend.",
  },
  {
    key: "dev",
    name: "Devansh Kulkarni",
    role: "Accelerator founder",
    company: "SkyDeck cohort",
    email: "devansh.k@example.com",
    origin: "manual",
    status: "interviewed",
    fitScore: 88,
    fitReason: "Added by the founder; in an accelerator cohort",
    keyQuote: "Our cohort's first homework was 20 interviews. Half of us faked it.",
  },
  {
    key: "tomas",
    name: "Tomás Herrera",
    role: "MBA student",
    company: "Haas",
    email: "tomas.h@example.com",
    origin: "manual",
    status: "replied",
    fitScore: 71,
    fitReason: "Runs a pitch competition team",
    keyQuote: "Our club would expense it if it helped us win the pitch competition.",
  },
  {
    key: "aiko",
    name: "Aiko Brennan",
    role: "Club lead",
    company: "Founders club",
    email: "aiko.b@example.com",
    origin: "waitlist",
    status: "emailed",
    fitScore: 80,
    fitReason: "Leads a founder club; channel test candidate",
    keyQuote: "Posted in the founders Discord and got 38 signups before lunch",
  },
  {
    key: "sam",
    name: "Samir Haddad",
    role: "Solo founder",
    email: "samir.h@example.com",
    origin: "waitlist",
    status: "queued",
    fitScore: 76,
    fitReason: "Joined the waitlist",
  },
  {
    key: "lena",
    name: "Lena Fischer",
    role: "Student org officer",
    company: "Entrepreneurship association",
    email: "lena.f@example.com",
    origin: "manual",
    status: "thanked",
    fitScore: 64,
    fitReason: "Runs the club newsletter",
  },
  {
    key: "omar",
    name: "Omar Siddiqui",
    role: "PM",
    company: "Edtech startup",
    linkedinUrl: "https://www.linkedin.com/in/example-omar",
    origin: "scout",
    status: "found",
    fitScore: 58,
    fitReason: "Wrote publicly about student founder tooling",
  },
  {
    key: "grace",
    name: "Grace Liu",
    role: "Program manager",
    company: "Campus incubator",
    origin: "scout",
    status: "found",
    fitScore: 66,
    fitReason: "Quoted in the incubator summary",
  },
];

const MIN = 60_000;
const DAY = 24 * 60 * MIN;

async function clearSample(ctx: MutationCtx) {
  const old = (
    await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", undefined))
      .collect()
  ).filter((p) => p.sample);
  for (const p of old) {
    const byProject = [
      "ideaBriefs",
      "hypotheses",
      "sources",
      "evidence",
      "contacts",
      "meetings",
      "events",
      "agentRuns",
      "toolCalls",
      "reports",
      "personaNotes",
      "pageEvents",
    ] as const;
    for (const table of byProject) {
      const rows = await ctx.db
        .query(table)
        .filter((q) => q.eq(q.field("projectId"), p._id))
        .collect();
      for (const r of rows) await ctx.db.delete(r._id);
    }
    for (const t of await ctx.db
      .query("touches")
      .filter((q) => q.eq(q.field("projectId"), p._id))
      .collect())
      await ctx.db.delete(t._id);
    for (const t of await ctx.db
      .query("tasks")
      .withIndex("by_project_status", (q) => q.eq("projectId", p._id))
      .collect())
      await ctx.db.delete(t._id);
    await ctx.db.delete(p._id);
  }
}

async function seedSample(ctx: MutationCtx) {
  await clearSample(ctx);
  const now = Date.now();
  const projectId = await ctx.db.insert("projects", {
    sample: true,
    slug: "founderhub-sample",
    ideaText:
      "Agents that validate a startup idea with cited evidence while the student founder keeps building.",
    status: "active",
    budgetUsd: 20,
    spentUsd: 7.42,
    dailyCaps: DEFAULT_CAPS,
    coldOutreach: false,
    grokConnectedAt: now - 3 * DAY,
    landingRepo: "founderhub-sample/founderhub-landing",
    pagesUrl: "https://founderhub-sample.github.io/founderhub-landing/",
    landingStatus: "live",
    freeSlots: ["Tue 3:00-3:30pm", "Wed 11:00-11:30am", "Thu 4:00-4:30pm"],
    lastEvidenceAt: now - 2 * DAY,
    createdAt: now - 7 * DAY,
  });
  await ctx.db.insert("ideaBriefs", {
    projectId,
    problem:
      "Student founders skip customer validation because finding people and evidence takes hours they would rather spend building.",
    customer:
      "First-time student founders in campus clubs and accelerators, starting with Berkeley.",
    solution:
      "A fleet of agents that collects cited quotes, customers and market numbers, and shows every score with the words behind it.",
    model: "$20 a month per founder, or a club plan the club pays for.",
    version: 1,
  });

  const sourceIds: Record<string, Id<"sources">> = {};
  for (const s of SOURCES)
    sourceIds[s.key] = await ctx.db.insert("sources", {
      projectId,
      url: `sample:${s.key}`,
      title: s.title,
      sourceType: s.type,
      text: s.text,
      meta: s.meta,
      fetchedAt: now - s.daysAgo * DAY,
      extractedAt: now - s.daysAgo * DAY,
    });

  const hypIds = {} as Record<HKey, Id<"hypotheses">>;
  for (const h of HYPOTHESES)
    hypIds[h.key] = await ctx.db.insert("hypotheses", {
      projectId,
      type: h.type,
      statement: H[h.key],
      disproveIf: h.disproveIf,
      score: 50,
      strength: { quotes: 0, sourceTypes: 0 },
      scoreHistory: [{ at: now - 7 * DAY, score: 50 }],
      nextQuestion: h.next,
      unknowns: h.unknowns,
      judgedAt: now - 2 * DAY,
    });

  // Replay evidence in order so every score and history step comes from the real formula.
  const evidenceIds: Id<"evidence">[] = [];
  const perH: Record<
    string,
    {
      stance: "supports" | "disproves";
      confidence: number;
      weight: number;
      id: Id<"evidence">;
      type: string;
    }[]
  > = {};
  const history: Record<string, Doc<"hypotheses">["scoreHistory"]> = {};
  for (let i = 0; i < EVIDENCE.length; i++) {
    const e = EVIDENCE[i];
    const src = SOURCES.find((s) => s.key === e.s)!;
    const at = now - 6 * DAY + (i * (4 * DAY)) / EVIDENCE.length;
    const weight = SOURCE_WEIGHTS[src.type];
    const id = await ctx.db.insert("evidence", {
      projectId,
      hypothesisId: hypIds[e.h],
      sourceId: sourceIds[e.s],
      quote: e.quote,
      speaker: e.speaker,
      stance: e.stance,
      confidence: e.c,
      weight,
      createdAt: at,
    });
    evidenceIds.push(id);
    const list = (perH[e.h] ??= []);
    list.push({ stance: e.stance, confidence: e.c, weight, id, type: src.type });
    (history[e.h] ??= [{ at: now - 7 * DAY, score: 50 }]).push({
      at,
      score: scoreOf(list),
      evidenceId: id,
    });
  }
  for (const h of HYPOTHESES) {
    const list = perH[h.key] ?? [];
    const best = (stance: "supports" | "disproves") =>
      list
        .filter((e) => e.stance === stance)
        .sort((a, b) => b.weight * b.confidence - a.weight * a.confidence)[0]?.id;
    await ctx.db.patch(hypIds[h.key], {
      score: scoreOf(list),
      strength: { quotes: list.length, sourceTypes: new Set(list.map((e) => e.type)).size },
      scoreHistory: history[h.key] ?? [{ at: now - 7 * DAY, score: 50 }],
      topSupportId: best("supports"),
      topDisproveId: best("disproves"),
      topSupportWhy: best("supports")
        ? "The clearest first-hand statement on this side."
        : undefined,
      topDisproveWhy: best("disproves")
        ? "Direct pushback from someone in the target group."
        : undefined,
    });
  }

  const contactIds: Record<string, Id<"contacts">> = {};
  for (const { key, ...c } of CONTACTS)
    contactIds[key] = await ctx.db.insert("contacts", {
      projectId,
      ...c,
      lastTouchAt: c.status === "found" ? undefined : now - 2 * DAY,
      createdAt: now - 5 * DAY,
    });
  const touches: [string, Doc<"touches">["channel"], Doc<"touches">["kind"], number, string?][] = [
    ["tomas", "email", "send", 4],
    [
      "tomas",
      "email",
      "reply",
      3,
      "Students don't pay for tools. Our club would expense it if it helped us win the pitch competition.",
    ],
    ["aiko", "email", "send", 2],
    ["rosa", "email", "send", 2],
    ["rosa", "email", "reply", 1.5, "Sure, happy to chat. Thursday works."],
    ["rosa", "email", "invite", 1.4],
    ["dev", "email", "send", 4],
    ["dev", "email", "invite", 3.5],
    [
      "dev",
      "email",
      "thank-you",
      1.9,
      "Thanks for the call. The line about your cohort faking interviews stuck with me.",
    ],
    ["lena", "email", "send", 4],
    ["lena", "email", "reply", 3.2],
    ["lena", "email", "thank-you", 3],
  ];
  for (const [k, channel, kind, days, text] of touches)
    await ctx.db.insert("touches", {
      contactId: contactIds[k],
      projectId,
      channel,
      kind,
      at: now - days * DAY,
      text,
    });

  await ctx.db.insert("meetings", {
    projectId,
    contactId: contactIds.dev,
    startTime: now - 2 * DAY,
    transcriptText: SOURCES.find((s) => s.key === "i1")!.text,
    transcriptSourceId: sourceIds.i1,
    summary:
      "Devansh is in an accelerator cohort that assigned 20 interviews as homework. He spends about eight hours a week on research and still feels behind. He would use a tool that books interviews for him.",
    personalLine: "Your point about half the cohort faking their interviews stuck with me.",
    status: "analyzed",
  });
  await ctx.db.insert("meetings", {
    projectId,
    contactId: contactIds.rosa,
    startTime: now - 60 * MIN,
    meetLink: "https://meet.google.com/sample-call",
    status: "booked",
  });

  const team = (agent: string): Doc<"agentRuns">["team"] =>
    agent === "Chief of staff"
      ? "lead"
      : ["Query planner", "Scouts", "Evidence extractors"].includes(agent)
        ? "research"
        : ["Landing-page builder"].includes(agent)
          ? "growth"
          : agent === "Meeting analyzer"
            ? "operations"
            : "strategy";
  const runs: [string, string, number, number][] = [
    ["Landing-page builder", "Wrote index.html", 0.05, 7 * DAY],
    ["Query planner", "Planned 10 searches", 0.04, 6.5 * DAY],
    ["Scouts", "12 sources, 1 skipped", 0, 6.4 * DAY],
    ["Evidence extractors", "9 quotes, 2 rejected", 0.31, 6 * DAY],
    ["Persona analysts", "6 notes, 1 flagged weak", 0.12, 3.4 * DAY],
    ["Chief of staff", "2 tasks, 1 interview ask", 0.05, 3.3 * DAY],
    ["Query planner", "Planned 6 pricing searches", 0.04, 3.3 * DAY],
    ["Scouts", "14 sources, 1 skipped", 0, 3.2 * DAY],
    ["Evidence extractors", "5 quotes, 1 rejected", 0.22, 3.1 * DAY],
    ["Hypothesis judge", "Picked the strongest quotes", 0.06, 3.1 * DAY],
    ["Meeting analyzer", "4 quotes from the call", 0.09, 2 * DAY],
    ["Report synthesizer", "Report v3", 0.08, 1.9 * DAY],
  ];
  for (const [agent, summary, costUsd, ago] of runs)
    await ctx.db.insert("agentRuns", {
      projectId,
      agent,
      team: team(agent),
      backend:
        agent === "Scouts"
          ? "convex"
          : agent === "Hypothesis judge" || agent === "Meeting analyzer"
            ? "claude"
            : "creao",
      status: "done",
      summary,
      costUsd,
      startedAt: now - ago,
      finishedAt: now - ago + 2 * MIN,
    });

  const calls: [string, string, string, boolean, string | undefined, number][] = [
    [
      "Scouts",
      "search_web",
      "site:reddit.com student founders pay for tools",
      true,
      undefined,
      0.01,
    ],
    ["Scouts", "scrape_page", "sample:r3", true, undefined, 0.02],
    ["Scouts", "scrape_page", "sample:r4", true, undefined, 0.02],
    [
      "Scouts",
      "scrape_page",
      "https://www.glassdoor.com/Reviews/student-startup-programs",
      false,
      "glassdoor.com is login-walled or paywalled",
      0,
    ],
    ["Scouts", "search_web", "student startup pricing survey", true, undefined, 0.01],
    ["Scouts", "scrape_page", "sample:w2", true, undefined, 0.02],
    [
      "Scouts",
      "scrape_page",
      "https://www.statista.com/statistics/student-software-spend",
      false,
      "statista.com is login-walled or paywalled",
      0,
    ],
    ["Scouts", "search_web", "campus incubator annual report startups", true, undefined, 0.01],
    ["Scouts", "scrape_page", "sample:p1", true, undefined, 0.02],
    [
      "Scouts",
      "scrape_page",
      "https://example-university.edu/account/login",
      false,
      "Login or account page",
      0,
    ],
  ];
  for (let i = 0; i < calls.length; i++) {
    const [agent, tool, target, allowed, reason, costUsd] = calls[i];
    await ctx.db.insert("toolCalls", {
      projectId,
      agent,
      tool,
      target,
      allowed,
      reason,
      costUsd,
      at: now - 3.2 * DAY + i * MIN,
    });
  }

  // The pricing loop from the spec's sample event log, oldest first.
  const feed: [string, string, number, ("pending" | "done")?][] = [
    [
      "brief.approved",
      "Founder → Chief of staff: brief approved, research and landing page started",
      7 * DAY,
    ],
    [
      "landing.live",
      "Landing page is live at https://founderhub-sample.github.io/founderhub-landing/",
      6.9 * DAY,
    ],
    ["grok.connected", "Grok Bot connected", 6.8 * DAY],
    [
      "persona.flagged",
      'Skeptical VC flags "Student founders will pay $20 a month for research th" as weak',
      3.4 * DAY,
    ],
    ["task.created", "Chief of staff → Research: find pricing talk ($3)", 3.3 * DAY],
    ["task.created", "Chief of staff → Growth: interview priority on pricing", 3.3 * DAY],
    ["research.planned", "Query planner → Scouts: 6 searches", 3.3 * DAY],
    ["evidence.fetched", "Scouts → Extractors: 14 sources fetched, 1 skipped", 3.2 * DAY],
    [
      "guardrail.refused",
      "Legal guardrail check: skipped https://www.glassdoor.com/Reviews/student-startup-programs (glassdoor.com is login-walled or paywalled)",
      3.2 * DAY,
    ],
    [
      "hypothesis.changed",
      "Extractors → Judge: 5 quotes added, 1 rejected (not found in source)",
      3.1 * DAY,
    ],
    ["hypothesis.rescored", `Hypothesis judge: "${H.wtp.slice(0, 60)}" moved down`, 3.1 * DAY],
    [
      "hypothesis.needs_interviews",
      `Chief of staff → Grok Bot: prioritise interviews on "${H.wtp.slice(0, 60)}"`,
      3.1 * DAY,
      "done",
    ],
    ["meeting.booked", "Grok Bot outreach: booked a call with Devansh Kulkarni", 3 * DAY],
    [
      "meeting.analyzed",
      "Meeting analyzer → Grok Bot: 4 quotes added, send a thank-you",
      2 * DAY,
      "done",
    ],
    ["report.published", "Report synthesizer: report v3 published", 1.9 * DAY],
    [
      "waitlist.signup",
      "Waitlist watcher → Grok Bot: new signup (solo founder)",
      0.5 * DAY,
      "pending",
    ],
    ["meeting.booked", "Grok Bot outreach: booked a call with Rosa Okafor", 0.2 * DAY],
  ];
  for (const [type, message, ago, status] of feed)
    await ctx.db.insert("events", {
      projectId,
      type,
      payload: { message, from: message.split(/ →|:/)[0] },
      status: status ?? "done",
      createdAt: now - ago,
      ackedAt: status === "pending" ? undefined : now - ago + 10 * MIN,
    });

  await ctx.db.insert("tasks", {
    projectId,
    team: "research",
    title: "Find a national count of student-led startups",
    hypothesisId: hypIds.market,
    priority: 3,
    budgetUsd: 2,
    status: "open",
    createdBy: "Chief of staff",
    createdAt: now - DAY,
  });

  const notes: [string, HKey, Doc<"personaNotes">["verdict"], string, number[]][] = [
    [
      "Skeptical VC",
      "wtp",
      "weak",
      "Pricing rests on two Reddit comments. Students say they do not pay for tools; a club plan is the more likely buyer.",
      [7, 9],
    ],
    [
      "Target customer",
      "problem",
      "strong",
      "The accelerator founder's eight hours a week matches my own experience. I would switch from asking friends.",
      [14],
    ],
    [
      "Industry analyst",
      "market",
      "unclear",
      "The survey suggests a large pool, but incubator counts are far lower. The gap between the two is the real finding.",
      [5, 6],
    ],
    [
      "Competitor PM",
      "competition",
      "weak",
      "Cited sizing is easy to copy. The defensible part is booking the interviews, not the citations.",
      [4],
    ],
  ];
  for (const [persona, h, verdict, note, ev] of notes)
    await ctx.db.insert("personaNotes", {
      projectId,
      persona,
      hypothesisId: hypIds[h],
      verdict,
      note,
      evidenceIds: ev.map((i) => evidenceIds[i]),
      createdAt: now - 2 * DAY,
    });

  const market = {
    topDown: [
      {
        label: "US undergraduates",
        value: 15_400_000,
        unit: "count" as const,
        note: "Public enrollment statistics",
        sourceId: sourceIds.p3,
      },
      {
        label: "Share working on a startup idea",
        value: 0.05,
        unit: "ratio" as const,
        note: "Survey: about 1 in 20 undergraduates",
        sourceId: sourceIds.p2,
      },
      {
        label: "TAM: student founders × $240 a year",
        value: 184_800_000,
        unit: "usd" as const,
        note: "770,000 founders at $20 a month",
      },
      {
        label: "SAM: share in clubs or accelerators (est. 20%)",
        value: 36_960_000,
        unit: "usd" as const,
        note: "Estimate; no public count of club membership yet",
      },
    ],
    bottomUp: [
      {
        label: "Formal student startups a year",
        value: 9_000,
        unit: "count" as const,
        note: "Incubator summaries count far fewer registered startups",
        sourceId: sourceIds.p1,
      },
      {
        label: "Price from interviews",
        value: 90,
        unit: "usd" as const,
        note: "Interviewees name $5-10 a month; about $7.50 a month over a year",
      },
      {
        label: "TAM: startups × yearly price",
        value: 810_000,
        unit: "usd" as const,
        note: "9,000 × $90",
      },
      {
        label: "SAM: reachable through campus clubs (est. 60%)",
        value: 486_000,
        unit: "usd" as const,
        note: "Estimate from club reach",
      },
    ],
  };
  const reports: [number, string, string, number][] = [
    [
      1,
      "First pass. The problem looks real in Reddit threads; pricing and market size have almost no evidence yet.",
      "First report.",
      5 * DAY,
    ],
    [
      2,
      "Pricing looked strong after two Reddit comments, but the Skeptical VC flagged it as thin. The chief of staff moved $3 to pricing research.",
      "Pricing support came only from Reddit; flagged as weak.",
      3.4 * DAY,
    ],
    [
      3,
      "The problem is well supported, now including an interview. Pricing is weaker: students say they do not pay for tools, though clubs might. The two market sizing methods disagree by a wide margin, which suggests the formal startup count is the real ceiling.",
      "Pricing weaker: three new disproving quotes, including an email reply and a report. The interview strengthened the problem hypothesis.",
      1.9 * DAY,
    ],
  ];
  for (const [version, body, whatChanged, ago] of reports)
    await ctx.db.insert("reports", {
      projectId,
      version,
      body,
      whatChanged,
      validated:
        version === 3
          ? [
              "Validation takes student founders hours they skip",
              "Accelerator cohorts feel it most",
            ]
          : [],
      shaky:
        version === 3
          ? ["$20 a month from individual students", "Club newsletters as a channel"]
          : [],
      experiments: [
        "Offer a $50 club plan to three founder clubs",
        "Post once in the founders Discord and count signups",
        "Ask five repeat founders how they validate",
      ],
      personaNotes: [],
      market: version >= 2 ? market : undefined,
      createdAt: now - ago,
    });

  // 61 unique visitors, 23 form starts, 9 signups.
  for (let i = 0; i < 140; i++)
    await ctx.db.insert("pageEvents", {
      projectId,
      type: "pageview",
      visitorId: `v${i % 61}`,
      at: now - (i / 140) * 5 * DAY,
    });
  for (let i = 0; i < 23; i++)
    await ctx.db.insert("pageEvents", {
      projectId,
      type: "form_focus",
      visitorId: `v${i * 2}`,
      at: now - (i / 23) * 5 * DAY,
    });
  for (let i = 0; i < 9; i++)
    await ctx.db.insert("pageEvents", {
      projectId,
      type: "signup",
      visitorId: `v${i * 5}`,
      at: now - (i / 9) * 5 * DAY,
    });
  return projectId;
}

/** `npx convex run seed:sample` */
export const sample = internalMutation({ args: {}, handler: (ctx) => seedSample(ctx) });

/** "Reset sample" button, so the live demo can run again from a clean state. */
export const resetSample = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return seedSample(ctx);
  },
});

export const sampleTranscript = query({
  args: { meetingId: v.id("meetings") },
  handler: async (ctx, { meetingId }) => {
    const m = await ctx.db.get(meetingId);
    const p = m && (await ctx.db.get(m.projectId));
    return p?.sample ? SAMPLE_TRANSCRIPT : null;
  },
});
