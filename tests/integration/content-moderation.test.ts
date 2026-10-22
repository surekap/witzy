import { vi } from "vitest";
import { buildQuickQuestions } from "@/tests/fixtures/age-banded-questions";

const category = { id: "math", slug: "math", name: "Math", icon: "", active: true };
vi.mock("@/lib/db/convex", () => ({
  runConvexQuery: vi.fn(async (name: string) => {
    if (name === "questionBank:getActiveQuestionBankVersion") return "moderation-test";
    if (name === "questionBank:listQuestionBankCategories") return [category];
    if (name === "questionBank:listQuestionBankQuestionsPage") {
      return { page: [{ ...buildQuickQuestions([category])[0], id: "legacy-question", tags: [] }], isDone: true, continueCursor: "" };
    }
    throw new Error(`Unexpected query: ${name}`);
  }),
  runConvexMutation: vi.fn(),
}));
vi.mock("@/lib/db/question-bank", () => ({ replaceQuestionBank: vi.fn() }));
import { loadQuestionBankFromDatabase } from "@/lib/db/runtime-storage";
import { removeQuestionsFromAdmin } from "@/lib/admin/service";
import { replaceQuestionBank } from "@/lib/db/question-bank";
import { runConvexMutation } from "@/lib/db/convex";

describe("single database question pool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads only database questions, never an additional compiled starter pool", async () => {
    const bank = await loadQuestionBankFromDatabase();
    expect(bank.questions.map((question) => question.id)).toEqual(["legacy-question"]);
  });

  it("serves the cached bank without copying it", async () => {
    expect(await loadQuestionBankFromDatabase()).toBe(await loadQuestionBankFromDatabase());
  });

  it("does not treat removed starter IDs as live questions", async () => {
    const id = buildQuickQuestions([category])[0].id;
    expect((await removeQuestionsFromAdmin([id, id])).removedCount).toBe(0);
    expect(runConvexMutation).not.toHaveBeenCalled();
    expect(replaceQuestionBank).not.toHaveBeenCalled();
    expect((await removeQuestionsFromAdmin([id])).removedCount).toBe(0);
  });

  it("keeps compiled starter content out of bank replacement", async () => {
    expect((await removeQuestionsFromAdmin(["legacy-question"])).removedCount).toBe(1);
    expect(replaceQuestionBank).toHaveBeenCalledWith({ categories: [category], questions: [] });
    expect(runConvexMutation).not.toHaveBeenCalled();
  });
});
