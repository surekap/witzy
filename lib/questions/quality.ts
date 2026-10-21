import { ageBands, type AgeBand, type Question } from "@/types/game";

export const quickQuestionBudgets: Record<AgeBand, { total: number; prompt: number; option: number }> = {
  "6_to_8": { total: 35, prompt: 19, option: 5 },
  "9_to_11": { total: 45, prompt: 25, option: 7 },
  "12_to_14": { total: 55, prompt: 30, option: 9 },
  "15_plus": { total: 65, prompt: 35, option: 11 },
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
  const budget = quickQuestionBudgets[question.ageBandMin];
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
  if (lengths.length && Math.max(...lengths) > Math.max(4, Math.min(...lengths) * 3)) issues.push("unbalanced-options");
  if (/\b(all|none) of (the )?(above|these)\b|\bboth [a-d] and [a-d]\b/i.test(options.join(" "))) issues.push("position-dependent-options");
  return issues;
}

export function isQuickQuestion(question: Question) {
  return question.active && question.tags.includes("age-reviewed:v1") && questionQualityIssues(question).length === 0;
}
