import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { Home } from "./Home.tsx";
import { Project } from "./Project.tsx";
import { SignIn } from "./SignIn.tsx";
import { useRoute } from "./ui.tsx";

export function App() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const [route, go] = useRoute();
  const projects = useQuery(api.projects.mine);
  const sampleId = projects?.find((p) => p.sample)?._id;

  if (isLoading) return <div className="min-h-[100dvh]" aria-busy="true" />;
  if (route.p)
    return (
      <Project
        projectId={route.p as Id<"projects">}
        route={route}
        go={go}
        signedIn={isAuthenticated}
      />
    );
  if (!isAuthenticated) return <SignIn onSample={() => sampleId && go({ p: sampleId })} />;
  return <Home projects={projects} go={go} />;
}
