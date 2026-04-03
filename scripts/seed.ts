import fs from "node:fs/promises";
import path from "node:path";

import { loadLocalEnv } from "./load-env";

loadLocalEnv();

async function main() {
  const [{ replaceQuestionBank }, { buildSeedData }, { env }] = await Promise.all([
    import("@/lib/db/question-bank"),
    import("@/lib/questions/seed-data"),
    import("@/lib/utils/env"),
  ]);
  const targetQuestionCount = 5000;
  const { categories, questions } = buildSeedData({ targetQuestionCount });

  if (!env.NEXT_PUBLIC_CONVEX_URL) {
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

    console.log(`No Convex runtime env found. Wrote seed preview to ${previewPath}`);
    return;
  }

  await replaceQuestionBank({ categories, questions });

  console.log(`Seeded ${categories.length} categories and ${questions.length} questions into Convex.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
