import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { Plus } from "@phosphor-icons/react";
import { api } from "../convex/_generated/api";
import type { Doc } from "../convex/_generated/dataModel";
import { Fleet } from "./Fleet.tsx";
import { HypothesisCard, type ProjectData } from "./HypothesisCard.tsx";
import { Button, Card, Field, errorText, inputClass } from "./ui.tsx";

const TYPES: Doc<"hypotheses">["type"][] = [
  "problem",
  "customer",
  "willingness to pay",
  "channel",
  "competition",
  "market size",
];

/** Highlights a card for a moment when its score moves. */
function useFresh(hypotheses: ProjectData["hypotheses"]) {
  const last = useRef(new Map<string, number>());
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  useEffect(() => {
    const moved = hypotheses.filter(
      (h) => last.current.has(h._id) && last.current.get(h._id) !== h.score,
    );
    for (const h of hypotheses) last.current.set(h._id, h.score);
    if (!moved.length) return;
    setFresh(new Set(moved.map((h) => h._id)));
    const t = setTimeout(() => setFresh(new Set()), 2500);
    return () => clearTimeout(t);
  }, [hypotheses]);
  return fresh;
}

function AddHypothesis({
  projectId,
  onDone,
}: {
  projectId: ProjectData["project"]["_id"];
  onDone: () => void;
}) {
  const add = useMutation(api.projects.addHypothesis);
  const [type, setType] = useState(TYPES[0]);
  const [statement, setStatement] = useState("");
  const [disproveIf, setDisproveIf] = useState("");
  const [error, setError] = useState<string>();
  return (
    <Card>
      <form
        className="grid gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          await add({ projectId, type, statement, disproveIf }).then(onDone, (err) =>
            setError(errorText(err)),
          );
        }}
      >
        <h2 className="font-bold">New hypothesis</h2>
        <div className="grid gap-4 md:grid-cols-[12rem_1fr]">
          <Field label="Type">
            <select
              className={inputClass}
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t[0].toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Hypothesis">
            <input
              className={inputClass}
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              required
            />
          </Field>
        </div>
        <Field
          label="What would disprove it?"
          hint="Make it falsifiable, e.g. “Fewer than 1 in 10 interviewees say …”"
        >
          <input
            className={inputClass}
            value={disproveIf}
            onChange={(e) => setDisproveIf(e.target.value)}
            required
          />
        </Field>
        {error && (
          <p role="alert" className="text-sm text-dis">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button variant="primary" type="submit">
            Add and score it
          </Button>
          <Button variant="quiet" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function Hypotheses({
  data,
  canEdit,
  onOpen,
}: {
  data: ProjectData;
  canEdit: boolean;
  onOpen: (hypothesisId: string) => void;
}) {
  const fresh = useFresh(data.hypotheses);
  const [adding, setAdding] = useState(false);
  return (
    <div className="grid gap-8">
      <section className="grid gap-2">
        <h1 className="max-w-[40ch] text-3xl font-extrabold tracking-tight text-balance md:text-3xl">
          {data.project.ideaText}
        </h1>
        <p className="text-sm text-mute">Most uncertain first, so you can see where to dig.</p>
      </section>
      <Fleet projectId={data.project._id} />
      <section
        className="grid gap-px border border-rule bg-rule lg:grid-cols-2"
        aria-label="Hypotheses"
      >
        {data.hypotheses.map((h) => (
          <HypothesisCard key={h._id} h={h} fresh={fresh.has(h._id)} onOpen={() => onOpen(h._id)} />
        ))}
      </section>
      {canEdit &&
        (adding ? (
          <AddHypothesis projectId={data.project._id} onDone={() => setAdding(false)} />
        ) : (
          <div>
            <Button onClick={() => setAdding(true)}>
              <Plus size={14} weight="bold" aria-hidden /> Add a hypothesis
            </Button>
          </div>
        ))}
    </div>
  );
}
