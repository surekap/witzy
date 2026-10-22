# Question quality and playability

## Product policy

Rooms and practice use one question bank, loaded from the existing database. There is no
question-mode selector or compiled starter pool in production. Legacy room mode fields are
ignored for new assignments; questions already in flight retain their snapshots. The old
starter material remains only as test fixtures, not as an alternative production collection.

The original questions need substantive editing, not truncation or replacement with unrelated
trivia. Preserve question IDs and educational objectives. Correct answer keys, explanations,
ambiguity and distractors; move advanced concepts to an appropriate age band. Review category
and age coverage after reassignment. Question selection avoids repeating a player's question
until that category/age pool is exhausted. Longer games can repeat.

Age controls prerequisites and reading level; difficulty controls reasoning within that
age. Ages 6-8 use concrete, familiar ideas and one reasoning step. Older bands can use
increasingly abstract ideas without increasing unnecessary wording. Prompt plus all options
must fit 35/45/55/65 words respectively. Individual prompt/option limits and checks for
duplicate, position-dependent or conspicuously unequal options are also enforced.

New imports should explicitly set `reviewedForAge: true` only after reviewing factual accuracy,
prerequisites, one unambiguous answer, plausible parallel distractors, and age suitability.
That flag is mechanically checked, but is an editorial assertion, not an AI certificate.
Unreviewed imports are not certified by this flag; existing import activation semantics are
unchanged. Missing answers/age labels are rejected, never
invented. IDs are stable when the same material is imported again. Generated material is
inactive and unreviewed by default. Do not promote content merely because it is short.

## Timing

Auto estimates reading time for the prompt and every option, adds difficulty-dependent
thinking time and five seconds for interaction, then takes the maximum across players.
The result rounds up to five seconds. Initial reading rates (60/90/120/150 words per minute)
are adjustable launch heuristics, not scientifically validated norms for individual children.
Relaxed adds 50%. Fixed 30/45/60/90-second settings explicitly override the allowance.

Target the 80th percentile of completion time, not the 80th percentile of room participants.
After 20 comparable unhinted age-reviewed correct/timeout observations (same age, difficulty and
similar length), Auto uses empirical p80 plus a small buffer. Timeouts are included as
censored observations; when over 20% time out, the estimator increases the heuristic rather
than shortening it. Wrong guesses are not treated as evidence of fast successful completion.
Production stores anonymous timing observations without player, account or room identifiers;
the latest 2,000 from the last 90 days inform calibration. Rounds from fixed-timer rooms are
never recorded: they measure the host's limit, not how long children need. In-memory tests use room history.
With insufficient samples, the heuristic remains in effect. This is deliberately not a claim
that the initial timers already achieve an observed 80% completion rate.

Every round, whatever the timer, has a 2.5-second preparation countdown ("Get ready") and a
1.5-second submission grace period. The browser closes new selections at zero and sends a
selected-but-unlocked answer automatically; the grace window covers the trip. The deadline is
judged on the time the web server received the request, which it passes to the Convex mutation,
so the hop to Convex and its cold starts are not charged to the child. Convex still refuses a
relay arriving more than 10 seconds after the deadline, and a client timestamp can never extend
a deadline. This allowance is bounded, not a guarantee over disconnected or extremely slow
networks. All-in rounds end early. Same-answer retries are idempotent. The browser keeps the
server-clock offset from its lowest-latency response and a monotonic clock, so it never relies
on the device's wall clock. After the deadline it polls every second until the round is locked,
and it refreshes when a tab becomes visible, the network returns or a page is restored.

New games award two base points at every difficulty. Speed bonuses default off and are
suppressed in mixed-age rounds. Hints are consumed on the server before eliminations appear
and are offered only on four-choice questions; with fewer options, removing two wrong answers
would reveal the right one. Random category mode only picks categories with a question for every
player's age band, preferring ones not yet played.

## Transport and privacy

New rooms provide a separate read-only random capability for a Convex revision subscription.
It reveals only a revision number, never room state, questions, answers or action credentials.
Authenticated HTTP routes fetch viewer-specific state when the revision changes. Polling is
a fallback; ordinary reads do not reload the bank or rewrite the room. Deadline finalization
is a guarded state transition. Answer submission is atomic in Convex. Old rooms without
subscription tokens continue to poll. Question-bank reads are version-pinned and cached.

QR codes are rendered locally and contain only the public join URL, built from the host
browser's own origin. The lobby shows a large QR and room code for a TV, and a smaller pair
stays on the host screen during play. Players may join until the game finishes; a latecomer
sits out the round in progress and is assigned a question from the next one. Name/age profiles
are remembered on the device by default (a checkbox opts out) and offered as one tap.
Hosts and players hold separate room cookies, so a host who opens their own join link keeps
host control (and cannot also join as a player from that device). Presence is a 15-second
heartbeat that updates only the player's own record in Convex without changing the room
version, so it neither wakes every subscriber nor makes host actions retry; a player counts as
connected for 45 seconds. Existing room credentials allow reconnecting after the game starts; a disconnected
name alone never grants access. Guest history is scoped to the participant, not a global name.
Practice solutions are removed from question responses and carried in encrypted, expiring,
account-bound tickets. Attempts have unique IDs for retry deduplication. Three correct answers
are required for temporary mastery; mastered questions return after a week.

Database and maintenance functions are internal except the capability-checked revision query.
The Next server requires `CONVEX_ADMIN_KEY`. Practice sessions expire after seven days, admin
sessions after eight hours, use Secure production cookies and are revoked on logout. Login
limits are stored atomically in Convex; IP and account identifiers are stored as keyed hashes.
Configure a strong `SESSION_SECRET`; signing fails closed if it is missing.

## Deployments

The live site uses the Convex **production** deployment (`npx convex deploy`, `--prod` on CLI
commands). The **dev** deployment in `.env.local` is for local development only; `npx convex dev`
never touches players. Vercel deploys `main` to production; its `NEXT_PUBLIC_CONVEX_URL` and
`CONVEX_ADMIN_KEY` (a production deploy key) must point at the production deployment.

1. Back up first: `npx convex export --prod --path <file>.zip` (keep it outside Git).
2. Deploy Convex before the web build whenever functions change (`npx convex deploy`): the web
   build calls `rooms:touchPresence` and passes `receivedAt` to `rooms:submitAnswer`.
3. Rollback needs compatible Convex functions as well as the previous Vercel build. Question-bank
   versions are retained, so a bank rollback is one `activateQuestionBankVersion` call.
4. Review retention with the owner before setting `WITZY_RETENTION_ENABLED=1` in Convex.
   The daily job then removes rooms inactive for 30 days and reports older than 180 days,
   and anonymous timing observations older than 90 days, in bounded batches. Practice history
   is not automatically deleted. Retention defaults off.

## Question-bank editing

`scripts/question-fix.ts` drives editorial rewrites of the whole bank. `split` cuts the active
bank into 40-question chunks per category and age; editors rewrite each chunk by hand against
`.data/question-fix/BRIEF.md`, and a second editor verifies it against `VERIFY.md`. `check`
enforces the word budgets in `lib/questions/quality.ts` plus answer-length and qualifier
giveaways; `assemble` keeps every question ID, re-letters answers deterministically and writes a
report (word counts, letter spread, per-age coverage, logic fixes); `publish [--prod]` uploads a
new bank version and activates it only if the live version is still the one that was edited.
`.data/` is ignored by Git and holds private exports; never commit it.

## Verification

Use `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm test`,
`corepack pnpm test:e2e`, and `corepack pnpm build`.
Playwright starts its own development server with `WITZY_TEST_MODE=1` and disables the
browser's Convex subscription, ensuring it cannot mutate or subscribe to the production backend.
This test-only in-memory path is disabled in production. Persistent-path tests use a fake
storage adapter; preview smoke testing is still required for deployed Convex behavior.
