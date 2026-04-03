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

  const [{ replaceQuestionBank }, { normalizeImportedQuestionBank }, { env }] = await Promise.all([
    import("@/lib/db/question-bank"),
    import("@/lib/questions/import-format"),
    import("@/lib/utils/env"),
  ]);

  if (!env.NEXT_PUBLIC_CONVEX_URL) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is required to import questions into Convex.");
  }

  const questionBank = normalizeImportedQuestionBank(payload);
  await replaceQuestionBank(questionBank);

  console.log(
    `Imported ${questionBank.categories.length} categories and ${questionBank.questions.length} questions from ${resolvedPath}.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
