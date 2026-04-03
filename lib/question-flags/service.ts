import { runConvexMutation, runConvexQuery } from "@/lib/db/convex";
import { getQuestionFlagStore } from "@/lib/question-flags/store";
import { env } from "@/lib/utils/env";
import type { QuestionFlagReporterScope, QuestionFlagSource, QuestionFlagSummary } from "@/types/question-flags";

interface RecordQuestionFlagInput {
  questionId: string;
  questionTitle: string;
  questionPrompt: string;
  reporterKey: string;
  reporterScope: QuestionFlagReporterScope;
  reporterUserId: string | null;
  reporterDisplayName: string;
  source: QuestionFlagSource;
  roomCode: string | null;
}

async function loadDatabaseSummaries(questionIds?: string[]) {
  return runConvexQuery<{ questionIds?: string[] }, QuestionFlagSummary[]>("questionFlags:listSummaries", {
    ...(questionIds ? { questionIds } : {}),
  });
}

export async function getQuestionFlagSummaries(questionIds?: string[]) {
  if (env.NODE_ENV === "test") {
    return getQuestionFlagStore().getSummaries(questionIds);
  }

  return loadDatabaseSummaries(questionIds);
}

export async function recordQuestionFlag(input: RecordQuestionFlagInput) {
  if (env.NODE_ENV === "test") {
    const result = getQuestionFlagStore().upsertFlag(input);

    return {
      alreadyFlagged: !result.created,
      summary: result.summary,
    };
  }

  const timestamp = new Date().toISOString();
  const recordResult = await runConvexMutation<
    {
      questionId: string;
      questionTitle: string;
      questionPrompt: string;
      reporterKey: string;
      reporterScope: QuestionFlagReporterScope;
      reporterUserId: string | null;
      reporterDisplayName: string;
      source: QuestionFlagSource;
      roomCode: string | null;
      reportedAt: string;
    },
    { created: boolean }
  >("questionFlags:recordFlag", {
    questionId: input.questionId,
    questionTitle: input.questionTitle,
    questionPrompt: input.questionPrompt,
    reporterKey: input.reporterKey,
    reporterScope: input.reporterScope,
    reporterUserId: input.reporterUserId,
    reporterDisplayName: input.reporterDisplayName,
    source: input.source,
    roomCode: input.roomCode,
    reportedAt: timestamp,
  });

  const [summary] = await loadDatabaseSummaries([input.questionId]);

  return {
    alreadyFlagged: !recordResult.created,
    summary: summary ?? null,
  };
}
