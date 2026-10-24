import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { type UIMessage, useSmoothText, useUIMessages } from "@convex-dev/agent/react";
import { ArrowUp, Check, PencilSimple } from "@phosphor-icons/react";
import { api } from "../convex/_generated/api";
import type { ProjectData } from "./HypothesisCard.tsx";
import { Button, Field, errorText, inputClass } from "./ui.tsx";

const POINTS = [
  ["problem", "Problem"],
  ["customer", "Target audience"],
  ["solution", "Solution"],
] as const;
const POINT_NAME = Object.fromEntries(POINTS) as Record<string, string>;

function Thinking() {
  return (
    <span className="flex h-6 items-center gap-1" aria-label="Thinking">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 animate-pulse rounded-full bg-mute motion-reduce:animate-none"
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
    </span>
  );
}

type Choice = {
  field: string;
  question: string;
  options: { label: string; detail: string }[];
};

/** The agent's multiple-choice question: pick any number of options, or write your own. */
function ChoiceCard({
  ask,
  onAnswer,
}: {
  ask: Choice;
  onAnswer?: (answer: string) => Promise<void>;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [other, setOther] = useState("");
  const [otherOn, setOtherOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const own = otherOn ? other.trim() : "";
  const ready = picked.length > 0 || own.length > 0;
  const toggle = (label: string) =>
    setPicked((p) => (p.includes(label) ? p.filter((l) => l !== label) : [...p, label]));
  const option =
    "grid w-full grid-cols-[1rem_1fr] gap-3 rounded-sm border bg-panel px-4 py-3 text-left transition enabled:hover:border-ink disabled:cursor-default";

  return (
    <fieldset className="grid gap-2" disabled={!onAnswer || busy}>
      <legend className="mb-2 text-sm font-bold">
        {ask.question}
        {onAnswer && <span className="ml-2 font-normal text-mute">Pick one or more</span>}
      </legend>
      {ask.options.map((o) => {
        const on = picked.includes(o.label);
        return (
          <button
            key={o.label}
            type="button"
            role="checkbox"
            aria-checked={on}
            onClick={() => toggle(o.label)}
            className={`${option} ${on ? "border-ink" : "border-rule-strong"} ${onAnswer ? "" : "opacity-60"}`}
          >
            <span
              aria-hidden
              className={`mt-0.5 grid size-4 place-items-center rounded-sm border transition-colors ${
                on ? "border-action bg-action text-action-ink" : "border-rule-strong"
              }`}
            >
              {on && <Check size={11} weight="bold" />}
            </span>
            <span className="grid gap-0.5">
              <span className="text-sm font-bold">{o.label}</span>
              <span className="text-sm text-ink-2">{o.detail}</span>
            </span>
          </button>
        );
      })}
      {onAnswer && (
        <div
          className={`rounded-sm border bg-panel ${otherOn ? "border-ink" : "border-dashed border-rule-strong"}`}
        >
          <button
            type="button"
            role="checkbox"
            aria-checked={otherOn}
            onClick={() => setOtherOn(!otherOn)}
            className="grid w-full grid-cols-[1rem_1fr] gap-3 px-4 py-3 text-left"
          >
            <span
              aria-hidden
              className={`mt-0.5 grid size-4 place-items-center rounded-sm border ${
                otherOn ? "border-action bg-action text-action-ink" : "border-rule-strong"
              }`}
            >
              {otherOn && <Check size={11} weight="bold" />}
            </span>
            <span className="text-sm font-bold">Something else</span>
          </button>
          {otherOn && (
            <div className="px-4 pb-3 pl-11">
              <label className="sr-only" htmlFor={`other-${ask.field}`}>
                Your own answer
              </label>
              <textarea
                id={`other-${ask.field}`}
                autoFocus
                rows={2}
                value={other}
                onChange={(e) => setOther(e.target.value)}
                placeholder="Say it in your own words, or correct an option above"
                className={`${inputClass} resize-none`}
              />
            </div>
          )}
        </div>
      )}
      {onAnswer && (
        <div className="flex items-center gap-3 pt-1">
          <Button
            variant="primary"
            disabled={!ready}
            onClick={async () => {
              setBusy(true);
              const parts = [...picked, ...(own ? [`something else: ${own}`] : [])];
              await onAnswer(`${POINT_NAME[ask.field] ?? ask.field}: ${parts.join("; ")}`);
              setBusy(false);
            }}
          >
            {busy ? "Sending" : "Continue"}
          </Button>
          <span className="text-xs text-mute">
            {picked.length + (own ? 1 : 0) || "Nothing"} selected
          </span>
        </div>
      )}
    </fieldset>
  );
}

function Message({ m, onAnswer }: { m: UIMessage; onAnswer?: (answer: string) => Promise<void> }) {
  const [text] = useSmoothText(m.text, { startStreaming: m.status === "streaming" });
  if (m.role === "user")
    return (
      <p className="ml-auto max-w-[80%] animate-rise rounded bg-action px-4 py-2.5 text-base leading-relaxed whitespace-pre-wrap text-action-ink motion-reduce:animate-none">
        {m.text}
      </p>
    );
  const confirmed = m.parts.flatMap((p) =>
    p.type === "tool-confirmPoint" && p.input ? [(p.input as { field: string }).field] : [],
  );
  // shown once the whole question has streamed in
  const asks = m.parts.flatMap((p) =>
    p.type === "tool-askChoice" && p.state !== "input-streaming" && p.input
      ? [p.input as Choice]
      : [],
  );
  const savedBrief = m.parts.some((p) => p.type === "tool-submitBrief");
  // a step with only reasoning or a tool result has nothing to show
  if (!m.text && !confirmed.length && !asks.length && !savedBrief && m.status !== "streaming")
    return null;
  return (
    <div className="grid grid-cols-[2rem_1fr] gap-3">
      <img src="/favicon.svg" alt="" width={24} height={24} className="mt-0.5" />
      <div className="grid min-w-0 gap-3">
        {confirmed.map((f) => (
          <p key={f} className="flex items-center gap-1.5 text-xs font-bold text-ink-2">
            <Check size={14} weight="bold" aria-hidden /> {POINT_NAME[f]} confirmed
          </p>
        ))}
        {text && <p className="text-base leading-relaxed whitespace-pre-wrap">{text}</p>}
        {asks.map((a, i) => (
          <ChoiceCard
            key={`${a.field}-${i}`}
            ask={a}
            onAnswer={i === asks.length - 1 ? onAnswer : undefined}
          />
        ))}
        {savedBrief && (
          <p className="flex items-center gap-1.5 text-xs font-bold text-sup">
            <Check size={14} weight="bold" aria-hidden /> Idea Brief written. Check it, then start
            the research.
          </p>
        )}
        {m.status === "streaming" && !text && !asks.length && <Thinking />}
      </div>
    </div>
  );
}

function Chat({ data }: { data: ProjectData }) {
  const { project, brief } = data;
  const { results, status } = useUIMessages(
    api.chat.messages,
    project.threadId ? { projectId: project._id, threadId: project.threadId } : "skip",
    { initialNumItems: 50, stream: true },
  );
  const send = useMutation(api.chat.send);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string>();
  const end = useRef<HTMLDivElement>(null);
  const waiting = results.length > 0 && results[results.length - 1].role === "user";

  // block body: Chrome's scrollIntoView returns a promise, which React would treat as a cleanup
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [results]);

  const post = async (prompt: string) => {
    if (!prompt.trim()) return;
    setDraft("");
    setError(undefined);
    await send({ projectId: project._id, prompt: prompt.trim() }).catch((err) => {
      setDraft(prompt);
      setError(errorText(err));
    });
  };
  const replies = brief ? [] : ["Just write it"];

  return (
    <section
      className="grid min-h-[calc(100dvh-10rem)] grid-rows-[1fr_auto]"
      aria-label="Idea chat"
    >
      <div className="grid content-start gap-8 pb-8" aria-live="polite">
        {status === "LoadingFirstPage" && <div className="h-10 w-2/3 animate-pulse bg-sunk" />}
        {results.map((m, i) => (
          <Message
            key={m.key}
            m={m}
            onAnswer={i === results.length - 1 && !waiting ? post : undefined}
          />
        ))}
        {waiting && (
          <div className="grid grid-cols-[2rem_1fr] gap-3">
            <img src="/favicon.svg" alt="" width={24} height={24} />
            <Thinking />
          </div>
        )}
        <div ref={end} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void post(draft);
        }}
        className="sticky bottom-0 grid gap-3 bg-ground pt-2 pb-6"
      >
        {error && (
          <p role="alert" className="text-sm text-dis">
            {error}
          </p>
        )}
        {replies.length > 0 && results.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {replies.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => void post(r)}
                disabled={waiting}
                className="h-8 rounded-sm border border-rule-strong bg-panel px-3 text-sm text-ink-2 transition hover:border-ink active:translate-y-px disabled:opacity-50"
              >
                {r}
              </button>
            ))}
          </div>
        )}
        <div className="border-2 border-rule-strong bg-panel p-2 transition-colors focus-within:border-ink">
          <label className="sr-only" htmlFor="chat-input">
            Reply
          </label>
          <textarea
            id="chat-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            rows={2}
            placeholder="Reply to FounderHub"
            className="block w-full resize-none bg-transparent px-2 py-1 text-base text-ink placeholder:text-mute focus:outline-none"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="px-2 text-xs text-mute">
              Enter to send, Shift + Enter for a new line
            </span>
            <button
              type="submit"
              aria-label="Send"
              disabled={!draft.trim()}
              className="grid size-9 place-items-center rounded bg-action text-action-ink transition hover:bg-action-hover active:scale-95 disabled:bg-rule disabled:text-mute"
            >
              <ArrowUp size={18} weight="bold" aria-hidden />
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}

/** The three things the chat verifies, drawn as stations on one line. */
function IdeaCheck({ data, onApproved }: { data: ProjectData; onApproved: () => void }) {
  const { brief, hypotheses, project } = data;
  const approve = useMutation(api.chat.approve);
  const editBrief = useMutation(api.chat.editBrief);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ problem: "", customer: "", solution: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const values: Partial<Record<(typeof POINTS)[number][0], string>> = brief ?? project.draft ?? {};
  const current = POINTS.findIndex(([k]) => !values[k]);

  return (
    <aside className="grid content-start gap-6 lg:sticky lg:top-28" aria-label="Idea check">
      <div className="grid gap-1 border-t-2 border-ink pt-5">
        <h2 className="font-extrabold">Idea check</h2>
        <p className="text-sm text-mute">
          Each part locks in once you agree with it. Research starts when all three are clear.
        </p>
      </div>

      {editing && brief ? (
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            await editBrief({ projectId: project._id, ...form, model: brief.model });
            setEditing(false);
          }}
        >
          {POINTS.map(([k, label]) => (
            <Field key={k} label={label}>
              <textarea
                className={inputClass}
                rows={3}
                value={form[k]}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              />
            </Field>
          ))}
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
        <ol className="grid">
          {POINTS.map(([k, label], i) => {
            const done = !!values[k];
            return (
              <li key={k} className="relative grid grid-cols-[1.5rem_1fr] gap-4 pb-6 last:pb-0">
                {i < POINTS.length - 1 && (
                  <span
                    aria-hidden
                    className={`absolute top-6 bottom-0 left-[10px] w-1 ${done ? "bg-ink" : "bg-rule"}`}
                  />
                )}
                <span
                  aria-hidden
                  className={`relative grid size-6 place-items-center rounded-full border-[5px] transition-colors ${
                    done
                      ? "border-ink bg-ink text-panel"
                      : i === current
                        ? "border-line-yellow bg-panel"
                        : "border-rule-strong bg-panel"
                  }`}
                >
                  {done && <Check size={10} weight="bold" />}
                </span>
                <div className="grid gap-1">
                  <h3 className="text-sm font-bold">
                    {label}
                    <span className="sr-only">{done ? ", confirmed" : ", not yet confirmed"}</span>
                  </h3>
                  <p
                    className={`text-sm leading-relaxed ${done ? "animate-rise text-ink-2 motion-reduce:animate-none" : "text-mute"}`}
                  >
                    {values[k] ?? (i === current ? "Being discussed now" : "Waiting")}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {brief && !editing && (
        <div className="grid gap-4 border-t border-rule pt-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-mute">
              <span className="font-num font-bold text-ink">{hypotheses.length}</span> hypotheses
              drafted to test
            </p>
            <Button
              variant="quiet"
              className="!px-2"
              onClick={() => {
                setForm({
                  problem: brief.problem,
                  customer: brief.customer,
                  solution: brief.solution,
                });
                setEditing(true);
              }}
            >
              <PencilSimple size={14} aria-hidden /> Edit
            </Button>
          </div>
          {error && (
            <p role="alert" className="text-sm text-dis">
              {error}
            </p>
          )}
          <Button
            variant="primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await approve({ projectId: project._id }).then(onApproved, (e) => {
                setError(errorText(e));
                setBusy(false);
              });
            }}
          >
            {busy ? "Starting the fleet" : "Approve and start research"}
          </Button>
        </div>
      )}
    </aside>
  );
}

export function Draft({ data, onApproved }: { data: ProjectData; onApproved: () => void }) {
  return (
    <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="mx-auto grid w-full max-w-2xl gap-8">
        <h1 className="text-xl font-extrabold tracking-tight text-balance">
          {data.project.ideaText}
        </h1>
        <Chat data={data} />
      </div>
      <IdeaCheck data={data} onApproved={onApproved} />
    </div>
  );
}
