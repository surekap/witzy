import path from "node:path";

import { loadLocalEnv } from "./load-env";

import { readJsonFile, readJsonlFile, type SnapshotManifest } from "@/lib/snapshot/format";

loadLocalEnv();

const SNAPSHOT_DIR = path.join(process.cwd(), "data", "runtime-snapshot", "current");
const SETTINGS_BATCH_SIZE = 50;
const USER_BATCH_SIZE = 100;
const ATTEMPT_BATCH_SIZE = 250;
const FLAG_BATCH_SIZE = 250;
const ROOM_BATCH_SIZE = 25;

function chunk<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

async function main() {
  const [{ runConvexMutation }, { replaceQuestionBank }] = await Promise.all([
    import("@/lib/db/convex"),
    import("@/lib/db/question-bank"),
  ]);

  const manifest = await readJsonFile<SnapshotManifest>(path.join(SNAPSHOT_DIR, "manifest.json"));
  if (manifest.formatVersion !== 1) {
    throw new Error(`Unsupported snapshot format version: ${manifest.formatVersion}`);
  }

  const [settings, categories, questions, users, practiceAttempts, questionFlags, rooms] = await Promise.all([
    readJsonlFile<Array<{ key: string; stringValue: string | null; updatedAt: string }>[number]>(
      path.join(SNAPSHOT_DIR, "settings.jsonl"),
    ),
    readJsonlFile<Array<{ id: string; slug: string; name: string; icon: string; active: boolean }>[number]>(
      path.join(SNAPSHOT_DIR, "categories.jsonl"),
    ),
    readJsonlFile<
      Array<{
        id: string;
        categoryId: string;
        title: string;
        prompt: string;
        modality: "text" | "image" | "audio";
        difficulty: "easy" | "medium" | "hard";
        ageBandMin: "6_to_8" | "9_to_11" | "12_to_14" | "15_plus";
        ageBandMax: "6_to_8" | "9_to_11" | "12_to_14" | "15_plus";
        answerType: "multiple_choice" | "single_tap_image" | "true_false";
        options: Partial<Record<"A" | "B" | "C" | "D", string>>;
        correctAnswer: "A" | "B" | "C" | "D";
        explanation: string;
        mediaUrl: string | null;
        mediaAltText: string | null;
        estimatedSeconds: number;
        active: boolean;
        tags: string[];
        createdAt: string;
        updatedAt: string;
      }>[number]
    >(path.join(SNAPSHOT_DIR, "questions.jsonl")),
    readJsonlFile<
      Array<{
        accountId: string;
        username: string;
        displayName: string;
        passwordHash: string | null;
        passwordSalt: string | null;
        createdAt: string;
        lastLoginAt: string | null;
      }>[number]
    >(path.join(SNAPSHOT_DIR, "users.jsonl")),
    readJsonlFile<
      Array<{
        accountId: string;
        questionId: string;
        submittedAnswer: string;
        isCorrect: boolean;
        answeredAt: string;
      }>[number]
    >(path.join(SNAPSHOT_DIR, "practiceAttempts.jsonl")),
    readJsonlFile<
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
      }>[number]
    >(path.join(SNAPSHOT_DIR, "questionFlags.jsonl")),
    readJsonlFile<
      Array<{
        roomCode: string;
        room: unknown;
        version: number;
        updatedAt: string;
      }>[number]
    >(path.join(SNAPSHOT_DIR, "rooms.jsonl")),
  ]);

  await replaceQuestionBank({ categories, questions });

  const importableSettings = settings.filter((setting) => setting.key !== "currentQuestionBankVersion");

  for (const batch of chunk(importableSettings, SETTINGS_BATCH_SIZE)) {
    await runConvexMutation<{ settings: typeof batch }, { insertedCount: number }>("snapshot:seedSettingsBatch", {
      settings: batch,
    });
  }

  for (const batch of chunk(users, USER_BATCH_SIZE)) {
    await runConvexMutation<{ users: typeof batch }, { insertedCount: number }>("snapshot:seedUsersBatch", {
      users: batch,
    });
  }

  for (const batch of chunk(practiceAttempts, ATTEMPT_BATCH_SIZE)) {
    await runConvexMutation<{ attempts: typeof batch }, { insertedCount: number }>(
      "snapshot:seedPracticeAttemptsBatch",
      {
        attempts: batch,
      },
    );
  }

  for (const batch of chunk(questionFlags, FLAG_BATCH_SIZE)) {
    await runConvexMutation<{ flags: typeof batch }, { insertedCount: number }>("snapshot:seedQuestionFlagsBatch", {
      flags: batch,
    });
  }

  for (const batch of chunk(rooms, ROOM_BATCH_SIZE)) {
    await runConvexMutation<{ rooms: typeof batch }, { insertedCount: number }>("snapshot:seedRoomsBatch", {
      rooms: batch,
    });
  }

  console.log(`Imported runtime snapshot from ${SNAPSHOT_DIR}.`);
  console.log(
    JSON.stringify(
      {
        settings: importableSettings.length,
        categories: categories.length,
        questions: questions.length,
        users: users.length,
        practiceAttempts: practiceAttempts.length,
        questionFlags: questionFlags.length,
        rooms: rooms.length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
