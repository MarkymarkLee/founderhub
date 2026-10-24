import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import {
  ArrowCounterClockwise,
  Check,
  Pause,
  Play,
  Prohibit,
  ThumbsDown,
  ThumbsUp,
} from "@phosphor-icons/react";
import { RouteBullet, ScoreBar, compact, usd } from "./ui.tsx";

// Landing-page demos: small working versions of the real screens, drawn with the app's own parts.
// Their words and numbers come from the seeded sample project (convex/seed.ts).

const ease = [0.16, 1, 0.3, 1] as const;

// Same formula as scoreOf in convex/lib.ts; that file pulls server-only imports into the bundle.
const sigmoid = (sum: number) => Math.round(100 / (1 + Math.exp(-sum)));
const logit = (score: number) => Math.log(score / (100 - score));

function Frame({
  children,
  hint,
  onReset,
}: {
  children: ReactNode;
  hint: string;
  onReset?: () => void;
}) {
  return (
    <figure className="grid gap-2 border border-rule bg-sunk p-3 pt-2">
      <figcaption className="flex min-h-6 items-center justify-between gap-3 text-[11px] font-bold text-mute">
        <span>{hint}</span>
        <span className="flex items-center gap-3">
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="flex items-center gap-1 transition hover:text-ink"
            >
              <ArrowCounterClockwise size={12} weight="bold" aria-hidden /> Reset
            </button>
          )}
          Sample data
        </span>
      </figcaption>
      <div className="bg-panel">{children}</div>
    </figure>
  );
}

/** A small plate button used inside the demos. */
function Chip({
  children,
  onClick,
  tone = "neutral",
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  tone?: "neutral" | "primary" | "sup" | "dis";
  disabled?: boolean;
}) {
  const styles = {
    neutral: "border-rule-strong text-ink-2 hover:border-ink",
    primary: "border-action bg-action text-action-ink hover:bg-action-hover",
    sup: "border-sup text-sup hover:bg-sup/10",
    dis: "border-dis text-dis hover:bg-dis/10",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-7 items-center gap-1.5 rounded-sm border px-2.5 text-xs font-bold transition active:translate-y-px disabled:pointer-events-none disabled:opacity-40 ${styles}`}
    >
      {children}
    </button>
  );
}

// ── Hero: the hypothesis board, where evidence moves the scores ──────────

const BOARD = [
  {
    type: "problem",
    score: 71,
    statement:
      "Student founders skip customer validation because it takes more than 5 hours a week.",
    quote: "I know I should do interviews. I just never find the afternoon for it",
  },
  {
    type: "willingness to pay",
    score: 38,
    statement: "Student founders will pay $20 a month for research they can trust.",
    quote: "Students don't pay for tools. We use free tiers until someone makes us",
  },
  {
    type: "competition",
    score: 64,
    statement: "No current tool ties every market number to a source a founder can open.",
    quote: "Most market sizing decks I see cite nothing below the headline TAM.",
  },
  {
    type: "channel",
    score: 58,
    statement: "Campus founder clubs can bring 100 waitlist signups in a week.",
    quote: "Posted in the founders Discord and got 38 signups before lunch",
  },
];

export function DashboardArt() {
  const start = () => BOARD.map((h) => logit(h.score));
  const [sums, setSums] = useState(start);
  const [picked, setPicked] = useState(0);
  const [fresh, setFresh] = useState<number>();
  const h = BOARD[picked];
  const add = (stance: 1 | -1, weight: number) => {
    setSums((s) => s.map((v, i) => (i === picked ? v + stance * weight * 0.4 : v)));
    setFresh(picked);
  };

  return (
    <Frame
      hint="Live demo"
      onReset={() => {
        setSums(start());
        setFresh(undefined);
      }}
    >
      <div className="grid gap-1 border-b-2 border-ink px-5 py-4">
        <h3 className="text-lg font-extrabold tracking-tight">Hypothesis testing</h3>
        <p className="text-sm text-mute">
          Click a hypothesis, then add evidence below. Its score moves with every quote.
        </p>
      </div>
      <div className="grid gap-px bg-rule md:grid-cols-2">
        {BOARD.map((b, i) => (
          <button
            key={b.type}
            type="button"
            onClick={() => setPicked(i)}
            aria-pressed={i === picked}
            className="relative grid content-start gap-3 bg-panel p-5 text-left transition-colors hover:bg-ground aria-pressed:bg-ground"
          >
            {fresh === i && (
              <span
                key={sums[i]}
                aria-hidden
                className="absolute inset-x-0 top-0 h-1 animate-rise bg-line-yellow motion-reduce:animate-none"
              />
            )}
            <span className="flex items-start gap-3">
              <RouteBullet type={b.type} />
              <span className="text-sm leading-snug font-bold">{b.statement}</span>
            </span>
            <ScoreBar score={sigmoid(sums[i])} />
            <span className="line-clamp-1 text-xs text-ink-2">&ldquo;{b.quote}&rdquo;</span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t-2 border-ink px-5 py-3">
        <span className="mr-auto text-xs font-bold">
          New evidence for <RouteBullet type={h.type} />
        </span>
        <Chip tone="sup" onClick={() => add(1, 3)}>
          <ThumbsUp size={12} weight="bold" aria-hidden /> Interview supports
        </Chip>
        <Chip tone="sup" onClick={() => add(1, 1)}>
          <ThumbsUp size={12} weight="bold" aria-hidden /> Reddit supports
        </Chip>
        <Chip tone="dis" onClick={() => add(-1, 2)}>
          <ThumbsDown size={12} weight="bold" aria-hidden /> Reply disproves
        </Chip>
      </div>
    </Frame>
  );
}

// ── The idea chat: a scripted, clickable conversation ─────────────────────

const SCRIPT = [
  {
    ask: "What problem are you solving?",
    answer: "Founders never find time to validate ideas",
    back: "So the problem is that validation takes more time than student founders have. Is that right?",
  },
  {
    ask: "Who feels this most?",
    answer: "First-time founders in campus accelerators",
    back: "So the audience is first-time founders in campus accelerators. Is that right?",
  },
  {
    ask: "What would you build?",
    answer: "Agents that research the idea while I build",
    back: "So the solution is an agent fleet that gathers cited evidence for you. Is that right?",
  },
];
const STATIONS = ["Problem", "Target audience", "Solution"];

export function ChatArt() {
  // each step has two halves: the founder answers, then confirms the play-back
  const [step, setStep] = useState(0);
  const point = Math.floor(step / 2);
  const done = step >= SCRIPT.length * 2;
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: "smooth" });
  }, [step]);

  const lines: ReactNode[] = [];
  for (let i = 0; i <= Math.min(point, SCRIPT.length - 1); i++) {
    const s = SCRIPT[i];
    lines.push(<Bot key={`a${i}`}>{s.ask}</Bot>);
    if (step > i * 2) {
      lines.push(<Me key={`m${i}`}>{s.answer}</Me>);
      lines.push(<Bot key={`b${i}`}>{s.back}</Bot>);
    }
    if (step > i * 2 + 1) {
      lines.push(<Me key={`y${i}`}>Yes, that's right</Me>);
      lines.push(
        <p key={`c${i}`} className="flex items-center gap-1 pl-6 text-[11px] font-bold text-ink-2">
          <Check size={12} weight="bold" aria-hidden /> {STATIONS[i]} confirmed
        </p>,
      );
    }
  }

  return (
    <Frame hint="Answer the questions to lock in the idea" onReset={() => setStep(0)}>
      <div className="grid grid-cols-[1fr_9rem] gap-5 p-5">
        <div className="grid gap-3">
          <div
            ref={log}
            className="grid h-52 content-start gap-3 overflow-y-auto pr-1 text-xs leading-relaxed"
            aria-live="polite"
          >
            {lines}
            {done && (
              <p className="pl-6 text-[11px] font-bold text-sup">
                Idea Brief written. Six hypotheses ready to test.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 border-t border-rule pt-3">
            {done ? (
              <Chip tone="primary" onClick={() => setStep(0)}>
                Start again
              </Chip>
            ) : step % 2 === 0 ? (
              <Chip tone="primary" onClick={() => setStep(step + 1)}>
                {SCRIPT[point].answer}
              </Chip>
            ) : (
              <Chip tone="primary" onClick={() => setStep(step + 1)}>
                Yes, that's right
              </Chip>
            )}
          </div>
        </div>
        <ol className="grid content-start border-l border-rule pl-4">
          {STATIONS.map((label, i) => {
            const ok = step > i * 2 + 1;
            return (
              <li key={label} className="relative grid grid-cols-[1rem_1fr] gap-2 pb-5 last:pb-0">
                {i < 2 && (
                  <span
                    className={`absolute top-4 bottom-0 left-[6px] w-1 transition-colors duration-500 ${ok ? "bg-ink" : "bg-rule"}`}
                  />
                )}
                <span
                  className={`relative size-4 rounded-full border-[4px] transition-colors duration-500 ${
                    ok
                      ? "border-ink bg-ink"
                      : i === point
                        ? "border-line-yellow bg-panel"
                        : "border-rule-strong bg-panel"
                  }`}
                />
                <span className="text-[11px] leading-4 font-bold">{label}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </Frame>
  );
}

function Bot({ children }: { children: ReactNode }) {
  return (
    <div className="flex animate-rise gap-2 motion-reduce:animate-none">
      <img src="/favicon.svg" alt="" width={16} height={16} className="mt-0.5 shrink-0" />
      <p>{children}</p>
    </div>
  );
}

function Me({ children }: { children: ReactNode }) {
  return (
    <p className="ml-auto max-w-[85%] animate-rise rounded bg-action px-3 py-2 text-action-ink motion-reduce:animate-none">
      {children}
    </p>
  );
}

// ── One hypothesis: toggle quotes and see the score worked out ────────────

const EVIDENCE = [
  {
    quote: "I spent maybe eight hours a week on research and still felt behind.",
    source: "Interview",
    weight: 3,
    stance: 1,
    confidence: 0.6,
  },
  {
    quote: "Our cohort's first homework was 20 interviews. Half of us faked it.",
    source: "Reddit",
    weight: 1,
    stance: 1,
    confidence: 0.8,
  },
  {
    quote: "Honestly validation was the fun part. Building was what dragged.",
    source: "Email reply",
    weight: 2,
    stance: -1,
    confidence: 0.4,
  },
] as const;

export function HypothesisArt() {
  const [on, setOn] = useState(() => EVIDENCE.map(() => true));
  const terms = EVIDENCE.filter((_, i) => on[i]);
  const sum = terms.reduce((a, e) => a + e.weight * e.stance * e.confidence, 0);
  const score = sigmoid(sum);
  return (
    <Frame hint="Switch quotes on and off to see how the score is made">
      <div className="grid gap-4 p-5">
        <div className="flex items-start gap-3">
          <RouteBullet type="problem" size="lg" />
          <p className="text-base leading-snug font-extrabold tracking-tight">
            Student founders skip customer validation because it takes more than 5 hours a week.
          </p>
        </div>
        <ScoreBar score={score} />
        <ul className="grid gap-2">
          {EVIDENCE.map((e, i) => (
            <li key={e.quote}>
              <label
                className={`grid cursor-pointer grid-cols-[auto_1fr] gap-3 border-t-2 pt-2 transition-opacity ${
                  e.stance > 0 ? "border-sup" : "border-dis"
                } ${on[i] ? "" : "opacity-45"}`}
              >
                <input
                  type="checkbox"
                  checked={on[i]}
                  onChange={() => setOn(on.map((v, j) => (j === i ? !v : v)))}
                  className="mt-0.5 size-3.5 accent-[var(--action)]"
                />
                <span className="grid gap-0.5">
                  <span
                    className={`text-[11px] font-bold ${e.stance > 0 ? "text-sup" : "text-dis"}`}
                  >
                    {`${e.stance > 0 ? "Supports" : "Disproves"} from ${e.source}, weight ${e.weight}`}
                  </span>
                  <span className="text-xs leading-relaxed text-ink-2">
                    &ldquo;{e.quote}&rdquo;
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <p className="bg-sunk px-3 py-2 font-num text-[11px] text-ink-2">
          sigmoid(
          {terms.length
            ? terms
                .map(
                  (e, i) =>
                    `${i ? (e.stance > 0 ? " + " : " − ") : e.stance > 0 ? "" : "−"}${e.weight}×${e.confidence}`,
                )
                .join("")
            : "0"}
          ) = <span className="font-bold text-ink">{score}%</span>
        </p>
      </div>
    </Frame>
  );
}

// ── Landing page and outreach: join the sample waitlist ───────────────────

const ROUTE = ["Waitlist signup", "Reply", "Call booked"];

export function CustomersArt() {
  const [email, setEmail] = useState("");
  const [stage, setStage] = useState(-1);
  const [signups, setSignups] = useState(37);
  useEffect(() => {
    if (stage < 0 || stage >= ROUTE.length - 1) return;
    const t = setTimeout(() => setStage(stage + 1), 1100);
    return () => clearTimeout(t);
  }, [stage]);
  const status = [
    "Signed up. Grok Bot drafts a personal note from your Gmail.",
    "They replied. The answer is saved as evidence.",
    "Call booked. Paste the transcript after you talk.",
  ][stage];

  return (
    <Frame
      hint="Join the sample waitlist and follow the signup"
      onReset={() => {
        setStage(-1);
        setEmail("");
        setSignups(37);
      }}
    >
      <div className="grid gap-5 p-5">
        <div className="border border-rule">
          <div className="flex items-center gap-1.5 border-b border-rule bg-ground px-3 py-1.5">
            {[0, 1, 2].map((i) => (
              <span key={i} className="size-2 rounded-full bg-rule-strong" />
            ))}
            <span className="ml-2 font-mono text-[11px] text-mute">you.github.io/founderhub</span>
          </div>
          <form
            className="grid gap-2 px-5 py-4"
            onSubmit={(e) => {
              e.preventDefault();
              setSignups((n) => n + 1);
              setStage(0);
              setEmail("");
            }}
          >
            <p className="text-sm font-extrabold tracking-tight">
              Validate your idea while you build
            </p>
            <div className="flex gap-2">
              <label className="sr-only" htmlFor="demo-email">
                Email for the sample waitlist
              </label>
              <input
                id="demo-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@berkeley.edu"
                className="h-7 min-w-0 flex-1 rounded-sm border border-rule-strong bg-panel px-2 text-xs text-ink placeholder:text-mute focus:border-ink focus:outline-none"
              />
              <button
                type="submit"
                className="h-7 rounded-sm bg-action px-3 text-[11px] font-bold text-action-ink transition hover:bg-action-hover active:translate-y-px"
              >
                Join the waitlist
              </button>
            </div>
            <p className="text-[11px] text-mute">
              <span className="font-num font-bold text-ink">{signups}</span> on the waitlist.
              Nothing is sent; this is a demo.
            </p>
          </form>
        </div>
        <ol className="relative grid grid-cols-3">
          <span className="absolute inset-x-2 top-[7px] h-1 bg-rule" />
          <span
            className="absolute top-[7px] left-2 h-1 origin-left bg-line-green transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ right: "0.5rem", transform: `scaleX(${Math.max(stage, 0) / 2})` }}
          />
          {ROUTE.map((r, i) => (
            <li
              key={r}
              className="relative grid justify-items-center gap-1.5 first:justify-items-start last:justify-items-end"
            >
              <span
                className={`size-[18px] rounded-full border-[4px] bg-panel transition-colors duration-500 ${
                  i <= stage ? "border-ink" : "border-rule-strong"
                } ${i === stage ? "bg-line-yellow" : ""}`}
              />
              <span className="text-[11px] font-bold tracking-wide uppercase">{r}</span>
            </li>
          ))}
        </ol>
        <p className="min-h-4 text-xs text-ink-2" aria-live="polite">
          {status ?? "Every signup becomes someone to talk to."}
        </p>
      </div>
    </Frame>
  );
}

// ── Market size: move the inputs, watch the methods agree or not ──────────

export function MarketArt() {
  const [share, setShare] = useState(5);
  const [startups, setStartups] = useState(9000);
  const topDown = 15_400_000 * (share / 100) * 240;
  const bottomUp = startups * 90;
  const max = Math.max(topDown, bottomUp);
  const gap = topDown / bottomUp;
  const rows = [
    {
      method: "Top-down",
      tam: topDown,
      how: `15.4M undergraduates × ${share}% × $240 a year`,
    },
    {
      method: "Bottom-up",
      tam: bottomUp,
      how: `${startups.toLocaleString()} formal startups × $90 a year`,
    },
  ];
  return (
    <Frame
      hint="Drag the assumptions and watch the two methods"
      onReset={() => {
        setShare(5);
        setStartups(9000);
      }}
    >
      <div className="grid gap-5 p-5">
        {rows.map((r) => (
          <div key={r.method} className="grid gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs font-bold">{r.method} TAM</span>
              <span className="font-num text-lg font-extrabold tracking-tight">
                {compact(r.tam, "usd")}
              </span>
            </div>
            <div className="h-2 bg-sunk">
              <div
                className="h-full min-w-1 origin-left bg-ink transition-[width] duration-300"
                style={{ width: `${(r.tam / max) * 100}%` }}
              />
            </div>
            <span className="text-[11px] text-mute">{r.how}</span>
          </div>
        ))}
        <div className="grid gap-3 border-t border-rule pt-4 text-xs">
          <label className="grid grid-cols-[9rem_1fr_3rem] items-center gap-3">
            <span className="font-bold">Undergrads with an idea</span>
            <input
              type="range"
              min={1}
              max={10}
              step={0.5}
              value={share}
              onChange={(e) => setShare(Number(e.target.value))}
              className="accent-[var(--action)]"
            />
            <span className="text-right font-num">{share}%</span>
          </label>
          <label className="grid grid-cols-[9rem_1fr_3rem] items-center gap-3">
            <span className="font-bold">Formal startups a year</span>
            <input
              type="range"
              min={3000}
              max={60000}
              step={1000}
              value={startups}
              onChange={(e) => setStartups(Number(e.target.value))}
              className="accent-[var(--action)]"
            />
            <span className="text-right font-num">{compact(startups, "count")}</span>
          </label>
        </div>
        <p
          className={`border-t-2 pt-2 text-xs leading-relaxed text-ink-2 ${gap > 3 ? "border-line-yellow" : "border-sup"}`}
        >
          <span className="font-bold text-ink">Finding:</span>{" "}
          {gap > 3
            ? `the two methods differ by about ${Math.round(gap)}×. One of the assumptions is wrong, and that is worth testing.`
            : "the two methods roughly agree, so the estimate is easier to defend."}
        </p>
      </div>
    </Frame>
  );
}

// ── The fleet: run it and watch work, spend and refusals ──────────────────

const TEAMS = [
  { team: "Research", line: "bg-line-yellow" },
  { team: "Strategy", line: "bg-line-red" },
  { team: "Growth", line: "bg-line-green" },
  { team: "Operations", line: "bg-line-blue" },
];

const ACTIONS = [
  { team: 0, text: "Research searched Reddit for “customer interviews take too long”", cost: 0.04 },
  { team: 0, text: "Research pulled 3 quotes from a campus incubator report", cost: 0.11 },
  {
    team: 3,
    text: "Refused: a LinkedIn profile page blocked by robots.txt. Logged, not fetched.",
    cost: 0,
    refused: true,
  },
  { team: 1, text: "Strategy rescored “will pay $20 a month”: 41% → 38%", cost: 0.06 },
  { team: 2, text: "Growth drafted a follow-up to a waitlist signup", cost: 0.03 },
  { team: 3, text: "Operations checked today’s caps: 4 of 15 emails used", cost: 0.01 },
  { team: 1, text: "Strategy asked four persona analysts to critique the report", cost: 0.18 },
];
const BUDGET = 5;

export function FleetArt() {
  const [running, setRunning] = useState(false);
  const [tick, setTick] = useState(0);
  const [spent, setSpent] = useState(3.92);
  const [budget, setBudget] = useState(BUDGET);
  const paused = spent >= budget;
  useEffect(() => {
    if (!running || paused) return;
    const t = setInterval(() => setTick((n) => n + 1), 1200);
    return () => clearInterval(t);
  }, [running, paused]);
  useEffect(() => {
    if (tick) setSpent((s) => Math.min(budget, s + ACTIONS[tick % ACTIONS.length].cost));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);
  const action = ACTIONS[tick % ACTIONS.length];

  return (
    <Frame
      hint="Run the fleet: it stops itself at the budget"
      onReset={() => {
        setTick(0);
        setSpent(3.92);
        setBudget(BUDGET);
        setRunning(false);
      }}
    >
      <motion.div
        className="grid gap-4 p-5"
        onViewportEnter={() => setRunning(true)}
        viewport={{ once: true, amount: 0.6 }}
      >
        {TEAMS.map((t, ti) => {
          const active = running && !paused && action.team === ti;
          const at = (tick + ti) % 4;
          return (
            <div key={t.team} className="grid grid-cols-[5.5rem_1fr] items-center gap-3">
              <span className={`text-xs font-bold transition-colors ${active ? "" : "text-mute"}`}>
                {t.team}
              </span>
              <div className="relative flex justify-between">
                <motion.span
                  className={`absolute inset-x-1 top-[7px] h-1 origin-left ${t.line}`}
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true, amount: 1 }}
                  transition={{ duration: 0.9, delay: ti * 0.1, ease }}
                />
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={`relative size-[18px] rounded-full border-[4px] transition-colors duration-300 ${
                      active && i === at
                        ? "animate-pulse border-ink bg-line-yellow motion-reduce:animate-none"
                        : i < at
                          ? "border-ink bg-panel"
                          : "border-rule-strong bg-panel"
                    }`}
                  />
                ))}
              </div>
            </div>
          );
        })}
        <p
          key={tick}
          aria-live="polite"
          className={`flex min-h-10 animate-rise items-start gap-2 border-t border-rule pt-3 text-xs motion-reduce:animate-none ${
            paused || action.refused ? "text-dis" : "text-ink-2"
          }`}
        >
          {(paused || action.refused) && (
            <Prohibit size={14} weight="bold" className="mt-px shrink-0" aria-hidden />
          )}
          {paused
            ? "Budget reached. Agents paused and are waiting for you to raise it."
            : action.text}
        </p>
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold">Spend</span>
            <span className="font-num">
              {usd(spent)} of {usd(budget)}
            </span>
          </div>
          <div className="h-2 bg-sunk">
            <div
              className="h-full origin-left bg-action transition-transform duration-700"
              style={{ transform: `scaleX(${spent / budget})` }}
            />
          </div>
        </div>
        <div className="flex gap-2">
          {paused ? (
            <Chip tone="primary" onClick={() => setBudget(budget + 5)}>
              Raise the budget by $5
            </Chip>
          ) : (
            <Chip tone="primary" onClick={() => setRunning(!running)}>
              {running ? (
                <>
                  <Pause size={12} weight="bold" aria-hidden /> Pause agents
                </>
              ) : (
                <>
                  <Play size={12} weight="bold" aria-hidden /> Run the fleet
                </>
              )}
            </Chip>
          )}
        </div>
      </motion.div>
    </Frame>
  );
}
