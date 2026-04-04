import { getStore, resetStore } from "@/lib/game/store";
import {
  createRoom,
  getCategories,
  getRoomState,
  joinRoom,
  revealRound,
  startGame,
  startRound,
  submitAnswer,
} from "@/lib/game/service";
import { isQuestionAgeCompatible } from "@/lib/questions/assignment";

describe("room flow", () => {
  beforeEach(() => {
    resetStore();
  });

  it("creates a room, accepts answers, and reveals a leaderboard", async () => {
    const categories = await getCategories();
    const room = await createRoom({
      hostName: "Morgan",
      config: {
        numberOfRounds: 5,
        answerTimeLimitSeconds: 15,
        categoryMode: "host_selects_each_round",
        enabledCategoryIds: categories.slice(0, 3).map((category) => category.id),
        fastestCorrectBonus: true,
        confidenceWager: true,
        teamBonus: false,
        hints: true,
      },
    });

    const firstPlayer = await joinRoom(
      room.roomCode,
      {
        displayName: "Ava",
        ageBand: "9_to_11",
        difficultyMode: "adaptive",
        avatarColor: "cyan",
      },
      null,
    );
    const secondPlayer = await joinRoom(
      room.roomCode,
      {
        displayName: "Noah",
        ageBand: "12_to_14",
        difficultyMode: "adaptive",
        avatarColor: "amber",
      },
      null,
    );

    await startGame(room.roomCode, room.sessionKey);
    await startRound(room.roomCode, room.sessionKey, categories[0].id);

    const liveRoom = getStore().rooms.get(room.roomCode);
    expect(liveRoom).toBeDefined();

    const activeRound = liveRoom?.rounds.at(-1);
    const firstAssignment = activeRound?.assignments.find((assignment) => assignment.gamePlayerId === firstPlayer.playerId);
    const secondAssignment = activeRound?.assignments.find((assignment) => assignment.gamePlayerId === secondPlayer.playerId);

    expect(firstAssignment).toBeDefined();
    expect(secondAssignment).toBeDefined();
    expect(firstAssignment && isQuestionAgeCompatible(firstAssignment.questionSnapshot, "9_to_11")).toBe(true);
    expect(secondAssignment && isQuestionAgeCompatible(secondAssignment.questionSnapshot, "12_to_14")).toBe(true);

    await submitAnswer(room.roomCode, firstPlayer.sessionKey, {
      assignedQuestionId: firstAssignment!.id,
      answerKey: firstAssignment!.questionSnapshot.correctAnswer,
      confidenceMode: "bold",
      useHint: false,
    });
    await submitAnswer(room.roomCode, secondPlayer.sessionKey, {
      assignedQuestionId: secondAssignment!.id,
      answerKey: "D",
      confidenceMode: "safe",
      useHint: false,
    });

    const lockedState = await getRoomState(room.roomCode, room.sessionKey);
    expect(lockedState.currentRound?.status).toBe("locked");

    const revealedState = await revealRound(room.roomCode, room.sessionKey);
    expect(revealedState.revealedRound?.results).toHaveLength(2);
    expect(revealedState.leaderboard[0]?.displayName).toBe("Ava");
  });

  it("explains missing seed coverage when a category has no questions for a player's age band", async () => {
    const store = getStore();
    store.categories = [
      {
        id: "category_custom",
        slug: "custom",
        name: "Custom Category",
        icon: "📚",
        active: true,
      },
    ];
    store.questions = [
      {
        id: "question_custom_1",
        categoryId: "category_custom",
        title: "Custom Q1",
        prompt: "Custom prompt",
        modality: "text",
        difficulty: "medium",
        ageBandMin: "9_to_11",
        ageBandMax: "9_to_11",
        answerType: "multiple_choice",
        options: {
          A: "A",
          B: "B",
          C: "C",
          D: "D",
        },
        correctAnswer: "A",
        explanation: "Because",
        mediaUrl: null,
        mediaAltText: null,
        estimatedSeconds: 15,
        active: true,
        tags: [],
        createdAt: "2026-04-03T00:00:00.000Z",
        updatedAt: "2026-04-03T00:00:00.000Z",
      },
    ];

    const room = await createRoom({
      hostName: "Morgan",
      config: {
        numberOfRounds: 5,
        answerTimeLimitSeconds: 15,
        categoryMode: "host_selects_each_round",
        enabledCategoryIds: ["category_custom"],
        fastestCorrectBonus: true,
        confidenceWager: true,
        teamBonus: false,
        hints: true,
      },
    });

    await joinRoom(
      room.roomCode,
      {
        displayName: "Siya",
        ageBand: "6_to_8",
        difficultyMode: "adaptive",
        avatarColor: "cyan",
      },
      null,
    );

    await startGame(room.roomCode, room.sessionKey);

    await expect(startRound(room.roomCode, room.sessionKey, "category_custom")).rejects.toThrow(
      "Custom Category has no seeded questions for 6 to 8 years.",
    );
  });

  it("scores by the served question difficulty when assignment falls back", async () => {
    const store = getStore();
    store.categories = [
      {
        id: "category_fallback",
        slug: "fallback",
        name: "Fallback Category",
        icon: "🧪",
        active: true,
      },
    ];
    store.questions = [
      {
        id: "question_fallback_hard",
        categoryId: "category_fallback",
        title: "Fallback Hard Question",
        prompt: "Fallback prompt",
        modality: "text",
        difficulty: "hard",
        ageBandMin: "6_to_8",
        ageBandMax: "6_to_8",
        answerType: "multiple_choice",
        options: {
          A: "A",
          B: "B",
          C: "C",
          D: "D",
        },
        correctAnswer: "A",
        explanation: "Because",
        mediaUrl: null,
        mediaAltText: null,
        estimatedSeconds: 15,
        active: true,
        tags: [],
        createdAt: "2026-04-03T00:00:00.000Z",
        updatedAt: "2026-04-03T00:00:00.000Z",
      },
    ];

    const room = await createRoom({
      hostName: "Morgan",
      config: {
        numberOfRounds: 5,
        answerTimeLimitSeconds: 15,
        categoryMode: "host_selects_each_round",
        enabledCategoryIds: ["category_fallback"],
        fastestCorrectBonus: false,
        confidenceWager: false,
        teamBonus: false,
        hints: false,
      },
    });

    const player = await joinRoom(
      room.roomCode,
      {
        displayName: "Ava",
        ageBand: "6_to_8",
        difficultyMode: "easy",
        avatarColor: "cyan",
      },
      null,
    );

    await startGame(room.roomCode, room.sessionKey);
    await startRound(room.roomCode, room.sessionKey, "category_fallback");

    const activeRound = getStore().rooms.get(room.roomCode)?.rounds.at(-1);
    const assignment = activeRound?.assignments.find((entry) => entry.gamePlayerId === player.playerId);
    expect(assignment).toBeDefined();
    expect(assignment?.questionSnapshot.difficulty).toBe("hard");
    expect(assignment?.assignedDifficulty).toBe("hard");

    await submitAnswer(room.roomCode, player.sessionKey, {
      assignedQuestionId: assignment!.id,
      answerKey: assignment!.questionSnapshot.correctAnswer,
      confidenceMode: "safe",
      useHint: false,
    });

    const lockedState = await getRoomState(room.roomCode, room.sessionKey);
    expect(lockedState.currentRound?.status).toBe("locked");

    const revealedState = await revealRound(room.roomCode, room.sessionKey);
    const result = revealedState.revealedRound?.results[0];
    expect(result?.assignedDifficulty).toBe("hard");
    expect(result?.pointsAwarded).toBe(3);
  });
});
