import { assignQuestionForPlayer } from "@/lib/questions/assignment";
import { buildSeedData } from "@/lib/questions/seed-data";

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
  });

  it("avoids repeated questions and relaxes difficulty when needed", () => {
    const availableMediumIds = new Set(
      questions
        .filter((question) => question.categoryId === mathCategoryId && question.difficulty === "medium")
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
    expect(result?.difficulty).not.toBe("medium");
  });
});
