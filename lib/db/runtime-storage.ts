import { runConvexMutation, runConvexQuery } from "@/lib/db/convex";
import { buildQuickQuestions } from "@/lib/questions/quick-bank";
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

export async function loadCategoriesFromDatabase() {
  return runConvexQuery<Record<string, never>, Category[]>("questionBank:listQuestionBankCategories", {});
}

export async function loadQuickQuestionsFromDatabase(categories: Category[]) {
  const disabledIds = await runConvexQuery<Record<string, never>, string[]>("questionBank:listDisabledQuickQuestions", {});
  const disabled = new Set(disabledIds);
  return buildQuickQuestions(categories).filter((question) => !disabled.has(question.id));
}

let bankCache: { version: string | null; promise: Promise<{ categories: Category[]; questions: Question[] }> } | undefined;

export async function loadQuestionBankFromDatabase() {
  const version = await runConvexQuery<Record<string, never>, string | null>("questionBank:getActiveQuestionBankVersion", {});
  if (!bankCache || bankCache.version !== version) {
    const promise = loadVersion(version);
    bankCache = { version, promise };
    promise.catch(() => { if (bankCache?.promise === promise) bankCache = undefined; });
  }
  return structuredClone(await bankCache.promise);
}

async function loadVersion(version: string | null) {
  const categories = await runConvexQuery<{ version: string | null }, Category[]>(
    "questionBank:listQuestionBankCategories",
    { version },
  );

  const questions: Question[] = [];
  let cursor: string | null = null;

  while (true) {
    const result: QuestionBankQuestionsPage = await runConvexQuery<
      {
        version: string | null;
        paginationOpts: {
          numItems: number;
          cursor: string | null;
        };
      },
      QuestionBankQuestionsPage
    >("questionBank:listQuestionBankQuestionsPage", {
      version,
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
