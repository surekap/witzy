import path from "node:path";

import { loadLocalEnv } from "./load-env";

import { readJsonlFile, type SnapshotManifest, writeJsonFile, writeJsonlFile } from "@/lib/snapshot/format";

loadLocalEnv();

const SNAPSHOT_DIR = path.join(process.cwd(), "data", "runtime-snapshot", "current");

async function main() {
  const [{ runConvexQuery }, { loadQuestionBankFromDatabase }] = await Promise.all([
    import("@/lib/db/convex"),
    import("@/lib/db/runtime-storage"),
  ]);

  const [settings, questionBank, users, practiceAttempts, questionFlags, rooms] = await Promise.all([
    runConvexQuery<Record<string, never>, Array<{ key: string; stringValue: string | null; updatedAt: string }>>(
      "snapshot:listSettings",
      {},
    ),
    loadQuestionBankFromDatabase(),
    runConvexQuery<
      Record<string, never>,
      Array<{
        id: string;
        username: string;
        displayName: string;
        passwordHash: string | null;
        passwordSalt: string | null;
        createdAt: string;
        lastLoginAt: string | null;
      }>
    >("practice:listAccounts", {}),
    runConvexQuery<
      Record<string, never>,
      Array<{
        accountId: string;
        questionId: string;
        submittedAnswer: string;
        isCorrect: boolean;
        answeredAt: string;
      }>
    >("practice:listAllAttempts", {}),
    runConvexQuery<
      Record<string, never>,
      Array<{
        questionId: string;
        questionTitle: string;
        questionPrompt: string;
        reporterKey: string;
        reporterScope: "practice_account" | "room_player";
        reporterUserId: string | null;
        reporterDisplayName: string;
        source: "solo_practice" | "live_room";
        roomCode: string | null;
        reportedAt: string;
      }>
    >("snapshot:listQuestionFlags", {}),
    runConvexQuery<
      Record<string, never>,
      Array<{
        roomCode: string;
        room: unknown;
        version: number;
        updatedAt: string;
      }>
    >("rooms:listRoomStates", {}),
  ]);

  await writeJsonlFile(path.join(SNAPSHOT_DIR, "settings.jsonl"), settings);
  await writeJsonlFile(path.join(SNAPSHOT_DIR, "categories.jsonl"), questionBank.categories);
  await writeJsonlFile(path.join(SNAPSHOT_DIR, "questions.jsonl"), questionBank.questions);
  await writeJsonlFile(
    path.join(SNAPSHOT_DIR, "users.jsonl"),
    users.map((user) => ({
      accountId: user.id,
      username: user.username,
      displayName: user.displayName,
      passwordHash: user.passwordHash,
      passwordSalt: user.passwordSalt,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    })),
  );
  await writeJsonlFile(path.join(SNAPSHOT_DIR, "practiceAttempts.jsonl"), practiceAttempts);
  await writeJsonlFile(path.join(SNAPSHOT_DIR, "questionFlags.jsonl"), questionFlags);
  await writeJsonlFile(path.join(SNAPSHOT_DIR, "rooms.jsonl"), rooms);

  const manifest: SnapshotManifest = {
    formatVersion: 1,
    generatedAt: new Date().toISOString(),
    source: "convex",
    tables: {
      settings: settings.length,
      categories: questionBank.categories.length,
      questions: questionBank.questions.length,
      users: users.length,
      practiceAttempts: practiceAttempts.length,
      questionFlags: questionFlags.length,
      rooms: rooms.length,
    },
  };

  await writeJsonFile(path.join(SNAPSHOT_DIR, "manifest.json"), manifest);

  console.log(`Exported runtime snapshot to ${SNAPSHOT_DIR}.`);
  console.log(JSON.stringify(manifest.tables, null, 2));

  // Quick read-back to catch malformed JSONL before the files get committed.
  await readJsonlFile(path.join(SNAPSHOT_DIR, "questions.jsonl"));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
