import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { FileText } from "@phosphor-icons/react";
import { api } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { Button, Card, Empty, Skeleton, ago } from "./ui.tsx";

function List({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="grid content-start gap-2">
      <h3 className="text-sm font-bold">{title}</h3>
      <ul className="grid list-disc gap-1 pl-5 text-sm text-ink-2">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}

function Version({ r }: { r: Doc<"reports"> }) {
  return (
    <div className="grid gap-5">
      <div className="rounded bg-accent/10 p-4">
        <h3 className="text-sm font-bold">What changed since the last run</h3>
        <p className="mt-1 text-sm">{r.whatChanged}</p>
      </div>
      {/* The body is plain markdown from the synthesizer; shown as text, never as HTML. */}
      <p className="max-w-[70ch] text-sm leading-relaxed whitespace-pre-wrap text-ink-2">
        {r.body.replace(/^#+\s*/gm, "").replace(/\*\*/g, "")}
      </p>
      <div className="grid gap-5 md:grid-cols-3">
        <List title="Validated" items={r.validated} />
        <List title="Shaky" items={r.shaky} />
        <List title="Next three experiments" items={r.experiments} />
      </div>
    </div>
  );
}

export function Report({ projectId, canEdit }: { projectId: Id<"projects">; canEdit: boolean }) {
  const data = useQuery(api.projects.reports, { projectId });
  const runPersonas = useMutation(api.strategy.runPersonasNow);
  const [asked, setAsked] = useState(false);
  if (data === undefined) return <Skeleton rows={1} className="h-96" />;
  const [latest, ...older] = data?.reports ?? [];

  const rerun = canEdit && (
    <Button
      disabled={asked}
      onClick={() => void runPersonas({ projectId }).then(() => setAsked(true))}
    >
      {asked ? "Personas are reviewing…" : "Run the personas now"}
    </Button>
  );

  if (!latest)
    return (
      <div className="grid gap-4">
        <Empty icon={<FileText size={28} aria-hidden />} title="No report yet">
          Four persona analysts (a skeptical VC, a target customer, an industry analyst and a
          competitor PM) review the evidence every 30 minutes. The synthesizer turns their notes
          into a report.
        </Empty>
        <div>{rerun}</div>
      </div>
    );

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">
            Report v{latest.version}
          </h1>
          <p className="text-sm text-mute">
            Written {ago(latest.createdAt)} from the persona reviews
          </p>
        </div>
        {rerun}
      </div>
      <Card>
        <Version r={latest} />
      </Card>
      {older.length > 0 && (
        <section className="grid gap-2">
          <h2 className="font-bold">Earlier versions</h2>
          {older.map((r) => (
            <details key={r._id} className="rounded border border-rule bg-panel px-5 py-3">
              <summary className="cursor-pointer text-sm font-medium">
                v{r.version}, {ago(r.createdAt)}
              </summary>
              <div className="pt-4">
                <Version r={r} />
              </div>
            </details>
          ))}
        </section>
      )}
    </div>
  );
}
