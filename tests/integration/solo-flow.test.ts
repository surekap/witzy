import { resetStore } from "@/lib/game/store";
import { getCategories, getSoloQuestion } from "@/lib/game/service";

describe("solo practice", () => {
  beforeEach(() => {
    resetStore();
  });

  it("serves a fresh question when the previous one has already been asked", async () => {
    const category = (await getCategories())[0];

    const first = await getSoloQuestion({
      categoryId: category.id,
      ageBand: "9_to_11",
      difficultyMode: "adaptive",
      askedQuestionIds: [],
    });

    const second = await getSoloQuestion({
      categoryId: category.id,
      ageBand: "9_to_11",
      difficultyMode: "adaptive",
      askedQuestionIds: [first.question.id],
    });

    expect(first.category.id).toBe(category.id);
    expect(second.category.id).toBe(category.id);
    expect(second.question.id).not.toBe(first.question.id);
  });
});
