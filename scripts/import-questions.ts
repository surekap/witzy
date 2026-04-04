import fs from "node:fs/promises";
import path from "node:path";

import { loadLocalEnv } from "./load-env";
import type { Category, Question } from "@/types/game";

loadLocalEnv();

type ImportMode = "replace" | "append";

interface ParsedArgs {
  inputPath: string;
  mode: ImportMode;
}

interface QuestionBankData {
  categories: Category[];
  questions: Question[];
}

const answerKeys = ["A", "B", "C", "D"] as const;

function normalizeText(value: string | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function createQuestionFingerprint(question: Question) {
  const optionsSignature = answerKeys
    .map((key) => `${key}:${normalizeText(question.options[key])}`)
    .join("|");
  const tagsSignature = [...question.tags].map(normalizeText).sort().join("|");

  return [
    question.categoryId,
    normalizeText(question.title),
    normalizeText(question.prompt),
    question.modality,
    question.difficulty,
    question.ageBandMin,
    question.ageBandMax,
    question.answerType,
    optionsSignature,
    question.correctAnswer,
    normalizeText(question.explanation),
    normalizeText(question.mediaUrl ?? ""),
    normalizeText(question.mediaAltText ?? ""),
    String(question.estimatedSeconds),
  ].join("||") + `||${tagsSignature}`;
}

function parseArgs(argv: string[]): ParsedArgs {
  let mode: ImportMode = "replace";
  let inputPath: string | null = null;

  for (const arg of argv) {
    if (arg === "--append") {
      mode = "append";
      continue;
    }

    if (arg === "--replace") {
      mode = "replace";
      continue;
    }

    if (arg.startsWith("--mode=")) {
      const modeValue = arg.slice("--mode=".length);

      if (modeValue !== "append" && modeValue !== "replace") {
        throw new Error(`Unsupported --mode value "${modeValue}". Use "append" or "replace".`);
      }

      mode = modeValue;
      continue;
    }

    if (arg.startsWith("--")) {
      throw new Error(`Unknown flag "${arg}".`);
    }

    if (inputPath) {
      throw new Error("Only one input JSON path may be provided.");
    }

    inputPath = arg;
  }

  if (!inputPath) {
    throw new Error(
      'Usage: corepack pnpm import:questions <path-to-json> [--append|--replace|--mode="append|replace"]',
    );
  }

  return { inputPath, mode };
}

function mergeQuestionBanks(
  existing: QuestionBankData,
  incoming: QuestionBankData,
): {
  merged: QuestionBankData;
  stats: { categoriesAdded: number; categoriesUpdated: number; questionsAdded: number; questionsSkipped: number };
} {
  const mergedCategories = existing.categories.map((category) => ({ ...category }));
  const mergedQuestions = existing.questions.map((question) => ({
    ...question,
    options: { ...question.options },
    tags: [...question.tags],
  }));
  const categoryBySlug = new Map(mergedCategories.map((category) => [category.slug, category]));
  const incomingCategoryIdToSlug = new Map(incoming.categories.map((category) => [category.id, category.slug]));
  const incomingCategoryIdToResolvedId = new Map<string, string>();

  let categoriesAdded = 0;
  let categoriesUpdated = 0;

  for (const incomingCategory of incoming.categories) {
    const existingCategory = categoryBySlug.get(incomingCategory.slug);

    if (existingCategory) {
      if (
        existingCategory.name !== incomingCategory.name ||
        existingCategory.icon !== incomingCategory.icon ||
        existingCategory.active !== incomingCategory.active
      ) {
        existingCategory.name = incomingCategory.name;
        existingCategory.icon = incomingCategory.icon;
        existingCategory.active = incomingCategory.active;
        categoriesUpdated += 1;
      }

      incomingCategoryIdToResolvedId.set(incomingCategory.id, existingCategory.id);
      continue;
    }

    const insertedCategory = { ...incomingCategory };
    mergedCategories.push(insertedCategory);
    categoryBySlug.set(insertedCategory.slug, insertedCategory);
    incomingCategoryIdToResolvedId.set(incomingCategory.id, insertedCategory.id);
    categoriesAdded += 1;
  }

  const existingQuestionIds = new Set(mergedQuestions.map((question) => question.id));
  const existingQuestionFingerprints = new Set(
    mergedQuestions.map((question) => createQuestionFingerprint(question)),
  );

  let questionsAdded = 0;
  let questionsSkipped = 0;

  for (const incomingQuestion of incoming.questions) {
    const incomingCategorySlug = incomingCategoryIdToSlug.get(incomingQuestion.categoryId);

    if (!incomingCategorySlug) {
      throw new Error(
        `Incoming question "${incomingQuestion.id}" references unknown category id "${incomingQuestion.categoryId}".`,
      );
    }

    const resolvedCategory = categoryBySlug.get(incomingCategorySlug);

    if (!resolvedCategory) {
      throw new Error(`Unable to resolve category slug "${incomingCategorySlug}" while merging question bank.`);
    }

    const resolvedCategoryId =
      incomingCategoryIdToResolvedId.get(incomingQuestion.categoryId) ?? resolvedCategory.id;
    const normalizedQuestion: Question = {
      ...incomingQuestion,
      categoryId: resolvedCategoryId,
      options: { ...incomingQuestion.options },
      tags: [...incomingQuestion.tags],
    };
    const fingerprint = createQuestionFingerprint(normalizedQuestion);

    if (existingQuestionIds.has(normalizedQuestion.id) || existingQuestionFingerprints.has(fingerprint)) {
      questionsSkipped += 1;
      continue;
    }

    mergedQuestions.push(normalizedQuestion);
    existingQuestionIds.add(normalizedQuestion.id);
    existingQuestionFingerprints.add(fingerprint);
    questionsAdded += 1;
  }

  return {
    merged: {
      categories: mergedCategories,
      questions: mergedQuestions,
    },
    stats: {
      categoriesAdded,
      categoriesUpdated,
      questionsAdded,
      questionsSkipped,
    },
  };
}

async function main() {
  const { inputPath, mode } = parseArgs(process.argv.slice(2));

  const resolvedPath = path.resolve(process.cwd(), inputPath);
  const rawContents = await fs.readFile(resolvedPath, "utf8");
  const payload = JSON.parse(rawContents) as unknown;

  const [{ replaceQuestionBank }, { normalizeImportedQuestionBank }, { env }, { loadQuestionBankFromDatabase }] =
    await Promise.all([
    import("@/lib/db/question-bank"),
    import("@/lib/questions/import-format"),
    import("@/lib/utils/env"),
    import("@/lib/db/runtime-storage"),
  ]);

  if (!env.NEXT_PUBLIC_CONVEX_URL) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is required to import questions into Convex.");
  }

  const importedQuestionBank = normalizeImportedQuestionBank(payload);

  if (mode === "replace") {
    await replaceQuestionBank(importedQuestionBank);
    console.log(
      `Replaced question bank with ${importedQuestionBank.categories.length} categories and ${importedQuestionBank.questions.length} questions from ${resolvedPath}.`,
    );
    return;
  }

  const existingQuestionBank = await loadQuestionBankFromDatabase();
  const { merged, stats } = mergeQuestionBanks(existingQuestionBank, importedQuestionBank);
  await replaceQuestionBank(merged);

  console.log(
    [
      `Appended questions from ${resolvedPath}.`,
      `Existing: ${existingQuestionBank.categories.length} categories, ${existingQuestionBank.questions.length} questions.`,
      `Imported file: ${importedQuestionBank.categories.length} categories, ${importedQuestionBank.questions.length} questions.`,
      `Added: ${stats.categoriesAdded} categories, ${stats.questionsAdded} questions.`,
      `Skipped duplicates: ${stats.questionsSkipped} questions.`,
      `Updated category metadata: ${stats.categoriesUpdated}.`,
      `Final bank: ${merged.categories.length} categories, ${merged.questions.length} questions.`,
    ].join(" "),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
