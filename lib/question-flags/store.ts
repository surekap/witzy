import { createId } from "@/lib/utils/ids";
import type { QuestionFlagRecord, QuestionFlagReporterScope, QuestionFlagSource, QuestionFlagSummary } from "@/types/question-flags";

interface CreateQuestionFlagInput {
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

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function sortSummaries(left: QuestionFlagSummary, right: QuestionFlagSummary) {
  return (
    right.distinctReporterCount - left.distinctReporterCount ||
    new Date(right.latestReportedAt).getTime() - new Date(left.latestReportedAt).getTime() ||
    left.questionId.localeCompare(right.questionId)
  );
}

function buildSummaries(flags: QuestionFlagRecord[]) {
  const summaries = new Map<string, QuestionFlagSummary>();

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

function createQuestionFlagRecord(input: CreateQuestionFlagInput): QuestionFlagRecord {
  return {
    id: createId("question_flag"),
    questionId: input.questionId,
    questionTitle: input.questionTitle,
    questionPrompt: input.questionPrompt,
    reporterKey: input.reporterKey,
    reporterScope: input.reporterScope,
    reporterUserId: input.reporterUserId,
    reporterDisplayName: input.reporterDisplayName,
    source: input.source,
    roomCode: input.roomCode,
    reportedAt: new Date().toISOString(),
  };
}

export function createQuestionFlagStore() {
  const flags: QuestionFlagRecord[] = [];

  return {
    upsertFlag(input: CreateQuestionFlagInput) {
      const existing = flags.find(
        (flag) => flag.questionId === input.questionId && flag.reporterKey === input.reporterKey,
      );

      if (existing) {
        return {
          created: false,
          flag: cloneValue(existing),
          summary: cloneValue(buildSummaries(flags).find((summary) => summary.questionId === input.questionId) ?? null),
        };
      }

      const record = createQuestionFlagRecord(input);
      flags.push(record);

      return {
        created: true,
        flag: cloneValue(record),
        summary: cloneValue(buildSummaries(flags).find((summary) => summary.questionId === input.questionId) ?? null),
      };
    },

    getSummaries(questionIds?: string[]) {
      const filteredFlags =
        questionIds && questionIds.length > 0
          ? flags.filter((flag) => questionIds.includes(flag.questionId))
          : flags;

      return cloneValue(buildSummaries(filteredFlags));
    },

    reset() {
      flags.length = 0;
    },
  };
}

declare global {
  var __questionFlagStore: ReturnType<typeof createQuestionFlagStore> | undefined;
}

export function getQuestionFlagStore() {
  if (!globalThis.__questionFlagStore) {
    globalThis.__questionFlagStore = createQuestionFlagStore();
  }

  return globalThis.__questionFlagStore;
}

export function resetQuestionFlagStore() {
  getQuestionFlagStore().reset();
}
