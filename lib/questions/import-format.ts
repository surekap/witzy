import { randomUUID } from "node:crypto";

import { z } from "zod";

import { ageBands, difficultyValues } from "@/types/game";
import type { AnswerKey, AnswerType, Category, Question, QuestionModality } from "@/types/game";

const ageBandOrder = [...ageBands];
const answerKeys: AnswerKey[] = ["A", "B", "C", "D"];
const modalityValues: QuestionModality[] = ["text", "image", "audio"];
const answerTypeValues: AnswerType[] = ["multiple_choice", "single_tap_image", "true_false"];
const defaultCategoryIcon = "📚";

const categorySchema = z.object({
  id: z.string().uuid().optional(),
  slug: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "Category slugs must use lowercase letters, numbers, and hyphens."),
  name: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).optional(),
  icon: z.string().trim().min(1).optional(),
  active: z.boolean().default(true),
});

const questionSchema = z
  .object({
    id: z.string().uuid().optional(),
    categorySlug: z.string().trim().min(1),
    title: z.string().trim().min(1),
    prompt: z.string().trim().min(1),
    modality: z.enum(modalityValues).default("text"),
    difficulty: z.enum(difficultyValues),
    ageBandMin: z.enum(ageBands),
    ageBandMax: z.enum(ageBands),
    answerType: z.enum(answerTypeValues),
    options: z
      .object({
        A: z.string().trim().min(1).optional(),
        B: z.string().trim().min(1).optional(),
        C: z.string().trim().min(1).optional(),
        D: z.string().trim().min(1).optional(),
      })
      .refine(
        (options) => Object.values(options).filter(Boolean).length >= 2,
        "Each question needs at least two answer options.",
      ),
    correctAnswer: z.enum(answerKeys),
    explanation: z.string().trim().min(1),
    mediaUrl: z
      .string()
      .trim()
      .refine(
        (value) => value.startsWith("data:") || /^https?:\/\//.test(value),
        "mediaUrl must be an http(s) URL or data URI.",
      )
      .nullable()
      .optional(),
    mediaAltText: z.string().trim().min(1).nullable().optional(),
    estimatedSeconds: z.number().int().min(5).max(120).default(15),
    active: z.boolean().default(true),
    tags: z.array(z.string().trim().min(1)).default([]),
  })
  .superRefine((question, context) => {
    if (!question.options[question.correctAnswer]) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "correctAnswer must point to a populated option.",
        path: ["correctAnswer"],
      });
    }

    if (ageBandOrder.indexOf(question.ageBandMin) > ageBandOrder.indexOf(question.ageBandMax)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "ageBandMin must not be older than ageBandMax.",
        path: ["ageBandMin"],
      });
    }

    if (question.answerType === "true_false" && (!question.options.A || !question.options.B)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'true_false questions must define "A" and "B".',
        path: ["options"],
      });
    }

    if (question.modality === "text" && question.mediaUrl) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Text questions should not include mediaUrl.",
        path: ["mediaUrl"],
      });
    }

    if ((question.modality === "image" || question.modality === "audio") && !question.mediaUrl) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Image/audio questions must include mediaUrl.",
        path: ["mediaUrl"],
      });
    }
  });

export const importedQuestionBankSchema = z.object({
  categories: z.array(categorySchema).min(1),
  questions: z.array(questionSchema).min(1),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function slugifyCategory(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function normalizeLegacyQuestionBank(input: unknown): unknown {
  if (!isRecord(input) || !Array.isArray(input.questions)) {
    return input;
  }

  const looksLikeLegacy = input.categories === undefined && input.questions.some((item) => {
    if (!isRecord(item)) {
      return false;
    }

    return (
      typeof item.category === "string" ||
      typeof item.ageBand === "string" ||
      typeof item.id === "number"
    );
  });

  if (!looksLikeLegacy) {
    return input;
  }

  const categoriesBySlug = new Map<string, { slug: string; name: string; icon: string; active: boolean }>();
  const questions = input.questions.map((item) => {
    const source = isRecord(item) ? item : {};
    const categoryName =
      typeof source.category === "string" && source.category.trim().length > 0
        ? source.category.trim()
        : "General";
    const categorySlug = slugifyCategory(categoryName) || "general";

    if (!categoriesBySlug.has(categorySlug)) {
      categoriesBySlug.set(categorySlug, {
        slug: categorySlug,
        name: categoryName,
        icon: defaultCategoryIcon,
        active: true,
      });
    }

    const ageBand =
      typeof source.ageBand === "string" && ageBands.includes(source.ageBand as (typeof ageBands)[number])
        ? (source.ageBand as (typeof ageBands)[number])
        : "9_to_11";
    const answerType =
      typeof source.answerType === "string" &&
      answerTypeValues.includes(source.answerType as AnswerType)
        ? (source.answerType as AnswerType)
        : "multiple_choice";
    const difficulty =
      typeof source.difficulty === "string" &&
      difficultyValues.includes(source.difficulty as (typeof difficultyValues)[number])
        ? (source.difficulty as (typeof difficultyValues)[number])
        : "medium";
    const optionsSource = isRecord(source.options) ? source.options : {};
    const options = {
      ...(typeof optionsSource.A === "string" && optionsSource.A.trim().length > 0
        ? { A: optionsSource.A }
        : {}),
      ...(typeof optionsSource.B === "string" && optionsSource.B.trim().length > 0
        ? { B: optionsSource.B }
        : {}),
      ...(typeof optionsSource.C === "string" && optionsSource.C.trim().length > 0
        ? { C: optionsSource.C }
        : {}),
      ...(typeof optionsSource.D === "string" && optionsSource.D.trim().length > 0
        ? { D: optionsSource.D }
        : {}),
    };
    const correctAnswer =
      typeof source.correctAnswer === "string" && answerKeys.includes(source.correctAnswer as AnswerKey)
        ? (source.correctAnswer as AnswerKey)
        : (Object.keys(options)[0] as AnswerKey | undefined) ?? "A";

    return {
      categorySlug,
      title: typeof source.title === "string" && source.title.trim().length > 0 ? source.title : "Untitled",
      prompt: typeof source.prompt === "string" && source.prompt.trim().length > 0 ? source.prompt : "No prompt provided.",
      modality:
        typeof source.modality === "string" && modalityValues.includes(source.modality as QuestionModality)
          ? source.modality
          : "text",
      difficulty,
      ageBandMin: ageBand,
      ageBandMax: ageBand,
      answerType,
      options,
      correctAnswer,
      explanation:
        typeof source.explanation === "string" && source.explanation.trim().length > 0
          ? source.explanation
          : "This option best matches the concept tested in the question.",
      mediaUrl: typeof source.mediaUrl === "string" ? source.mediaUrl : undefined,
      mediaAltText: typeof source.mediaAltText === "string" ? source.mediaAltText : undefined,
      estimatedSeconds: typeof source.estimatedSeconds === "number" ? source.estimatedSeconds : 20,
      active: typeof source.active === "boolean" ? source.active : true,
      tags:
        Array.isArray(source.tags) && source.tags.every((tag) => typeof tag === "string")
          ? source.tags
          : [],
    };
  });

  return {
    categories: [...categoriesBySlug.values()],
    questions,
  };
}

function toTitleCaseFromSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function normalizeImportedQuestionBank(input: unknown) {
  const parsed = importedQuestionBankSchema.parse(normalizeLegacyQuestionBank(input));
  const now = new Date().toISOString();

  const seenSlugs = new Set<string>();
  const categories: Category[] = parsed.categories.map((category) => {
    if (seenSlugs.has(category.slug)) {
      throw new Error(`Duplicate category slug "${category.slug}" found in import JSON.`);
    }

    seenSlugs.add(category.slug);
    return {
      id: category.id ?? randomUUID(),
      slug: category.slug,
      name: category.name ?? category.title ?? toTitleCaseFromSlug(category.slug),
      icon: category.icon ?? defaultCategoryIcon,
      active: category.active,
    };
  });

  const categoryIdBySlug = new Map(categories.map((category) => [category.slug, category.id]));

  const questions: Question[] = parsed.questions.map((question, index) => {
    const categoryId = categoryIdBySlug.get(question.categorySlug);

    if (!categoryId) {
      throw new Error(
        `Question ${index + 1} references unknown categorySlug "${question.categorySlug}".`,
      );
    }

    return {
      id: question.id ?? randomUUID(),
      categoryId,
      title: question.title,
      prompt: question.prompt,
      modality: question.modality,
      difficulty: question.difficulty,
      ageBandMin: question.ageBandMin,
      ageBandMax: question.ageBandMax,
      answerType: question.answerType,
      options: question.options,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      mediaUrl: question.mediaUrl ?? null,
      mediaAltText: question.mediaAltText ?? null,
      estimatedSeconds: question.estimatedSeconds,
      active: question.active,
      tags: question.tags,
      createdAt: now,
      updatedAt: now,
    };
  });

  return {
    categories,
    questions,
  };
}
