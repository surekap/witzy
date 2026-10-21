import { vi } from "vitest";
import { buildQuickQuestions } from "@/lib/questions/quick-bank";

const state = vi.hoisted(() => ({ disabled: [] as string[] }));
const category = { id: "math", slug: "math", name: "Math", icon: "", active: true };
vi.mock("@/lib/db/convex", () => ({
  runConvexQuery: vi.fn(async (name: string) => {
    if (name === "questionBank:listDisabledQuickQuestions") return state.disabled;
    if (name === "questionBank:getActiveQuestionBankVersion") return "moderation-test";
    if (name === "questionBank:listQuestionBankCategories") return [category];
    if (name === "questionBank:listQuestionBankQuestionsPage") {
      return { page: [{ ...buildQuickQuestions([category])[0], id: "legacy-question", tags: [] }], isDone: true, continueCursor: "" };
    }
    throw new Error(`Unexpected query: ${name}`);
  }),
  runConvexMutation: vi.fn(async (_name: string, args: { questionIds: string[] }) => {
    state.disabled.push(...args.questionIds);
  }),
}));
vi.mock("@/lib/db/question-bank", () => ({ replaceQuestionBank: vi.fn() }));
import { loadQuickQuestionsFromDatabase } from "@/lib/db/runtime-storage";
import { removeQuestionsFromAdmin } from "@/lib/admin/service";
import { replaceQuestionBank } from "@/lib/db/question-bank";
import { runConvexMutation } from "@/lib/db/convex";

describe("starter question moderation", () => {
  beforeEach(() => { state.disabled = []; vi.clearAllMocks(); });

  it("applies the persistent blocklist without changing the authored source", async () => {
    const source = buildQuickQuestions([category]);
    state.disabled = [source[0].id];
    const playable = await loadQuickQuestionsFromDatabase([category]);
    expect(playable).toHaveLength(source.length - 1);
    expect(playable.some((question) => question.id === source[0].id)).toBe(false);
    expect(buildQuickQuestions([category])).toHaveLength(source.length);
  });

  it("removes a starter through admin without replacing the legacy bank", async () => {
    const id = buildQuickQuestions([category])[0].id;
    expect((await removeQuestionsFromAdmin([id, id])).removedCount).toBe(1);
    expect(runConvexMutation).toHaveBeenCalledWith("questionBank:disableQuickQuestions", { questionIds: [id] });
    expect(replaceQuestionBank).not.toHaveBeenCalled();
    expect((await removeQuestionsFromAdmin([id])).removedCount).toBe(0);
  });

  it("keeps compiled starter content out of bank replacement", async () => {
    expect((await removeQuestionsFromAdmin(["legacy-question"])).removedCount).toBe(1);
    expect(replaceQuestionBank).toHaveBeenCalledWith({ categories: [category], questions: [] });
    expect(runConvexMutation).not.toHaveBeenCalled();
  });
});
