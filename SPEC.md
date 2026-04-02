
# LLM BUILD SPEC

Build a production-quality MVP for a multiplayer family quiz web app using:

* Next.js latest stable with App Router
* TypeScript
* Tailwind CSS
* Neon Postgres
* Vercel deployment
* Server Actions and/or Route Handlers where appropriate
* No React Native, no Expo, no separate backend repo
* Single monorepo-style Next.js app only

## Product concept

This app is a live multiplayer family quiz platform where:

* one parent or host acts as quizmaster
* multiple kids join the same game room from separate devices
* each player receives a question customized to their difficulty level
* all players answer simultaneously
* the category is shared, but the exact question differs by player
* the experience must still feel social, competitive, and fun

This is not a solo assessment app. It is a synchronized live game with private difficulty adaptation.

## Core product principle

Equal challenge, not equal question.

Players of different ages should not receive the same question. They should receive questions that are similarly difficult relative to their skill/age level.

## MVP goals

Implement these modes only:

1. Host-created live multiplayer game
2. Player join by room code
3. Shared category per round
4. Personalized question per player
5. Simultaneous answering with countdown
6. Public leaderboard after each round
7. Support text, image, and audio questions
8. Basic solo practice mode for testing the question engine

Do not build chat, payments, video, drag-and-drop question types, or advanced analytics in MVP.

---

# USER ROLES

## 1. Host / Quizmaster

Can:

* create game room
* choose categories
* start next round
* see all players and statuses
* reveal answers
* control pacing
* end game
* enable or disable optional mechanics:

  * fastest correct bonus
  * confidence wager
  * team bonus
  * hints

## 2. Player

Can:

* enter name
* optionally choose avatar color/icon
* join room with code
* answer questions
* see timer
* see round result
* see leaderboard

## 3. Admin seed mode

Need a developer-only seed path to populate categories and questions.

---

# PRIMARY GAME LOOP

## Live multiplayer round flow

1. Host creates room
2. Players join room
3. Host starts game
4. System chooses or host selects a category
5. Each player gets a private question in same category, tailored to their difficulty profile
6. Countdown timer starts
7. Players answer simultaneously
8. When timer ends or all have answered, lock submissions
9. Show shared reveal screen on host/room display:

   * which players answered correctly
   * points earned
   * optional fastest correct bonus
10. Update leaderboard
11. Host starts next round
12. Game ends after configurable number of rounds or points threshold

---

# CUSTOMIZATION MODEL

Each player profile should include:

* display_name
* age_band:

  * 6_to_8
  * 9_to_11
  * 12_to_14
  * 15_plus
* optional manual difficulty override:

  * easy
  * medium
  * hard
  * adaptive
* preferred categories optional
* accessibility flags:

  * audio_on
  * larger_text

For MVP, difficulty should be determined by:

1. manual age band
2. optional manual override
3. fallback adaptive estimate from prior answers

Adaptive estimate can be simple:

* start from default difficulty based on age band
* move up after 2 correct answers in a row
* move down after 2 wrong answers in a row

Keep it simple. No overengineered Elo system in MVP.

---

# QUESTION CONTENT MODEL

Each question must have:

* id
* category_id
* title
* prompt
* modality:

  * text
  * image
  * audio
* difficulty:

  * easy
  * medium
  * hard
* age_band_min
* age_band_max
* answer_type:

  * multiple_choice
  * single_tap_image
  * true_false
* option_a
* option_b
* option_c
* option_d
* correct_answer
* explanation
* media_url nullable
* media_alt_text nullable
* estimated_seconds
* active boolean
* tags array/text
* created_at
* updated_at

Constraints:

* MVP supports only 4-option multiple choice, true/false, and image-tap with pre-defined hotspots/options
* Audio questions should use a short hosted audio clip
* Image questions should support landmarks, flags, animals, diagrams, art, movie stills, etc.
* All questions must belong to exactly one category

---

# CATEGORIES

Seed these categories:

* Math
* Science
* Geography
* History
* Art
* Movies
* Music
* Sports
* Computer Science
* Logic

Each category should have enough seeded questions across easy/medium/hard for demo purposes.

Generate at least:

* 30 questions per category
* balanced across difficulties
* balanced across age bands
* include some image and audio questions for at least Music, Geography, Art, and Movies

---

# SOCIAL MECHANICS FOR MVP

Implement these optional mechanics as feature flags on the game:

## 1. Fastest Correct Bonus

* among correct answers, fastest gets +1

## 2. Confidence Wager

Before answering, player may choose:

* safe = normal scoring
* bold = +1 extra if right, -1 if wrong

Keep it simple. No all-in mode in MVP.

## 3. Team Bonus

If all players answer correctly in a round, every player gets +1 bonus.

## 4. Hint

Allow one hint per player per game.
If used:

* remove two wrong options
* max points for that question reduced by 1

Do not implement steals in MVP because synchronized private questioning makes steals awkward.

---

# SCORING

Base scoring:

* easy question correct = 1 point
* medium question correct = 2 points
* hard question correct = 3 points

Adjustments:

* fastest correct bonus = +1 if enabled
* bold wager = +1 if correct, -1 if wrong
* hint used = reduce final earned points by 1, minimum 0
* wrong answer = 0 points, no life system in MVP
* unanswered = 0 points

Need total score and per-round score breakdown.

---

# GAME CONFIGURATION

Host can configure when creating a game:

* number_of_rounds: 5, 10, 15
* answer_time_limit_seconds: 10, 15, 20
* category_mode:

  * host_selects_each_round
  * random_from_selected_pool
* enabled_categories
* fastest_correct_bonus enabled/disabled
* confidence_wager enabled/disabled
* team_bonus enabled/disabled
* hints enabled/disabled

---

# UX / SCREEN REQUIREMENTS

## 1. Landing page

* clear product identity
* buttons:

  * Host a game
  * Join a game
  * Solo practice

## 2. Host create game page

* host name
* choose settings
* create room
* show room code and join link

## 3. Player join page

* room code
* player name
* age band
* optional avatar/color
* join room

## 4. Lobby screen

* list of joined players
* ready states
* host can remove player
* host starts game

## 5. Player question screen

Must show:

* category
* timer
* question prompt
* media if any
* answer choices
* confidence toggle if enabled
* hint button if available
* lock-in feedback when answered

## 6. Shared results screen

After each round, show:

* category
* each player result
* correct/incorrect
* points earned this round
* explanation for answers
* updated leaderboard

## 7. Final results screen

* winner
* final ranking
* total score
* optional “play again with same settings”

## 8. Solo practice page

* choose category
* choose age band
* answer 10 questions
* show score and explanations

Design must be mobile-first, because each player likely uses a phone.

---

# REALTIME REQUIREMENTS

Use a pragmatic realtime approach.

Need live updates for:

* lobby joins/leaves
* round start
* timer state
* answer submitted state
* round locked
* leaderboard updates

Implementation approach:

* prefer a simple and reliable realtime strategy compatible with Vercel deployment
* acceptable options:

  * polling for MVP
  * server-sent events
  * hosted realtime service
* do not build custom websocket infra unless absolutely necessary

If polling is used, keep it clean and responsive:

* 1–2 second polling in lobby
* tighter polling during live rounds if needed

Prioritize simplicity and reliability over cleverness.

---

# DATABASE DESIGN

Create Postgres schema for the following tables.

## users

For MVP this can be lightweight and mostly host/player session identity, not full auth.

Fields:

* id uuid pk
* display_name
* role nullable
* created_at

## game_rooms

* id uuid pk
* room_code unique short code
* host_user_id
* status:

  * lobby
  * in_progress
  * finished
* number_of_rounds
* answer_time_limit_seconds
* category_mode
* enabled_categories jsonb or normalized relation
* fastest_correct_bonus boolean
* confidence_wager boolean
* team_bonus boolean
* hints boolean
* current_round_number int default 0
* created_at
* updated_at

## game_players

* id uuid pk
* game_room_id
* user_id nullable
* display_name
* age_band
* difficulty_mode
* avatar_color
* joined_at
* is_connected boolean
* hint_uses_remaining int default 1

## categories

* id uuid pk
* slug unique
* name
* icon
* active boolean

## questions

Use fields defined in content model above.

## game_rounds

* id uuid pk
* game_room_id
* round_number
* category_id
* status:

  * pending
  * active
  * locked
  * revealed
* started_at nullable
* locked_at nullable
* revealed_at nullable

## round_questions

This stores the actual assigned question per player per round.

* id uuid pk
* game_round_id
* game_player_id
* question_id
* assigned_difficulty
* confidence_mode nullable
* hint_used boolean default false

## round_answers

* id uuid pk
* round_question_id
* submitted_answer
* is_correct
* response_ms
* points_awarded
* answered_at

## game_scores

Can be derived, but create a materialized/easy-read table for MVP if useful.

* id uuid pk
* game_room_id
* game_player_id
* total_points
* updated_at

Add indexes on:

* room_code
* game_room_id on related tables
* category_id on questions
* active and difficulty filters on questions

---

# QUESTION ASSIGNMENT LOGIC

For each round:

1. determine shared category
2. for each player, determine target difficulty
3. fetch one eligible question matching:

   * category
   * active = true
   * difficulty
   * suitable age band
   * not used recently in same game
4. assign question
5. if none found:

   * first relax age band
   * then relax difficulty by one step
   * never assign same question twice in same game unless unavoidable

Need deterministic and understandable fallback logic.

---

# API / SERVER ARCHITECTURE

Use Next.js App Router.

Use:

* Server Components for most pages
* Client Components only where interactivity is needed
* Route Handlers for structured API endpoints where polling or client fetches are needed
* Server Actions for host/game mutations where they simplify forms and server-side workflows

Organize code cleanly by domain, not by random file dumping.

Suggested structure:

* `app/`

  * `(marketing)/`
  * `host/`
  * `join/`
  * `game/[roomCode]/`
  * `solo/`
  * `api/`
* `components/`
* `lib/`

  * `db/`
  * `game/`
  * `questions/`
  * `scoring/`
  * `realtime/`
  * `utils/`
* `actions/`
* `types/`

---

# REQUIRED ROUTES / FEATURES

Implement at minimum:

## Pages

* `/`
* `/host`
* `/join`
* `/game/[roomCode]`
* `/solo`

## Route handlers or equivalent endpoints

* create room
* join room
* get room state
* start game
* start round
* submit answer
* lock round
* reveal round
* get leaderboard
* solo next question

Keep contracts typed and documented.

---

# AUTH STRATEGY

For MVP:

* no full user account system required
* use anonymous session identity via cookies or local storage plus server session token
* host gets elevated privileges for room they created
* players only access their room/player state

Protect against simple abuse:

* validate room membership
* validate that player can only submit their own answer once
* validate that only host can control round progression

Do not add OAuth in MVP.

---

# MEDIA HANDLING

Need support for:

* image question asset URLs
* audio clip URLs

Store media metadata in DB and serve assets from simple static/public storage for MVP.

Requirements:

* preload image/audio on player question screen where possible
* graceful fallback if media fails
* alt text for images
* play/pause UI for audio

---

# ACCESSIBILITY

Need basic accessibility:

* keyboard usable
* visible focus states
* adequate contrast
* alt text for images
* captions/transcripts field optional for audio where relevant
* timer should not create unreadable panic UX
* larger text support on player screens

---

# ERROR HANDLING

Implement clear handling for:

* invalid room code
* room already started
* duplicate player name in same room
* reconnecting player
* timer expired
* double submission
* no questions available in category/difficulty
* host disconnect
* player refresh during active game

Need user-friendly error states, not raw stack traces.

---

# RECONNECT / RESILIENCE

This matters.

If player refreshes:

* restore their session if possible
* place them back into current game state

If host refreshes:

* retain host authority via session

If someone disconnects temporarily:

* mark disconnected
* allow reconnect within same room

Do not lose the game state due to a browser refresh.

---

# PERFORMANCE REQUIREMENTS

Because deployment is on Vercel and database is Neon, build with serverless-friendly patterns.

Requirements:

* avoid chatty DB patterns
* minimize round-trip count on active gameplay
* batch reads where sensible
* use efficient indexed queries
* avoid N+1 queries
* keep payloads compact on polling endpoints
* do not overuse client-side state if server truth is clearer

---

# TEST DATA / SEEDING

Need a seed script that creates:

* categories
* demo host
* 3 demo players
* at least 300 total questions across categories
* at least one sample game room for local testing optional

Also generate a few high-quality sample questions in JSON or SQL seed form.

---

# TESTING REQUIREMENTS

Implement:

* unit tests for scoring logic
* unit tests for question assignment fallback logic
* integration tests for room creation and answer submission
* one end-to-end test for:

  * host creates room
  * players join
  * host starts round
  * players answer
  * leaderboard updates

Use a sensible modern test setup.

---

# CODE QUALITY REQUIREMENTS

* strict TypeScript
* clean domain types
* Zod validation for external inputs
* no `any`
* reusable service functions
* comments only where useful
* no giant god-files
* environment variable validation
* readable naming

---

# ENVIRONMENT VARIABLES

Support:

* database connection string for Neon
* app base URL
* session secret
* optional storage/media base URL

Create `.env.example`.

---

# DEPLOYMENT REQUIREMENTS

Prepare for Vercel deployment:

* production-safe environment handling
* build should succeed without manual hacks
* serverless-compatible architecture
* migration workflow for Neon Postgres
* simple seed instructions for dev

Also include a README with:

* setup
* env vars
* local dev
* migrations
* seeding
* deploy steps to Vercel

Note: since Vercel now points new Postgres projects toward Marketplace integrations rather than the old standalone Vercel Postgres, assume Neon is connected through Vercel’s integration flow or directly through Neon credentials. ([Vercel][2])

---

# UI STYLE DIRECTION

The UI should feel:

* playful
* polished
* modern
* family-friendly
* not babyish
* not like school software
* exciting during reveals

Use:

* rounded cards
* strong hierarchy
* big answer buttons on mobile
* crisp leaderboard
* subtle animation
* category icons
* clear colors without visual chaos

Avoid:

* clutter
* tiny text
* dense admin-looking tables on player screens

---

# IMPLEMENTATION PRIORITIES

Build in this order:

1. database schema and seed data
2. room creation and join flow
3. lobby
4. live round state machine
5. question assignment engine
6. player answer submission
7. scoring and leaderboard
8. result reveal
9. solo practice mode
10. polish, reconnects, tests

---

# DELIVERABLES

Produce:

1. full project code
2. SQL/schema or ORM migrations
3. seed script
4. sample question dataset
5. README
6. explanation of architecture
7. list of tradeoffs and MVP limitations

---

# IMPORTANT ENGINEERING CONSTRAINTS

* Keep MVP simple and robust
* Prefer understandable architecture over overengineering
* Do not add unnecessary libraries
* Do not use a separate backend service
* Do not implement full auth in MVP
* Do not use websockets unless clearly justified
* Focus on a working multiplayer game loop

---

# NICE-TO-HAVE IF EASY

Only include these if they do not bloat the MVP:

* sound effects toggle
* avatar picker
* streak indicator
* confetti on winner screen
* host view optimized for casting to TV

---

# FINAL INSTRUCTION TO THE CODING LLM

Implement this as a clean, runnable Next.js application using the App Router and a Neon Postgres database, suitable for deployment on Vercel. Use current best practices for App Router structure, Route Handlers, and Server Actions where appropriate. Make pragmatic choices when the spec leaves room for interpretation, but stay inside MVP scope. Next.js App Router is the current routing model, Route Handlers live in the `app` directory, and Next.js documents Server and Client Components, data mutation patterns, and deployment around this structure. ([Next.js][3])

