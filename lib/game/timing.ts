import { questionWordCount } from "@/lib/questions/quality";
import type { AgeBand, GameConfig, Question, QuestionDifficulty } from "@/types/game";

export const SUBMISSION_GRACE_MS = 1500;
export const ROUND_PREPARE_MS = 2500;
export const TARGET_COMPLETION_PERCENTILE = 0.8;
export interface TimingSample { ageBand: AgeBand; difficulty: QuestionDifficulty; words: number; seconds: number; timedOut: boolean }
const readingWordsPerMinute: Record<AgeBand, number> = { "6_to_8": 60, "9_to_11": 90, "12_to_14": 120, "15_plus": 150 };
const thinkingSeconds: Record<QuestionDifficulty, number> = { easy: 8, medium: 12, hard: 18 };

export function percentile(values: number[], fraction: number) {
  const sorted = values.filter((value) => Number.isFinite(value) && value >= 0).sort((a, b) => a - b);
  return sorted.length ? sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] : null;
}

// These are launch heuristics, not measured child-development norms. Calibrate
// against age/difficulty/length cohorts, including timeout rates, before reducing.
export function questionAllowanceSeconds(question: Question, ageBand: AgeBand, samples: TimingSample[] = []) {
  const reading = questionWordCount(question) * 60 / readingWordsPerMinute[ageBand];
  const media = question.modality === "text" ? 0 : Math.max(10, question.estimatedSeconds);
  const heuristic = Math.max(20, Math.ceil(reading + thinkingSeconds[question.difficulty] + 5 + media));
  const cohort = samples.filter((sample) => sample.ageBand === ageBand && sample.difficulty === question.difficulty &&
    Math.abs(sample.words - questionWordCount(question)) <= 10 && sample.seconds >= 3);
  // Never estimate p80 from successful answers alone: timeouts are censored
  // observations. If >20% time out, increase rather than shorten the allowance.
  if (cohort.length < 20 || question.modality !== "text") return heuristic;
  const timeoutRate = cohort.filter((sample) => sample.timedOut).length / cohort.length;
  const observed = percentile(cohort.map((sample) => sample.seconds), TARGET_COMPLETION_PERCENTILE) ?? heuristic;
  return Math.ceil(Math.max(heuristic * 0.8, observed + 3, timeoutRate > 0.2 ? heuristic * 1.25 : 0));
}

export function roundDurationSeconds(assignments: Array<{ question: Question; ageBand: AgeBand }>, config: GameConfig, samples: TimingSample[] = []) {
  if (typeof config.answerTimeLimitSeconds === "number") return config.answerTimeLimitSeconds;
  const multiplier = config.answerTimeLimitSeconds === "relaxed" ? 1.5 : 1;
  return Math.ceil(Math.max(20, ...assignments.map(({ question, ageBand }) => questionAllowanceSeconds(question, ageBand, samples))) * multiplier / 5) * 5;
}
