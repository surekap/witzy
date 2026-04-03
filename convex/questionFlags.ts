import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

function sortSummaries(
  left: {
    distinctReporterCount: number;
    latestReportedAt: string;
    questionId: string;
  },
  right: {
    distinctReporterCount: number;
    latestReportedAt: string;
    questionId: string;
  },
) {
  return (
    right.distinctReporterCount - left.distinctReporterCount ||
    new Date(right.latestReportedAt).getTime() - new Date(left.latestReportedAt).getTime() ||
    left.questionId.localeCompare(right.questionId)
  );
}

function buildSummaries(
  flags: Array<{
    questionId: string;
    questionTitle: string;
    questionPrompt: string;
    reporterScope: "practice_account" | "room_player";
    reportedAt: string;
  }>,
) {
  const summaries = new Map<string, {
    questionId: string;
    questionTitle: string;
    questionPrompt: string;
    distinctReporterCount: number;
    practiceAccountFlagCount: number;
    roomPlayerFlagCount: number;
    latestReportedAt: string;
  }>();

  for (const flag of flags) {
    const existing = summaries.get(flag.questionId);

    if (existing) {
      existing.distinctReporterCount += 1;
      if (flag.reporterScope === "practice_account") {
        existing.practiceAccountFlagCount += 1;
      } else {
        existing.roomPlayerFlagCount += 1;
      }

      if (new Date(flag.reportedAt).getTime() > new Date(existing.latestReportedAt).getTime()) {
        existing.latestReportedAt = flag.reportedAt;
      }

      continue;
    }

    summaries.set(flag.questionId, {
      questionId: flag.questionId,
      questionTitle: flag.questionTitle,
      questionPrompt: flag.questionPrompt,
      distinctReporterCount: 1,
      practiceAccountFlagCount: flag.reporterScope === "practice_account" ? 1 : 0,
      roomPlayerFlagCount: flag.reporterScope === "room_player" ? 1 : 0,
      latestReportedAt: flag.reportedAt,
    });
  }

  return [...summaries.values()].sort(sortSummaries);
}

export const listSummaries = queryGeneric({
  args: {
    questionIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    if (args.questionIds && args.questionIds.length === 0) {
      return [];
    }

    const flags =
      args.questionIds && args.questionIds.length > 0
        ? (
            await Promise.all(
              args.questionIds.map((questionId) =>
                ctx.db.query("questionFlags").withIndex("by_question_id", (query) => query.eq("questionId", questionId)).collect(),
              ),
            )
          ).flat()
        : await ctx.db.query("questionFlags").collect();

    return buildSummaries(
      flags.map((flag) => ({
        questionId: flag.questionId,
        questionTitle: flag.questionTitle,
        questionPrompt: flag.questionPrompt,
        reporterScope: flag.reporterScope,
        reportedAt: flag.reportedAt,
      })),
    );
  },
});

export const recordFlag = mutationGeneric({
  args: {
    questionId: v.string(),
    questionTitle: v.string(),
    questionPrompt: v.string(),
    reporterKey: v.string(),
    reporterScope: v.union(v.literal("practice_account"), v.literal("room_player")),
    reporterUserId: v.union(v.string(), v.null()),
    reporterDisplayName: v.string(),
    source: v.union(v.literal("solo_practice"), v.literal("live_room")),
    roomCode: v.union(v.string(), v.null()),
    reportedAt: v.string(),
  },
  handler: async (ctx, args) => {
    const existingFlags = await ctx.db
      .query("questionFlags")
      .withIndex("by_question_id", (query) => query.eq("questionId", args.questionId))
      .collect();
    const existing = existingFlags.find((flag) => flag.reporterKey === args.reporterKey) ?? null;

    if (existing) {
      return { created: false };
    }

    await ctx.db.insert("questionFlags", {
      questionId: args.questionId,
      questionTitle: args.questionTitle,
      questionPrompt: args.questionPrompt,
      reporterKey: args.reporterKey,
      reporterScope: args.reporterScope,
      reporterUserId: args.reporterUserId,
      reporterDisplayName: args.reporterDisplayName,
      source: args.source,
      roomCode: args.roomCode,
      reportedAt: args.reportedAt,
    });

    return { created: true };
  },
});
