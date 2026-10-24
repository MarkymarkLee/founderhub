import { useState } from "react";
import { useConvex, useMutation, useQuery } from "convex/react";
import {
  ArrowSquareOut,
  CalendarPlus,
  Copy,
  Plus,
  Trash,
  UploadSimple,
  UsersThree,
} from "@phosphor-icons/react";
import { api } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { SKILL, setupPrompt } from "./grok.ts";
import {
  Button,
  Card,
  Empty,
  Field,
  Pill,
  Skeleton,
  ago,
  errorText,
  inputClass,
  useCopy,
} from "./ui.tsx";

const STATUS_LABEL: Record<Doc<"contacts">["status"], string> = {
  found: "Found, not contacted",
  queued: "Queued",
  emailed: "Emailed",
  replied: "Replied",
  "meeting booked": "Meeting booked",
  interviewed: "Interviewed",
  thanked: "Thanked",
};
const ORIGIN_LABEL: Record<Doc<"contacts">["origin"], string> = {
  scout: "Found online",
  waitlist: "Waitlist",
  manual: "Added by you",
};

function ConnectGrok({
  mcpUrl,
  connectedAt,
  canEdit,
}: {
  mcpUrl: string;
  connectedAt?: number;
  canEdit: boolean;
}) {
  const createToken = useMutation(api.mcp.createToken);
  const [token, setToken] = useState<string>();
  const { copied, copy } = useCopy();
  const prompt = token ? `${setupPrompt(mcpUrl, token)}\n\n${SKILL}` : "";
  return (
    <Card className="grid content-start gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold">Connect Grok Bot</h2>
        <Pill tone={connectedAt ? "accent" : "neutral"}>
          {connectedAt ? "Connected" : "Not connected"}
        </Pill>
      </div>
      <p className="text-sm text-mute">
        Grok Bot sends every email and LinkedIn message from your own accounts, within daily caps.
        FounderHub never sends anything itself.
      </p>
      {!canEdit ? null : token ? (
        <>
          <pre className="max-h-40 overflow-auto rounded bg-sunk p-3 font-mono text-xs whitespace-pre-wrap">
            {setupPrompt(mcpUrl, token)}
          </pre>
          <p className="text-xs text-mute">
            The token is shown once. Copying includes the skill instructions too.
          </p>
          <div>
            <Button variant="primary" onClick={() => void copy("prompt", prompt)}>
              <Copy size={14} aria-hidden /> {copied === "prompt" ? "Copied" : "Copy setup prompt"}
            </Button>
          </div>
        </>
      ) : (
        <div>
          <Button variant="primary" onClick={() => void createToken().then(setToken)}>
            {connectedAt ? "New setup prompt" : "Get setup prompt"}
          </Button>
        </div>
      )}
      {connectedAt && <p className="text-xs text-mute">First check-in {ago(connectedAt)}</p>}
    </Card>
  );
}

type Landing = NonNullable<ReturnType<typeof useCustomers>>["landing"];
const useCustomers = (projectId: Id<"projects">) => useQuery(api.projects.customers, { projectId });

function LandingCard({ landing, sample }: { landing: Landing; sample: boolean }) {
  const stats = [
    ["Visits", landing.visits],
    ["Visitors", landing.unique],
    ["Form starts", landing.formStarts],
    ["Signups", landing.signups],
  ] as const;
  const status = {
    building: "Writing the page…",
    publishing: "Publishing… (about 1 min)",
    live: "Live",
    failed: "Publishing failed",
  }[landing.status ?? "building"];
  return (
    <Card className="grid content-start gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold">Landing page</h2>
        <Pill tone={landing.status === "live" ? "accent" : "neutral"}>{status}</Pill>
      </div>
      {landing.pagesUrl &&
        (sample ? (
          <p className="truncate font-mono text-xs text-mute">{landing.pagesUrl}</p>
        ) : (
          <a
            href={landing.pagesUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 truncate text-sm underline-offset-2 hover:underline"
          >
            {landing.pagesUrl.replace(/^https:\/\//, "")} <ArrowSquareOut size={13} aria-hidden />
          </a>
        ))}
      {landing.error && <p className="text-sm text-dis">{landing.error}</p>}
      <dl className="flex flex-wrap divide-x divide-rule border-y border-rule text-sm">
        {[...stats, ["Conversion", `${(landing.conversion * 100).toFixed(1)}%`] as const].map(
          ([label, n]) => (
            // dt stays first for screen readers; the row shows the number first
            <div
              key={label}
              className="flex flex-row-reverse items-baseline gap-1.5 px-3 py-2 first:pl-0"
            >
              <dt className="text-mute">{label.toLowerCase()}</dt>
              <dd className="font-num font-bold">{n}</dd>
            </div>
          ),
        )}
      </dl>
    </Card>
  );
}

function AddContact({ projectId, onDone }: { projectId: Id<"projects">; onDone: () => void }) {
  const add = useMutation(api.projects.addContact);
  const [f, setF] = useState({ name: "", role: "", company: "", email: "", linkedinUrl: "" });
  const [error, setError] = useState<string>();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: e.target.value });
  return (
    <Card>
      <form
        className="grid gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          await add({
            projectId,
            name: f.name,
            role: f.role || undefined,
            company: f.company || undefined,
            email: f.email || undefined,
            linkedinUrl: f.linkedinUrl || undefined,
          }).then(onDone, (err) => setError(errorText(err)));
        }}
      >
        <h2 className="font-bold">Add someone you know</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Name">
            <input className={inputClass} value={f.name} onChange={set("name")} required />
          </Field>
          <Field label="Role">
            <input className={inputClass} value={f.role} onChange={set("role")} />
          </Field>
          <Field label="Company or school">
            <input className={inputClass} value={f.company} onChange={set("company")} />
          </Field>
          <Field label="Email">
            <input type="email" className={inputClass} value={f.email} onChange={set("email")} />
          </Field>
          <Field label="LinkedIn URL" hint="An email or a LinkedIn URL is needed.">
            <input
              type="url"
              className={inputClass}
              value={f.linkedinUrl}
              onChange={set("linkedinUrl")}
            />
          </Field>
        </div>
        {error && (
          <p role="alert" className="text-sm text-dis">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button variant="primary" type="submit">
            Add and queue
          </Button>
          <Button variant="quiet" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

function MeetingRow({
  m,
  name,
  sample,
  canEdit,
}: {
  m: Doc<"meetings">;
  name: string;
  sample: boolean;
  canEdit: boolean;
}) {
  const paste = useMutation(api.meetings.pasteTranscript);
  const convex = useConvex();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();
  const when = new Date(m.startTime).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const status = {
    booked: "Booked",
    ended: "Transcript saved",
    analyzing: "Analysing…",
    analyzed: "Analysed",
    failed: "Analysis failed",
  }[m.status];
  return (
    <li className="grid gap-3 border-b border-rule py-4 last:border-0">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="font-medium">{name}</span>
        <span className="text-mute">{when}</span>
        <Pill tone={m.status === "analyzed" ? "accent" : "neutral"}>{status}</Pill>
        {canEdit && m.status === "booked" && !open && (
          <span className="ml-auto flex gap-2">
            <Button disabled title="Recording from Google Meet is coming soon">
              <UploadSimple size={14} aria-hidden /> Upload recording (coming soon)
            </Button>
            <Button onClick={() => setOpen(true)}>Paste transcript</Button>
          </span>
        )}
      </div>
      {m.summary && <p className="max-w-[75ch] text-sm text-ink-2">{m.summary}</p>}
      {open && (
        <form
          className="grid gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            await paste({ meetingId: m._id, transcript: text }).then(
              () => setOpen(false),
              (err) => setError(errorText(err)),
            );
          }}
        >
          <Field
            label="Transcript"
            hint="Label lines with the speaker, e.g. “Founder:” and the interviewee’s name. Your own lines never count as evidence."
          >
            <textarea
              className={inputClass}
              rows={8}
              value={text}
              onChange={(e) => setText(e.target.value)}
              required
            />
          </Field>
          {error && (
            <p role="alert" className="text-sm text-dis">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" type="submit">
              Analyse the call
            </Button>
            {sample && (
              <Button
                onClick={async () =>
                  setText(
                    (await convex.query(api.seed.sampleTranscript, { meetingId: m._id })) ?? "",
                  )
                }
              >
                Use the sample transcript
              </Button>
            )}
            <Button variant="quiet" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </li>
  );
}

export function Customers({
  projectId,
  sample,
  canEdit,
}: {
  projectId: Id<"projects">;
  sample: boolean;
  canEdit: boolean;
}) {
  const data = useCustomers(projectId);
  const setCold = useMutation(api.projects.setColdOutreach);
  const remove = useMutation(api.projects.deleteContact);
  const logCall = useMutation(api.meetings.create);
  const [adding, setAdding] = useState(false);
  if (data === undefined) return <Skeleton rows={2} />;
  if (data === null) return null;
  const nameOf = new Map(data.contacts.map((c) => [c._id, c.name]));

  return (
    <div className="grid gap-8">
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <ConnectGrok
          mcpUrl={data.mcpUrl}
          connectedAt={data.grokConnectedAt}
          canEdit={canEdit && !sample}
        />
        <LandingCard landing={data.landing} sample={sample} />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            role="switch"
            checked={data.coldOutreach}
            disabled={!canEdit}
            onChange={(e) => void setCold({ projectId, on: e.target.checked })}
            className="size-4 accent-[var(--color-accent-strong)]"
          />
          <span>
            <span className="font-medium">Cold outreach</span>
            <span className="block text-xs text-mute">
              Off: Grok Bot only contacts waitlist signups and people you add.
            </span>
          </span>
        </label>
        {canEdit && !adding && (
          <Button className="ml-auto" onClick={() => setAdding(true)}>
            <Plus size={14} weight="bold" aria-hidden /> Add contact
          </Button>
        )}
      </div>
      {adding && <AddContact projectId={projectId} onDone={() => setAdding(false)} />}

      {data.contacts.length === 0 ? (
        <Empty icon={<UsersThree size={28} aria-hidden />} title="No people yet">
          Waitlist signups, people scouts find in public sources, and people you add all show up
          here.
        </Empty>
      ) : (
        <div className="overflow-x-auto border-b border-rule">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="border-b-2 border-ink text-xs text-mute">
              <tr>
                {["Person", "Source", "Status", "Fit", "Key quote", "Last touch", ""].map((h) => (
                  <th key={h} scope="col" className="px-4 py-2.5 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {data.contacts.map((c) => (
                <tr key={c._id} className="align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-mute">
                      {[c.role, c.company].filter(Boolean).join(", ")}
                    </p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{ORIGIN_LABEL[c.origin]}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{STATUS_LABEL[c.status]}</td>
                  <td className="px-4 py-3 font-num tabular-nums">{c.fitScore ?? ""}</td>
                  <td className="max-w-[28ch] px-4 py-3 text-ink-2">
                    {c.keyQuote && <span className="line-clamp-2">“{c.keyQuote}”</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-mute">
                    {c.lastTouchAt ? ago(c.lastTouchAt) : ""}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    {canEdit && c.status !== "found" && (
                      <Button
                        variant="quiet"
                        aria-label={`Log a call with ${c.name}`}
                        title="Log a call you had, then paste its transcript below"
                        onClick={() => void logCall({ contactId: c._id, startTime: Date.now() })}
                      >
                        <CalendarPlus size={14} aria-hidden />
                      </Button>
                    )}
                    {canEdit && (
                      <Button
                        variant="quiet"
                        aria-label={`Delete ${c.name}'s data`}
                        title="Delete this person's data (on request)"
                        onClick={() =>
                          confirm(`Delete everything stored about ${c.name}?`) &&
                          void remove({ contactId: c._id })
                        }
                      >
                        <Trash size={14} aria-hidden />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="grid gap-2">
        <h2 className="font-bold">Calls</h2>
        {data.meetings.length === 0 ? (
          <p className="text-sm text-mute">
            Calls Grok Bot books land here. After a call, paste the transcript and the quotes are
            pulled out for you.
          </p>
        ) : (
          <ul>
            {data.meetings.map((m) => (
              <MeetingRow
                key={m._id}
                m={m}
                name={nameOf.get(m.contactId) ?? "Someone"}
                sample={sample}
                canEdit={canEdit}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
