import type { createNeonSql } from "@/lib/db/neon";
import type { Category, Question } from "@/types/game";

type NeonSql = ReturnType<typeof createNeonSql>;

function chunk<T>(items: T[], size: number) {
  const batches: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }

  return batches;
}

export async function insertQuestionBank(
  sql: NeonSql,
  data: {
    categories: Category[];
    questions: Question[];
  },
) {
  for (const category of data.categories) {
    await sql`
      insert into categories (id, slug, name, icon, active)
      values (${category.id}, ${category.slug}, ${category.name}, ${category.icon}, ${category.active})
    `;
  }

  const questionBatches = chunk(
    data.questions.map((question) => ({
      id: question.id,
      category_id: question.categoryId,
      title: question.title,
      prompt: question.prompt,
      modality: question.modality,
      difficulty: question.difficulty,
      age_band_min: question.ageBandMin,
      age_band_max: question.ageBandMax,
      answer_type: question.answerType,
      option_a: question.options.A ?? null,
      option_b: question.options.B ?? null,
      option_c: question.options.C ?? null,
      option_d: question.options.D ?? null,
      correct_answer: question.correctAnswer,
      explanation: question.explanation,
      media_url: question.mediaUrl,
      media_alt_text: question.mediaAltText,
      estimated_seconds: question.estimatedSeconds,
      active: question.active,
      tags: question.tags,
      created_at: question.createdAt,
      updated_at: question.updatedAt,
    })),
    250,
  );

  for (const batch of questionBatches) {
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
      select
        record.id::uuid,
        record.category_id::uuid,
        record.title,
        record.prompt,
        record.modality,
        record.difficulty,
        record.age_band_min,
        record.age_band_max,
        record.answer_type,
        record.option_a,
        record.option_b,
        record.option_c,
        record.option_d,
        record.correct_answer,
        record.explanation,
        record.media_url,
        record.media_alt_text,
        record.estimated_seconds,
        record.active,
        record.tags,
        record.created_at::timestamptz,
        record.updated_at::timestamptz
      from jsonb_to_recordset(${JSON.stringify(batch)}::jsonb) as record(
        id text,
        category_id text,
        title text,
        prompt text,
        modality text,
        difficulty text,
        age_band_min text,
        age_band_max text,
        answer_type text,
        option_a text,
        option_b text,
        option_c text,
        option_d text,
        correct_answer text,
        explanation text,
        media_url text,
        media_alt_text text,
        estimated_seconds integer,
        active boolean,
        tags jsonb,
        created_at text,
        updated_at text
      )
    `;
  }
}

export async function replaceQuestionBank(
  sql: NeonSql,
  data: {
    categories: Category[];
    questions: Question[];
  },
) {
  await sql`delete from questions`;
  await sql`delete from categories`;
  await insertQuestionBank(sql, data);
}
