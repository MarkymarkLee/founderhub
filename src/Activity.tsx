import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { Fleet } from "./Fleet.tsx";
import { Card, Pill, Skeleton, ago, usd } from "./ui.tsx";

export function Activity({ projectId }: { projectId: Id<"projects"> }) {
  const calls = useQuery(api.projects.audit, { projectId });
  const fleet = useQuery(api.projects.fleet, { projectId });
  const refused = calls?.filter((c) => !c.allowed).length ?? 0;

  return (
    <div className="grid gap-8">
      <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Activity</h1>
      <Fleet projectId={projectId} feedSize={20} />

      {fleet && (fleet.openTasks.length > 0 || fleet.failures.length > 0) && (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {fleet.openTasks.length > 0 && (
            <Card className="grid content-start gap-3">
              <h2 className="font-bold">Open tasks</h2>
              <ul className="grid gap-2 text-sm">
                {fleet.openTasks.map((t) => (
                  <li key={t._id} className="flex items-start justify-between gap-3">
                    <span>{t.title}</span>
                    <Pill>{t.team}</Pill>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {fleet.failures.length > 0 && (
            <Card className="grid content-start gap-3">
              <h2 className="font-bold">Recent agent failures</h2>
              <ul className="grid gap-2 text-sm">
                {fleet.failures.map((r) => (
                  <li key={r._id} className="grid gap-0.5">
                    <span className="font-medium">
                      {r.agent} <span className="font-normal text-mute">{ago(r.startedAt)}</span>
                    </span>
                    <span className="line-clamp-2 text-xs text-mute">{r.error}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      <section className="grid gap-3">
        <div className="grid gap-1">
          <h2 className="font-bold">Audit log</h2>
          <p className="text-sm text-mute">
            Every tool call an agent makes goes through FounderHub first. Login-walled, paywalled
            and robots.txt-blocked pages are refused and logged
            {calls ? `: ${refused} refused so far` : ""}.
          </p>
        </div>
        {calls === undefined ? (
          <Skeleton rows={1} className="h-48" />
        ) : calls === null || calls.length === 0 ? (
          <p className="text-sm text-mute">No tool calls yet.</p>
        ) : (
          <div className="overflow-x-auto border-b border-rule">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b-2 border-ink text-xs text-mute">
                <tr>
                  {["When", "Agent", "Tool", "Target", "Result", "Cost"].map((h) => (
                    <th key={h} scope="col" className="px-4 py-2.5 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {calls.map((c) => (
                  <tr key={c._id}>
                    <td className="px-4 py-2.5 whitespace-nowrap text-mute">{ago(c.at)}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{c.agent}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{c.tool}</td>
                    <td
                      className="max-w-[40ch] truncate px-4 py-2.5 font-mono text-xs"
                      title={c.target}
                    >
                      {c.target}
                    </td>
                    <td className="px-4 py-2.5">
                      {c.allowed ? (
                        "Allowed"
                      ) : (
                        <span className="text-dis">Refused: {c.reason}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-num text-xs tabular-nums">
                      {c.costUsd ? usd(c.costUsd) : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
