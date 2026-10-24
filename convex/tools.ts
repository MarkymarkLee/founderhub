import { HOUR, RateLimiter, SECOND } from "@convex-dev/rate-limiter";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { type ActionCtx, internalAction, internalMutation } from "./_generated/server";
import { rag } from "./ai";
import { addEvent } from "./lib";
import { vSourceType } from "./schema";

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  domain: { kind: "fixed window", rate: 1, period: 3 * SECOND }, // one request per domain every few seconds
  waitlist: { kind: "fixed window", rate: 10, period: HOUR },
  track: { kind: "token bucket", rate: 120, period: HOUR, capacity: 30 },
});

// Login-walled or paywalled sites the scouts may not fetch directly.
const BLOCKED_DOMAINS = [
  "linkedin.com",
  "facebook.com",
  "instagram.com",
  "x.com",
  "twitter.com",
  "tiktok.com",
  "glassdoor.com",
  "wsj.com",
  "ft.com",
  "bloomberg.com",
  "economist.com",
  "statista.com",
  "ibisworld.com",
  "nytimes.com",
  "medium.com",
];
const LOGIN_PATH = /\/(login|signin|sign-in|signup|account|checkout|cart)(\/|$|\?)/i;
const TOOL_COST_USD = { search_web: 0.01, scrape_page: 0.02, run_actor: 0.03 } as const;
// Actors Creao scouts may run through run_actor.
const ACTOR_ALLOWLIST = [
  "apify/rag-web-browser",
  "apify/google-search-scraper",
  "apify/website-content-crawler",
];

export function legalCheck(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return "Not a valid URL";
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return "Only public web pages";
  if (u.username || u.password) return "No credentials in URLs";
  const host = u.hostname.replace(/^www\./, "");
  const blocked = BLOCKED_DOMAINS.find((d) => host === d || host.endsWith(`.${d}`));
  if (blocked) return `${blocked} is login-walled or paywalled`;
  if (LOGIN_PATH.test(u.pathname)) return "Login or account page";
  return null;
}

/** Records every tool call in the audit log; refuses over-budget and off-limits calls. */
export const guard = internalMutation({
  args: {
    projectId: v.id("projects"),
    agentRunId: v.optional(v.id("agentRuns")),
    agent: v.string(),
    tool: v.string(),
    target: v.string(),
    refusal: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    const project = await ctx.db.get(a.projectId);
    const costUsd = TOOL_COST_USD[a.tool as keyof typeof TOOL_COST_USD] ?? 0;
    let reason = a.refusal ?? null;
    if (!project || project.status === "paused") reason ??= "Project is paused";
    else if (project.spentUsd + costUsd > project.budgetUsd) reason ??= "Over budget";
    const allowed = reason === null;
    await ctx.db.insert("toolCalls", {
      projectId: a.projectId,
      agentRunId: a.agentRunId,
      agent: a.agent,
      tool: a.tool,
      target: a.target.slice(0, 300),
      allowed,
      reason: reason ?? undefined,
      costUsd: allowed ? costUsd : 0,
      at: Date.now(),
    });
    if (allowed) await ctx.db.patch(a.projectId, { spentUsd: project!.spentUsd + costUsd });
    else if (reason !== "Over budget" && reason !== "Project is paused")
      await addEvent(ctx, a.projectId, "guardrail.refused", {
        message: `Legal guardrail check: skipped ${a.target.slice(0, 80)} (${reason})`,
        from: "Legal guardrail check",
      });
    return { allowed, reason };
  },
});

async function robotsAllows(url: string) {
  try {
    const u = new URL(url);
    const res = await fetch(`${u.origin}/robots.txt`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return true;
    let applies = false;
    for (const raw of (await res.text()).split("\n")) {
      const line = raw.split("#")[0].trim();
      const [k, ...rest] = line.split(":");
      const val = rest.join(":").trim();
      if (/^user-agent$/i.test(k)) applies = val === "*";
      else if (applies && /^disallow$/i.test(k) && val && u.pathname.startsWith(val)) return false;
    }
    return true;
  } catch {
    return true;
  }
}

async function waitForDomain(ctx: ActionCtx, url: string) {
  const key = new URL(url).hostname;
  const { retryAfter } = await rateLimiter.limit(ctx, "domain", { key, reserve: true });
  if (retryAfter) await new Promise((r) => setTimeout(r, retryAfter));
}

type Page = { url: string; title: string; text: string };

async function apify(actor: string, input: unknown) {
  const res = await fetch(
    `https://api.apify.com/v2/acts/${actor.replace("/", "~")}/run-sync-get-dataset-items?token=${process.env.APIFY_TOKEN}&timeout=120`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  if (!res.ok) throw new Error(`Apify ${actor} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as unknown[];
}

async function brightData(zone: string | undefined, url: string) {
  if (!zone || !process.env.BRIGHTDATA_API_KEY) throw new Error("Bright Data zone not configured");
  const res = await fetch("https://api.brightdata.com/request", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.BRIGHTDATA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ zone, url, format: "raw" }),
  });
  if (!res.ok) throw new Error(`Bright Data ${res.status}`);
  return res.text();
}

const htmlToText = (html: string) =>
  html
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

/** Google results via Apify's Google Search scraper; Bright Data SERP as fallback. */
async function search(query: string, max: number): Promise<{ url: string; title: string }[]> {
  try {
    const [item] = (await apify("apify/google-search-scraper", {
      queries: query,
      resultsPerPage: 10,
      maxPagesPerQuery: 1,
    })) as { organicResults?: { url: string; title: string }[] }[];
    return (item?.organicResults ?? []).slice(0, max);
  } catch (e) {
    console.warn("Apify search failed, trying Bright Data", e);
    const serp = JSON.parse(
      await brightData(
        process.env.BRIGHTDATA_SERP_ZONE,
        `https://www.google.com/search?q=${encodeURIComponent(query)}&brd_json=1`,
      ),
    ) as { organic?: { link: string; title: string }[] };
    return (serp.organic ?? []).slice(0, max).map((r) => ({ url: r.link, title: r.title }));
  }
}

async function fetchPage(url: string): Promise<Page> {
  try {
    const [item] = (await apify("apify/rag-web-browser", {
      query: url,
      maxResults: 1,
      outputFormats: ["markdown"],
    })) as { metadata?: { title?: string }; markdown?: string }[];
    if (item?.markdown) return { url, title: item.metadata?.title ?? "", text: item.markdown };
    throw new Error("Empty page");
  } catch {
    const html = await brightData(process.env.BRIGHTDATA_UNLOCKER_ZONE, url).catch(async () =>
      (await fetch(url, { signal: AbortSignal.timeout(15000) })).text(),
    );
    return { url, title: html.match(/<title>([^<]*)/i)?.[1] ?? "", text: htmlToText(html) };
  }
}

type ToolArgs = { projectId: Id<"projects">; agentRunId?: Id<"agentRuns">; agent: string };
const who = ({ projectId, agentRunId, agent }: ToolArgs) => ({ projectId, agentRunId, agent });

/** Forum voices from Hacker News comments via its public Algolia API, one source per thread. */
async function searchForum(ctx: ActionCtx, a: ToolArgs & { query: string }) {
  const res = await fetch(
    // optionalWords ranks by how many words match; plain queries require every word and find nothing.
    `https://hn.algolia.com/api/v1/search?tags=comment&hitsPerPage=30&query=${encodeURIComponent(a.query)}&optionalWords=${encodeURIComponent(a.query)}`,
  );
  if (!res.ok) throw new Error(`HN search ${res.status}`);
  const { hits } = (await res.json()) as {
    hits: { author: string; story_id: number; story_title?: string; comment_text?: string }[];
  };
  const threads = new Map<number, { title: string; lines: string[] }>();
  for (const h of hits) {
    if (!h.comment_text || !h.story_id) continue;
    const t = threads.get(h.story_id) ?? {
      title: h.story_title ?? "Hacker News thread",
      lines: [],
    };
    t.lines.push(`${h.author}: ${htmlToText(h.comment_text)}`);
    threads.set(h.story_id, t);
  }
  const sources: Id<"sources">[] = [];
  for (const [storyId, t] of [...threads].slice(0, 5)) {
    const id = await ctx.runMutation(internal.tools.ingest, {
      projectId: a.projectId,
      url: `https://news.ycombinator.com/item?id=${storyId}`,
      title: `Hacker News: ${t.title}`,
      text: t.lines.join("\n\n"),
      sourceType: "forum",
      meta: `${t.lines.length} comments`,
    });
    if (id) sources.push(id);
  }
  return sources;
}

/** search_web: runs the search and stores each allowed result as a source. */
export async function searchWeb(
  ctx: ActionCtx,
  a: ToolArgs & { query: string; kind: "forum" | "web" | "public data" },
) {
  const query = a.query.replace(/\s+/g, " ").trim();
  // Planners sometimes emit empty or placeholder queries; searching them only wastes credits.
  if (query.length < 4 || /^(undefined|null)$/i.test(query))
    return { sources: [] as Id<"sources">[], skipped: 1 };
  const g = await ctx.runMutation(internal.tools.guard, {
    ...who(a),
    tool: "search_web",
    target: a.kind === "forum" ? `Hacker News comments: ${query}` : query,
  });
  if (!g.allowed) return { sources: [] as Id<"sources">[], skipped: 1 };
  if (a.kind === "forum") return { sources: await searchForum(ctx, { ...a, query }), skipped: 0 };
  const results = await search(query, 3);
  let skipped = 0;
  const ids = await Promise.all(
    results.map(async (r): Promise<Id<"sources"> | null> => {
      const { sourceId } = await scrapePage(ctx, {
        ...a,
        url: r.url,
        sourceType: a.kind === "public data" ? "public data" : "web",
      }).catch(() => ({ sourceId: null }));
      if (!sourceId) skipped++;
      return sourceId;
    }),
  );
  const sources = ids.filter((id): id is Id<"sources"> => !!id);
  return { sources, skipped };
}

/** scrape_page: one URL, after the legal, robots.txt and per-domain rate checks. */
export async function scrapePage(
  ctx: ActionCtx,
  a: ToolArgs & { url: string; sourceType?: "web" | "report" | "public data" },
) {
  const refusal =
    legalCheck(a.url) ?? ((await robotsAllows(a.url)) ? null : "robots.txt disallows it");
  const g = await ctx.runMutation(internal.tools.guard, {
    ...who(a),
    tool: "scrape_page",
    target: a.url,
    refusal: refusal ?? undefined,
  });
  if (!g.allowed) return { sourceId: null, reason: g.reason };
  await waitForDomain(ctx, a.url);
  const page = await fetchPage(a.url);
  const sourceType = a.url.includes("reddit.com") ? "reddit" : (a.sourceType ?? "web");
  return {
    sourceId: await ctx.runMutation(internal.tools.ingest, {
      projectId: a.projectId,
      ...page,
      sourceType,
    }),
  };
}

/** run_actor: allowlisted Apify actors only. */
export async function runActor(ctx: ActionCtx, a: ToolArgs & { actorId: string; input: unknown }) {
  const refusal = ACTOR_ALLOWLIST.includes(a.actorId) ? undefined : "Actor not on the allowlist";
  const g = await ctx.runMutation(internal.tools.guard, {
    ...who(a),
    tool: "run_actor",
    target: a.actorId,
    refusal,
  });
  if (!g.allowed) return { items: [], reason: g.reason };
  return { items: (await apify(a.actorId, a.input)).slice(0, 20) };
}

/** Store a fetched page (deduped by URL) and embed it into the project's RAG namespace. */
export const ingest = internalMutation({
  args: {
    projectId: v.id("projects"),
    url: v.string(),
    title: v.string(),
    text: v.string(),
    sourceType: vSourceType,
    meta: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    if (a.text.trim().length < 200) return null;
    const existing = await ctx.db
      .query("sources")
      .withIndex("by_project_url", (q) => q.eq("projectId", a.projectId).eq("url", a.url))
      .first();
    if (existing) return null;
    const id = await ctx.db.insert("sources", {
      projectId: a.projectId,
      url: a.url,
      title: a.title.slice(0, 200),
      sourceType: a.sourceType,
      text: a.text.slice(0, 30_000),
      meta: a.meta,
      fetchedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.tools.embed, { sourceId: id });
    return id;
  },
});

export const embed = internalAction({
  args: { sourceId: v.id("sources") },
  handler: async (ctx, { sourceId }) => {
    const source: Doc<"sources"> | null = await ctx.runQuery(internal.research.source, {
      sourceId,
    });
    if (!source) return;
    const { entryId } = await rag.add(ctx, {
      namespace: source.projectId,
      key: sourceId,
      title: source.title ?? source.url,
      text: source.text,
      filterValues: [
        { name: "sourceType", value: source.sourceType },
        { name: "hypothesisId", value: "" },
      ],
    });
    await ctx.runMutation(internal.research.setRagKey, { sourceId, ragKey: entryId });
  },
});
