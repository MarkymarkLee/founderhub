import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import {
  ChartPieSlice,
  FileText,
  GearSix,
  Lightbulb,
  Pulse,
  UsersThree,
  type Icon,
} from "@phosphor-icons/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { Activity } from "./Activity.tsx";
import { Customers } from "./Customers.tsx";
import { Draft } from "./Draft.tsx";
import { HypothesisPage } from "./HypothesisPage.tsx";
import { Hypotheses } from "./Hypotheses.tsx";
import { Market } from "./Market.tsx";
import { Report } from "./Report.tsx";
import { Settings } from "./Settings.tsx";
import { Wordmark } from "./Wordmark.tsx";
import { Button, LineRule, Skeleton, type Route } from "./ui.tsx";

const TABS: { key: string; name: string; icon: Icon }[] = [
  { key: "hypotheses", name: "Hypotheses", icon: Lightbulb },
  { key: "customers", name: "Customers", icon: UsersThree },
  { key: "market", name: "Market", icon: ChartPieSlice },
  { key: "report", name: "Report", icon: FileText },
  { key: "activity", name: "Activity", icon: Pulse },
  { key: "settings", name: "Settings", icon: GearSix },
];

export function Project({
  projectId,
  route,
  go,
  signedIn,
}: {
  projectId: Id<"projects">;
  route: Route;
  go: (r: Route) => void;
  signedIn: boolean;
}) {
  const data = useQuery(api.projects.get, { projectId });
  const { signIn, signOut } = useAuthActions();
  const setPaused = useMutation(api.projects.setPaused);
  const resetSample = useMutation(api.seed.resetSample);
  const tab = TABS.find((t) => t.key === route.tab) ?? TABS[0];
  const visibleTabs =
    data?.project.sample || !signedIn ? TABS.filter((t) => t.key !== "settings") : TABS;
  const open = (r: Omit<Route, "p">) => go({ p: projectId, ...r });

  const header = (
    <header className="sticky top-0 z-10">
      <div className="bg-sign text-sign-ink">
        <div className="mx-auto flex h-16 max-w-6xl items-stretch gap-6 px-4 md:px-8">
          <button
            type="button"
            onClick={() => go({})}
            aria-label="All projects"
            className="flex shrink-0 items-center"
          >
            <Wordmark compact />
          </button>
          {data && data.project.status !== "drafting" && (
            <nav className="flex min-w-0 overflow-x-auto" aria-label="Project">
              {visibleTabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => open({ tab: t.key })}
                  aria-current={t === tab ? (route.h ? "location" : "page") : undefined}
                  className="flex shrink-0 items-center gap-2 border-t-4 border-transparent px-4 pb-1 text-sm font-bold text-sign-mute transition hover:text-sign-ink [&[aria-current]]:border-line-yellow [&[aria-current]]:text-sign-ink"
                >
                  <t.icon size={16} aria-hidden />
                  <span className="hidden lg:inline">{t.name}</span>
                </button>
              ))}
            </nav>
          )}
          <div className="ml-auto flex shrink-0 items-center">
            <button
              type="button"
              onClick={() => void (signedIn ? signOut() : signIn("github"))}
              className="text-sm font-bold text-sign-mute transition hover:text-sign-ink"
            >
              {signedIn ? "Sign out" : "Sign in"}
            </button>
          </div>
        </div>
      </div>
      <LineRule />
    </header>
  );

  if (data === undefined)
    return (
      <div className="min-h-[100dvh]">
        {header}
        <main className="mx-auto max-w-6xl px-4 py-10 md:px-8">
          <Skeleton rows={4} />
        </main>
      </div>
    );
  if (data === null)
    return (
      <div className="min-h-[100dvh]">
        {header}
        <main className="mx-auto max-w-6xl px-4 py-16 md:px-8">
          <p>This project does not exist or is not yours.</p>
        </main>
      </div>
    );

  const { project } = data;
  return (
    <div className="min-h-[100dvh]">
      {header}
      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 md:px-8 md:py-10">
        {project.sample && (
          <div className="flex flex-wrap items-center gap-3 border-y border-rule bg-panel px-4 py-3 text-sm">
            <p className="flex-1">
              Sample project: FounderHub testing its own idea. People, quotes and numbers are
              illustrative.
            </p>
            {signedIn && (
              <Button onClick={() => void resetSample().then((id) => go({ p: id }))}>
                Reset sample
              </Button>
            )}
          </div>
        )}
        {project.status === "paused" && (
          <div
            role="status"
            className="flex flex-wrap items-center gap-3 border-y-4 border-line-yellow bg-panel px-4 py-3 text-sm"
          >
            <p className="flex-1">Agents are paused. {project.pauseReason}</p>
            {project.pauseReason?.startsWith("Budget") ? (
              <Button onClick={() => open({ tab: "settings" })}>Raise budget</Button>
            ) : (
              signedIn && (
                <Button onClick={() => void setPaused({ projectId, paused: false })}>Resume</Button>
              )
            )}
          </div>
        )}

        {project.status === "drafting" ? (
          <Draft data={data} onApproved={() => open({ tab: "customers" })} />
        ) : route.h ? (
          <HypothesisPage
            hypothesisId={route.h as Id<"hypotheses">}
            canEdit={signedIn}
            onBack={() => open({ tab: "hypotheses" })}
          />
        ) : tab.key === "customers" ? (
          <Customers projectId={projectId} sample={!!project.sample} canEdit={signedIn} />
        ) : tab.key === "market" ? (
          <Market projectId={projectId} />
        ) : tab.key === "report" ? (
          <Report projectId={projectId} canEdit={signedIn} />
        ) : tab.key === "activity" ? (
          <Activity projectId={projectId} />
        ) : tab.key === "settings" ? (
          <Settings data={data} />
        ) : (
          <Hypotheses
            data={data}
            canEdit={signedIn}
            onOpen={(h) => open({ tab: "hypotheses", h })}
          />
        )}
      </main>
    </div>
  );
}
