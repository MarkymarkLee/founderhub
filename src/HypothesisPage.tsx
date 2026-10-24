import { useEffect, useRef, useState } from "react";
import { animate } from "motion/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  MagnifyingGlass,
  PencilSimple,
  ThumbsDown,
  ThumbsUp,
} from "@phosphor-icons/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { QuoteBody, type Quote, sourceLabel } from "./HypothesisCard.tsx";
import { RouteStrip } from "./RouteStrip.tsx";
import { Button, Card, Field, Pill, RouteBullet, Skeleton, errorText, inputClass } from "./ui.tsx";

function Column({
  title,
  icon,
  quotes,
  stance,
}: {
  title: string;
  icon: React.ReactNode;
  quotes: Quote[];
  stance: "sup" | "dis";
}) {
  return (
    <section className="grid content-start" aria-label={title}>
      <h2
        className={`flex items-center gap-2 border-b-4 pb-3 font-extrabold ${
          stance === "sup" ? "border-sup" : "border-dis"
        }`}
      >
        {icon} {title}{" "}
        <span className="font-num text-sm font-normal text-mute tabular-nums">{quotes.length}</span>
      </h2>
      {quotes.length === 0 ? (
        <p className="py-4 text-sm text-mute">No quotes on this side yet.</p>
      ) : (
        <ul className="divide-y divide-rule">
          {quotes.map((q) => (
            <li key={q._id} className="py-4">
              <QuoteBody q={q} clamp={false} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Score numerals that tick from the old value to the new one. */
function Ticker({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    if (from === value || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const c = animate(from, value, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = `${Math.round(v)}%`;
      },
    });
    return () => c.stop();
  }, [value]);
  return <span ref={ref}>{value}%</span>;
}

export function HypothesisPage({
  hypothesisId,
  canEdit,
  onBack,
}: {
  hypothesisId: Id<"hypotheses">;
  canEdit: boolean;
  onBack: () => void;
}) {
  const data = useQuery(api.projects.hypothesis, { hypothesisId });
  const askScouts = useMutation(api.projects.askScouts);
  const { signIn } = useAuthActions();
  const edit = useMutation(api.projects.editHypothesis);
  const [filter, setFilter] = useState<string>();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ statement: "", disproveIf: "" });
  const [notice, setNotice] = useState<string>();

  if (data === undefined) return <Skeleton rows={2} className="h-64" />;
  if (data === null) return <p>Hypothesis not found.</p>;
  const { hypothesis: h, quotes, history, personas, weights } = data;
  const types = [...new Set(quotes.map((q) => q.sourceType))];
  const shown = filter ? quotes.filter((q) => q.sourceType === filter) : quotes;
  const start = history[0]?.score;
  const contested = new Set(personas.map((n) => n.verdict)).size > 1;

  return (
    <div className="grid gap-8">
      <div>
        <Button variant="quiet" className="!px-0" onClick={onBack}>
          <ArrowLeft size={16} weight="bold" aria-hidden /> All hypotheses
        </Button>
      </div>

      <header className="grid items-end gap-8 lg:grid-cols-[1fr_16rem]">
        <div className="grid gap-4">
          {editing ? (
            <form
              className="grid gap-4"
              onSubmit={async (e) => {
                e.preventDefault();
                await edit({ hypothesisId, ...form });
                setEditing(false);
              }}
            >
              <Field label="Hypothesis">
                <input
                  className={inputClass}
                  value={form.statement}
                  onChange={(e) => setForm({ ...form, statement: e.target.value })}
                />
              </Field>
              <Field label="What would disprove it?">
                <input
                  className={inputClass}
                  value={form.disproveIf}
                  onChange={(e) => setForm({ ...form, disproveIf: e.target.value })}
                />
              </Field>
              <div className="flex gap-2">
                <Button variant="primary" type="submit">
                  Save
                </Button>
                <Button variant="quiet" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <>
              <h1 className="flex max-w-[30ch] items-start gap-4 text-3xl leading-tight font-extrabold tracking-tight text-balance md:text-[40px]">
                <span className="pt-1">
                  <RouteBullet type={h.type} size="lg" />
                </span>
                {h.statement}
              </h1>
              <p className="max-w-[70ch] text-mute">
                <span className="font-bold text-ink">Disproved if</span> {h.disproveIf}
              </p>
            </>
          )}
          {!canEdit && (
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" onClick={() => void signIn("github")}>
                <MagnifyingGlass size={16} aria-hidden /> Sign in to ask scouts for more
              </Button>
              <span className="text-sm text-mute">Viewing the sample read-only.</span>
            </div>
          )}
          {canEdit && !editing && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                onClick={async () => {
                  setNotice(undefined);
                  await askScouts({ hypothesisId }).then(
                    () => setNotice("Scouts are on it. New quotes land here as they arrive."),
                    (e) => setNotice(errorText(e)),
                  );
                }}
              >
                <MagnifyingGlass size={16} aria-hidden /> Ask scouts for more
              </Button>
              <Button
                onClick={() => {
                  setForm({ statement: h.statement, disproveIf: h.disproveIf });
                  setEditing(true);
                }}
              >
                <PencilSimple size={16} aria-hidden /> Edit
              </Button>
            </div>
          )}
          {notice && (
            <p role="status" className="text-sm text-ink-2">
              {notice}
            </p>
          )}
        </div>
        <div className="grid gap-2 border-rule lg:border-l lg:pl-6">
          <p
            className={`font-num text-7xl leading-none font-bold tracking-tighter tabular-nums ${
              h.score >= 50 ? "text-sup" : "text-dis"
            }`}
          >
            <Ticker value={h.score} />
          </p>
          <p className="text-sm text-mute">
            {start !== undefined && start !== h.score && (
              <span className="block font-bold text-ink-2">
                {h.score < start ? "Down" : "Up"} from {start}%
              </span>
            )}
            {h.strength.quotes} quotes from {h.strength.sourceTypes} kinds of source
            {h.strength.quotes < 3 && ". Too few to trust yet."}
          </p>
        </div>
      </header>

      <section className="grid gap-3" aria-label="How the score moved">
        <h2 className="font-extrabold">How the score moved</h2>
        <RouteStrip history={history} quotes={quotes} contested={contested} />
      </section>

      {(h.unknowns || h.nextQuestion) && (
        <section className="grid gap-6 border-b border-rule pb-6 md:grid-cols-2">
          <div className="grid content-start gap-1">
            <h2 className="text-sm font-bold">What we still don’t know</h2>
            <p className="text-sm text-ink-2">{h.unknowns ?? "Nothing flagged yet."}</p>
          </div>
          <div className="grid content-start gap-1">
            <h2 className="text-sm font-bold">Ask this in your next interview</h2>
            <p className="text-sm text-ink-2">{h.nextQuestion ?? "No question yet."}</p>
          </div>
        </section>
      )}

      {types.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by source">
          {[undefined, ...types].map((t) => (
            <button
              key={t ?? "all"}
              type="button"
              aria-pressed={filter === t}
              onClick={() => setFilter(t)}
              className="h-8 rounded-sm border border-rule-strong px-3 text-sm font-bold aria-pressed:border-action aria-pressed:bg-action aria-pressed:text-action-ink"
            >
              {t ? sourceLabel[t] : "All sources"}
            </button>
          ))}
        </div>
      )}

      <div className="grid items-start gap-12 md:grid-cols-2">
        <Column
          title="Supports"
          icon={<ThumbsUp size={18} weight="bold" className="text-sup" aria-hidden />}
          quotes={shown.filter((q) => q.stance === "supports")}
          stance="sup"
        />
        <Column
          title="Disproves"
          icon={<ThumbsDown size={18} weight="bold" className="text-dis" aria-hidden />}
          quotes={shown.filter((q) => q.stance === "disproves")}
          stance="dis"
        />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card className="grid content-start gap-4">
          <h2 className="font-bold">Every move, newest first</h2>
          <ol className="grid gap-3">
            {history
              .map((p, i) => ({ ...p, prev: history[i - 1]?.score }))
              .filter((p) => p.prev === undefined || p.prev !== p.score)
              .reverse()
              .map((p) => (
                <li key={p.at} className="grid grid-cols-[6.5rem_1fr] gap-3 text-sm">
                  <span className="font-num tabular-nums">
                    {p.prev === undefined ? `${p.score}%` : `${p.prev}% → ${p.score}%`}
                  </span>
                  <span className="text-ink-2">
                    {p.cause ? (
                      <>
                        {p.cause.stance === "supports" ? "New support: " : "New pushback: "}“
                        {p.cause.quote}”
                      </>
                    ) : (
                      "Starting point, before any evidence"
                    )}
                  </span>
                </li>
              ))}
          </ol>
        </Card>
        <Card className="grid content-start gap-3">
          <h2 className="font-bold">How quotes are weighed</h2>
          <p className="text-sm text-mute">
            Each quote counts its source weight times the extractor’s confidence, plus for support
            and minus for pushback. The sum goes through a sigmoid to give the score.
          </p>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {Object.entries(weights)
              .sort((a, b) => b[1] - a[1])
              .map(([k, w]) => (
                <li key={k} className="flex justify-between">
                  <span>{sourceLabel[k]}</span>
                  <span className="font-num tabular-nums">{w}</span>
                </li>
              ))}
          </ul>
        </Card>
      </div>

      <section className="grid gap-3">
        <h2 className="font-bold">What the persona analysts think</h2>
        {personas.length === 0 ? (
          <p className="text-sm text-mute">
            Persona analysts review every 30 minutes once new evidence arrives.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {personas.map((n) => (
              <Card key={n._id} className="grid content-start gap-2">
                <p className="flex items-center justify-between gap-2 text-sm font-medium">
                  {n.persona}
                  <Pill
                    tone={n.verdict === "weak" ? "dis" : n.verdict === "strong" ? "sup" : "neutral"}
                  >
                    {n.verdict}
                  </Pill>
                </p>
                <p className="text-sm text-ink-2">{n.note}</p>
                <p className="text-xs text-mute">Cites {n.evidenceIds.length} quotes</p>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
