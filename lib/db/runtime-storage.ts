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

interface QuestionBankQuestionsPage {
  page: Question[];
  isDone: boolean;
  continueCursor: string;
}

export async function loadQuestionBankFromDatabase() {
  const categories = await runConvexQuery<Record<string, never>, Category[]>(
    "questionBank:listQuestionBankCategories",
    {},
  );

  const questions: Question[] = [];
  let cursor: string | null = null;

  while (true) {
    const result: QuestionBankQuestionsPage = await runConvexQuery<
      {
        paginationOpts: {
          numItems: number;
          cursor: string | null;
        };
      },
      QuestionBankQuestionsPage
    >("questionBank:listQuestionBankQuestionsPage", {
      paginationOpts: {
        numItems: 500,
        cursor,
      },
    });

    questions.push(...result.page);

    if (result.isDone) {
      break;
    }

    cursor = result.continueCursor;
  }

  return { categories, questions };
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
