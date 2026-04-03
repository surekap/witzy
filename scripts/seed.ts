import fs from "node:fs/promises";
import path from "node:path";

import { loadLocalEnv } from "./load-env";

loadLocalEnv();

async function main() {
  const [{ createNeonSql }, { replaceQuestionBank }, { buildSeedData }, { env }] = await Promise.all([
    import("@/lib/db/neon"),
    import("@/lib/db/question-bank"),
    import("@/lib/questions/seed-data"),
    import("@/lib/utils/env"),
  ]);
  const targetQuestionCount = 5000;
  const { categories, questions } = buildSeedData({ targetQuestionCount });

  if (!env.DATABASE_URL) {
    const previewPath = path.join(process.cwd(), "scripts", "seed-preview.json");
    await fs.writeFile(
      previewPath,
      JSON.stringify(
        {
          categoryCount: categories.length,
          questionCount: questions.length,
          sampleCategory: categories[0],
          sampleQuestion: questions[0],
        },
        null,
        2,
      ),
    );

    console.log(`No DATABASE_URL found. Wrote seed preview to ${previewPath}`);
    return;
  }

  const sql = createNeonSql();
  await replaceQuestionBank(sql, { categories, questions });

  console.log(`Seeded ${categories.length} categories and ${questions.length} questions into Neon.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
