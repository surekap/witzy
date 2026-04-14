import { mutationGeneric, paginationOptsValidator, queryGeneric } from "convex/server";
import { v } from "convex/values";

const categoryValidator = v.object({
  id: v.string(),
  slug: v.string(),
  name: v.string(),
  icon: v.string(),
  active: v.boolean(),
});

const questionValidator = v.object({
  id: v.string(),
  categoryId: v.string(),
  title: v.string(),
  prompt: v.string(),
  modality: v.union(v.literal("text"), v.literal("image"), v.literal("audio")),
  difficulty: v.union(v.literal("easy"), v.literal("medium"), v.literal("hard")),
  ageBandMin: v.union(v.literal("6_to_8"), v.literal("9_to_11"), v.literal("12_to_14"), v.literal("15_plus")),
  ageBandMax: v.union(v.literal("6_to_8"), v.literal("9_to_11"), v.literal("12_to_14"), v.literal("15_plus")),
  answerType: v.union(v.literal("multiple_choice"), v.literal("single_tap_image"), v.literal("true_false")),
  options: v.object({
    A: v.optional(v.string()),
    B: v.optional(v.string()),
    C: v.optional(v.string()),
    D: v.optional(v.string()),
  }),
  correctAnswer: v.union(v.literal("A"), v.literal("B"), v.literal("C"), v.literal("D")),
  explanation: v.string(),
  mediaUrl: v.union(v.string(), v.null()),
  mediaAltText: v.union(v.string(), v.null()),
  estimatedSeconds: v.number(),
  active: v.boolean(),
  tags: v.array(v.string()),
  createdAt: v.string(),
  updatedAt: v.string(),
});

async function getCurrentQuestionBankVersion(ctx: any): Promise<string | null> {
  const setting = await ctx.db
    .query("settings")
    .withIndex("by_key", (query: any) => query.eq("key", "currentQuestionBankVersion"))
    .unique();
  return setting?.stringValue ?? null;
}

function mapCategoryRow(category: any) {
  return {
    id: category.categoryId,
    slug: category.slug,
    name: category.name,
    icon: category.icon,
    active: category.active,
  };
}

function mapQuestionRow(question: any) {
  return {
    id: question.questionId,
    categoryId: question.categoryId,
    title: question.title,
    prompt: question.prompt,
    modality: question.modality,
    difficulty: question.difficulty,
    ageBandMin: question.ageBandMin,
    ageBandMax: question.ageBandMax,
    answerType: question.answerType,
    options: {
      ...(question.optionA ? { A: question.optionA } : {}),
      ...(question.optionB ? { B: question.optionB } : {}),
      ...(question.optionC ? { C: question.optionC } : {}),
      ...(question.optionD ? { D: question.optionD } : {}),
    },
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
    mediaUrl: question.mediaUrl,
    mediaAltText: question.mediaAltText,
    estimatedSeconds: question.estimatedSeconds,
    active: question.active,
    tags: question.tags,
    createdAt: question.createdAt,
    updatedAt: question.updatedAt,
  };
}

export const listQuestionBankCategories = queryGeneric({
  args: {},
  handler: async (ctx) => {
    const currentVersion = await getCurrentQuestionBankVersion(ctx);

    if (!currentVersion) {
      return [] as ReturnType<typeof mapCategoryRow>[];
    }

    const categories = await ctx.db
      .query("categories")
      .withIndex("by_bank_version", (query) => query.eq("bankVersion", currentVersion))
      .collect();

    return categories
      .filter((category: any) => category.active)
      .sort((left: any, right: any) => left.name.localeCompare(right.name))
      .map(mapCategoryRow);
  },
});

export const listQuestionBankQuestionsPage = queryGeneric({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const currentVersion = await getCurrentQuestionBankVersion(ctx);

    if (!currentVersion) {
      return {
        page: [],
        isDone: true,
        continueCursor: "",
      };
    }

    const result = await ctx.db
      .query("questions")
      .withIndex("by_bank_version", (query) => query.eq("bankVersion", currentVersion))
      .order("asc")
      .paginate({
        ...args.paginationOpts,
        maximumRowsRead: args.paginationOpts.maximumRowsRead ?? 2000,
      });

    return {
      ...result,
      page: result.page
        .filter((question: any) => question.active)
        .map(mapQuestionRow),
    };
  },
});

export const seedCategoriesBatch = mutationGeneric({
  args: {
    version: v.string(),
    categories: v.array(categoryValidator),
  },
  handler: async (ctx, args) => {
    for (const category of args.categories) {
      await ctx.db.insert("categories", {
        bankVersion: args.version,
        categoryId: category.id,
        slug: category.slug,
        name: category.name,
        icon: category.icon,
        active: category.active,
      });
    }

    return { insertedCount: args.categories.length };
  },
});

export const seedQuestionsBatch = mutationGeneric({
  args: {
    version: v.string(),
    questions: v.array(questionValidator),
  },
  handler: async (ctx, args) => {
    for (const question of args.questions) {
      await ctx.db.insert("questions", {
        bankVersion: args.version,
        questionId: question.id,
        categoryId: question.categoryId,
        title: question.title,
        prompt: question.prompt,
        modality: question.modality,
        difficulty: question.difficulty,
        ageBandMin: question.ageBandMin,
        ageBandMax: question.ageBandMax,
        answerType: question.answerType,
        optionA: question.options.A ?? null,
        optionB: question.options.B ?? null,
        optionC: question.options.C ?? null,
        optionD: question.options.D ?? null,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
        mediaUrl: question.mediaUrl,
        mediaAltText: question.mediaAltText,
        estimatedSeconds: question.estimatedSeconds,
        active: question.active,
        tags: question.tags,
        createdAt: question.createdAt,
        updatedAt: question.updatedAt,
      });
    }

    return { insertedCount: args.questions.length };
  },
});

export const activateQuestionBankVersion = mutationGeneric({
  args: {
    version: v.string(),
    activatedAt: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("settings").withIndex("by_key", (query) => query.eq("key", "currentQuestionBankVersion")).unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        stringValue: args.version,
        updatedAt: args.activatedAt,
      });
    } else {
      await ctx.db.insert("settings", {
        key: "currentQuestionBankVersion",
        stringValue: args.version,
        updatedAt: args.activatedAt,
      });
    }

    return { version: args.version };
  },
});

export const getActiveQuestionBankVersion = queryGeneric({
  args: {},
  handler: async (ctx) => {
    return getCurrentQuestionBankVersion(ctx);
  },
});

export const listQuestionBankVersions = queryGeneric({
  args: {},
  handler: async (ctx) => {
    const categories = await ctx.db.query("categories").collect();
    return [...new Set(categories.map((category) => category.bankVersion))];
  },
});

export const deleteQuestionBankVersionChunk = mutationGeneric({
  args: {
    version: v.string(),
    questionChunkSize: v.number(),
    categoryChunkSize: v.number(),
  },
  handler: async (ctx, args) => {
    const [questionRows, categoryRows] = await Promise.all([
      ctx.db
        .query("questions")
        .withIndex("by_bank_version", (query) => query.eq("bankVersion", args.version))
        .take(args.questionChunkSize),
      ctx.db
        .query("categories")
        .withIndex("by_bank_version", (query) => query.eq("bankVersion", args.version))
        .take(args.categoryChunkSize),
    ]);

    for (const row of questionRows) {
      await ctx.db.delete(row._id);
    }

    for (const row of categoryRows) {
      await ctx.db.delete(row._id);
    }

    return {
      deletedQuestionCount: questionRows.length,
      deletedCategoryCount: categoryRows.length,
    };
  },
});
