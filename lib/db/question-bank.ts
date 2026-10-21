import { runConvexMutation, runConvexQuery } from "@/lib/db/convex";
import type { Category, Question } from "@/types/game";

const CATEGORY_BATCH_SIZE = 100;
const QUESTION_BATCH_SIZE = 250;

function chunk<T>(items: T[], size: number) {
  const result: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }

  return result;
}

function createQuestionBankVersion() {
  return `question_bank_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function replaceQuestionBank(data: {
  categories: Category[];
  questions: Question[];
}) {
  const version = createQuestionBankVersion();
  const expectedVersion = await runConvexQuery<Record<string, never>, string | null>("questionBank:getActiveQuestionBankVersion", {});

  for (const categoryBatch of chunk(data.categories, CATEGORY_BATCH_SIZE)) {
    await runConvexMutation<{ version: string; categories: Category[] }, { insertedCount: number }>(
      "questionBank:seedCategoriesBatch",
      {
        version,
        categories: categoryBatch,
      },
    );
  }

  for (const questionBatch of chunk(data.questions, QUESTION_BATCH_SIZE)) {
    await runConvexMutation<{ version: string; questions: Question[] }, { insertedCount: number }>(
      "questionBank:seedQuestionsBatch",
      {
        version,
        questions: questionBatch,
      },
    );
  }

  await runConvexMutation<{ version: string; activatedAt: string; expectedVersion: string | null }, { version: string }>(
    "questionBank:activateQuestionBankVersion",
    {
      version,
      activatedAt: new Date().toISOString(),
      expectedVersion,
    },
  );

  // Retain old versions for rollback and readers pinned to a previous version.
  // Cleanup is an explicit maintenance operation, never part of publication.

  return { version };
}
