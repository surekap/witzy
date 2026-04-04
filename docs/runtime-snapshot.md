# Runtime Snapshot

Witzy can export the live Convex runtime data into repo-committed snapshot files so a fresh database can be rebuilt quickly.

## Files

Snapshots are written to `data/runtime-snapshot/current/` in JSONL plus one JSON manifest:

- `manifest.json`
- `settings.jsonl`
- `categories.jsonl`
- `questions.jsonl`
- `users.jsonl`
- `practiceAttempts.jsonl`
- `questionFlags.jsonl`
- `rooms.jsonl`

Each `.jsonl` file contains one JSON object per line.

## Export

```bash
corepack pnpm snapshot:export
```

This reads the active Convex data and rewrites the snapshot files in `data/runtime-snapshot/current/`.

## Import

```bash
corepack pnpm snapshot:import
```

This restores the snapshot into the configured Convex deployment.

## Notes

- The question bank is restored through the existing versioned `replaceQuestionBank` path.
- The `currentQuestionBankVersion` setting is not imported directly. A fresh version id is generated during import.
- The snapshot includes user password hashes and salts. Treat the repo accordingly.
