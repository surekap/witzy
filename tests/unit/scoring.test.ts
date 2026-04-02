import { calculateAnswerPoints, scoreRoundAnswers } from "@/lib/scoring/score-round";

describe("scoring", () => {
  it("adds base points, bold bonus, fastest bonus, and team bonus", () => {
    const [winner, teammate] = scoreRoundAnswers(
      [
        {
          playerId: "p1",
          displayName: "Ava",
          difficulty: "hard",
          isCorrect: true,
          responseMs: 3200,
          confidenceMode: "bold",
          hintUsed: false,
        },
        {
          playerId: "p2",
          displayName: "Noah",
          difficulty: "medium",
          isCorrect: true,
          responseMs: 4800,
          confidenceMode: "safe",
          hintUsed: true,
        },
      ],
      {
        fastestCorrectBonus: true,
        teamBonus: true,
      },
    );

    expect(winner.pointsAwarded).toBe(6);
    expect(teammate.pointsAwarded).toBe(2);
    expect(winner.fastestCorrect).toBe(true);
  });

  it("keeps bold wrong answers negative", () => {
    expect(
      calculateAnswerPoints({
        playerId: "p1",
        displayName: "Ava",
        difficulty: "easy",
        isCorrect: false,
        responseMs: 1000,
        confidenceMode: "bold",
        hintUsed: false,
      }),
    ).toBe(-1);
  });
});
