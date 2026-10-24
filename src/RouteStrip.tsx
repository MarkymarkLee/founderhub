import { useEffect, useRef, useState } from "react";
import { sourceLabel, type Quote } from "./HypothesisCard.tsx";

type Point = {
  at: number;
  score: number;
  cause: { id: string; quote: string; stance: string; weight: number } | null;
};

const H = 168; // strip height
const TOP = 32; // y of 100%
const BOTTOM = 136; // y of 0%
const PAD = 32;
const LABEL_GAP = 88; // narrower than this and a stop keeps only its tooltip

const y = (score: number) => BOTTOM - ((BOTTOM - TOP) * score) / 100;

/**
 * The score history drawn as a transit line: each quote is a stop, the run between stops is
 * proportional to that quote's weight, and every change in score bends the line at 45°.
 */
export function RouteStrip({
  history,
  quotes,
  contested,
}: {
  history: Point[];
  quotes: Quote[];
  contested: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const byId = new Map(quotes.map((q) => [q._id as string, q]));
  const points = history.length ? history : [{ at: 0, score: 50, cause: null }];

  // Each run is proportional to its quote's weight times the extractor's confidence.
  const runs = points.map((p, i) => (i === 0 ? 0 : (p.cause?.weight ?? 1)));
  const total = runs.reduce((s, r) => s + r, 0) || 1;
  const span = Math.max(0, width - PAD * 2 - (contested ? 96 : 24));
  let x = PAD;
  const stops = points.map((p, i) => {
    x += (runs[i] / total) * span;
    return { ...p, x, y: y(p.score), q: p.cause ? byId.get(p.cause.id) : undefined };
  });
  const last = stops[stops.length - 1];

  const segment = (i: number) => {
    const a = stops[i - 1];
    const b = stops[i];
    const dy = Math.abs(b.y - a.y);
    return `M${a.x} ${a.y} H${Math.max(a.x, b.x - dy)} L${b.x} ${b.y}`;
  };
  const color = (stance?: string) =>
    stance === "supports" ? "var(--sup)" : stance ? "var(--dis)" : "var(--ink)";

  const first = points[0].score;
  return (
    <div
      ref={box}
      className="relative border-y border-rule"
      role="img"
      aria-label={`Score moved from ${first}% to ${last.score}% across ${stops.length - 1} quotes.`}
    >
      {width > 0 && (
        <svg width={width} height={H} className="block" aria-hidden>
          <line
            x1={PAD}
            x2={width - PAD}
            y1={y(50)}
            y2={y(50)}
            stroke="var(--rule)"
            strokeDasharray="2 6"
          />
          {stops.slice(1).map((s, i) => (
            <path
              key={s.at}
              d={segment(i + 1)}
              pathLength={1}
              fill="none"
              stroke={color(s.cause?.stance)}
              strokeWidth={8}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={i === stops.length - 2 ? "route-draw" : undefined}
            />
          ))}
          {contested && (
            <path
              d={`M${last.x} ${last.y} H${last.x + 24} L${last.x + 48} ${last.y - 24} H${last.x + 72}`}
              fill="none"
              stroke="var(--line-yellow)"
              strokeWidth={8}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="0.1 14"
            />
          )}
          {stops.map((s, i) => {
            const end = i === stops.length - 1;
            const roomy = i === 0 || end || s.x - stops[i - 1].x >= LABEL_GAP;
            // climbing stops label above, falling stops below, so labels clear the incoming line
            const above = i > 0 && s.score > stops[i - 1].score;
            const label =
              i === 0 ? "START" : s.q ? (sourceLabel[s.q.sourceType] ?? s.q.sourceType) : "QUOTE";
            return (
              <g key={s.at}>
                <title>
                  {s.cause ? `${s.score}%: “${s.cause.quote}”` : `Starting point, ${s.score}%`}
                </title>
                <circle
                  cx={s.x}
                  cy={s.y}
                  r={end ? 14 : 8}
                  fill="var(--panel)"
                  stroke={end ? "var(--ink)" : color(s.cause?.stance)}
                  strokeWidth={end ? 6 : 4}
                />
                {roomy && !end && (
                  <text
                    x={s.x}
                    y={above ? s.y - 16 : s.y + 26}
                    textAnchor={i === 0 ? "start" : "middle"}
                    className="fill-mute text-[11px] font-bold uppercase"
                  >
                    {label} {s.score}%
                  </text>
                )}
              </g>
            );
          })}
          {contested && (
            <text
              x={last.x + 76}
              y={last.y - 32}
              textAnchor="end"
              className="fill-ink text-[11px] font-bold"
            >
              PERSONAS DISAGREE
            </text>
          )}
        </svg>
      )}
    </div>
  );
}
