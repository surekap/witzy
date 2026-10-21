import { cronJobs, makeFunctionReference } from "convex/server";

const crons = cronJobs();
crons.daily("room and report retention", { hourUTC: 2, minuteUTC: 0 }, makeFunctionReference<"mutation">("security:applyRetentionPolicy"));
export default crons;
