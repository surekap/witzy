import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { getCategories } from "@/lib/game/service";
import { resetStore } from "@/lib/game/store";
import {
  getSoloPracticeQuestion,
  registerPracticeAccount,
  selectPracticeQuestionForAccount,
  submitPracticeAnswer,
} from "@/lib/practice/service";
import { createPracticeStore } from "@/lib/practice/store";
import type { Category, Question } from "@/types/game";

function buildQuestion(overrides: Partial<Question>): Question {
  return {
    id: overrides.id ?? "question_1",
    categoryId: overrides.categoryId ?? "category_math",
    title: overrides.title ?? "Question",
    prompt: overrides.prompt ?? "Prompt",
    modality: overrides.modality ?? "text",
    difficulty: overrides.difficulty ?? "medium",
    ageBandMin: overrides.ageBandMin ?? "6_to_8",
    ageBandMax: overrides.ageBandMax ?? "15_plus",
    answerType: overrides.answerType ?? "multiple_choice",
    options: overrides.options ?? {
      A: "Answer A",
      B: "Answer B",
      C: "Answer C",
      D: "Answer D",
    },
    correctAnswer: overrides.correctAnswer ?? "A",
    explanation: overrides.explanation ?? "Explanation",
    mediaUrl: overrides.mediaUrl ?? null,
    mediaAltText: overrides.mediaAltText ?? null,
    estimatedSeconds: overrides.estimatedSeconds ?? 15,
    active: overrides.active ?? true,
    tags: overrides.tags ?? ["math", "medium"],
    createdAt: overrides.createdAt ?? "2026-04-02T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-04-02T00:00:00.000Z",
  };
}

describe("practice progress", () => {
  let tempDir = "";

  beforeEach(() => {
    resetStore();
  });

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = "";
    }
  });

  it("retires a question after the account answers it correctly", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "kids-quiz-practice-"));
    const store = createPracticeStore(path.join(tempDir, "practice.json"));
    const account = await registerPracticeAccount(
      { username: "Ava", password: "1234" },
      store,
    );
    const category = (await getCategories())[0];

    const first = await getSoloPracticeQuestion(
      account.id,
      {
        categoryId: category.id,
        ageBand: "9_to_11",
        difficultyMode: "adaptive",
        askedQuestionIds: [],
      },
      store,
    );

    await submitPracticeAnswer(
      account.id,
      {
        questionId: first.question.id,
        answerKey: first.question.correctAnswer,
      },
      store,
    );

    const next = await getSoloPracticeQuestion(
      account.id,
      {
        categoryId: category.id,
        ageBand: "9_to_11",
        difficultyMode: "adaptive",
        askedQuestionIds: [],
      },
      store,
    );

    expect(next.question.id).not.toBe(first.question.id);
  });

  it("prioritizes question types that have a stronger miss history", () => {
    const category: Category = {
      id: "category_math",
      slug: "math",
      name: "Math",
      icon: "➗",
      active: true,
    };

    const fractionQuestion = buildQuestion({
      id: "question_fraction",
      tags: ["math", "medium", "fractions"],
    });
    const geometryQuestion = buildQuestion({
      id: "question_geometry",
      tags: ["math", "medium", "geometry"],
    });

    const selected = selectPracticeQuestionForAccount({
      category,
      questions: [geometryQuestion, fractionQuestion],
      ageBand: "9_to_11",
      targetDifficulty: "medium",
      askedQuestionIds: [],
      progress: {
        totalAnswered: 4,
        totalCorrect: 1,
        totalIncorrect: 3,
        currentStreak: -1,
        questionStats: {},
        signalStats: {
          "tag:fractions": { correctCount: 0, incorrectCount: 3 },
          "tag:geometry": { correctCount: 1, incorrectCount: 0 },
          "difficulty:medium": { correctCount: 1, incorrectCount: 3 },
          "category:math": { correctCount: 1, incorrectCount: 3 },
          "modality:text": { correctCount: 1, incorrectCount: 3 },
        },
        categoryStats: {
          [category.id]: { correctCount: 1, incorrectCount: 3 },
        },
      },
    });

    expect(selected?.id).toBe(fractionQuestion.id);
  });

  it("returns no question when the selected age band has no seeded matches", () => {
    const category: Category = {
      id: "category_creative",
      slug: "creative-expression",
      name: "Creative Expression",
      icon: "🎨",
      active: true,
    };

    const olderQuestion = buildQuestion({
      id: "question_older_age_only",
      categoryId: category.id,
      ageBandMin: "9_to_11",
      ageBandMax: "9_to_11",
      difficulty: "easy",
    });

    const selected = selectPracticeQuestionForAccount({
      category,
      questions: [olderQuestion],
      ageBand: "6_to_8",
      targetDifficulty: "easy",
      askedQuestionIds: [],
      progress: {
        totalAnswered: 0,
        totalCorrect: 0,
        totalIncorrect: 0,
        currentStreak: 0,
        questionStats: {},
        signalStats: {},
        categoryStats: {},
      },
    });

    expect(selected).toBeNull();
  });
});
