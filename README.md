# Witzy

Mobile-first multiplayer family quiz MVP built with Next.js App Router, TypeScript, Tailwind CSS, and Convex as the runtime source of truth.

Production URL: [witzy.sureka.family](https://witzy.sureka.family)

## What’s Included

- Host flow for creating a live room with configurable rounds, timers, categories, and bonus mechanics
- Player join flow with age bands, avatar colors, and adaptive difficulty defaults
- Shared-category rounds with personalized questions per player
- Simultaneous answering, host-controlled reveals, and public leaderboard updates
- Text, image, and audio question support
- Solo practice mode for one-player warmups and quick adaptive runs
- Simple username/password accounts stored in Convex
- One shared question bank in Convex for both live games and practice mode
- Lifetime practice progress derived from answer history linked to the main `questions` table
- Unit, integration, and browser e2e tests
- Convex schema/functions plus seed and import scripts

## Setup

1. Install dependencies with `corepack pnpm install`
2. Run `corepack pnpm convex:dev` to create or link a Convex deployment
3. Set `NEXT_PUBLIC_CONVEX_URL` and `SESSION_SECRET` in `.env.local`
4. Run `corepack pnpm seed` or `corepack pnpm import:questions <path-to-json>`
5. Run the app with `corepack pnpm dev`

The app now expects Convex for runtime storage. Rooms, account-backed practice progress, question flags, and the shared question bank all read from Convex.

## Environment Variables

- `NEXT_PUBLIC_CONVEX_URL`: Convex deployment URL used by the app and server-side data bridge
- `CONVEX_ADMIN_KEY`: Optional server-only key for privileged Convex calls
- `NEXT_PUBLIC_APP_URL`: Base URL for join links. Set this to `https://witzy.sureka.family` in production.
- `SESSION_SECRET`: Long random string for production deployments
- `MEDIA_BASE_URL`: Optional future override for hosted media assets

## Convex Backend And Seeding

1. Sync the Convex backend with `corepack pnpm convex:dev` locally or `corepack pnpm convex:deploy` for production
2. Run `corepack pnpm seed`
3. To import a custom JSON question bank instead, run `corepack pnpm import:questions <path-to-json>`

Without Convex runtime env vars, the seed command writes a local preview file so you can inspect the generated content, but the app itself expects Convex at runtime.

Detailed format and authoring guidance:

- [docs/question-seeding.md](/Users/prateeksureka/Sites/kids_quiz/docs/question-seeding.md)
- [scripts/question-bank.example.json](/Users/prateeksureka/Sites/kids_quiz/scripts/question-bank.example.json)

## Scripts

- `corepack pnpm dev`
- `corepack pnpm convex:dev`
- `corepack pnpm convex:deploy`
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
- Rooms, accounts, practice attempts, question flags, and the shared question bank are stored in Convex
