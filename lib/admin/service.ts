import { runConvexQuery } from "@/lib/db/convex";
import { replaceQuestionBank } from "@/lib/db/question-bank";
import { loadQuestionBankFromDatabase } from "@/lib/db/runtime-storage";
import { isQuestionAgeCompatible } from "@/lib/questions/assignment";
import { normalizeImportedQuestionBank } from "@/lib/questions/import-format";
import { getQuestionFlagSummaries } from "@/lib/question-flags/service";
import { ageBands, type AgeBand, type Category, type GameRoom, type Question } from "@/types/game";
import type {
  AdminDashboardData,
  AdminPlayerPerformanceEntry,
  AdminQuestionCatalogEntry,
  AdminQuestionFrequencyDistribution,
  AdminQuestionFrequencyRow,
  AdminRemoveQuestionsResult,
  AdminUploadMode,
  AdminUploadResult,
} from "@/types/admin";

const answerKeys = ["A", "B", "C", "D"] as const;

type PracticeAccountRow = {
  id: string;
  username: string;
  displayName: string;
  passwordHash: string | null;
  passwordSalt: string | null;
  createdAt: string;
  lastLoginAt: string | null;
};

type PracticeAttemptRow = {
  accountId: string;
  questionId: string;
  submittedAnswer: string;
  isCorrect: boolean;
  answeredAt: string;
};

type PersistedRoomStateRow = {
  roomCode: string;
  room: GameRoom;
  version: number;
  updatedAt: string;
};

function normalizeText(value: string | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function createQuestionFingerprint(question: Question) {
  const optionsSignature = answerKeys
    .map((key) => `${key}:${normalizeText(question.options[key])}`)
    .join("|");
  const tagsSignature = [...question.tags].map(normalizeText).sort().join("|");

  return [
    question.categoryId,
    normalizeText(question.title),
    normalizeText(question.prompt),
    question.modality,
    question.difficulty,
    question.ageBandMin,
    question.ageBandMax,
    question.answerType,
    optionsSignature,
    question.correctAnswer,
    normalizeText(question.explanation),
    normalizeText(question.mediaUrl ?? ""),
    normalizeText(question.mediaAltText ?? ""),
    String(question.estimatedSeconds),
  ].join("||") + `||${tagsSignature}`;
}

function mergeQuestionBanks(existing: { categories: Category[]; questions: Question[] }, incoming: { categories: Category[]; questions: Question[] }) {
  const mergedCategories = existing.categories.map((category) => ({ ...category }));
  const mergedQuestions = existing.questions.map((question) => ({
    ...question,
    options: { ...question.options },
    tags: [...question.tags],
  }));
  const categoryBySlug = new Map(mergedCategories.map((category) => [category.slug, category]));
  const incomingCategoryIdToSlug = new Map(incoming.categories.map((category) => [category.id, category.slug]));
  const incomingCategoryIdToResolvedId = new Map<string, string>();

  let categoriesAdded = 0;
  let categoriesUpdated = 0;

  for (const incomingCategory of incoming.categories) {
    const existingCategory = categoryBySlug.get(incomingCategory.slug);

    if (existingCategory) {
      if (
        existingCategory.name !== incomingCategory.name ||
        existingCategory.icon !== incomingCategory.icon ||
        existingCategory.active !== incomingCategory.active
      ) {
        existingCategory.name = incomingCategory.name;
        existingCategory.icon = incomingCategory.icon;
        existingCategory.active = incomingCategory.active;
        categoriesUpdated += 1;
      }

      incomingCategoryIdToResolvedId.set(incomingCategory.id, existingCategory.id);
      continue;
    }

    const insertedCategory = { ...incomingCategory };
    mergedCategories.push(insertedCategory);
    categoryBySlug.set(insertedCategory.slug, insertedCategory);
    incomingCategoryIdToResolvedId.set(incomingCategory.id, insertedCategory.id);
    categoriesAdded += 1;
  }

  const existingQuestionIds = new Set(mergedQuestions.map((question) => question.id));
  const existingQuestionFingerprints = new Set(
    mergedQuestions.map((question) => createQuestionFingerprint(question)),
  );

  let questionsAdded = 0;
  let questionsSkipped = 0;

  for (const incomingQuestion of incoming.questions) {
    const incomingCategorySlug = incomingCategoryIdToSlug.get(incomingQuestion.categoryId);

    if (!incomingCategorySlug) {
      throw new Error(
        `Incoming question "${incomingQuestion.id}" references unknown category id "${incomingQuestion.categoryId}".`,
      );
    }

    const resolvedCategory = categoryBySlug.get(incomingCategorySlug);

    if (!resolvedCategory) {
      throw new Error(`Unable to resolve category slug "${incomingCategorySlug}" while merging question bank.`);
    }

    const resolvedCategoryId =
      incomingCategoryIdToResolvedId.get(incomingQuestion.categoryId) ?? resolvedCategory.id;
    const normalizedQuestion: Question = {
      ...incomingQuestion,
      categoryId: resolvedCategoryId,
      options: { ...incomingQuestion.options },
      tags: [...incomingQuestion.tags],
    };
    const fingerprint = createQuestionFingerprint(normalizedQuestion);

    if (existingQuestionIds.has(normalizedQuestion.id) || existingQuestionFingerprints.has(fingerprint)) {
      questionsSkipped += 1;
      continue;
    }

    mergedQuestions.push(normalizedQuestion);
    existingQuestionIds.add(normalizedQuestion.id);
    existingQuestionFingerprints.add(fingerprint);
    questionsAdded += 1;
  }

  return {
    merged: {
      categories: mergedCategories,
      questions: mergedQuestions,
    },
    stats: {
      categoriesAdded,
      categoriesUpdated,
      questionsAdded,
      questionsSkipped,
    },
  };
}

function buildFrequencyDistribution(categories: Category[], questions: Question[]): AdminQuestionFrequencyDistribution {
  const ageBandOrder = new Map(ageBands.map((band, index) => [band, index]));
  const countsByAgeAndCategory = new Map<AgeBand, Map<string, number>>();

  for (const ageBand of ageBands) {
    const categoryMap = new Map<string, number>();
    for (const category of categories) {
      categoryMap.set(category.id, 0);
    }
    countsByAgeAndCategory.set(ageBand, categoryMap);
  }

  for (const question of questions) {
    if (!question.active) {
      continue;
    }

    const minIndex = ageBandOrder.get(question.ageBandMin);
    const maxIndex = ageBandOrder.get(question.ageBandMax);
    if (minIndex === undefined || maxIndex === undefined) {
      continue;
    }

    for (const ageBand of ageBands) {
      const bandIndex = ageBandOrder.get(ageBand);
      if (bandIndex === undefined) {
        continue;
      }

      if (bandIndex >= minIndex && bandIndex <= maxIndex) {
        const categoryMap = countsByAgeAndCategory.get(ageBand);
        if (!categoryMap) {
          continue;
        }
        categoryMap.set(question.categoryId, (categoryMap.get(question.categoryId) ?? 0) + 1);
      }
    }
  }

  const rows: AdminQuestionFrequencyRow[] = [];
  for (const ageBand of ageBands) {
    for (const category of categories) {
      rows.push({
        ageBand,
        categoryId: category.id,
        categoryName: category.name,
        categorySlug: category.slug,
        count: countsByAgeAndCategory.get(ageBand)?.get(category.id) ?? 0,
      });
    }
  }

  rows.sort(
    (left, right) =>
      (ageBandOrder.get(left.ageBand) ?? 0) - (ageBandOrder.get(right.ageBand) ?? 0) ||
      left.categoryName.localeCompare(right.categoryName),
  );

  return {
    categoryCount: categories.length,
    questionCount: questions.length,
    rows,
    missing: rows.filter((row) => row.count === 0),
  };
}

type PlayerEvent = {
  answeredAt: string;
  isCorrect: boolean;
};

type PlayerAccumulator = {
  source: "practice_account" | "room_player";
  displayName: string;
  ageBand: AgeBand | null;
  events: PlayerEvent[];
};

function computeAccuracyRate(correctCount: number, answeredCount: number) {
  return answeredCount === 0 ? 0 : correctCount / answeredCount;
}

function summarizeEventsForPlayer(
  playerKey: string,
  accumulator: PlayerAccumulator,
): AdminPlayerPerformanceEntry {
  const sortedEvents = [...accumulator.events].sort(
    (left, right) => new Date(left.answeredAt).getTime() - new Date(right.answeredAt).getTime(),
  );

  const totalAnswered = sortedEvents.length;
  const totalCorrect = sortedEvents.filter((event) => event.isCorrect).length;
  const firstTen = sortedEvents.slice(0, 10);
  const lastTen = sortedEvents.slice(-10);
  const firstTenCorrect = firstTen.filter((event) => event.isCorrect).length;
  const lastTenCorrect = lastTen.filter((event) => event.isCorrect).length;
  const firstTenAccuracyRate = computeAccuracyRate(firstTenCorrect, firstTen.length);
  const lastTenAccuracyRate = computeAccuracyRate(lastTenCorrect, lastTen.length);

  const groupedByDay = new Map<string, { answeredCount: number; correctCount: number }>();
  for (const event of sortedEvents) {
    const date = event.answeredAt.slice(0, 10);
    const existing = groupedByDay.get(date) ?? { answeredCount: 0, correctCount: 0 };
    groupedByDay.set(date, {
      answeredCount: existing.answeredCount + 1,
      correctCount: existing.correctCount + (event.isCorrect ? 1 : 0),
    });
  }

  const timeline = [...groupedByDay.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([date, stats], index, entries) => {
      const cumulativeEntries = entries.slice(0, index + 1).map((entry) => entry[1]);
      const cumulativeAnswered = cumulativeEntries.reduce((sum, entry) => sum + entry.answeredCount, 0);
      const cumulativeCorrect = cumulativeEntries.reduce((sum, entry) => sum + entry.correctCount, 0);

      return {
        date,
        answeredCount: stats.answeredCount,
        correctCount: stats.correctCount,
        accuracyRate: computeAccuracyRate(stats.correctCount, stats.answeredCount),
        cumulativeAccuracyRate: computeAccuracyRate(cumulativeCorrect, cumulativeAnswered),
      };
    });

  return {
    playerKey,
    source: accumulator.source,
    displayName: accumulator.displayName,
    ageBand: accumulator.ageBand,
    totalAnswered,
    totalCorrect,
    accuracyRate: computeAccuracyRate(totalCorrect, totalAnswered),
    firstTenAccuracyRate,
    lastTenAccuracyRate,
    trendDelta: lastTenAccuracyRate - firstTenAccuracyRate,
    firstSeenAt: sortedEvents[0]?.answeredAt ?? null,
    lastSeenAt: sortedEvents.at(-1)?.answeredAt ?? null,
    timeline,
  };
}

function buildPlayerPerformance(params: {
  accounts: PracticeAccountRow[];
  attempts: PracticeAttemptRow[];
  roomStates: PersistedRoomStateRow[];
}) {
  const accountById = new Map(params.accounts.map((account) => [account.id, account]));
  const players = new Map<string, PlayerAccumulator>();

  for (const attempt of params.attempts) {
    const account = accountById.get(attempt.accountId);
    const displayName = account?.username ?? attempt.accountId;
    const key = `practice:${attempt.accountId}`;
    const existing = players.get(key) ?? {
      source: "practice_account" as const,
      displayName,
      ageBand: null,
      events: [],
    };
    existing.events.push({
      answeredAt: attempt.answeredAt,
      isCorrect: attempt.isCorrect,
    });
    players.set(key, existing);
  }

  for (const roomState of params.roomStates) {
    const room = roomState.room;
    for (const round of room.rounds ?? []) {
      const answeredAt =
        round.revealedAt ??
        round.lockedAt ??
        round.startedAt ??
        room.updatedAt;

      for (const result of round.results ?? []) {
        const normalizedName = result.displayName.trim().toLowerCase();
        const key = `room:${normalizedName}:${result.ageBand}`;
        const existing = players.get(key) ?? {
          source: "room_player" as const,
          displayName: result.displayName,
          ageBand: result.ageBand,
          events: [],
        };

        existing.events.push({
          answeredAt,
          isCorrect: result.isCorrect,
        });
        players.set(key, existing);
      }
    }
  }

  const playerEntries = [...players.entries()]
    .map(([playerKey, accumulator]) => summarizeEventsForPlayer(playerKey, accumulator))
    .sort(
      (left, right) =>
        right.totalAnswered - left.totalAnswered ||
        right.accuracyRate - left.accuracyRate ||
        left.displayName.localeCompare(right.displayName),
    );

  return {
    generatedAt: new Date().toISOString(),
    players: playerEntries,
  };
}

type PlayerQuestionCoverageAccumulator = {
  playerKey: string;
  displayName: string;
  ageBand: AgeBand;
  seenQuestionIds: Set<string>;
};

function normalizeRoomPlayerKey(displayName: string, ageBand: AgeBand) {
  return `room:${displayName.trim().toLowerCase()}:${ageBand}`;
}

function buildPlayerQuestionAvailabilityMatrix(params: {
  categories: Category[];
  questions: Question[];
  roomStates: PersistedRoomStateRow[];
}) {
  const ageBandIndex = new Map(ageBands.map((ageBand, index) => [ageBand, index]));
  const players = new Map<string, PlayerQuestionCoverageAccumulator>();
  const activeQuestions = params.questions.filter((question) => question.active);

  const ensurePlayer = (displayName: string, ageBand: AgeBand) => {
    const playerKey = normalizeRoomPlayerKey(displayName, ageBand);
    const existing = players.get(playerKey) ?? {
      playerKey,
      displayName,
      ageBand,
      seenQuestionIds: new Set<string>(),
    };
    players.set(playerKey, existing);
    return existing;
  };

  for (const roomState of params.roomStates) {
    const playersById = new Map(roomState.room.players.map((player) => [player.id, player]));

    for (const player of roomState.room.players) {
      ensurePlayer(player.displayName, player.ageBand);
    }

    for (const round of roomState.room.rounds) {
      for (const assignment of round.assignments) {
        const player = playersById.get(assignment.gamePlayerId);
        if (!player) {
          continue;
        }

        const accumulator = ensurePlayer(player.displayName, player.ageBand);
        accumulator.seenQuestionIds.add(assignment.questionId);
      }
    }
  }

  const categories = [...params.categories].sort(
    (left, right) => left.name.localeCompare(right.name) || left.slug.localeCompare(right.slug),
  );

  const rows = [...players.values()]
    .sort(
      (left, right) =>
        left.displayName.localeCompare(right.displayName) ||
        (ageBandIndex.get(left.ageBand) ?? 0) - (ageBandIndex.get(right.ageBand) ?? 0),
    )
    .map((player) => {
      const cells = categories.map((category) => {
        const eligibleQuestionIds = activeQuestions
          .filter(
            (question) =>
              question.categoryId === category.id && isQuestionAgeCompatible(question, player.ageBand),
          )
          .map((question) => question.id);
        const unseenQuestionIds = eligibleQuestionIds.filter(
          (questionId) => !player.seenQuestionIds.has(questionId),
        );

        return {
          categoryId: category.id,
          eligibleCount: eligibleQuestionIds.length,
          seenCount: eligibleQuestionIds.length - unseenQuestionIds.length,
          unseenCount: unseenQuestionIds.length,
          unseenQuestionIds,
        };
      });

      return {
        playerKey: player.playerKey,
        displayName: player.displayName,
        ageBand: player.ageBand,
        cells,
      };
    });

  return {
    generatedAt: new Date().toISOString(),
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
    })),
    rows,
  };
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const [{ categories, questions }, flaggedQuestions, accounts, attempts, roomStates] = await Promise.all([
    loadQuestionBankFromDatabase(),
    getQuestionFlagSummaries(),
    runConvexQuery<Record<string, never>, PracticeAccountRow[]>("practice:listAccounts", {}),
    runConvexQuery<Record<string, never>, PracticeAttemptRow[]>("practice:listAllAttempts", {}),
    runConvexQuery<Record<string, never>, PersistedRoomStateRow[]>("rooms:listRoomStates", {}),
  ]);

  const frequency = buildFrequencyDistribution(categories, questions);
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const flagByQuestionId = new Map(flaggedQuestions.map((summary) => [summary.questionId, summary]));

  const questionCatalog: AdminQuestionCatalogEntry[] = questions
    .map((question) => {
      const category = categoryById.get(question.categoryId);
      const flagSummary = flagByQuestionId.get(question.id);

      return {
        id: question.id,
        categoryId: question.categoryId,
        categoryName: category?.name ?? "Unknown category",
        title: question.title,
        prompt: question.prompt,
        difficulty: question.difficulty,
        ageBandMin: question.ageBandMin,
        ageBandMax: question.ageBandMax,
        active: question.active,
        distinctFlagCount: flagSummary?.distinctReporterCount ?? 0,
        latestFlaggedAt: flagSummary?.latestReportedAt ?? null,
      };
    })
    .sort(
      (left, right) =>
        right.distinctFlagCount - left.distinctFlagCount ||
        new Date(right.latestFlaggedAt ?? 0).getTime() - new Date(left.latestFlaggedAt ?? 0).getTime() ||
        left.categoryName.localeCompare(right.categoryName) ||
        left.title.localeCompare(right.title),
    );

  return {
    generatedAt: new Date().toISOString(),
    questionFrequency: frequency,
    questions: questionCatalog,
    flaggedQuestions: flaggedQuestions.map((flag) => ({
      questionId: flag.questionId,
      questionTitle: flag.questionTitle,
      questionPrompt: flag.questionPrompt,
      distinctReporterCount: flag.distinctReporterCount,
      practiceAccountFlagCount: flag.practiceAccountFlagCount,
      roomPlayerFlagCount: flag.roomPlayerFlagCount,
      latestReportedAt: flag.latestReportedAt,
    })),
    playerPerformance: buildPlayerPerformance({
      accounts,
      attempts,
      roomStates,
    }),
    playerQuestionAvailability: buildPlayerQuestionAvailabilityMatrix({
      categories,
      questions,
      roomStates,
    }),
  };
}

export async function uploadQuestionsFromAdmin(input: {
  payload: unknown;
  mode: AdminUploadMode;
}): Promise<AdminUploadResult> {
  const importedQuestionBank = normalizeImportedQuestionBank(input.payload);

  if (input.mode === "replace") {
    await replaceQuestionBank(importedQuestionBank);
    return {
      mode: input.mode,
      categoryCount: importedQuestionBank.categories.length,
      questionCount: importedQuestionBank.questions.length,
    };
  }

  const existingQuestionBank = await loadQuestionBankFromDatabase();
  const { merged, stats } = mergeQuestionBanks(existingQuestionBank, importedQuestionBank);
  await replaceQuestionBank(merged);

  return {
    mode: input.mode,
    categoryCount: merged.categories.length,
    questionCount: merged.questions.length,
    categoriesAdded: stats.categoriesAdded,
    categoriesUpdated: stats.categoriesUpdated,
    questionsAdded: stats.questionsAdded,
    questionsSkipped: stats.questionsSkipped,
  };
}

export async function removeQuestionsFromAdmin(questionIds: string[]): Promise<AdminRemoveQuestionsResult> {
  const uniqueQuestionIds = [...new Set(questionIds.map((questionId) => questionId.trim()).filter(Boolean))];
  if (uniqueQuestionIds.length === 0) {
    return {
      removedCount: 0,
      remainingQuestionCount: (await loadQuestionBankFromDatabase()).questions.length,
    };
  }

  const questionIdSet = new Set(uniqueQuestionIds);
  const existingQuestionBank = await loadQuestionBankFromDatabase();
  const cleanedQuestions = existingQuestionBank.questions.filter(
    (question) => !questionIdSet.has(question.id),
  );
  const removedCount = existingQuestionBank.questions.length - cleanedQuestions.length;

  if (removedCount === 0) {
    return {
      removedCount: 0,
      remainingQuestionCount: existingQuestionBank.questions.length,
    };
  }

  await replaceQuestionBank({
    categories: existingQuestionBank.categories,
    questions: cleanedQuestions,
  });

  return {
    removedCount,
    remainingQuestionCount: cleanedQuestions.length,
  };
}
