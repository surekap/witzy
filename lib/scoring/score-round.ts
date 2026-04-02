import type { ConfidenceMode, GameConfig, QuestionDifficulty } from "@/types/game";

const baseScoreByDifficulty: Record<QuestionDifficulty, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
};

export interface ScoreableAnswer {
  playerId: string;
  displayName: string;
  difficulty: QuestionDifficulty;
  isCorrect: boolean;
  responseMs: number | null;
  confidenceMode: ConfidenceMode | null;
  hintUsed: boolean;
}

export interface ScoredAnswer extends ScoreableAnswer {
  pointsAwarded: number;
  fastestCorrect: boolean;
}

export function getBasePoints(difficulty: QuestionDifficulty) {
  return baseScoreByDifficulty[difficulty];
}

export function getAdaptiveDifficultyOffset(streak: number) {
  if (streak >= 2) {
    return 1;
  }

  if (streak <= -2) {
    return -1;
  }

  return 0;
}

export function calculateAnswerPoints(answer: ScoreableAnswer) {
  let points = answer.isCorrect ? getBasePoints(answer.difficulty) : 0;

  if (answer.isCorrect && answer.hintUsed) {
    points = Math.max(0, points - 1);
  }

  if (answer.confidenceMode === "bold") {
    points += answer.isCorrect ? 1 : -1;
  }

  return points;
}

export function scoreRoundAnswers(
  answers: ScoreableAnswer[],
  config: Pick<GameConfig, "fastestCorrectBonus" | "teamBonus">,
) {
  const fastestCorrectPlayerId =
    config.fastestCorrectBonus
      ? answers
          .filter((answer) => answer.isCorrect && typeof answer.responseMs === "number")
          .sort((left, right) => (left.responseMs ?? Infinity) - (right.responseMs ?? Infinity))[0]?.playerId ?? null
      : null;

  const everyoneCorrect = config.teamBonus && answers.length > 0 && answers.every((answer) => answer.isCorrect);

  return answers.map<ScoredAnswer>((answer) => {
    let pointsAwarded = calculateAnswerPoints(answer);
    const fastestCorrect = fastestCorrectPlayerId === answer.playerId;

    if (fastestCorrect) {
      pointsAwarded += 1;
    }

    if (everyoneCorrect) {
      pointsAwarded += 1;
    }

    return {
      ...answer,
      pointsAwarded,
      fastestCorrect,
    };
  });
}
