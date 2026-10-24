import { useRef, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { ArrowRight, ArrowUp, GithubLogo } from "@phosphor-icons/react";
import { Wordmark } from "./Wordmark.tsx";
import { PENDING_IDEA, LineRule } from "./ui.tsx";
import {
  ChatArt,
  CustomersArt,
  DashboardArt,
  FleetArt,
  HypothesisArt,
  MarketArt,
} from "./LandingArt.tsx";

const EXAMPLES = [
  "Meal plans for students on a dining plan",
  "Shift swapping for hospital nurses",
  "Bookkeeping for food trucks",
];

const ease = [0.16, 1, 0.3, 1] as const;

const FEATURES: { title: string; body: string; points: string[]; art: ReactNode }[] = [
  {
    title: "Get the idea straight before anything runs",
    body: "A short chat plays your idea back to you, one part at a time. Research only starts once you agree on the problem, who has it and what you would build.",
    points: [
      "Problem, target audience and solution, each confirmed by you",
      "Say “just write it” to skip ahead",
      "Edit the brief any time before you approve",
    ],
    art: <ChatArt />,
  },
  {
    title: "Every hypothesis scored by the quotes behind it",
    body: "Your brief becomes five to eight falsifiable hypotheses. Each one says what would disprove it, and its score moves only when a quote supports or contradicts it.",
    points: [
      "Interviews count more than forum posts",
      "Read the quotes for and against side by side",
      "See which hypotheses are still a coin flip",
    ],
    art: <HypothesisArt />,
  },
  {
    title: "A landing page and outreach, on your accounts",
    body: "FounderHub publishes a landing page to your GitHub Pages and turns waitlist signups into people to talk to. Outreach goes from your own Gmail and LinkedIn, under strict daily caps.",
    points: [
      "Contacts only signups and people you add",
      "Plain, personal messages, never bulk mail",
      "Paste a call transcript and it becomes evidence",
    ],
    art: <CustomersArt />,
  },
  {
    title: "Market size with the method shown",
    body: "TAM, SAM and SOM are worked out top-down and bottom-up, with a source for every input. When the two methods disagree, that gap is reported as a finding.",
    points: [
      "Every number links to where it came from",
      "Estimates are labelled as estimates",
      "Learn how sizing works by reading it",
    ],
    art: <MarketArt />,
  },
  {
    title: "A fleet you can watch, with guardrails you can see",
    body: "A chief of staff runs four agent teams: Research, Strategy, Growth and Operations. You see who is working, what it costs and every action they refused to take.",
    points: [
      "You set the budget; agents pause at the cap",
      "Robots.txt, rate limits and quotas checked first",
      "Every action written to an audit log",
    ],
    art: <FleetArt />,
  },
];

const STEPS = [
  ["Describe it", "One sentence about the idea."],
  ["Sign in", "With GitHub. It also hosts your landing page."],
  ["Confirm it", "Problem, audience and solution, in a chat."],
  ["Check in", "Agents research for hours. The dashboard updates live."],
];

export function SignIn({ onSample }: { onSample: () => void }) {
  const { signIn } = useAuthActions();
  const [idea, setIdea] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string>();
  const input = useRef<HTMLTextAreaElement>(null);
  const ready = idea.trim().length >= 8;

  const signInWithGitHub = () => {
    setError(undefined);
    setBusy(true);
    signIn("github").catch(() => {
      setBusy(false);
      setError("GitHub sign-in failed. Try again, or open the sample.");
    });
  };

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!ready || busy) return;
    // Home picks the idea up after the GitHub round trip and starts the chat with it.
    try {
      localStorage.setItem(PENDING_IDEA, idea.trim());
    } catch {
      // storage blocked: the founder retypes it after sign-in
    }
    signInWithGitHub();
  };

  const toIdea = () => {
    scrollTo({
      top: 0,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
    input.current?.focus({ preventScroll: true });
  };

  return (
    <div className="overflow-x-clip">
      <header className="sticky top-0 z-20 bg-sign text-sign-ink">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 md:px-8">
          <Wordmark />
          <nav className="flex items-center gap-1" aria-label="Site">
            {[
              ["Features", "#features"],
              ["How it works", "#how"],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="hidden px-3 py-2 text-sm font-bold text-sign-mute no-underline transition hover:text-sign-ink md:block"
              >
                {label}
              </a>
            ))}
            <button
              type="button"
              onClick={onSample}
              className="px-3 py-2 text-sm font-bold text-sign-mute transition hover:text-sign-ink"
            >
              See a sample
            </button>
            <button
              type="button"
              onClick={signInWithGitHub}
              disabled={busy}
              className="ml-2 flex h-10 items-center gap-2 rounded bg-line-yellow px-4 text-sm font-bold whitespace-nowrap text-sign transition hover:brightness-105 active:translate-y-px disabled:opacity-60"
            >
              <GithubLogo size={16} weight="bold" aria-hidden />
              Sign in
            </button>
          </nav>
        </div>
        <LineRule />
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl gap-14 px-4 pt-20 pb-24 md:px-8 md:pt-28">
          <div className="mx-auto grid w-full max-w-3xl gap-8">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease }}
              className="grid gap-5 text-center"
            >
              <h1 className="text-4xl leading-[1.05] font-extrabold tracking-tighter text-balance md:text-6xl">
                Is your idea worth building?
              </h1>
              <p className="mx-auto max-w-[52ch] text-lg leading-relaxed text-mute">
                Describe it in a sentence. A fleet of agents spends the next hours finding cited
                proof for and against it, while you keep building.
              </p>
            </motion.div>

            <motion.form
              onSubmit={submit}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.12, ease }}
              className="grid gap-4"
            >
              <div className="border-2 border-rule-strong bg-panel p-3 transition-colors focus-within:border-ink">
                <label htmlFor="idea" className="sr-only">
                  Your startup idea
                </label>
                <textarea
                  id="idea"
                  ref={input}
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) submit(e);
                  }}
                  rows={3}
                  placeholder="Describe your startup idea, like a shift-swap app for nurses..."
                  className="block w-full resize-none bg-transparent px-2 py-1 text-base text-ink placeholder:text-mute focus:outline-none"
                />
                <div className="flex items-center justify-between gap-3 pt-2">
                  <span className="px-2 text-xs text-mute">
                    Next: sign in with GitHub, then a short chat
                  </span>
                  <button
                    type="submit"
                    disabled={!ready || busy}
                    aria-label="Start testing this idea"
                    className="grid size-10 place-items-center rounded bg-action text-action-ink transition hover:bg-action-hover active:scale-95 disabled:bg-rule disabled:text-mute"
                  >
                    <ArrowUp size={18} weight="bold" aria-hidden />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {EXAMPLES.map((x) => (
                  <button
                    key={x}
                    type="button"
                    onClick={() => setIdea(x)}
                    className="h-8 rounded-sm border border-rule-strong bg-panel px-3 text-sm text-ink-2 transition hover:border-ink active:translate-y-px"
                  >
                    {x}
                  </button>
                ))}
              </div>
              {error && (
                <p role="alert" className="text-center text-sm text-dis">
                  {error}
                </p>
              )}
            </motion.form>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.25, ease }}
          >
            <DashboardArt />
          </motion.div>
        </section>

        <section id="features" className="scroll-mt-20 border-t-2 border-ink">
          <div className="mx-auto grid max-w-6xl gap-4 px-4 pt-20 md:px-8">
            <h2 className="max-w-[22ch] text-3xl font-extrabold tracking-tighter text-balance md:text-5xl">
              Everything you would do to validate an idea, done for you
            </h2>
            <p className="max-w-[60ch] text-mute">
              You make the founder decisions: approve the brief, set the budget, take the calls.
              Everything else runs unattended and reports back with sources.
            </p>
          </div>
          <div className="mx-auto grid max-w-6xl px-4 md:px-8">
            {FEATURES.map((f, i) => (
              <article
                key={f.title}
                className="grid items-center gap-10 border-b border-rule py-20 last:border-b-0 md:grid-cols-2 md:gap-16"
              >
                <div className={`grid gap-5 ${i % 2 ? "md:order-2" : ""}`}>
                  <h3 className="max-w-[24ch] text-2xl font-extrabold tracking-tight text-balance md:text-3xl">
                    {f.title}
                  </h3>
                  <p className="max-w-[52ch] leading-relaxed text-ink-2">{f.body}</p>
                  <ul className="grid max-w-[52ch] border-t border-rule">
                    {f.points.map((p) => (
                      <li key={p} className="border-b border-rule py-2.5 text-sm text-ink-2">
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={i % 2 ? "md:order-1" : ""}>{f.art}</div>
              </article>
            ))}
          </div>
        </section>

        <section id="how" className="scroll-mt-20 border-t-2 border-ink">
          <div className="mx-auto grid max-w-6xl gap-14 px-4 py-24 md:px-8">
            <h2 className="text-3xl font-extrabold tracking-tighter text-balance md:text-5xl">
              About five minutes of your time
            </h2>
            <ol className="relative grid gap-8 md:grid-cols-4 md:gap-6">
              {/* track and fill run from the first station to the last: 3 of 4 columns plus 3 gaps */}
              <span
                aria-hidden
                className="absolute top-[9px] left-3 hidden h-1.5 bg-rule md:block"
                style={{ width: "calc(75% + 18px)" }}
              />
              <motion.span
                aria-hidden
                className="absolute top-[9px] left-3 hidden h-1.5 origin-left bg-ink md:block"
                style={{ width: "calc(75% + 18px)" }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: step / (STEPS.length - 1) }}
                transition={{ duration: 0.7, ease }}
              />
              {STEPS.map(([title, body], i) => (
                <li key={title}>
                  <button
                    type="button"
                    onClick={() => setStep(i)}
                    onMouseEnter={() => setStep(i)}
                    aria-current={i === step ? "step" : undefined}
                    className="group relative grid content-start justify-items-start gap-3 text-left"
                  >
                    <span
                      aria-hidden
                      className={`size-6 rounded-full border-[5px] transition-colors duration-300 ${
                        i < step
                          ? "border-ink bg-ink"
                          : i === step
                            ? "border-ink bg-line-yellow"
                            : "border-rule-strong bg-panel group-hover:border-ink"
                      }`}
                    />
                    <span className="text-[11px] font-bold tracking-wide uppercase">{title}</span>
                    <span
                      className={`max-w-[26ch] text-sm transition-colors ${i === step ? "text-ink" : "text-mute"}`}
                    >
                      {body}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="bg-sign text-sign-ink">
          <LineRule />
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-8 px-4 py-20 md:px-8">
            <div className="grid gap-3">
              <h2 className="text-3xl font-extrabold tracking-tighter text-balance md:text-4xl">
                Find out before you build it.
              </h2>
              <p className="max-w-[48ch] text-sign-mute">
                Start with one sentence, or open the sample project to see a finished dashboard.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={toIdea}
                className="flex h-11 items-center gap-2 rounded bg-line-yellow px-5 text-sm font-bold text-sign transition hover:brightness-105 active:translate-y-px"
              >
                Test an idea <ArrowRight size={16} weight="bold" aria-hidden />
              </button>
              <button
                type="button"
                onClick={onSample}
                className="h-11 rounded border border-sign-mute px-5 text-sm font-bold text-sign-ink transition hover:border-sign-ink active:translate-y-px"
              >
                See a sample
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
