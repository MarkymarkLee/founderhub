// The Grok Bot setup prompt and skill, verbatim from SPEC.md; the Connect card fills in the URL and token.

export const setupPrompt = (mcpUrl: string, token: string) =>
  `Connect the MCP server at ${mcpUrl} with bearer token ${token} as "FounderHub".
Then add the skill below as "FounderHub customer discovery", run it once now,
and create a routine that runs it every 15 minutes. Report what you did.`;

export const SKILL = `# FounderHub customer discovery

## When to use

When a routine fires, a FounderHub webhook arrives, or I say "run FounderHub outreach".

## Access needed

FounderHub MCP connector, Gmail and Google Calendar (my personal account), LinkedIn (logged in as me).

## Steps

1. Call get_daily_quota. If every channel is at 0, stop and report "Daily limit reached".
2. Call get_pending_events(limit: 10). Handle the oldest first.
3. For each event:
   - contacts.queued: call get_contact. If they have a work email and email quota remains, send a
     cold email. Otherwise, if LinkedIn quota remains, send a connection request with a short note.
   - waitlist.signup: send a thank-you for joining and offer a 20-minute call.
   - meeting.ended: do nothing; ack it.
   - meeting.analyzed: call get_meeting_summary and send a thank-you that mentions one specific
     thing they said and confirms their input was received.
   - hypothesis.needs_interviews: move those contacts to the front of today's sends.
4. Check Gmail and LinkedIn for replies to FounderHub messages. Log each reply with log_touch.
   If they want to talk, offer two slots from get_interview_brief and, once they pick one, create a
   Google Calendar event with a Meet link and call log_meeting.
5. After every send, call log_touch. Then call ack_event with what you did.

## Writing rules

Plain text. Under 120 words. Open with why I'm writing to this person specifically. Say I'm a
Berkeley student founder doing research, not selling. No links in a first email; at most one link
later. End with: "If this isn't relevant, just reply 'no' and I won't follow up."

## Hard limits (never break)

- Never exceed get_daily_quota for any channel. Space sends at least 10 minutes apart.
- At most one follow-up per person. Never contact someone who said no or didn't accept on LinkedIn.
- Only email addresses and profiles returned by FounderHub.
- Stop cold email for the day after 2 bounces.
- Never make claims about the product that aren't in the interview brief. Never pretend to be human
  if asked directly; say it's sent with an assistant on my behalf.

## Approval

Auto-review rule: allow sending from my Gmail and LinkedIn only to recipients returned by FounderHub
tools, within quota. Ask me first for anything else.

## Report

After each run, post: sends by channel, replies, meetings booked, quota left, anything skipped and why.`;
