# Witzy

Mobile-first multiplayer family quiz MVP built with Next.js App Router, TypeScript, Tailwind CSS, and a Neon-ready data model.

## What’s Included

- Host flow for creating a live room with configurable rounds, timers, categories, and bonus mechanics
- Player join flow with age bands, avatar colors, and adaptive difficulty defaults
- Shared-category rounds with personalized questions per player
- Simultaneous answering, host-controlled reveals, and public leaderboard updates
- Text, image, and audio question support
- Solo practice mode for testing the question engine
- Unit, integration, and browser e2e tests
- Neon schema SQL plus a seed script

## Setup

1. Install dependencies with `corepack pnpm install`
2. Copy `.env.example` to `.env.local`
3. Run the app with `corepack pnpm dev`

The runtime currently works without a database by using an in-memory demo store, which keeps local setup fast. If you want to seed Neon, create the schema first and then run the seed script.

## Environment Variables

- `DATABASE_URL`: Neon connection string for schema seeding
- `NEXT_PUBLIC_APP_URL`: Base URL for join links
- `SESSION_SECRET`: Long random string for production deployments
- `MEDIA_BASE_URL`: Optional future override for hosted media assets

## Neon Schema And Seeding

1. Apply [`lib/db/schema.sql`](/Users/prateeksureka/Sites/kids_quiz/lib/db/schema.sql) to your Neon database
2. Run `corepack pnpm seed`

Without `DATABASE_URL`, the seed command writes a local preview file so you can inspect the generated content.

## Scripts

- `corepack pnpm dev`
- `corepack pnpm db:init`
- `corepack pnpm build`
- `corepack pnpm lint`
- `corepack pnpm test`
- `corepack pnpm test:e2e`
- `corepack pnpm typecheck`
- `corepack pnpm seed`

## Testing

- Unit tests cover scoring and question assignment fallback logic
- Integration tests cover room creation, answer submission, and reveal flow
- Playwright covers the main host/player room flow

## Deployment Notes

- The UI and route handlers are serverless-friendly and avoid custom websocket infrastructure
- Active gameplay uses polling instead of custom socket infrastructure for Vercel compatibility
- Neon schema and seed tooling are included for a database-backed deployment path
