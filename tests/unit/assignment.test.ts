import { assignQuestionForPlayer, isQuestionAgeCompatible } from "@/lib/questions/assignment";
import { buildSeedData } from "@/lib/questions/seed-data";
import type { AgeBand, Question, QuestionDifficulty } from "@/types/game";

function createQuestion(params: {
  id: string;
  categoryId: string;
  difficulty: QuestionDifficulty;
  ageBandMin: AgeBand;
  ageBandMax: AgeBand;
}): Question {
  return {
    id: params.id,
    categoryId: params.categoryId,
    title: `Question ${params.id}`,
    prompt: `Prompt ${params.id}`,
    modality: "text",
    difficulty: params.difficulty,
    ageBandMin: params.ageBandMin,
    ageBandMax: params.ageBandMax,
    answerType: "multiple_choice",
    options: {
      A: "A",
      B: "B",
      C: "C",
      D: "D",
    },
    correctAnswer: "A",
    explanation: "Because it is.",
    mediaUrl: null,
    mediaAltText: null,
    estimatedSeconds: 15,
    active: true,
    tags: [],
    createdAt: "2026-04-03T00:00:00.000Z",
    updatedAt: "2026-04-03T00:00:00.000Z",
  };
}

describe("question assignment", () => {
  const { categories, questions } = buildSeedData();
  const mathCategoryId = categories.find((category) => category.slug === "math")?.id ?? "";

  it("prefers an exact category, age, and difficulty match", () => {
    const result = assignQuestionForPlayer({
      questions,
      categoryId: mathCategoryId,
      ageBand: "6_to_8",
      targetDifficulty: "easy",
      usedQuestionIds: new Set(),
    });

    expect(result?.difficulty).toBe("easy");
    expect(result?.categoryId).toBe(mathCategoryId);
    expect(result && isQuestionAgeCompatible(result, "6_to_8")).toBe(true);
  });

  it("keeps assignments age-compatible even when repeats are allowed", () => {
    const availableMediumIds = new Set(
      questions
        .filter(
          (question) =>
            question.categoryId === mathCategoryId &&
            question.difficulty === "medium" &&
            isQuestionAgeCompatible(question, "9_to_11"),
        )
        .map((question) => question.id),
    );

    const result = assignQuestionForPlayer({
      questions,
      categoryId: mathCategoryId,
      ageBand: "9_to_11",
      targetDifficulty: "medium",
      usedQuestionIds: availableMediumIds,
    });

    expect(result).not.toBeNull();
    expect(result && isQuestionAgeCompatible(result, "9_to_11")).toBe(true);
  });

  it("never falls back to a question outside the player's age band", () => {
    const categoryId = "category_math";
    const customQuestions = [
      createQuestion({
        id: "older-medium",
        categoryId,
        difficulty: "medium",
        ageBandMin: "12_to_14",
        ageBandMax: "15_plus",
      }),
      createQuestion({
        id: "younger-easy",
        categoryId,
        difficulty: "easy",
        ageBandMin: "6_to_8",
        ageBandMax: "9_to_11",
      }),
    ];

    const result = assignQuestionForPlayer({
      questions: customQuestions,
      categoryId,
      ageBand: "9_to_11",
      targetDifficulty: "medium",
      usedQuestionIds: new Set(),
    });

    expect(result?.id).toBe("younger-easy");
    expect(result && isQuestionAgeCompatible(result, "9_to_11")).toBe(true);
  });

  it("falls back to non-adjacent difficulties when needed", () => {
    const categoryId = "category_math";
    const customQuestions = [
      createQuestion({
        id: "hard-only",
        categoryId,
        difficulty: "hard",
        ageBandMin: "6_to_8",
        ageBandMax: "9_to_11",
      }),
    ];

    const result = assignQuestionForPlayer({
      questions: customQuestions,
      categoryId,
      ageBand: "6_to_8",
      targetDifficulty: "easy",
      usedQuestionIds: new Set(),
    });

    expect(result?.id).toBe("hard-only");
    expect(result && isQuestionAgeCompatible(result, "6_to_8")).toBe(true);
  });
});
