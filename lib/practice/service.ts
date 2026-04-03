import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { createNeonSql } from "@/lib/db/neon";
import { loadQuestionBankFromDatabase } from "@/lib/db/runtime-storage";
import { isQuestionAgeCompatible, resolvePlayerDifficulty } from "@/lib/questions/assignment";
import { getStore } from "@/lib/game/store";
import { createId } from "@/lib/utils/ids";
import { getPracticeStore } from "@/lib/practice/store";
import { env } from "@/lib/utils/env";
import type {
  AgeBand,
  Category,
  DifficultyMode,
  GamePlayer,
  Question,
  QuestionDifficulty,
} from "@/types/game";
import type {
  PracticeAccountProfile,
  PracticeAccountRecord,
  PracticeCategoryProgress,
  PracticeLifetimeProgress,
  PracticeProgressRecord,
} from "@/types/practice";

const difficultyOrder: QuestionDifficulty[] = ["easy", "medium", "hard"];

export class PracticeError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "PracticeError";
  }
}

type PracticeStore = ReturnType<typeof getPracticeStore>;

type PracticeUserRow = {
  id: string;
  username: string;
  display_name: string;
  password_hash: string | null;
  password_salt: string | null;
  created_at: string;
  last_login_at: string | null;
};

type PracticeAttemptRow = {
  question_id: string;
  submitted_answer: string;
  is_correct: boolean;
  answered_at: string;
};

function normalizeUsername(username: string) {
  return username.trim();
}

function hashPassword(password: string, salt: string) {
  return scryptSync(password, salt, 64).toString("hex");
}

function updateStreak(currentStreak: number, isCorrect: boolean) {
  if (isCorrect) {
    return currentStreak >= 0 ? currentStreak + 1 : 1;
  }

  return currentStreak <= 0 ? currentStreak - 1 : -1;
}

function getDifficultyFallbacks(targetDifficulty: QuestionDifficulty) {
  const targetIndex = difficultyOrder.indexOf(targetDifficulty);

  return difficultyOrder
    .map((difficulty, index) => ({
      difficulty,
      distance: Math.abs(index - targetIndex),
    }))
    .sort((left, right) => left.distance - right.distance)
    .map((entry) => entry.difficulty);
}

function getQuestionStats(progress: PracticeProgressRecord, questionId: string) {
  return (
    progress.questionStats[questionId] ?? {
      correctCount: 0,
      incorrectCount: 0,
      lastAnsweredAt: null,
    }
  );
}

function getMasteredQuestionIds(progress: PracticeProgressRecord) {
  return new Set(
    Object.entries(progress.questionStats)
      .filter(([, stats]) => stats.correctCount > 0)
      .map(([questionId]) => questionId),
  );
}

function buildQuestionSignals(question: Question, category: Category) {
  return [
    `category:${category.slug}`,
    `difficulty:${question.difficulty}`,
    `modality:${question.modality}`,
    ...question.tags.map((tag) => `tag:${tag}`),
  ];
}

function describeSignal(signal: string, categories: Category[]) {
  const [scope, value] = signal.split(":");

  if (scope === "category") {
    return categories.find((category) => category.slug === value)?.name ?? value;
  }

  if (scope === "difficulty") {
    return `${value[0]?.toUpperCase() ?? ""}${value.slice(1)} questions`;
  }

  if (scope === "modality") {
    return `${value[0]?.toUpperCase() ?? ""}${value.slice(1)} questions`;
  }

  return value;
}

function computeWeakAreaLabels(progress: PracticeProgressRecord, categories: Category[]) {
  return Object.entries(progress.signalStats)
    .filter(([signal]) => signal.startsWith("category:") || signal.startsWith("difficulty:") || signal.startsWith("modality:"))
    .map(([signal, stats]) => ({
      signal,
      weakness: stats.incorrectCount - stats.correctCount,
    }))
    .filter((entry) => entry.weakness > 0)
    .sort((left, right) => right.weakness - left.weakness || left.signal.localeCompare(right.signal))
    .slice(0, 3)
    .map((entry) => describeSignal(entry.signal, categories));
}

function buildLifetimeProgress(
  progress: PracticeProgressRecord,
  questions: Question[],
  categories: Category[],
): PracticeLifetimeProgress {
  const masteredQuestionIds = getMasteredQuestionIds(progress);
  const categoryQuestions = new Map<string, Question[]>();

  for (const question of questions) {
    const existing = categoryQuestions.get(question.categoryId) ?? [];
    existing.push(question);
    categoryQuestions.set(question.categoryId, existing);
  }

  const categoryProgress = categories
    .map<PracticeCategoryProgress>((category) => {
      const stats = progress.categoryStats[category.id] ?? {
        correctCount: 0,
        incorrectCount: 0,
      };
      const masteredCount = (categoryQuestions.get(category.id) ?? []).filter((question) =>
        masteredQuestionIds.has(question.id),
      ).length;

      return {
        categoryId: category.id,
        categoryName: category.name,
        icon: category.icon,
        correctCount: stats.correctCount,
        incorrectCount: stats.incorrectCount,
        masteredCount,
      };
    })
    .sort((left, right) => {
      const rightAttempts = right.correctCount + right.incorrectCount;
      const leftAttempts = left.correctCount + left.incorrectCount;

      return rightAttempts - leftAttempts || right.categoryName.localeCompare(left.categoryName);
    });

  return {
    totalAnswered: progress.totalAnswered,
    totalCorrect: progress.totalCorrect,
    totalIncorrect: progress.totalIncorrect,
    masteredCount: masteredQuestionIds.size,
    currentStreak: progress.currentStreak,
    accuracyRate: progress.totalAnswered === 0 ? 0 : progress.totalCorrect / progress.totalAnswered,
    categoryProgress,
    weakAreas: computeWeakAreaLabels(progress, categories),
  };
}

function toAccountProfile(account: PracticeAccountRecord, questions: Question[], categories: Category[]): PracticeAccountProfile {
  return {
    id: account.id,
    username: account.username,
    createdAt: account.createdAt,
    lastLoginAt: account.lastLoginAt,
    lifetimeProgress: buildLifetimeProgress(account.progress, questions, categories),
  };
}

function verifyPassword(password: string, account: PracticeAccountRecord) {
  const expectedHash = Buffer.from(account.passwordHash, "hex");
  const providedHash = Buffer.from(hashPassword(password, account.passwordSalt), "hex");

  return expectedHash.length === providedHash.length && timingSafeEqual(expectedHash, providedHash);
}

function findCategoryOrThrow(categoryId: string, categories: Category[]) {
  const category = categories.find((candidate) => candidate.id === categoryId);

  if (!category) {
    throw new PracticeError("That category could not be found.", 404);
  }

  return category;
}

function computeQuestionPriorityScore(
  question: Question,
  category: Category,
  progress: PracticeProgressRecord,
) {
  const questionStats = getQuestionStats(progress, question.id);
  let score = questionStats.incorrectCount * 120;

  for (const signal of buildQuestionSignals(question, category)) {
    const signalStats = progress.signalStats[signal];
    if (!signalStats) {
      continue;
    }

    score += signalStats.incorrectCount * 10;
    score -= signalStats.correctCount * 4;
  }

  return score;
}

export function selectPracticeQuestionForAccount(params: {
  category: Category;
  questions: Question[];
  ageBand: AgeBand;
  targetDifficulty: QuestionDifficulty;
  askedQuestionIds: string[];
  progress: PracticeProgressRecord;
}) {
  const askedQuestionIds = new Set(params.askedQuestionIds);
  const masteredQuestionIds = getMasteredQuestionIds(params.progress);
  const categoryQuestions = params.questions.filter(
    (question) =>
      question.categoryId === params.category.id &&
      question.active &&
      !askedQuestionIds.has(question.id) &&
      !masteredQuestionIds.has(question.id),
  );

  const difficultyPreference = getDifficultyFallbacks(params.targetDifficulty);

  const buckets = difficultyPreference.flatMap((difficulty) => [
    categoryQuestions.filter(
      (question) => question.difficulty === difficulty && isQuestionAgeCompatible(question, params.ageBand),
    ),
    categoryQuestions.filter((question) => question.difficulty === difficulty),
  ]);

  for (const bucket of buckets) {
    if (bucket.length === 0) {
      continue;
    }

    return [...bucket].sort((left, right) => {
      const rightScore = computeQuestionPriorityScore(right, params.category, params.progress);
      const leftScore = computeQuestionPriorityScore(left, params.category, params.progress);

      return rightScore - leftScore || left.id.localeCompare(right.id);
    })[0];
  }

  return null;
}

async function getAccountOrThrow(accountId: string, store: PracticeStore) {
  const account = await store.getAccountById(accountId);

  if (!account) {
    throw new PracticeError("Please sign in again to continue practice.", 401);
  }

  return account;
}

function buildProgressFromAttempts(
  attempts: PracticeAttemptRow[],
  questions: Question[],
  categories: Category[],
) {
  const progress: PracticeProgressRecord = {
    totalAnswered: 0,
    totalCorrect: 0,
    totalIncorrect: 0,
    currentStreak: 0,
    questionStats: {},
    signalStats: {},
    categoryStats: {},
  };

  const questionsById = new Map(questions.map((question) => [question.id, question]));
  const categoriesById = new Map(categories.map((category) => [category.id, category]));

  const sortedAttempts = [...attempts].sort(
    (left, right) => new Date(left.answered_at).getTime() - new Date(right.answered_at).getTime(),
  );

  for (const attempt of sortedAttempts) {
    const question = questionsById.get(attempt.question_id);
    if (!question) {
      continue;
    }

    const category = categoriesById.get(question.categoryId);
    if (!category) {
      continue;
    }

    const isCorrect = attempt.is_correct;
    const questionStats = getQuestionStats(progress, question.id);
    progress.questionStats[question.id] = {
      correctCount: questionStats.correctCount + (isCorrect ? 1 : 0),
      incorrectCount: questionStats.incorrectCount + (isCorrect ? 0 : 1),
      lastAnsweredAt: attempt.answered_at,
    };
    progress.totalAnswered += 1;
    progress.totalCorrect += isCorrect ? 1 : 0;
    progress.totalIncorrect += isCorrect ? 0 : 1;
    progress.currentStreak = updateStreak(progress.currentStreak, isCorrect);

    const categoryStats = progress.categoryStats[category.id] ?? {
      correctCount: 0,
      incorrectCount: 0,
    };
    progress.categoryStats[category.id] = {
      correctCount: categoryStats.correctCount + (isCorrect ? 1 : 0),
      incorrectCount: categoryStats.incorrectCount + (isCorrect ? 0 : 1),
    };

    for (const signal of buildQuestionSignals(question, category)) {
      const signalStats = progress.signalStats[signal] ?? {
        correctCount: 0,
        incorrectCount: 0,
      };
      progress.signalStats[signal] = {
        correctCount: signalStats.correctCount + (isCorrect ? 1 : 0),
        incorrectCount: signalStats.incorrectCount + (isCorrect ? 0 : 1),
      };
    }
  }

  return progress;
}

async function loadRuntimeAccountById(accountId: string) {
  const sql = createNeonSql();
  const rows = await (sql.query(
    `select id, username, display_name, password_hash, password_salt, created_at::text, last_login_at::text
      from users
      where id = $1 and username is not null`,
    [accountId],
  ) as unknown as Promise<PracticeUserRow[]>);

  return rows[0] ?? null;
}

async function loadRuntimeAccountByUsername(username: string) {
  const sql = createNeonSql();
  const rows = await (sql.query(
    `select id, username, display_name, password_hash, password_salt, created_at::text, last_login_at::text
      from users
      where lower(username) = lower($1)`,
    [username],
  ) as unknown as Promise<PracticeUserRow[]>);

  return rows[0] ?? null;
}

async function loadRuntimeAttempts(accountId: string) {
  const sql = createNeonSql();
  return sql.query(
    `select question_id, submitted_answer, is_correct, answered_at::text
      from practice_question_attempts
      where user_id = $1
      order by answered_at asc`,
    [accountId],
  ) as unknown as Promise<PracticeAttemptRow[]>;
}

async function loadRuntimeAccountSnapshot(accountId: string) {
  const account = await loadRuntimeAccountById(accountId);
  if (!account) {
    return null;
  }

  const [{ categories, questions }, attempts] = await Promise.all([
    loadQuestionBankFromDatabase(),
    loadRuntimeAttempts(accountId),
  ]);

  return {
    account,
    categories,
    questions,
    progress: buildProgressFromAttempts(attempts, questions, categories),
  };
}

function toRuntimeAccountProfile(snapshot: NonNullable<Awaited<ReturnType<typeof loadRuntimeAccountSnapshot>>>) {
  return {
    id: snapshot.account.id,
    username: snapshot.account.username,
    createdAt: snapshot.account.created_at,
    lastLoginAt: snapshot.account.last_login_at,
    lifetimeProgress: buildLifetimeProgress(snapshot.progress, snapshot.questions, snapshot.categories),
  } satisfies PracticeAccountProfile;
}

export async function registerPracticeAccount(input: { username: string; password: string }, store = getPracticeStore()) {
  const username = normalizeUsername(input.username);
  const password = input.password;

  if (username.length < 2 || username.length > 30) {
    throw new PracticeError("Choose a username between 2 and 30 characters.", 400);
  }

  if (password.length < 4 || password.length > 64) {
    throw new PracticeError("Choose a simple password between 4 and 64 characters.", 400);
  }

  if (env.NODE_ENV !== "test") {
    const sql = createNeonSql();
    const passwordSalt = randomBytes(16).toString("hex");
    const passwordHash = hashPassword(password, passwordSalt);
    const timestamp = new Date().toISOString();

    try {
      const rows = await (sql.query(
        `insert into users (
          display_name,
          username,
          password_hash,
          password_salt,
          created_at,
          last_login_at
        ) values ($1, $2, $3, $4, $5::timestamptz, $6::timestamptz)
        returning id, username, display_name, password_hash, password_salt, created_at::text, last_login_at::text`,
        [username, username, passwordHash, passwordSalt, timestamp, timestamp],
      ) as unknown as Promise<PracticeUserRow[]>);

      const account = rows[0];
      if (!account) {
        throw new PracticeError("Could not create that account.", 500);
      }

      const { categories, questions } = await loadQuestionBankFromDatabase();
      return {
        id: account.id,
        username: account.username,
        createdAt: account.created_at,
        lastLoginAt: account.last_login_at,
        lifetimeProgress: buildLifetimeProgress(
          {
            totalAnswered: 0,
            totalCorrect: 0,
            totalIncorrect: 0,
            currentStreak: 0,
            questionStats: {},
            signalStats: {},
            categoryStats: {},
          },
          questions,
          categories,
        ),
      } satisfies PracticeAccountProfile;
    } catch (error) {
      throw new PracticeError(error instanceof Error ? error.message : "Could not create that account.", 409);
    }
  }

  const timestamp = new Date().toISOString();
  const passwordSalt = randomBytes(16).toString("hex");
  const account: PracticeAccountRecord = {
    id: createId("practice_user"),
    username,
    passwordSalt,
    passwordHash: hashPassword(password, passwordSalt),
    createdAt: timestamp,
    lastLoginAt: timestamp,
    progress: store.createEmptyProgress(),
  };

  try {
    const createdAccount = await store.createAccount(account);
    const { questions, categories } = getStore();
    return toAccountProfile(createdAccount, questions, categories);
  } catch (error) {
    throw new PracticeError(error instanceof Error ? error.message : "Could not create that account.", 409);
  }
}

export async function loginPracticeAccount(input: { username: string; password: string }, store = getPracticeStore()) {
  const username = normalizeUsername(input.username);

  if (env.NODE_ENV !== "test") {
    const account = await loadRuntimeAccountByUsername(username);

    if (!account || !account.password_hash || !account.password_salt) {
      throw new PracticeError("That username and password did not match.", 401);
    }

    const runtimeAccount: PracticeAccountRecord = {
      id: account.id,
      username: account.username,
      passwordHash: account.password_hash,
      passwordSalt: account.password_salt,
      createdAt: account.created_at,
      lastLoginAt: account.last_login_at,
      progress: {
        totalAnswered: 0,
        totalCorrect: 0,
        totalIncorrect: 0,
        currentStreak: 0,
        questionStats: {},
        signalStats: {},
        categoryStats: {},
      },
    };

    if (!verifyPassword(input.password, runtimeAccount)) {
      throw new PracticeError("That username and password did not match.", 401);
    }

    const sql = createNeonSql();
    const lastLoginAt = new Date().toISOString();
    await sql.query("update users set last_login_at = $2::timestamptz where id = $1", [account.id, lastLoginAt]);
    const snapshot = await loadRuntimeAccountSnapshot(account.id);

    if (!snapshot) {
      throw new PracticeError("Please sign in again to continue practice.", 401);
    }

    snapshot.account.last_login_at = lastLoginAt;
    return toRuntimeAccountProfile(snapshot);
  }

  const account = await store.getAccountByUsername(username);

  if (!account || !verifyPassword(input.password, account)) {
    throw new PracticeError("That username and password did not match.", 401);
  }

  account.lastLoginAt = new Date().toISOString();
  const updatedAccount = await store.updateAccount(account);
  const { questions, categories } = getStore();
  return toAccountProfile(updatedAccount, questions, categories);
}

export async function getPracticeAccountProfile(accountId: string, store = getPracticeStore()) {
  if (env.NODE_ENV !== "test") {
    const snapshot = await loadRuntimeAccountSnapshot(accountId);
    return snapshot ? toRuntimeAccountProfile(snapshot) : null;
  }

  const account = await store.getAccountById(accountId);
  if (!account) {
    return null;
  }

  const { questions, categories } = getStore();
  return toAccountProfile(account, questions, categories);
}

export async function getSoloPracticeQuestion(
  accountId: string,
  input: {
    categoryId: string;
    ageBand: AgeBand;
    difficultyMode?: DifficultyMode;
    askedQuestionIds: string[];
  },
  store = getPracticeStore(),
) {
  if (env.NODE_ENV !== "test") {
    const snapshot = await loadRuntimeAccountSnapshot(accountId);
    if (!snapshot) {
      throw new PracticeError("Please sign in again to continue practice.", 401);
    }

    const category = findCategoryOrThrow(input.categoryId, snapshot.categories);
    const targetDifficulty =
      input.difficultyMode && input.difficultyMode !== "adaptive"
        ? input.difficultyMode
        : resolvePlayerDifficulty({
            ageBand: input.ageBand,
            difficultyMode: input.difficultyMode ?? "adaptive",
            streak: snapshot.progress.currentStreak,
          } satisfies Pick<GamePlayer, "ageBand" | "difficultyMode" | "streak">);

    const question = selectPracticeQuestionForAccount({
      category,
      questions: snapshot.questions,
      ageBand: input.ageBand,
      targetDifficulty,
      askedQuestionIds: input.askedQuestionIds,
      progress: snapshot.progress,
    });

    if (!question) {
      throw new PracticeError(
        "No new practice questions are left in this category for this account yet. Try another category or age band.",
        404,
      );
    }

    return {
      category,
      question,
      lifetimeProgress: buildLifetimeProgress(snapshot.progress, snapshot.questions, snapshot.categories),
    };
  }

  const account = await getAccountOrThrow(accountId, store);
  const { questions, categories } = getStore();
  const category = findCategoryOrThrow(input.categoryId, categories);

  const targetDifficulty =
    input.difficultyMode && input.difficultyMode !== "adaptive"
      ? input.difficultyMode
      : resolvePlayerDifficulty({
          ageBand: input.ageBand,
          difficultyMode: input.difficultyMode ?? "adaptive",
          streak: account.progress.currentStreak,
        } satisfies Pick<GamePlayer, "ageBand" | "difficultyMode" | "streak">);

  const question = selectPracticeQuestionForAccount({
    category,
    questions,
    ageBand: input.ageBand,
    targetDifficulty,
    askedQuestionIds: input.askedQuestionIds,
    progress: account.progress,
  });

  if (!question) {
    throw new PracticeError(
      "No new practice questions are left in this category for this account yet. Try another category or age band.",
      404,
    );
  }

  return {
    category,
    question,
    lifetimeProgress: buildLifetimeProgress(account.progress, questions, categories),
  };
}

export async function submitPracticeAnswer(
  accountId: string,
  input: {
    questionId: string;
    answerKey: "A" | "B" | "C" | "D";
  },
  store = getPracticeStore(),
) {
  if (env.NODE_ENV !== "test") {
    const snapshot = await loadRuntimeAccountSnapshot(accountId);
    if (!snapshot) {
      throw new PracticeError("Please sign in again to continue practice.", 401);
    }

    const question = snapshot.questions.find((candidate) => candidate.id === input.questionId);
    if (!question) {
      throw new PracticeError("That practice question could not be found.", 404);
    }

    const isCorrect = question.correctAnswer === input.answerKey;
    const sql = createNeonSql();
    await sql.query(
      `insert into practice_question_attempts (user_id, question_id, submitted_answer, is_correct)
        values ($1, $2, $3, $4)`,
      [accountId, question.id, input.answerKey, isCorrect],
    );

    const refreshedSnapshot = await loadRuntimeAccountSnapshot(accountId);
    if (!refreshedSnapshot) {
      throw new PracticeError("Please sign in again to continue practice.", 401);
    }

    return {
      questionId: question.id,
      isCorrect,
      correctAnswer: question.correctAnswer,
      correctAnswerText: question.options[question.correctAnswer] ?? "Correct answer",
      explanation: question.explanation,
      lifetimeProgress: buildLifetimeProgress(
        refreshedSnapshot.progress,
        refreshedSnapshot.questions,
        refreshedSnapshot.categories,
      ),
    };
  }

  const account = await getAccountOrThrow(accountId, store);
  const { questions, categories } = getStore();
  const question = questions.find((candidate) => candidate.id === input.questionId);

  if (!question) {
    throw new PracticeError("That practice question could not be found.", 404);
  }

  const category = findCategoryOrThrow(question.categoryId, categories);
  const isCorrect = question.correctAnswer === input.answerKey;
  const timestamp = new Date().toISOString();
  const questionStats = getQuestionStats(account.progress, question.id);

  account.progress.questionStats[question.id] = {
    correctCount: questionStats.correctCount + (isCorrect ? 1 : 0),
    incorrectCount: questionStats.incorrectCount + (isCorrect ? 0 : 1),
    lastAnsweredAt: timestamp,
  };
  account.progress.totalAnswered += 1;
  account.progress.totalCorrect += isCorrect ? 1 : 0;
  account.progress.totalIncorrect += isCorrect ? 0 : 1;
  account.progress.currentStreak = updateStreak(account.progress.currentStreak, isCorrect);

  const categoryStats = account.progress.categoryStats[category.id] ?? {
    correctCount: 0,
    incorrectCount: 0,
  };
  account.progress.categoryStats[category.id] = {
    correctCount: categoryStats.correctCount + (isCorrect ? 1 : 0),
    incorrectCount: categoryStats.incorrectCount + (isCorrect ? 0 : 1),
  };

  for (const signal of buildQuestionSignals(question, category)) {
    const signalStats = account.progress.signalStats[signal] ?? {
      correctCount: 0,
      incorrectCount: 0,
    };
    account.progress.signalStats[signal] = {
      correctCount: signalStats.correctCount + (isCorrect ? 1 : 0),
      incorrectCount: signalStats.incorrectCount + (isCorrect ? 0 : 1),
    };
  }

  const updatedAccount = await store.updateAccount(account);

  return {
    questionId: question.id,
    isCorrect,
    correctAnswer: question.correctAnswer,
    correctAnswerText: question.options[question.correctAnswer] ?? "Correct answer",
    explanation: question.explanation,
    lifetimeProgress: buildLifetimeProgress(updatedAccount.progress, questions, categories),
  };
}
