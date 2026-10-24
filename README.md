# FounderHub

A founder types an idea, chats for two minutes, and a fleet of agents spends the next hours proving or disproving it with cited evidence. See [SPEC.md](SPEC.md) for the full design.

## Run it

```sh
vp install
bunx convex dev        # pushes convex/ and keeps it in sync
vp dev                 # web app on http://localhost:5173
bunx convex run seed:sample   # (re)load the FounderHub-on-FounderHub sample project
```

Secrets live only on the Convex deployment (`bunx convex env set NAME value`); `.env` lists them. `vp check` and `vp test` must pass.

## How it fits together

| Piece                                                                                  | Where                                   |
| -------------------------------------------------------------------------------------- | --------------------------------------- |
| Idea chat (Convex Agent + Claude Sonnet 5.5, streamed)                                 | `convex/chat.ts`, `src/Draft.tsx`       |
| Agent runner: Creao if `CREAO_APP_*` is set, else Claude, same prompt and schema       | `convex/agents.ts`                      |
| Research: planner → scouts → extractors → judge                                        | `convex/research.ts`, `convex/judge.ts` |
| Guarded tool layer: legal checks, robots.txt, per-domain rate limit, budget, audit log | `convex/tools.ts`                       |
| Score: `sigmoid(Σ weight × stance × confidence)`, computed in code                     | `convex/lib.ts`                         |
| Landing page publish to GitHub Pages, `/waitlist`, `/track`                            | `convex/landing.ts`                     |
| MCP server for Grok Bot (`POST /mcp`, per-user hashed tokens, daily caps)              | `convex/mcp.ts`                         |
| Meetings: pasted transcript → quotes, summary, thank-you line                          | `convex/meetings.ts`                    |
| Chief of staff (every 5 min), personas (every 30 min), report and market sizing        | `convex/strategy.ts`, `convex/crons.ts` |
| Seeded sample project                                                                  | `convex/seed.ts`                        |

Scouts always fetch in Convex (Apify Google Search + RAG Web Browser, Bright Data as fallback) so every request passes the guard. A quote is stored only if it appears in the fetched text or transcript.

## Creao apps

Each Creao app receives these inputs and must answer with only a JSON object:

- `instructions`: the agent's role, the guardrail rule, and the JSON schema to answer with
- `data`: the agent's inputs as a JSON string (brief, hypotheses, chunks, memory, ...)
- `projectId`, `runId`, `toolsBaseUrl`, `toolsToken`: for apps that call FounderHub tools (`POST {toolsBaseUrl}/search_web | scrape_page | run_actor | add_evidence` with `Authorization: Bearer {toolsToken}` and `runId` in the body)

Configure each app's instructions to "Follow `instructions`; read `data`; reply with the JSON object only". FounderHub reads the answer from `result.text` or `result.chatText`, whichever matches the schema. If a Creao call fails, the run falls back to Claude.

## Demo

1. Sign in with GitHub, type an idea, chat, approve. The Hypotheses tab shows the fleet lighting up and bars moving as quotes land.
2. Customers tab: copy the Grok Bot setup prompt; the pill turns Connected on its first call.
3. Open the sample project (Home, or "See a sample" when signed out). On Customers, paste the sample transcript into Rosa's call to run the meeting analyzer live. "Reset sample" restores it.
