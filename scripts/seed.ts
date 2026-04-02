import fs from "node:fs/promises";
import path from "node:path";

import { loadLocalEnv } from "./load-env";

loadLocalEnv();

async function main() {
  const [{ createNeonSql }, { buildSeedData }, { env }] = await Promise.all([
    import("@/lib/db/neon"),
    import("@/lib/questions/seed-data"),
    import("@/lib/utils/env"),
  ]);
  const { categories, questions } = buildSeedData();

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

  await sql`delete from questions`;
  await sql`delete from categories`;

  for (const category of categories) {
    await sql`
      insert into categories (id, slug, name, icon, active)
      values (${category.id}, ${category.slug}, ${category.name}, ${category.icon}, ${category.active})
    `;
  }

  for (const question of questions) {
    await sql`
      insert into questions (
        id,
        category_id,
        title,
        prompt,
        modality,
        difficulty,
        age_band_min,
        age_band_max,
        answer_type,
        option_a,
        option_b,
        option_c,
        option_d,
        correct_answer,
        explanation,
        media_url,
        media_alt_text,
        estimated_seconds,
        active,
        tags,
        created_at,
        updated_at
      )
      values (
        ${question.id},
        ${question.categoryId},
        ${question.title},
        ${question.prompt},
        ${question.modality},
        ${question.difficulty},
        ${question.ageBandMin},
        ${question.ageBandMax},
        ${question.answerType},
        ${question.options.A ?? null},
        ${question.options.B ?? null},
        ${question.options.C ?? null},
        ${question.options.D ?? null},
        ${question.correctAnswer},
        ${question.explanation},
        ${question.mediaUrl},
        ${question.mediaAltText},
        ${question.estimatedSeconds},
        ${question.active},
        ${JSON.stringify(question.tags)},
        ${question.createdAt},
        ${question.updatedAt}
      )
    `;
  }

  console.log(`Seeded ${categories.length} categories and ${questions.length} questions into Neon.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
