import { runConvexMutation, runConvexQuery } from "@/lib/db/convex";
import type { GameRoom, Category, Question } from "@/types/game";

export interface PersistedRoomState {
  room: GameRoom;
  version: number;
}

export interface PersistedRoomStateListEntry extends PersistedRoomState {
  roomCode: string;
  updatedAt: string;
}

export async function loadQuestionBankFromDatabase() {
  return runConvexQuery<Record<string, never>, { categories: Category[]; questions: Question[] }>(
    "questionBank:listQuestionBank",
    {},
  );
}

export async function loadRoomStateFromDatabase(roomCode: string): Promise<PersistedRoomState | null> {
  return runConvexQuery<{ roomCode: string }, PersistedRoomState | null>("rooms:getRoomState", {
    roomCode: roomCode.toUpperCase(),
  });
}

export async function loadAllRoomStatesFromDatabase(): Promise<PersistedRoomStateListEntry[]> {
  return runConvexQuery<Record<string, never>, PersistedRoomStateListEntry[]>("rooms:listRoomStates", {});
}

export async function insertRoomStateIntoDatabase(room: GameRoom) {
  await runConvexMutation<{ room: GameRoom }, { version: number }>("rooms:insertRoomState", {
    room,
  });
}

export async function updateRoomStateInDatabase(room: GameRoom, expectedVersion: number) {
  return runConvexMutation<{ room: GameRoom; expectedVersion: number }, number | null>("rooms:updateRoomState", {
    room,
    expectedVersion,
  });
}
