import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { ProjectData } from "./HypothesisCard.tsx";
import { Button, Card, Field, ago, errorText, inputClass, usd } from "./ui.tsx";

export function Settings({ data }: { data: ProjectData }) {
  const { project } = data;
  const setBudget = useMutation(api.projects.setBudget);
  const setPaused = useMutation(api.projects.setPaused);
  const setSlots = useMutation(api.projects.setFreeSlots);
  const tokens = useQuery(api.mcp.tokens);
  const revoke = useMutation(api.mcp.revokeToken);
  const [budget, setBudgetDraft] = useState(String(project.budgetUsd));
  const [slots, setSlotsDraft] = useState((project.freeSlots ?? []).join("\n"));
  const [msg, setMsg] = useState<string>();

  const save = (p: Promise<unknown>, done: string) =>
    p.then(
      () => setMsg(done),
      (e) => setMsg(errorText(e)),
    );

  return (
    <div className="grid max-w-3xl gap-6">
      <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Settings</h1>
      {msg && (
        <p role="status" className="text-sm">
          {msg}
        </p>
      )}

      <Card className="grid gap-4">
        <h2 className="font-bold">Budget</h2>
        <p className="text-sm text-mute">
          {usd(project.spentUsd)} spent of {usd(project.budgetUsd)}. Agents pause at the cap.
        </p>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save(
              setBudget({ projectId: project._id, budgetUsd: Number(budget) }),
              "Budget saved.",
            );
          }}
        >
          <Field label="Budget in dollars">
            <input
              type="number"
              min={1}
              max={500}
              className={`${inputClass} w-32`}
              value={budget}
              onChange={(e) => setBudgetDraft(e.target.value)}
            />
          </Field>
          <Button type="submit">Save budget</Button>
          {project.status !== "drafting" && (
            <Button
              variant="quiet"
              onClick={() =>
                void save(
                  setPaused({ projectId: project._id, paused: project.status !== "paused" }),
                  project.status === "paused" ? "Agents resumed." : "Agents paused.",
                )
              }
            >
              {project.status === "paused" ? "Resume agents" : "Pause all agents"}
            </Button>
          )}
        </form>
      </Card>

      <Card className="grid gap-4">
        <h2 className="font-bold">Free slots for calls</h2>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save(
              setSlots({ projectId: project._id, slots: slots.split("\n") }),
              "Slots saved.",
            );
          }}
        >
          <Field
            label="One slot per line"
            hint="Grok Bot offers two of these when someone wants to talk."
          >
            <textarea
              className={inputClass}
              rows={4}
              value={slots}
              onChange={(e) => setSlotsDraft(e.target.value)}
              placeholder="Tue 3:00-3:30pm"
            />
          </Field>
          <div>
            <Button type="submit">Save slots</Button>
          </div>
        </form>
      </Card>

      <Card className="grid gap-4">
        <h2 className="font-bold">Grok Bot tokens</h2>
        <p className="text-sm text-mute">
          Tokens are stored hashed. Revoke one and Grok Bot loses access right away. Get a new setup
          prompt on the Customers tab.
        </p>
        {tokens?.length ? (
          <ul className="divide-y divide-rule text-sm">
            {tokens.map((t) => (
              <li key={t._id} className="flex items-center justify-between gap-3 py-2.5">
                <span>
                  Created {ago(t.createdAt)}
                  <span className="block text-xs text-mute">
                    {t.revokedAt
                      ? `Revoked ${ago(t.revokedAt)}`
                      : t.lastUsedAt
                        ? `Last used ${ago(t.lastUsedAt)}`
                        : "Never used"}
                  </span>
                </span>
                {!t.revokedAt && (
                  <Button variant="quiet" onClick={() => void revoke({ tokenId: t._id })}>
                    Revoke
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-mute">No tokens yet.</p>
        )}
      </Card>
    </div>
  );
}
