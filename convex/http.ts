import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { handle as mcp } from "./mcp";
import { track, waitlist } from "./landing";
import { runActor, scrapePage, searchWeb } from "./tools";

const http = httpRouter();

auth.addHttpRoutes(http);

http.route({ path: "/mcp", method: "POST", handler: mcp });
http.route({ path: "/mcp", method: "GET", handler: mcp });

for (const method of ["POST", "OPTIONS"] as const) {
  http.route({ path: "/waitlist", method, handler: waitlist });
  http.route({ path: "/track", method, handler: track });
}

const secretOk = (given: string | null) =>
  !!process.env.CREAO_WEBHOOK_SECRET && given === process.env.CREAO_WEBHOOK_SECRET;

http.route({
  path: "/creao/webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    if (!secretOk(url.searchParams.get("secret")))
      return new Response("Forbidden", { status: 403 });
    const body = (await req.json()) as {
      status: string;
      result?: { text?: string; chatText?: string };
    };
    await ctx.runAction(internal.agents.completeFromCreao, {
      runId: url.searchParams.get("run") as Id<"agentRuns">,
      status: body.status,
      texts: [body.result?.text, body.result?.chatText].filter((t): t is string => !!t),
    });
    return new Response("ok");
  }),
});

// Tools Creao agents call mid-run. Every call goes through the same guard layer as local runs.
http.route({
  pathPrefix: "/tools/",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    if (!secretOk(req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? null))
      return new Response("Forbidden", { status: 403 });
    const tool = new URL(req.url).pathname.split("/").pop();
    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    const run = await ctx.runQuery(internal.agents.inputsFor, { runId: body.runId });
    if (!run || run.status !== "running")
      return Response.json({ error: "Unknown or finished runId" }, { status: 400 });
    const base = { projectId: run.projectId, agentRunId: run._id, agent: run.agent };
    try {
      switch (tool) {
        case "search_web":
          return Response.json(
            await searchWeb(ctx, {
              ...base,
              query: String(body.query),
              kind:
                body.kind === "forum"
                  ? "forum"
                  : body.kind === "public data"
                    ? "public data"
                    : "web",
            }),
          );
        case "scrape_page":
          return Response.json(await scrapePage(ctx, { ...base, url: String(body.url) }));
        case "run_actor":
          return Response.json(
            await runActor(ctx, {
              ...base,
              actorId: String(body.actorId),
              input: body.input ?? {},
            }),
          );
        case "add_evidence": {
          const summary = await ctx.runMutation(internal.research.onExtract, {
            projectId: run.projectId,
            runId: run._id,
            output: { items: body.items ?? [], contacts: body.contacts ?? [], memory: "" },
            context: null,
          });
          return Response.json({ summary });
        }
        default:
          return Response.json({ error: `Unknown tool ${tool}` }, { status: 404 });
      }
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500 });
    }
  }),
});

export default http;
