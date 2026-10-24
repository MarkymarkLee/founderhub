import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { MotionConfig } from "motion/react";
import { App } from "./App.tsx";
import "./index.css";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <ConvexAuthProvider client={convex}>
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </ConvexAuthProvider>
  </StrictMode>,
);
