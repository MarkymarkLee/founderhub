# Product

<!-- impeccable:product-schema 1 -->

## Platform

web (desktop only; no mobile layout for now)

## Users

Berkeley student founders first. They should spend most of their time building, yet they still need to validate an idea and learn how market analysis works. A founder types an idea, chats for two to three minutes, approves the Idea Brief, and then checks the dashboard between building sessions while agents work unattended. Active founder time is about five minutes plus any interviews.

Cal Hacks 13.0 judges are a demo audience, not the user. Design decisions serve the founder.

## Product Purpose

FounderHub proves or disproves a startup idea with cited evidence. A fleet of agents spends hours collecting it, and the output is a live dashboard: every hypothesis scored and backed by quotes, a customer list, and a sourced TAM/SAM/SOM. Success means the founder knows which hypotheses hold, why, and what to test next, without doing the research legwork themselves.

## Positioning

A closed validation loop run by an autonomous agent fleet. Idea → brief and hypotheses → evidence, landing page, outreach and interviews → rescoring, all in one place. A chief-of-staff agent manages four agent teams (Research, Strategy, Growth, Operations) through one shared Convex blackboard. The founder acts as CEO and makes only founder decisions: approve the brief, set the budget, show up to calls.

## Operating Context

- Sign in with GitHub. The same token publishes the founder's landing page to their own repo on GitHub Pages.
- Grok Bot runs outreach from the founder's personal Gmail and LinkedIn through FounderHub's MCP server, with strict daily caps. By default it contacts only waitlist signups and contacts the founder adds by hand.
- Interviews happen on calls. For now the founder pastes the transcript into a meeting row; recording upload is a placeholder.
- The dashboard updates live through Convex real-time queries.
- Surfaces in the app: Home, Draft (idea chat), Project, Hypotheses and Hypothesis page, Customers, Market, Report, Fleet, Activity, Settings, Sign in.

## Capabilities and Constraints

- Hypotheses are typed (problem, customer, willingness to pay, channel, competition, market size), and each must be falsifiable: it says what evidence would disprove it.
- Score = `sigmoid(Σ weight × stance × confidence)`, computed in code. Source weights: interview 3, waitlist behaviour 2.5, reply 2, and so on (see SPEC.md).
- Market sizing names the technique behind each number (top-down, bottom-up, interviews). A gap between methods is shown as a finding.
- Every agent action passes legal, robots.txt, rate-limit, budget and quota guards and is written to an audit log. Refused actions are visible.
- The founder sets a credit budget per project.
- Customers tab is display only.
- Later, not now: Chrome extension recording, Cartesia transcription.
- Terminology: Idea Brief, hypothesis, evidence/quote, stance (supports / contradicts / neutral), fleet, chief of staff, blackboard, persona analysts, report version, "what changed".

## Brand Commitments

- Name: FounderHub. A wordmark component exists (`src/Wordmark.tsx`).
- Plain, direct language. Outreach copy is plain text and personal, never spammy.

## Evidence on Hand

- Seeded sample project "FounderHub-on-FounderHub" (`convex/seed.ts`, `bunx convex run seed:sample`) holds the replies, calls and rescoring used in the demo.
- SPEC.md's sample event log and score changes (e.g. 62% → 41% → 33%) are illustrative only. Real figures come from the seeded project.
- No real testimonials, customer logos, press or usage metrics exist. Do not invent them.

## Product Principles

1. Quotes first, score second. Founders trust words they can read, not a number. No quote, no claim.
2. Show the method. Every score and market number explains how it was produced, so the founder learns while reading.
3. Make the fleet visible. Handoffs, running agents, spend and refusals are on screen and replayable.
4. The founder only makes founder decisions. Everything else runs unattended and reports back.
5. Guardrails are visible. Budgets, caps and refused actions are shown, never hidden.
