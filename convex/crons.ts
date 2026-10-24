import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Both skip projects that are paused, over budget, or have no new evidence since their last run.
crons.interval("chief of staff", { minutes: 5 }, internal.strategy.chiefTick, {});
crons.interval("persona analysts", { minutes: 30 }, internal.strategy.personaTick, {});

export default crons;
