import { buildSeedData } from "@/lib/questions/seed-data";

describe("seed data prompts", () => {
  it("does not leak the correct computer science answer in a hard prompt", () => {
    const { categories, questions } = buildSeedData({ targetQuestionCount: 5000 });
    const computerScienceCategory = categories.find((category) => category.slug === "computer-science");

    expect(computerScienceCategory).toBeDefined();

    const variableHardQuestion = questions.find(
      (question) =>
        question.categoryId === computerScienceCategory?.id &&
        question.difficulty === "hard" &&
        question.options[question.correctAnswer] === "Variable",
    );

    expect(variableHardQuestion).toBeDefined();
    expect(variableHardQuestion?.prompt).not.toMatch(/\bvariables?\b/i);
  });
});
