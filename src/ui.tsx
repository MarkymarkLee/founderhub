import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { ConvexError } from "convex/values";

// ── Routing: the URL query string is the only navigation state ──────────

export type Route = { p?: string; tab?: string; h?: string };

// localStorage key: the idea typed on the landing page, carried across the GitHub sign-in
export const PENDING_IDEA = "founderhub:pending-idea";

export function useRoute(): [Route, (r: Route) => void] {
  const read = () => Object.fromEntries(new URLSearchParams(location.search)) as Route;
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onPop = () => setRoute(read());
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, []);
  const go = (r: Route) => {
    const qs = new URLSearchParams(
      Object.entries(r).filter(([, v]) => v) as [string, string][],
    ).toString();
    history.pushState(null, "", qs ? `?${qs}` : location.pathname);
    setRoute(r);
    scrollTo({ top: 0 });
  };
  return [route, go];
}

// ── Formatting ──────────────────────────────────────────────────────────

export const usd = (n: number) => `$${n < 10 ? n.toFixed(2) : Math.round(n).toLocaleString()}`;

export function compact(n: number, unit: "usd" | "count" | "ratio") {
  if (unit === "ratio") return `${(n * 100).toFixed(n < 0.01 ? 2 : 1)}%`;
  const s = Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
  return unit === "usd" ? `$${s}` : s;
}

export function ago(at: number) {
  const s = Math.round((Date.now() - at) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export const errorText = (e: unknown) =>
  e instanceof ConvexError ? String(e.data) : "Something went wrong. Try again.";

// ── Pieces ──────────────────────────────────────────────────────────────

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "quiet";
};

export function Button({ variant = "secondary", className = "", ...props }: ButtonProps) {
  const styles = {
    primary: "bg-action text-action-ink hover:bg-action-hover",
    secondary: "border border-rule-strong text-ink hover:border-ink",
    quiet: "text-mute hover:text-ink",
  }[variant];
  return (
    <button
      type="button"
      className={`inline-flex h-10 items-center justify-center gap-2 rounded px-4 text-sm font-bold whitespace-nowrap transition active:translate-y-px disabled:pointer-events-none disabled:opacity-50 ${styles} ${className}`}
      {...props}
    />
  );
}

/** A ruled section: a 2px ink rule on top, no box. `boxed` is for live panels (fleet, chat). */
export function Card({
  children,
  className = "",
  boxed = false,
}: {
  children: ReactNode;
  className?: string;
  boxed?: boolean;
}) {
  return (
    <section
      className={`${boxed ? "border border-rule bg-panel p-6" : "border-t-2 border-ink pt-5"} ${className}`}
    >
      {children}
    </section>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "sup" | "dis";
}) {
  const styles = {
    neutral: "text-ink-2",
    accent: "text-accent-strong",
    sup: "text-sup",
    dis: "text-dis",
  }[tone];
  // a sign label: outlined in its own colour, never a filled lozenge
  return (
    <span
      className={`inline-flex h-6 items-center gap-1.5 rounded-sm border border-current px-2 text-xs font-bold whitespace-nowrap ${styles}`}
    >
      {children}
    </span>
  );
}

/** Route bullet: a hypothesis type as a transit-line roundel. */
const BULLET: Record<string, string> = {
  problem: "P",
  customer: "C",
  "willingness to pay": "W",
  channel: "Ch",
  competition: "Co",
  "market size": "M",
};

export function RouteBullet({ type, size = "md" }: { type: string; size?: "md" | "lg" }) {
  return (
    <span
      title={type}
      className={`inline-grid shrink-0 place-items-center rounded-full bg-action font-extrabold tracking-tight text-action-ink ${
        size === "lg" ? "size-10 text-base" : "size-6 text-[11px]"
      }`}
    >
      {BULLET[type] ?? type.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function Empty({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="grid place-items-center gap-3 border border-dashed border-rule-strong px-6 py-16 text-center">
      <span className="text-mute">{icon}</span>
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="max-w-[48ch] text-sm text-mute">{children}</div>
    </div>
  );
}

/** Skeleton blocks shaped like the content that is loading. */
export function Skeleton({ rows = 3, className = "h-40" }: { rows?: number; className?: string }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={`animate-pulse bg-sunk motion-reduce:animate-none ${className}`} />
      ))}
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-bold">{label}</span>
      {children}
      {hint && <span className="text-xs text-mute">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-sm border border-rule-strong bg-panel px-3 py-2 text-sm text-ink placeholder:text-mute focus:border-ink focus:outline-none";

export function useCopy() {
  const [copied, setCopied] = useState<string>();
  const copy = (key: string, text: string) =>
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(undefined), 1800);
    });
  return { copied, copy };
}

/** Score bar: a line from 0 to 100 with a tick at the 50% start, animated with transform only. */
export function ScoreBar({ score, label = "Confidence" }: { score: number; label?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="relative h-2 flex-1 bg-sunk"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score}
      >
        <div
          className={`h-full origin-left transition-transform duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
            score >= 50 ? "bg-sup" : "bg-dis"
          }`}
          style={{ transform: `scaleX(${score / 100})` }}
        />
        <span className="absolute inset-y-[-3px] left-1/2 w-px bg-ink" aria-hidden />
      </div>
      <span className="w-10 text-right font-num text-sm font-bold tabular-nums">{score}%</span>
    </div>
  );
}

/** The four team lines under the sign band: Research, Strategy, Growth, Operations. */
export function LineRule() {
  return (
    <div className="flex h-1" aria-hidden>
      <span className="flex-1 bg-line-yellow" />
      <span className="flex-1 bg-line-red" />
      <span className="flex-1 bg-line-green" />
      <span className="flex-1 bg-line-blue" />
    </div>
  );
}
