create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  username text,
  password_hash text,
  password_salt text,
  role text,
  last_login_at timestamptz,
  created_at timestamptz not null default now()
);

alter table users add column if not exists username text;
alter table users add column if not exists password_hash text;
alter table users add column if not exists password_salt text;
alter table users add column if not exists last_login_at timestamptz;

create table if not exists game_rooms (
  id uuid primary key default gen_random_uuid(),
  room_code text not null unique,
  host_user_id uuid references users(id),
  status text not null,
  number_of_rounds integer not null,
  answer_time_limit_seconds integer not null,
  category_mode text not null,
  enabled_categories jsonb not null,
  fastest_correct_bonus boolean not null default false,
  confidence_wager boolean not null default false,
  team_bonus boolean not null default false,
  hints boolean not null default false,
  current_round_number integer not null default 0,
  room_state jsonb,
  room_state_version bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table game_rooms add column if not exists room_state jsonb;
alter table game_rooms add column if not exists room_state_version bigint not null default 0;

create table if not exists game_players (
  id uuid primary key default gen_random_uuid(),
  game_room_id uuid not null references game_rooms(id) on delete cascade,
  user_id uuid references users(id),
  display_name text not null,
  age_band text not null,
  difficulty_mode text not null,
  avatar_color text not null,
  joined_at timestamptz not null default now(),
  is_connected boolean not null default true,
  hint_uses_remaining integer not null default 1
);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  icon text not null,
  active boolean not null default true
);

create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete cascade,
  title text not null,
  prompt text not null,
  modality text not null,
  difficulty text not null,
  age_band_min text not null,
  age_band_max text not null,
  answer_type text not null,
  option_a text,
  option_b text,
  option_c text,
  option_d text,
  correct_answer text not null,
  explanation text not null,
  media_url text,
  media_alt_text text,
  estimated_seconds integer not null,
  active boolean not null default true,
  tags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists game_rounds (
  id uuid primary key default gen_random_uuid(),
  game_room_id uuid not null references game_rooms(id) on delete cascade,
  round_number integer not null,
  category_id uuid not null references categories(id),
  status text not null,
  started_at timestamptz,
  locked_at timestamptz,
  revealed_at timestamptz
);

create table if not exists round_questions (
  id uuid primary key default gen_random_uuid(),
  game_round_id uuid not null references game_rounds(id) on delete cascade,
  game_player_id uuid not null references game_players(id) on delete cascade,
  question_id uuid not null references questions(id),
  assigned_difficulty text not null,
  confidence_mode text,
  hint_used boolean not null default false
);

create table if not exists round_answers (
  id uuid primary key default gen_random_uuid(),
  round_question_id uuid not null references round_questions(id) on delete cascade,
  submitted_answer text,
  is_correct boolean not null,
  response_ms integer,
  points_awarded integer not null default 0,
  answered_at timestamptz
);

create table if not exists game_scores (
  id uuid primary key default gen_random_uuid(),
  game_room_id uuid not null references game_rooms(id) on delete cascade,
  game_player_id uuid not null references game_players(id) on delete cascade,
  total_points integer not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists idx_game_rooms_room_code on game_rooms(room_code);
create index if not exists idx_game_players_room on game_players(game_room_id);
create index if not exists idx_game_rounds_room on game_rounds(game_room_id);
create index if not exists idx_round_questions_round on round_questions(game_round_id);
create index if not exists idx_round_answers_round_question on round_answers(round_question_id);
create index if not exists idx_questions_category on questions(category_id);
create index if not exists idx_questions_active_difficulty on questions(active, difficulty);
create unique index if not exists idx_users_username_lower on users(lower(username)) where username is not null;

create table if not exists practice_question_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  submitted_answer text not null,
  is_correct boolean not null,
  answered_at timestamptz not null default now()
);

create table if not exists question_flags (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  question_title text not null,
  question_prompt text not null,
  reporter_key text not null,
  reporter_scope text not null,
  reporter_user_id uuid references users(id) on delete set null,
  reporter_display_name text not null,
  source text not null,
  room_code text,
  reported_at timestamptz not null default now()
);

create index if not exists idx_practice_attempts_user on practice_question_attempts(user_id, answered_at desc);
create index if not exists idx_practice_attempts_question on practice_question_attempts(question_id);
create index if not exists idx_question_flags_question on question_flags(question_id, reported_at desc);
create unique index if not exists idx_question_flags_question_reporter on question_flags(question_id, reporter_key);
