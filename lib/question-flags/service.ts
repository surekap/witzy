import { createNeonSql } from "@/lib/db/neon";
import { getQuestionFlagStore } from "@/lib/question-flags/store";
import { env } from "@/lib/utils/env";
import type { QuestionFlagReporterScope, QuestionFlagSource, QuestionFlagSummary } from "@/types/question-flags";

type QuestionFlagSummaryRow = {
  question_id: string;
  question_title: string;
  question_prompt: string;
  distinct_reporter_count: number;
  practice_account_flag_count: number;
  room_player_flag_count: number;
  latest_reported_at: string;
};

interface RecordQuestionFlagInput {
  questionId: string;
  questionTitle: string;
  questionPrompt: string;
  reporterKey: string;
  reporterScope: QuestionFlagReporterScope;
  reporterUserId: string | null;
  reporterDisplayName: string;
  source: QuestionFlagSource;
  roomCode: string | null;
}

function mapSummaryRow(row: QuestionFlagSummaryRow): QuestionFlagSummary {
  return {
    questionId: row.question_id,
    questionTitle: row.question_title,
    questionPrompt: row.question_prompt,
    distinctReporterCount: Number(row.distinct_reporter_count),
    practiceAccountFlagCount: Number(row.practice_account_flag_count),
    roomPlayerFlagCount: Number(row.room_player_flag_count),
    latestReportedAt: row.latest_reported_at,
  };
}

async function loadDatabaseSummaries(questionIds?: string[]) {
  const sql = createNeonSql();

  if (questionIds && questionIds.length === 0) {
    return [];
  }

  const query = questionIds && questionIds.length > 0
    ? sql.query(
        `select
          question_id,
          max(question_title) as question_title,
          max(question_prompt) as question_prompt,
          count(*)::int as distinct_reporter_count,
          sum(case when reporter_scope = 'practice_account' then 1 else 0 end)::int as practice_account_flag_count,
          sum(case when reporter_scope = 'room_player' then 1 else 0 end)::int as room_player_flag_count,
          max(reported_at)::text as latest_reported_at
        from question_flags
        where question_id = any($1::uuid[])
        group by question_id
        order by distinct_reporter_count desc, latest_reported_at desc, question_id asc`,
        [questionIds],
      )
    : sql.query(
        `select
          question_id,
          max(question_title) as question_title,
          max(question_prompt) as question_prompt,
          count(*)::int as distinct_reporter_count,
          sum(case when reporter_scope = 'practice_account' then 1 else 0 end)::int as practice_account_flag_count,
          sum(case when reporter_scope = 'room_player' then 1 else 0 end)::int as room_player_flag_count,
          max(reported_at)::text as latest_reported_at
        from question_flags
        group by question_id
        order by distinct_reporter_count desc, latest_reported_at desc, question_id asc`,
      );
  const rows = (await query) as unknown as QuestionFlagSummaryRow[];

  return rows.map(mapSummaryRow);
}

export async function getQuestionFlagSummaries(questionIds?: string[]) {
  if (env.NODE_ENV === "test") {
    return getQuestionFlagStore().getSummaries(questionIds);
  }

  return loadDatabaseSummaries(questionIds);
}

export async function recordQuestionFlag(input: RecordQuestionFlagInput) {
  if (env.NODE_ENV === "test") {
    const result = getQuestionFlagStore().upsertFlag(input);

    return {
      alreadyFlagged: !result.created,
      summary: result.summary,
    };
  }

  const sql = createNeonSql();
  const insertedRows = await (sql.query(
    `insert into question_flags (
      question_id,
      question_title,
      question_prompt,
      reporter_key,
      reporter_scope,
      reporter_user_id,
      reporter_display_name,
      source,
      room_code
    ) values (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      $9
    )
    on conflict (question_id, reporter_key) do nothing
    returning question_id`,
    [
      input.questionId,
      input.questionTitle,
      input.questionPrompt,
      input.reporterKey,
      input.reporterScope,
      input.reporterUserId,
      input.reporterDisplayName,
      input.source,
      input.roomCode,
    ],
  ) as unknown as Promise<Array<{ question_id: string }>>);

  const [summary] = await loadDatabaseSummaries([input.questionId]);

  return {
    alreadyFlagged: insertedRows.length === 0,
    summary: summary ?? null,
  };
}
