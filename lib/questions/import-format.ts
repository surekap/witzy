import { randomUUID } from "node:crypto";

import { z } from "zod";

import { ageBands, difficultyValues } from "@/types/game";
import type { AnswerKey, AnswerType, Category, Question, QuestionModality } from "@/types/game";

const ageBandOrder = [...ageBands];
const answerKeys: AnswerKey[] = ["A", "B", "C", "D"];
const modalityValues: QuestionModality[] = ["text", "image", "audio"];
const answerTypeValues: AnswerType[] = ["multiple_choice", "single_tap_image", "true_false"];

const categorySchema = z.object({
  id: z.string().uuid().optional(),
  slug: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "Category slugs must use lowercase letters, numbers, and hyphens."),
  name: z.string().trim().min(1),
  icon: z.string().trim().min(1),
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

export function normalizeImportedQuestionBank(input: unknown) {
  const parsed = importedQuestionBankSchema.parse(input);
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
      name: category.name,
      icon: category.icon,
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
