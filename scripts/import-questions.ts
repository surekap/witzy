import fs from "node:fs/promises";
import path from "node:path";

import { loadLocalEnv } from "./load-env";

loadLocalEnv();

async function main() {
  const inputPath = process.argv[2];

  if (!inputPath) {
    throw new Error("Usage: corepack pnpm import:questions <path-to-json>");
  }

  const resolvedPath = path.resolve(process.cwd(), inputPath);
  const rawContents = await fs.readFile(resolvedPath, "utf8");
  const payload = JSON.parse(rawContents) as unknown;

  const [{ createNeonSql }, { replaceQuestionBank }, { normalizeImportedQuestionBank }, { env }] =
    await Promise.all([
      import("@/lib/db/neon"),
      import("@/lib/db/question-bank"),
      import("@/lib/questions/import-format"),
      import("@/lib/utils/env"),
    ]);

  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to import questions into Neon.");
  }

  const questionBank = normalizeImportedQuestionBank(payload);
  const sql = createNeonSql();

  await replaceQuestionBank(sql, questionBank);

  console.log(
    `Imported ${questionBank.categories.length} categories and ${questionBank.questions.length} questions from ${resolvedPath}.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
