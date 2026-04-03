# Witzy

Mobile-first multiplayer family quiz MVP built with Next.js App Router, TypeScript, Tailwind CSS, and Neon as the runtime source of truth.

Production URL: [witzy.sureka.family](https://witzy.sureka.family)

## What’s Included

- Host flow for creating a live room with configurable rounds, timers, categories, and bonus mechanics
- Player join flow with age bands, avatar colors, and adaptive difficulty defaults
- Shared-category rounds with personalized questions per player
- Simultaneous answering, host-controlled reveals, and public leaderboard updates
- Text, image, and audio question support
- Solo practice mode for one-player warmups and quick adaptive runs
- Simple username/password accounts stored in Neon
- One shared question bank in Neon for both live games and practice mode
- Lifetime practice progress derived from answer history linked to the main `questions` table
- Unit, integration, and browser e2e tests
- Neon schema SQL plus a seed script

## Setup

1. Install dependencies with `corepack pnpm install`
2. Set `DATABASE_URL` in `.env.local`
3. Run `corepack pnpm db:init`
4. Run `corepack pnpm seed` or `corepack pnpm import:questions <path-to-json>`
5. Run the app with `corepack pnpm dev`

The app now expects Neon for runtime storage. Rooms, account-backed practice progress, and the shared question bank all read from the database.

## Environment Variables

- `DATABASE_URL`: Neon connection string for runtime storage and seeding
- `NEXT_PUBLIC_APP_URL`: Base URL for join links. Set this to `https://witzy.sureka.family` in production.
- `SESSION_SECRET`: Long random string for production deployments
- `MEDIA_BASE_URL`: Optional future override for hosted media assets

## Neon Schema And Seeding

1. Apply [`lib/db/schema.sql`](/Users/prateeksureka/Sites/kids_quiz/lib/db/schema.sql) to your Neon database
2. Run `corepack pnpm seed`
3. To import a custom JSON question bank instead, run `corepack pnpm import:questions <path-to-json>`

Without `DATABASE_URL`, the seed command writes a local preview file so you can inspect the generated content, but the app itself expects Neon at runtime.

Detailed format and authoring guidance:

- [docs/question-seeding.md](/Users/prateeksureka/Sites/kids_quiz/docs/question-seeding.md)
- [scripts/question-bank.example.json](/Users/prateeksureka/Sites/kids_quiz/scripts/question-bank.example.json)

## Scripts

- `corepack pnpm dev`
- `corepack pnpm db:init`
- `corepack pnpm build`
- `corepack pnpm lint`
- `corepack pnpm test`
- `corepack pnpm test:e2e`
- `corepack pnpm typecheck`
- `corepack pnpm seed`
- `corepack pnpm import:questions <path-to-json>`

## Testing

- Unit tests cover scoring and question assignment fallback logic
- Integration tests cover room creation, answer submission, and reveal flow
- Playwright covers the main host/player room flow

## Deployment Notes

- The UI and route handlers are serverless-friendly and avoid custom websocket infrastructure
- Active gameplay uses polling instead of custom socket infrastructure for Vercel compatibility
- Rooms, accounts, practice attempts, and the shared question bank are stored in Neon
