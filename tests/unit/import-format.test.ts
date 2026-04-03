import { normalizeImportedQuestionBank } from "@/lib/questions/import-format";

describe("question import format", () => {
  it("normalizes valid JSON into category and question records", () => {
    const result = normalizeImportedQuestionBank({
      categories: [
        {
          slug: "space",
          name: "Space",
          icon: "🚀",
        },
      ],
      questions: [
        {
          categorySlug: "space",
          title: "Mars",
          prompt: "Which planet is called the Red Planet?",
          modality: "text",
          difficulty: "easy",
          ageBandMin: "6_to_8",
          ageBandMax: "9_to_11",
          answerType: "multiple_choice",
          options: {
            A: "Mars",
            B: "Venus",
            C: "Jupiter",
            D: "Mercury",
          },
          correctAnswer: "A",
          explanation: "Mars is known as the Red Planet.",
          estimatedSeconds: 12,
          tags: ["space", "planets"],
        },
      ],
    });

    expect(result.categories).toHaveLength(1);
    expect(result.questions).toHaveLength(1);
    expect(result.categories[0]?.id).toBeTruthy();
    expect(result.questions[0]?.id).toBeTruthy();
    expect(result.questions[0]?.categoryId).toBe(result.categories[0]?.id);
    expect(result.questions[0]?.mediaUrl).toBeNull();
    expect(result.questions[0]?.mediaAltText).toBeNull();
  });

  it("rejects questions that reference unknown categories", () => {
    expect(() =>
      normalizeImportedQuestionBank({
        categories: [
          {
            slug: "space",
            name: "Space",
            icon: "🚀",
          },
        ],
        questions: [
          {
            categorySlug: "animals",
            title: "Lion",
            prompt: "Which animal is called the king of the jungle?",
            modality: "text",
            difficulty: "easy",
            ageBandMin: "6_to_8",
            ageBandMax: "9_to_11",
            answerType: "multiple_choice",
            options: {
              A: "Lion",
              B: "Tiger",
            },
            correctAnswer: "A",
            explanation: "Lion is the expected answer here.",
            estimatedSeconds: 10,
            tags: ["animals"],
          },
        ],
      }),
    ).toThrow('unknown categorySlug "animals"');
  });
});
