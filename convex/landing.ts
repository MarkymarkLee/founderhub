import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { httpAction, internalAction, internalMutation, internalQuery } from "./_generated/server";
import type { Output } from "./agents";
import { addEvent, sha256 } from "./lib";
import { rateLimiter } from "./tools";

export const build = internalAction({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const { brief } = await ctx.runQuery(internal.research.briefAndHypotheses, { projectId });
    await ctx.runAction(internal.agents.run, { projectId, agent: "landing", inputs: { brief } });
  },
});

/** The form handler and analytics, injected by FounderHub so the agent never writes scripts. */
export function analyticsScript(siteUrl: string, slug: string) {
  return `<script>
(() => {
  const base = ${JSON.stringify(siteUrl)}, project = ${JSON.stringify(slug)};
  let vid = sessionStorage.getItem("fh_vid");
  if (!vid) { vid = crypto.randomUUID(); sessionStorage.setItem("fh_vid", vid); }
  const send = (path, body) => fetch(base + path + "?project=" + project, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visitorId: vid, ...body })
  });
  send("/track", { type: "pageview", referrer: document.referrer, utm: location.search });
  const form = document.getElementById("waitlist");
  if (!form) return;
  form.addEventListener("focusin", () => send("/track", { type: "form_focus" }), { once: true });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector("button");
    if (btn) btn.disabled = true;
    const res = await send("/waitlist", Object.fromEntries(new FormData(form)));
    form.innerHTML = res.ok ? "<p>Thanks! You're on the list.</p>" : "<p>Something went wrong. Please try again.</p>";
  });
})();
</script>`;
}

export const onBuilt = internalMutation({
  args: {
    projectId: v.id("projects"),
    runId: v.id("agentRuns"),
    output: v.any(),
    context: v.any(),
  },
  handler: async (ctx, { projectId, output }) => {
    const project = (await ctx.db.get(projectId))!;
    let html = (output as Output<"landing">).html.replace(/<script[\s\S]*?<\/script>/gi, "");
    const script = analyticsScript(process.env.CONVEX_SITE_URL!, project.slug);
    html = html.includes("</body>") ? html.replace("</body>", `${script}\n</body>`) : html + script;
    await ctx.db.patch(projectId, { landingStatus: "publishing", landingError: undefined });
    await addEvent(ctx, projectId, "landing.built", {
      message: "Landing-page builder → GitHub: page written, publishing",
      from: "Landing-page builder",
    });
    await ctx.scheduler.runAfter(0, internal.landing.publish, { projectId, html });
    return "Wrote index.html";
  },
});

export const ownerToken = internalQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const project = await ctx.db.get(projectId);
    const user = project?.userId ? await ctx.db.get(project.userId) : null;
    return user?.githubToken && user.githubLogin
      ? {
          token: user.githubToken,
          login: user.githubLogin,
          slug: project!.slug,
          idea: project!.ideaText,
        }
      : null;
  },
});

export const setLanding = internalMutation({
  args: {
    projectId: v.id("projects"),
    landingStatus: v.union(v.literal("publishing"), v.literal("live"), v.literal("failed")),
    landingRepo: v.optional(v.string()),
    pagesUrl: v.optional(v.string()),
    landingError: v.optional(v.string()),
  },
  handler: async (ctx, { projectId, ...patch }) => {
    await ctx.db.patch(projectId, patch);
    if (patch.landingStatus === "live")
      await addEvent(ctx, projectId, "landing.live", {
        message: `Landing page is live at ${(await ctx.db.get(projectId))?.pagesUrl}`,
        from: "Landing-page builder",
      });
  },
});

const base64 = (text: string) => btoa(String.fromCharCode(...new TextEncoder().encode(text)));

/** Create {slug}-landing in the founder's GitHub, push index.html, turn on Pages. */
export const publish = internalAction({
  args: { projectId: v.id("projects"), html: v.string() },
  handler: async (ctx, { projectId, html }) => {
    const owner = await ctx.runQuery(internal.landing.ownerToken, { projectId });
    if (!owner) {
      await ctx.runMutation(internal.landing.setLanding, {
        projectId,
        landingStatus: "failed",
        landingError: "Sign in with GitHub again so FounderHub can publish.",
      });
      return;
    }
    const repo = `${owner.slug}-landing`;
    const gh = (path: string, method = "GET", body?: unknown) =>
      fetch(`https://api.github.com${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${owner.token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "FounderHub",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    try {
      const created = await gh("/user/repos", "POST", {
        name: repo,
        description: `Landing page for: ${owner.idea.slice(0, 120)}`,
        auto_init: true,
      });
      if (!created.ok && created.status !== 422) throw new Error(`Create repo: ${created.status}`);
      const existing = await gh(`/repos/${owner.login}/${repo}/contents/index.html`);
      const sha = existing.ok ? ((await existing.json()) as { sha: string }).sha : undefined;
      const put = await gh(`/repos/${owner.login}/${repo}/contents/index.html`, "PUT", {
        message: sha ? "Update landing page" : "Add landing page",
        content: base64(html),
        sha,
      });
      if (!put.ok)
        throw new Error(`Push index.html: ${put.status} ${(await put.text()).slice(0, 200)}`);
      const pages = await gh(`/repos/${owner.login}/${repo}/pages`, "POST", {
        source: { branch: "main", path: "/" },
      });
      if (!pages.ok && pages.status !== 409) throw new Error(`Enable Pages: ${pages.status}`);
      const pagesUrl = `https://${owner.login.toLowerCase()}.github.io/${repo}/`;
      await ctx.runMutation(internal.landing.setLanding, {
        projectId,
        landingStatus: "publishing",
        landingRepo: `${owner.login}/${repo}`,
        pagesUrl,
      });
      await ctx.scheduler.runAfter(20_000, internal.landing.checkLive, {
        projectId,
        pagesUrl,
        attempt: 1,
      });
    } catch (e) {
      await ctx.runMutation(internal.landing.setLanding, {
        projectId,
        landingStatus: "failed",
        landingError: String(e).slice(0, 300),
      });
    }
  },
});

export const checkLive = internalAction({
  args: { projectId: v.id("projects"), pagesUrl: v.string(), attempt: v.number() },
  handler: async (ctx, { projectId, pagesUrl, attempt }) => {
    const res = await fetch(pagesUrl, { method: "HEAD" }).catch(() => null);
    if (res?.ok)
      await ctx.runMutation(internal.landing.setLanding, { projectId, landingStatus: "live" });
    else if (attempt < 20)
      await ctx.scheduler.runAfter(20_000, internal.landing.checkLive, {
        projectId,
        pagesUrl,
        attempt: attempt + 1,
      });
    else
      await ctx.runMutation(internal.landing.setLanding, {
        projectId,
        landingStatus: "failed",
        landingError: "GitHub Pages did not come up within 7 minutes",
      });
  },
});

// ── Public endpoints for the landing page ────────────────────────────────

export const bySlug = internalQuery({
  args: { slug: v.string() },
  handler: (ctx, { slug }) =>
    ctx.db
      .query("projects")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique(),
});

function allowedOrigin(project: Doc<"projects"> | null, origin: string | null) {
  if (!project?.pagesUrl || !origin) return null;
  return new URL(project.pagesUrl).origin === origin ? origin : null;
}

const cors = (origin: string) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  Vary: "Origin",
});

/** Shared CORS, origin and per-IP rate-limit checks for /waitlist and /track. */
function publicEndpoint(
  limit: "waitlist" | "track",
  handle: (
    projectId: Id<"projects">,
    body: Record<string, string>,
    ctx: Parameters<Parameters<typeof httpAction>[0]>[0],
  ) => Promise<void>,
) {
  return httpAction(async (ctx, req) => {
    const slug = new URL(req.url).searchParams.get("project") ?? "";
    const project = await ctx.runQuery(internal.landing.bySlug, { slug });
    const origin = allowedOrigin(project, req.headers.get("Origin"));
    if (!origin) return new Response("Forbidden origin", { status: 403 });
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    const key = `${slug}:${await sha256(`${process.env.IP_HASH_SALT}${ip}`)}`;
    const { ok } = await rateLimiter.limit(ctx, limit, { key });
    if (!ok) return new Response("Too many requests", { status: 429, headers: cors(origin) });

    const body = (await req.json().catch(() => ({}))) as Record<string, string>;
    await handle(project!._id, body, ctx);
    return new Response("ok", { headers: cors(origin) });
  });
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export const waitlist = publicEndpoint("waitlist", async (projectId, body, ctx) => {
  const email = str(body.email, 200).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return;
  await ctx.runMutation(internal.landing.recordSignup, {
    projectId,
    email,
    role: str(body.role, 100),
    companySize: str(body.company_size, 40),
    useCase: str(body.use_case, 1000),
    visitorId: str(body.visitorId, 64) || "unknown",
  });
});

export const track = publicEndpoint("track", async (projectId, body, ctx) => {
  const type = body.type;
  if (type !== "pageview" && type !== "form_focus") return;
  await ctx.runMutation(internal.landing.recordPageEvent, {
    projectId,
    type,
    visitorId: str(body.visitorId, 64) || "unknown",
    referrer: str(body.referrer, 300) || undefined,
    utm: str(body.utm, 300) || undefined,
  });
});

export const recordPageEvent = internalMutation({
  args: {
    projectId: v.id("projects"),
    type: v.union(v.literal("pageview"), v.literal("form_focus")),
    visitorId: v.string(),
    referrer: v.optional(v.string()),
    utm: v.optional(v.string()),
  },
  handler: (ctx, a) => ctx.db.insert("pageEvents", { ...a, at: Date.now() }),
});

/** Waitlist watcher: a signup becomes a contact, an outreach event and evidence. */
export const recordSignup = internalMutation({
  args: {
    projectId: v.id("projects"),
    email: v.string(),
    role: v.string(),
    companySize: v.string(),
    useCase: v.string(),
    visitorId: v.string(),
  },
  handler: async (ctx, a) => {
    const dupe = await ctx.db
      .query("contacts")
      .withIndex("by_project_email", (q) => q.eq("projectId", a.projectId).eq("email", a.email))
      .first();
    if (dupe) return;
    await ctx.db.insert("pageEvents", {
      projectId: a.projectId,
      type: "signup",
      visitorId: a.visitorId,
      at: Date.now(),
    });
    const contactId = await ctx.db.insert("contacts", {
      projectId: a.projectId,
      name: a.email.split("@")[0],
      role: a.role || undefined,
      email: a.email,
      origin: "waitlist",
      status: "queued",
      keyQuote: a.useCase || undefined,
      priority: 2,
      createdAt: Date.now(),
    });
    await addEvent(ctx, a.projectId, "waitlist.signup", {
      message: `Waitlist watcher → Grok Bot: new signup (${a.role || "no role given"})`,
      from: "Waitlist watcher",
      contactId,
    });
    if (a.useCase.length < 20) return;
    const sourceId = await ctx.db.insert("sources", {
      projectId: a.projectId,
      url: `waitlist:${contactId}`,
      title: "Waitlist answer",
      sourceType: "waitlist",
      text: `Role: ${a.role || "not given"}. Company size: ${a.companySize || "not given"}. What would you use this for? ${a.useCase}`,
      fetchedAt: Date.now(),
      extractedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.research.extractSource, {
      projectId: a.projectId,
      sourceId,
      types: ["willingness to pay", "channel", "problem"],
    });
  },
});
