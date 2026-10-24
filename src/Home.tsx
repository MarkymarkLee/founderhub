import { useEffect, useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import { ArrowRight, Flask } from "@phosphor-icons/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../convex/_generated/api";
import { Wordmark } from "./Wordmark.tsx";
import { Button, PENDING_IDEA, Pill, errorText, inputClass, type Route, LineRule } from "./ui.tsx";

const BUDGETS = [5, 20, 50];

export function Home({
  projects,
  go,
}: {
  projects: FunctionReturnType<typeof api.projects.mine> | undefined;
  go: (r: Route) => void;
}) {
  const { signOut } = useAuthActions();
  const createProject = useMutation(api.chat.createProject);
  const [idea, setIdea] = useState("");
  const [budget, setBudget] = useState(20);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const begin = async (ideaText: string, budgetUsd: number) => {
    setBusy(true);
    setError(undefined);
    try {
      go({ p: await createProject({ ideaText, budgetUsd }) });
    } catch (err) {
      setIdea(ideaText);
      setError(errorText(err));
      setBusy(false);
    }
  };
  const start = (e: React.FormEvent) => {
    e.preventDefault();
    void begin(idea, budget);
  };

  // An idea typed on the landing page goes straight to the chat; removing it first keeps a StrictMode re-run from starting two.
  useEffect(() => {
    let pending: string | null = null;
    try {
      pending = localStorage.getItem(PENDING_IDEA);
      localStorage.removeItem(PENDING_IDEA);
    } catch {
      return;
    }
    if (pending) void begin(pending, 20);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="grid min-h-[100dvh] grid-rows-[auto_1fr]">
      <header className="bg-sign text-sign-ink">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 md:px-8">
          <Wordmark />
          <button
            type="button"
            onClick={() => void signOut()}
            className="text-sm font-bold text-sign-mute transition hover:text-sign-ink"
          >
            Sign out
          </button>
        </div>
        <LineRule />
      </header>
      <main className="mx-auto grid w-full max-w-3xl content-start gap-12 px-4 py-10 md:px-8 md:py-16">
        <form onSubmit={start} className="grid gap-5">
          <h1 className="text-3xl font-extrabold tracking-tight text-balance md:text-4xl">
            What are you building?
          </h1>
          <label className="grid gap-2">
            <span className="text-sm font-medium">Your idea, in a sentence</span>
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              rows={3}
              required
              minLength={8}
              placeholder="A meal-planning app for college students on a dining plan"
              className={`${inputClass} text-base`}
            />
          </label>
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">Research budget</legend>
            <div className="flex flex-wrap gap-2">
              {BUDGETS.map((b) => (
                <label
                  key={b}
                  className="cursor-pointer rounded-sm border border-rule-strong px-4 py-2 text-sm font-bold has-checked:border-ink has-checked:bg-action has-checked:text-action-ink has-focus-visible:outline-2 has-focus-visible:outline-accent"
                >
                  <input
                    type="radio"
                    name="budget"
                    value={b}
                    checked={budget === b}
                    onChange={() => setBudget(b)}
                    className="sr-only"
                  />
                  ${b}
                </label>
              ))}
            </div>
            <p className="text-xs text-mute">
              Agent and scraping credits. Agents pause at the cap and ask before spending more.
            </p>
          </fieldset>
          {error && (
            <p role="alert" className="text-sm text-dis">
              {error}
            </p>
          )}
          <div>
            <Button variant="primary" type="submit" disabled={busy || idea.trim().length < 8}>
              Start the chat <ArrowRight size={16} weight="bold" aria-hidden />
            </Button>
          </div>
        </form>

        <section className="grid gap-3" aria-label="Your projects">
          <h2 className="text-sm font-bold text-mute">Projects</h2>
          {projects === undefined ? (
            <div className="h-24 animate-pulse rounded bg-sunk/70" aria-busy="true" />
          ) : (
            <ul className="grid gap-2">
              {projects.map((p) => (
                <li key={p._id}>
                  <button
                    type="button"
                    onClick={() => go({ p: p._id })}
                    className="flex w-full items-center gap-3 rounded border border-rule bg-panel px-4 py-3 text-left text-sm transition hover:border-rule-strong"
                  >
                    {p.sample && <Flask size={16} className="shrink-0 text-mute" aria-hidden />}
                    <span className="line-clamp-1 flex-1">{p.ideaText}</span>
                    <Pill tone={p.status === "active" ? "accent" : "neutral"}>
                      {p.sample ? "Sample" : p.status}
                    </Pill>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
