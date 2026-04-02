import { buildSeedData } from "@/lib/questions/seed-data";
import type { Category, GameRoom, Question } from "@/types/game";

interface QuizStoreState {
  categories: Category[];
  questions: Question[];
  rooms: Map<string, GameRoom>;
}

declare global {
  var __kidsQuizStore: QuizStoreState | undefined;
}

function createStoreState(): QuizStoreState {
  const { categories, questions } = buildSeedData();

  return {
    categories,
    questions,
    rooms: new Map(),
  };
}

export function getStore() {
  if (!globalThis.__kidsQuizStore) {
    globalThis.__kidsQuizStore = createStoreState();
  }

  return globalThis.__kidsQuizStore;
}

export function resetStore() {
  globalThis.__kidsQuizStore = createStoreState();
  return globalThis.__kidsQuizStore;
}
