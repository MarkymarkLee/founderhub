import { useQuery } from "convex/react";
import { ArrowSquareOut, ChartPieSlice } from "@phosphor-icons/react";
import { api } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { Card, Empty, Skeleton, compact } from "./ui.tsx";

type Line = NonNullable<Doc<"reports">["market"]>["topDown"][number];
type Sources = Record<string, { url: string; title?: string; sourceType: string }>;

/** The first money line is the TAM and the last is the SAM (the synthesizer is told to list them that way). */
function tamSam(lines: Line[]) {
  const money = lines.filter((l) => l.unit === "usd");
  return { tam: money[0]?.value, sam: money[money.length - 1]?.value };
}

function Method({
  title,
  how,
  lines,
  sources,
  conversion,
}: {
  title: string;
  how: string;
  lines: Line[];
  sources: Sources;
  conversion: number;
}) {
  const { sam } = tamSam(lines);
  return (
    <Card className="grid content-start gap-4">
      <div className="grid gap-1">
        <h2 className="font-bold">{title}</h2>
        <p className="text-sm text-mute">{how}</p>
      </div>
      <ol className="grid gap-4">
        {lines.map((l, i) => {
          const s = l.sourceId ? sources[l.sourceId] : undefined;
          return (
            <li key={i} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5">
              <span className="text-sm">{l.label}</span>
              <span className="text-right font-num text-lg tabular-nums">
                {compact(l.value, l.unit)}
              </span>
              <span className="col-span-2 text-xs text-mute">
                {l.note}
                {s &&
                  (/^https?:/.test(s.url) ? (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-1.5 inline-flex items-center gap-0.5 underline underline-offset-2"
                    >
                      {s.title || "Source"} <ArrowSquareOut size={11} aria-hidden />
                    </a>
                  ) : (
                    <span className="ml-1.5">Source: {s.title}</span>
                  ))}
                {!s && " (no source yet)"}
              </span>
            </li>
          );
        })}
        {sam !== undefined && (
          <li className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 border-t border-rule pt-4">
            <span className="text-sm font-medium">SOM: SAM × waitlist conversion</span>
            <span className="text-right font-num text-lg tabular-nums">
              {compact(sam * conversion, "usd")}
            </span>
            <span className="col-span-2 text-xs text-mute">
              {conversion
                ? `Uses the ${(conversion * 100).toFixed(1)}% of landing-page visitors who joined the waitlist, not a guess.`
                : "Needs landing-page signups before it can be estimated."}
            </span>
          </li>
        )}
      </ol>
    </Card>
  );
}

export function Market({ projectId }: { projectId: Id<"projects"> }) {
  const data = useQuery(api.projects.reports, { projectId });
  const customers = useQuery(api.projects.customers, { projectId });
  if (data === undefined || customers === undefined) return <Skeleton rows={2} className="h-80" />;
  const market = data?.reports.find((r) => r.market)?.market;
  if (!data || !market)
    return (
      <Empty icon={<ChartPieSlice size={28} aria-hidden />} title="No market sizing yet">
        The report synthesizer sizes the market two ways once scouts bring back reports and public
        counts.
      </Empty>
    );
  const conversion = customers?.landing.conversion ?? 0;
  const top = tamSam(market.topDown);
  const bottom = tamSam(market.bottomUp);
  const gap =
    top.sam && bottom.sam ? Math.max(top.sam, bottom.sam) / Math.min(top.sam, bottom.sam) : null;

  return (
    <div className="grid gap-6">
      <section className="grid gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">
          Market size, two ways
        </h1>
        <p className="max-w-[65ch] text-sm text-mute">
          Every number shows the technique and the source behind it. When the two methods disagree,
          the gap is a finding: it tells you which assumption to test next.
        </p>
      </section>
      {gap && gap >= 1.5 && (
        <Card className="!border-accent">
          <p className="text-sm">
            <span className="font-medium">
              The {top.sam! > bottom.sam! ? "top-down" : "bottom-up"} SAM is{" "}
              {gap >= 10 ? Math.round(gap) : gap.toFixed(1)}× the other.
            </span>{" "}
            Top-down starts from everyone who could buy; bottom-up counts customers you can actually
            find and what they said they would pay. Trust the smaller number until evidence closes
            the gap.
          </p>
        </Card>
      )}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Method
          title="Top-down"
          how="Total market from reports and public data, then the share that matches your segment and the share you can reach."
          lines={market.topDown}
          sources={data.sources}
          conversion={conversion}
        />
        <Method
          title="Bottom-up"
          how="Number of target customers you can count, times the price people named in interviews and the waitlist."
          lines={market.bottomUp}
          sources={data.sources}
          conversion={conversion}
        />
      </div>
    </div>
  );
}
