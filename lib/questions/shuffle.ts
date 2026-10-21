import type { AnswerKey, Question } from "@/types/game";

export function shuffleQuestionOptions(question: Question, random = Math.random): Question {
  const entries = Object.entries(question.options) as Array<[AnswerKey, string]>;
  // Position-dependent legacy questions cannot safely be shuffled.
  if (/\b(above|both [a-d])\b/i.test(entries.map(([, value]) => value).join(" "))) return structuredClone(question);
  for (let index = entries.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [entries[index], entries[other]] = [entries[other], entries[index]];
  }
  const keys: AnswerKey[] = ["A", "B", "C", "D"];
  return {
    ...question,
    options: Object.fromEntries(entries.map(([, value], index) => [keys[index], value])),
    correctAnswer: keys[entries.findIndex(([key]) => key === question.correctAnswer)],
  };
}
