import { createNeonSql } from "@/lib/db/neon";
import type { GameRoom, Category, Question } from "@/types/game";

type CategoryRow = {
  id: string;
  slug: string;
  name: string;
  icon: string;
  active: boolean;
};

type QuestionRow = {
  id: string;
  category_id: string;
  title: string;
  prompt: string;
  modality: Question["modality"];
  difficulty: Question["difficulty"];
  age_band_min: Question["ageBandMin"];
  age_band_max: Question["ageBandMax"];
  answer_type: Question["answerType"];
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  correct_answer: Question["correctAnswer"];
  explanation: string;
  media_url: string | null;
  media_alt_text: string | null;
  estimated_seconds: number;
  active: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
};

type RoomStateRow = {
  room_code: string;
  room_state: GameRoom | null;
  room_state_version: number;
};

export interface PersistedRoomState {
  room: GameRoom;
  version: number;
}

function mapCategoryRow(row: CategoryRow): Category {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    icon: row.icon,
    active: row.active,
  };
}

function mapQuestionRow(row: QuestionRow): Question {
  return {
    id: row.id,
    categoryId: row.category_id,
    title: row.title,
    prompt: row.prompt,
    modality: row.modality,
    difficulty: row.difficulty,
    ageBandMin: row.age_band_min,
    ageBandMax: row.age_band_max,
    answerType: row.answer_type,
    options: {
      ...(row.option_a ? { A: row.option_a } : {}),
      ...(row.option_b ? { B: row.option_b } : {}),
      ...(row.option_c ? { C: row.option_c } : {}),
      ...(row.option_d ? { D: row.option_d } : {}),
    },
    correctAnswer: row.correct_answer,
    explanation: row.explanation,
    mediaUrl: row.media_url,
    mediaAltText: row.media_alt_text,
    estimatedSeconds: row.estimated_seconds,
    active: row.active,
    tags: row.tags ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildRoomDbPayload(room: GameRoom) {
  return {
    room_code: room.roomCode,
    status: room.status,
    number_of_rounds: room.config.numberOfRounds,
    answer_time_limit_seconds: room.config.answerTimeLimitSeconds,
    category_mode: room.config.categoryMode,
    enabled_categories: JSON.stringify(room.config.enabledCategoryIds),
    fastest_correct_bonus: room.config.fastestCorrectBonus,
    confidence_wager: room.config.confidenceWager,
    team_bonus: room.config.teamBonus,
    hints: room.config.hints,
    current_round_number: room.currentRoundNumber,
    room_state: JSON.stringify(room),
    updated_at: room.updatedAt,
  };
}

export async function loadQuestionBankFromDatabase() {
  const sql = createNeonSql();

  const [categoryRows, questionRows] = await Promise.all([
    sql.query("select id, slug, name, icon, active from categories where active = true order by name asc") as unknown as Promise<CategoryRow[]>,
    sql.query(
      `select
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
        created_at::text,
        updated_at::text
      from questions
      where active = true
      order by id asc`,
    ) as unknown as Promise<QuestionRow[]>,
  ]);

  return {
    categories: categoryRows.map(mapCategoryRow),
    questions: questionRows.map(mapQuestionRow),
  };
}

export async function loadRoomStateFromDatabase(roomCode: string): Promise<PersistedRoomState | null> {
  const sql = createNeonSql();
  const rows = await (sql.query(
    "select room_code, room_state, room_state_version from game_rooms where room_code = $1",
    [roomCode.toUpperCase()],
  ) as unknown as Promise<RoomStateRow[]>);
  const row = rows[0];

  if (!row || !row.room_state) {
    return null;
  }

  return {
    room: row.room_state,
    version: Number(row.room_state_version ?? 0),
  };
}

export async function insertRoomStateIntoDatabase(room: GameRoom) {
  const sql = createNeonSql();
  const payload = buildRoomDbPayload(room);

  await sql.query(
    `insert into game_rooms (
      room_code,
      status,
      number_of_rounds,
      answer_time_limit_seconds,
      category_mode,
      enabled_categories,
      fastest_correct_bonus,
      confidence_wager,
      team_bonus,
      hints,
      current_round_number,
      room_state,
      room_state_version,
      created_at,
      updated_at
    ) values (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6::jsonb,
      $7,
      $8,
      $9,
      $10,
      $11,
      $12::jsonb,
      0,
      $13::timestamptz,
      $14::timestamptz
    )`,
    [
      payload.room_code,
      payload.status,
      payload.number_of_rounds,
      payload.answer_time_limit_seconds,
      payload.category_mode,
      payload.enabled_categories,
      payload.fastest_correct_bonus,
      payload.confidence_wager,
      payload.team_bonus,
      payload.hints,
      payload.current_round_number,
      payload.room_state,
      room.createdAt,
      payload.updated_at,
    ],
  );
}

export async function updateRoomStateInDatabase(room: GameRoom, expectedVersion: number) {
  const sql = createNeonSql();
  const payload = buildRoomDbPayload(room);
  const result = await (sql.query(
    `update game_rooms
      set status = $2,
          number_of_rounds = $3,
          answer_time_limit_seconds = $4,
          category_mode = $5,
          enabled_categories = $6::jsonb,
          fastest_correct_bonus = $7,
          confidence_wager = $8,
          team_bonus = $9,
          hints = $10,
          current_round_number = $11,
          room_state = $12::jsonb,
          room_state_version = room_state_version + 1,
          updated_at = $13::timestamptz
      where room_code = $1
        and room_state_version = $14
      returning room_state_version`,
    [
      payload.room_code,
      payload.status,
      payload.number_of_rounds,
      payload.answer_time_limit_seconds,
      payload.category_mode,
      payload.enabled_categories,
      payload.fastest_correct_bonus,
      payload.confidence_wager,
      payload.team_bonus,
      payload.hints,
      payload.current_round_number,
      payload.room_state,
      payload.updated_at,
      expectedVersion,
    ],
  ) as unknown as Promise<Array<{ room_state_version: number }>>);

  return result[0] ? Number(result[0].room_state_version) : null;
}
