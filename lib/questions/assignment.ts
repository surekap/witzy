import { getAdaptiveDifficultyOffset } from "@/lib/scoring/score-round";
import type { AgeBand, GamePlayer, Question, QuestionDifficulty } from "@/types/game";

const ageBandOrder: AgeBand[] = ["6_to_8", "9_to_11", "12_to_14", "15_plus"];
const difficultyOrder: QuestionDifficulty[] = ["easy", "medium", "hard"];

export function getDefaultDifficultyForAgeBand(ageBand: AgeBand): QuestionDifficulty {
  if (ageBand === "6_to_8") {
    return "easy";
  }

  if (ageBand === "15_plus") {
    return "hard";
  }

  return "medium";
}

export function resolvePlayerDifficulty(player: Pick<GamePlayer, "ageBand" | "difficultyMode" | "streak">) {
  if (player.difficultyMode !== "adaptive") {
    return player.difficultyMode;
  }

  const baseDifficulty = getDefaultDifficultyForAgeBand(player.ageBand);
  const offset = getAdaptiveDifficultyOffset(player.streak);
  const baseIndex = difficultyOrder.indexOf(baseDifficulty);
  const nextIndex = Math.min(difficultyOrder.length - 1, Math.max(0, baseIndex + offset));
  return difficultyOrder[nextIndex];
}

export function isQuestionAgeCompatible(question: Pick<Question, "ageBandMin" | "ageBandMax">, ageBand: AgeBand) {
  const minimumIndex = ageBandOrder.indexOf(question.ageBandMin);
  const maximumIndex = ageBandOrder.indexOf(question.ageBandMax);
  const playerIndex = ageBandOrder.indexOf(ageBand);

  return playerIndex >= minimumIndex && playerIndex <= maximumIndex;
}

function buildDifficultyRelaxation(targetDifficulty: QuestionDifficulty) {
  const targetIndex = difficultyOrder.indexOf(targetDifficulty);
  return difficultyOrder
    .map((difficulty, index) => ({ difficulty, distance: Math.abs(index - targetIndex) }))
    .sort((left, right) => left.distance - right.distance)
    .filter((entry) => entry.distance > 0)
    .map((entry) => entry.difficulty);
}

function sortQuestions(questions: Question[]) {
  return [...questions].sort((left, right) => left.id.localeCompare(right.id));
}

export function assignQuestionForPlayer(params: {
  questions: Question[];
  categoryId: string;
  ageBand: AgeBand;
  targetDifficulty: QuestionDifficulty;
  usedQuestionIds: Set<string>;
}) {
  const categoryQuestions = params.questions.filter(
    (question) =>
      question.categoryId === params.categoryId &&
      question.active &&
      isQuestionAgeCompatible(question, params.ageBand),
  );

  const adjacentDifficulties = buildDifficultyRelaxation(params.targetDifficulty);

  const selectQuestion = (allowRepeats: boolean) => {
    const questionPool = categoryQuestions.filter(
      (question) => allowRepeats || !params.usedQuestionIds.has(question.id),
    );

    const exactDifficulty = sortQuestions(
      questionPool.filter(
        (question) =>
          question.difficulty === params.targetDifficulty &&
          isQuestionAgeCompatible(question, params.ageBand),
      ),
    );
    if (exactDifficulty.length > 0) {
      return exactDifficulty[0];
    }

    for (const difficulty of adjacentDifficulties) {
      const nearbyAgeMatch = sortQuestions(
        questionPool.filter((question) => question.difficulty === difficulty),
      );

      if (nearbyAgeMatch.length > 0) {
        return nearbyAgeMatch[0];
      }
    }

    return null;
  };

  return selectQuestion(false) ?? selectQuestion(true);
}
