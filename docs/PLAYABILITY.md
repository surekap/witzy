# Quick play, content quality and rollout

## Product policy

Quick play is the default for new rooms and practice. It uses explicitly age-reviewed,
concise material, not a shortened rendering of a longer question. Extended room mode
preserves access to the original bank and clearly warns that its age labels are unverified.
Existing rooms retain their settings. No existing database questions are deleted or relabelled.

The authored starter bank has at least five questions per age band in each of the 14
production categories. Related categories share some material. Question selection avoids
repeating a player's question until that category/age pool is exhausted. Longer games
can repeat; expanding the reviewed bank remains an editorial task. The starter review is
not a substitute for educator feedback or trials with children.

The initial pack contains 308 category entries (some shared prompts across related categories).
Median prompt-plus-option lengths are 13/18/20/22 words by ascending age band. Initial Auto
allowances, rounded to five seconds, range from 25-45/20-45/20-40/20-35 seconds respectively.

Starter questions appear in the admin catalog alongside imported questions. Removing one
persists a blocklist applied to future assignments in both rooms and practice; it does not
change a question already in flight. Expanding or restoring the starter pack is a code change.

Age controls prerequisites and reading level; difficulty controls reasoning within that
age. Ages 6-8 use concrete, familiar ideas and one reasoning step. Older bands can use
increasingly abstract ideas without increasing unnecessary wording. Prompt plus all options
must fit 35/45/55/65 words respectively. Individual prompt/option limits and checks for
duplicate, position-dependent or conspicuously unequal options are also enforced.

New imports must explicitly set `reviewedForAge: true` after reviewing factual accuracy,
prerequisites, one unambiguous answer, plausible parallel distractors, and age suitability.
That flag is mechanically checked, but is an editorial assertion, not an AI certificate.
Otherwise material remains extended-only. Missing answers/age labels are rejected, never
invented. IDs are stable when the same material is imported again. Generated material is
inactive and unreviewed by default. Do not promote content merely because it is short.

## Timing

Auto estimates reading time for the prompt and every option, adds difficulty-dependent
thinking time and five seconds for interaction, then takes the maximum across players.
The result rounds up to five seconds. Initial reading rates (60/90/120/150 words per minute)
are adjustable launch heuristics, not scientifically validated norms for individual children.
Relaxed adds 50%. Fixed 30/45/60/90-second settings explicitly override the allowance.

Target the 80th percentile of completion time, not the 80th percentile of room participants.
After 20 comparable unhinted quick-play correct/timeout observations (same age, difficulty and
similar length), Auto uses empirical p80 plus a small buffer. Timeouts are included as
censored observations; when over 20% time out, the estimator increases the heuristic rather
than shortening it. Wrong guesses are not treated as evidence of fast successful completion.
Production stores anonymous timing observations without player, account or room identifiers;
the latest 2,000 from the last 90 days inform calibration. In-memory tests use room history.
With insufficient samples, the heuristic remains in effect. This is deliberately not a claim
that the initial timers already achieve an observed 80% completion rate.

There is a 2.5-second preparation countdown for Auto/Relaxed and a 1.5-second submission
grace period. The browser closes new selections at zero; the authoritative Convex mutation
records receipt time and accepts transport grace. A client timestamp cannot extend a deadline.
This allowance is bounded, not a guarantee over disconnected or extremely slow networks.
All-in rounds end early. Same-answer retries are idempotent. Server offset plus a monotonic
browser clock avoids relying on the device's wall clock.

New games award two base points at every difficulty. Speed bonuses default off and are
suppressed in mixed-age rooms. Hints are consumed on the server before eliminations appear.

## Transport and privacy

New rooms provide a separate read-only random capability for a Convex revision subscription.
It reveals only a revision number, never room state, questions, answers or action credentials.
Authenticated HTTP routes fetch viewer-specific state when the revision changes. Polling is
a fallback; ordinary reads do not reload the bank or rewrite the room. Deadline finalization
is a guarded state transition. Answer submission is atomic in Convex. Old rooms without
subscription tokens continue to poll. Question-bank reads are version-pinned and cached.

QR codes are rendered locally and contain only the public join URL. Saved name/age profiles
are opt-in. Existing room credentials allow reconnecting after the game starts; a disconnected
name alone never grants access. Guest history is scoped to the participant, not a global name.
Practice solutions are removed from question responses and carried in encrypted, expiring,
account-bound tickets. Attempts have unique IDs for retry deduplication. Three correct answers
are required for temporary mastery; mastered questions return after a week.

Database and maintenance functions are internal except the capability-checked revision query.
The Next server requires `CONVEX_ADMIN_KEY`. Practice sessions expire after seven days, admin
sessions after eight hours, use Secure production cookies and are revoked on logout. Login
limits are stored atomically in Convex; IP and account identifiers are stored as keyed hashes.
Configure a strong `SESSION_SECRET`; signing fails closed if it is missing.

## Deployment checklist

1. Back up production data and verify `CONVEX_ADMIN_KEY`, `SESSION_SECRET`, and
   `NEXT_PUBLIC_APP_URL=https://witzy.sureka.family` in the web deployment.
2. Deploy Convex schema/functions and the Next app in a coordinated maintenance window.
   The old app cannot use the new practice ticket/session/revocation paths. Old login cookies
   are intentionally invalidated. Existing room cookies remain valid.
3. Smoke-test authentication, QR joining, mixed-age rounds, hint use, retries, timeout and
   reconnect on a separate preview deployment before promoting production.
4. Rollback requires retaining compatible Convex functions/schema as well as the web build.
   Question-bank replacement now retains earlier versions and uses compare-and-swap publication.
5. Review retention with the owner before setting `WITZY_RETENTION_ENABLED=1` in Convex.
   The daily job then removes rooms inactive for 30 days and reports older than 180 days,
   and anonymous timing observations older than 90 days, in bounded batches. Practice history
   is not automatically deleted. Retention defaults off.

No deployment, live-bank migration or retention enablement is performed by these code changes.
No local wireless mode is included.

## Verification

Use `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm test`,
`corepack pnpm test:e2e`, and `corepack pnpm build`.
Playwright starts its own development server with `WITZY_TEST_MODE=1` and disables the
browser's Convex subscription, ensuring it cannot mutate or subscribe to the production backend.
This test-only in-memory path is disabled in production. Persistent-path tests use a fake
storage adapter; preview smoke testing is still required for deployed Convex behavior.
