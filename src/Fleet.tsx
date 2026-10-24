import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { ago, Card, usd } from "./ui.tsx";

// The org chart from the spec: the founder is CEO, a chief of staff runs four teams.
// Each team is a line on the system map; its agents are the stations.
const TEAMS: { name: string; line: string; agents: string[] }[] = [
  { name: "Lead", line: "bg-ink-2", agents: ["Chief of staff"] },
  {
    name: "Research",
    line: "bg-line-yellow",
    agents: ["Query planner", "Scouts", "Evidence extractors"],
  },
  {
    name: "Strategy",
    line: "bg-line-red",
    agents: ["Hypothesis judge", "Persona analysts", "Report synthesizer"],
  },
  {
    name: "Growth",
    line: "bg-line-green",
    agents: ["Landing-page builder", "Waitlist watcher", "Grok Bot outreach"],
  },
  {
    name: "Operations",
    line: "bg-line-blue",
    agents: ["Meeting analyzer", "Legal guardrail check"],
  },
];
const ACTIVE_MS = 90_000;

export function Fleet({
  projectId,
  feedSize = 6,
}: {
  projectId: Id<"projects">;
  feedSize?: number;
}) {
  const fleet = useQuery(api.projects.fleet, { projectId });
  if (!fleet)
    return (
      <div className="h-48 animate-pulse bg-sunk motion-reduce:animate-none" aria-busy="true" />
    );
  const now = Date.now();
  const spentPct = Math.min(100, (fleet.spentUsd / fleet.budgetUsd) * 100);

  return (
    <Card boxed className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
      <div className="grid content-start gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-bold">Agent fleet</h2>
          <p className="text-xs text-mute">
            <span className="font-num tabular-nums">
              {usd(fleet.spentUsd)} of {usd(fleet.budgetUsd)}
            </span>{" "}
            spent
          </p>
        </div>
        <div
          className="h-2 bg-sunk"
          role="meter"
          aria-label="Budget spent"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(spentPct)}
        >
          <div
            className="h-full origin-left bg-action"
            style={{ transform: `scaleX(${spentPct / 100})` }}
          />
        </div>
        <ol className="grid gap-5" aria-label="Teams">
          {TEAMS.map((team) => {
            const spent = team.agents.reduce((s, a) => s + (fleet.agents[a]?.spent ?? 0), 0);
            return (
              <li key={team.name} className="grid grid-cols-[6rem_1fr] items-start gap-4">
                <p className="grid gap-0.5 pt-0.5 text-xs">
                  <span className="font-bold">{team.name}</span>
                  {spent > 0 && (
                    <span className="font-num text-mute tabular-nums">{usd(spent)}</span>
                  )}
                </p>
                <ul className="relative flex justify-between gap-2">
                  <span className={`absolute inset-x-2 top-[7px] h-1 ${team.line}`} aria-hidden />
                  {team.agents.map((name) => {
                    const a = fleet.agents[name];
                    const running = !!a && (a.running > 0 || now - a.lastAt < ACTIVE_MS);
                    return (
                      <li
                        key={name}
                        title={a?.lastSummary ? `${name}: ${a.lastSummary}` : name}
                        className="grid min-w-0 flex-1 justify-items-center gap-1.5 text-center first-of-type:justify-items-start first-of-type:text-left last-of-type:not-first-of-type:justify-items-end last-of-type:not-first-of-type:text-right"
                      >
                        <span
                          className={`size-[18px] rounded-full border-4 transition-colors duration-500 ${
                            running
                              ? "border-ink bg-line-yellow motion-safe:animate-pulse"
                              : a
                                ? "border-ink bg-panel"
                                : "border-rule-strong bg-panel"
                          }`}
                          aria-hidden
                        />
                        <span
                          className={`text-xs leading-tight ${running ? "font-bold text-ink" : a ? "text-ink-2" : "text-mute"}`}
                        >
                          {running && <span className="sr-only">Running: </span>}
                          {name}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="grid content-start gap-3">
        <h2 className="font-bold">Handoffs</h2>
        {fleet.feed.length === 0 ? (
          <p className="text-sm text-mute">Handoffs between agents show up here as they happen.</p>
        ) : (
          <ol className="grid gap-2.5" aria-live="polite">
            {fleet.feed.slice(0, feedSize).map((e) => (
              <li
                key={e._id}
                className="grid animate-rise grid-cols-[3.5rem_1fr] gap-2 text-sm motion-reduce:animate-none"
              >
                <span className="pt-0.5 font-num text-xs text-mute tabular-nums">{ago(e.at)}</span>
                <span className="text-ink-2">{e.message}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Card>
  );
}
