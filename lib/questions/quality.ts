import { ageBands, type AgeBand, type Question } from "@/types/game";

// Word budgets keep rounds fast: prompt + every option is read aloud in the child's head.
export const questionBudgets: Record<AgeBand, { total: number; prompt: number; option: number }> = {
  "6_to_8": { total: 28, prompt: 15, option: 4 },
  "9_to_11": { total: 34, prompt: 18, option: 5 },
  "12_to_14": { total: 42, prompt: 22, option: 6 },
  "15_plus": { total: 50, prompt: 25, option: 7 },
};

export function countWords(text: string) {
  return text.match(/[\p{L}\p{N}]+(?:['’.-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

export function questionWordCount(question: Pick<Question, "prompt" | "options">) {
  return countWords(question.prompt) + Object.values(question.options).reduce((sum, value) => sum + countWords(value ?? ""), 0);
}

// Mechanical checks are a publication gate, not a substitute for subject/age review.
export function questionQualityIssues(question: Pick<Question, "prompt" | "options" | "correctAnswer" | "ageBandMin" | "ageBandMax">) {
  const issues: string[] = [];
  const budget = questionBudgets[question.ageBandMin];
  const options = Object.values(question.options).filter((value): value is string => Boolean(value?.trim()));
  if (!budget || ageBands.indexOf(question.ageBandMin) > ageBands.indexOf(question.ageBandMax)) return ["invalid-age-range"];
  if (!question.prompt.trim()) issues.push("missing-prompt");
  if (!question.options[question.correctAnswer]) issues.push("missing-correct-answer");
  if (options.length < 2) issues.push("missing-options");
  if (new Set(options.map((value) => value.trim().toLowerCase())).size !== options.length) issues.push("duplicate-options");
  if (countWords(question.prompt) > budget.prompt) issues.push("long-prompt");
  if (questionWordCount(question) > budget.total) issues.push("long-question");
  if (options.some((value) => countWords(value) > budget.option)) issues.push("long-option");
  const lengths = options.map(countWords);
  if (lengths.length && Math.max(...lengths) - Math.min(...lengths) > 3) issues.push("unbalanced-options");
  // The answer must not be guessable as the conspicuously longest option.
  const correct = question.options[question.correctAnswer] ?? "";
  const distractors = options.filter((value) => value !== correct).map((value) => value.length);
  if (distractors.length && correct.length > Math.max(...distractors) * 1.3 + 3) issues.push("answer-length-clue");
  if (/\b(all|none) of (the )?(above|these)\b|\bboth [a-d] and [a-d]\b/i.test(options.join(" "))) issues.push("position-dependent-options");
  return issues;
}

export function isReviewedQuestion(question: Question) {
  return question.active && question.tags.includes("age-reviewed:v1") && questionQualityIssues(question).length === 0;
}
