import { motion } from "motion/react";
import {
  ArrowSquareOut,
  ChatCircleText,
  ChatsCircle,
  ChartBar,
  EnvelopeSimple,
  FileText,
  Globe,
  LinkedinLogo,
  ListChecks,
  Microphone,
  RedditLogo,
  ThumbsDown,
  ThumbsUp,
  type Icon,
} from "@phosphor-icons/react";
import type { FunctionReturnType } from "convex/server";
import type { api } from "../convex/_generated/api";
import { RouteBullet, ScoreBar } from "./ui.tsx";

export type ProjectData = NonNullable<FunctionReturnType<typeof api.projects.get>>;
export type HypothesisRow = ProjectData["hypotheses"][number];
export type Quote = NonNullable<HypothesisRow["support"]>;

export const sourceIcon: Record<string, Icon> = {
  interview: Microphone,
  email: EnvelopeSimple,
  linkedin: LinkedinLogo,
  waitlist: ListChecks,
  reddit: RedditLogo,
  forum: ChatsCircle,
  report: FileText,
  "public data": ChartBar,
  web: Globe,
};

export const sourceLabel: Record<string, string> = {
  interview: "Interviews",
  email: "Email replies",
  linkedin: "LinkedIn replies",
  waitlist: "Waitlist answers",
  reddit: "Reddit",
  forum: "Forums",
  report: "Reports",
  "public data": "Public data",
  web: "Web",
};

export function QuoteBody({ q, clamp = true }: { q: Quote; clamp?: boolean }) {
  const SourceIcon = sourceIcon[q.sourceType] ?? ChatCircleText;
  const date = new Date(q.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return (
    <figure key={q.quote} className="grid animate-rise gap-1 motion-reduce:animate-none">
      <blockquote className={`text-sm leading-relaxed text-ink-2 ${clamp ? "line-clamp-3" : ""}`}>
        &ldquo;{q.quote}&rdquo;
      </blockquote>
      <figcaption className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-mute">
        <span>
          <SourceIcon size={13} className="mr-1.5 inline align-[-2px]" aria-hidden />
          {q.speaker}, {date}
        </span>
        {q.url && (
          <a
            href={q.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 underline-offset-2 hover:underline"
          >
            Source <ArrowSquareOut size={12} aria-hidden />
          </a>
        )}
        {q.isNew && <span className="font-bold text-accent-strong">New</span>}
      </figcaption>
    </figure>
  );
}

function Side({
  label,
  icon: StanceIcon,
  q,
  stance,
}: {
  label: string;
  icon: Icon;
  q: Quote | null;
  stance: "sup" | "dis";
}) {
  return (
    <div className="grid content-start gap-2">
      <p
        className={`flex items-center gap-1.5 border-b-2 pb-1 text-xs font-bold ${
          stance === "sup" ? "border-sup text-sup" : "border-dis text-dis"
        }`}
      >
        <StanceIcon size={14} weight="bold" aria-hidden />
        {label}
      </p>
      {q ? (
        <QuoteBody q={q} />
      ) : (
        <p className="text-sm text-mute">Nothing yet. Scouts are still looking.</p>
      )}
    </div>
  );
}

export function HypothesisCard({
  h,
  fresh = false,
  onOpen,
}: {
  h: Pick<HypothesisRow, "type" | "statement" | "score" | "support" | "disprove" | "strength">;
  fresh?: boolean;
  onOpen?: () => void;
}) {
  return (
    <motion.article
      layout
      transition={{ type: "spring", stiffness: 140, damping: 22 }}
      className="relative grid content-start gap-6 bg-panel p-6"
    >
      <span
        className={`absolute inset-x-0 top-0 h-1 bg-line-yellow transition-opacity duration-700 ${
          fresh ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden
      />
      <header className="flex items-start gap-3">
        <RouteBullet type={h.type} />
        <h3 className="text-base leading-snug font-bold text-pretty">
          {onOpen ? (
            <button
              type="button"
              onClick={onOpen}
              className="text-left hover:underline hover:underline-offset-4"
            >
              {h.statement}
            </button>
          ) : (
            h.statement
          )}
        </h3>
      </header>
      <div className="grid gap-6 sm:grid-cols-2">
        <Side label="Strongest for" icon={ThumbsUp} q={h.support} stance="sup" />
        <Side label="Strongest against" icon={ThumbsDown} q={h.disprove} stance="dis" />
      </div>
      <footer className="grid gap-2">
        <ScoreBar score={h.score} />
        <p className="text-xs text-mute">
          {h.strength.quotes === 0
            ? "No evidence yet"
            : `${h.strength.quotes} ${h.strength.quotes === 1 ? "quote" : "quotes"} from ${h.strength.sourceTypes} ${
                h.strength.sourceTypes === 1 ? "kind of source" : "kinds of source"
              }${h.strength.quotes < 3 ? ", still thin" : ""}`}
        </p>
      </footer>
    </motion.article>
  );
}
