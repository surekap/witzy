import { buildQuickQuestions } from "@/lib/questions/quick-bank";
import { isQuickQuestion, questionQualityIssues, questionWordCount, quickQuestionBudgets } from "@/lib/questions/quality";
import { shuffleQuestionOptions } from "@/lib/questions/shuffle";
import { percentile, questionAllowanceSeconds, roundDurationSeconds } from "@/lib/game/timing";
import { ageBands, type GameConfig } from "@/types/game";
import { issuePracticeTicket, publicPracticeQuestion, readPracticeTicket } from "@/lib/practice/ticket";
import { readToken, signToken } from "@/lib/utils/tokens";

const slugs = ["creative-expression", "design-innovation", "global-perspectives", "how-world-works", "express-ourselves", "organize-ourselves", "language-craft", "language-literacy", "logical-inquirers", "math-masterminds", "sharing-planet", "systems-societies", "place-and-time", "who-we-are"];
const categories = slugs.map((slug) => ({ id: slug, slug, name: slug, icon: "", active: true }));
const config: GameConfig = { numberOfRounds: 5, answerTimeLimitSeconds: "auto", categoryMode: "host_selects_each_round", enabledCategoryIds: slugs, fastestCorrectBonus: false, confidenceWager: false, teamBonus: false, hints: true };

describe("quick-play content and timing", () => {
  it("has structurally valid concise questions for every production category and age", () => {
    const questions = buildQuickQuestions(categories);
    expect(questions.length).toBeGreaterThan(100);
    expect(new Set(questions.map((q) => q.id)).size).toBe(questions.length);
    for (const category of categories) for (const age of ageBands) {
      const pool = questions.filter((q) => q.categoryId === category.id && q.ageBandMin === age);
      expect(pool.length).toBeGreaterThanOrEqual(5);
      for (const question of pool) {
        expect(questionQualityIssues(question)).toEqual([]);
        expect(isQuickQuestion(question)).toBe(true);
        expect(questionWordCount(question)).toBeLessThanOrEqual(quickQuestionBudgets[age].total);
        expect(questionAllowanceSeconds(question, age)).toBeLessThanOrEqual(65);
      }
    }
  });
  it("never treats a short unreviewed legacy question as age-reviewed", () => {
    const question = buildQuickQuestions(categories)[0];
    expect(isQuickQuestion({ ...question, tags: [] })).toBe(false);
    expect(isQuickQuestion({ ...question, prompt: "Long ".repeat(80) })).toBe(false);
  });
  it("shuffles without changing the correct answer text or mutating the bank", () => {
    const question = buildQuickQuestions(categories)[0];
    const original = structuredClone(question);
    const shuffled = shuffleQuestionOptions(question, () => 0);
    expect(shuffled.correctAnswer).not.toBe(question.correctAnswer);
    expect(shuffled.options[shuffled.correctAnswer]).toBe(question.options[question.correctAnswer]);
    expect(question).toEqual(original);
  });
  it("uses the longest player's allowance, not the 80th percentile of players", () => {
    const question = buildQuickQuestions(categories)[0];
    const assignments = ageBands.map((ageBand) => ({ ageBand, question }));
    const max = Math.max(...assignments.map((a) => questionAllowanceSeconds(a.question, a.ageBand)));
    expect(roundDurationSeconds(assignments, config)).toBe(Math.ceil(max / 5) * 5);
    expect(roundDurationSeconds(assignments, { ...config, answerTimeLimitSeconds: "relaxed" })).toBe(Math.ceil(max * 1.5 / 5) * 5);
    expect(percentile([10, 20, 30, 40, 100], 0.8)).toBe(40);
  });
  it("keeps practice solutions opaque and binds tickets to an account", () => {
    const question = buildQuickQuestions(categories)[0];
    const ticket = issuePracticeTicket("ava", question);
    expect(publicPracticeQuestion(question)).not.toHaveProperty("correctAnswer");
    expect(publicPracticeQuestion(question)).not.toHaveProperty("explanation");
    expect(readPracticeTicket(ticket, "ava").question).toEqual(question);
    expect(() => readPracticeTicket(ticket, "noah")).toThrow();
    expect(() => readPracticeTicket(`x${ticket.slice(1)}`, "ava")).toThrow();
  });
  it("uses p80 only with enough comparable observations and accounts for timeouts", () => {
    const question = buildQuickQuestions(categories)[0];
    const sample = { ageBand: question.ageBandMin, difficulty: question.difficulty, words: questionWordCount(question), seconds: 40, timedOut: false };
    const baseline = questionAllowanceSeconds(question, question.ageBandMin);
    expect(questionAllowanceSeconds(question, question.ageBandMin, Array(19).fill(sample))).toBe(baseline);
    const cohort = Array.from({ length: 20 }, (_, i) => ({ ...sample, seconds: i < 16 ? 40 : 100 }));
    expect(questionAllowanceSeconds(question, question.ageBandMin, cohort)).toBe(43);
    const timeouts = Array.from({ length: 20 }, (_, i) => ({ ...sample, seconds: baseline, timedOut: i < 6 }));
    expect(questionAllowanceSeconds(question, question.ageBandMin, timeouts)).toBeGreaterThanOrEqual(baseline * 1.25);
  });
  it("expires sessions and prevents cross-purpose use", () => {
    const token = signToken("ava", "practice", 60);
    expect(readToken(token, "practice")).toBe("ava");
    expect(readToken(token, "admin")).toBeNull();
    expect(readToken(signToken("ava", "practice", -1), "practice")).toBeNull();
    expect(readToken(`${token}.extra`, "practice")).toBeNull();
  });
});
