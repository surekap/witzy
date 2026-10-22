import { vi } from "vitest";
import { getStore, resetStore } from "@/lib/game/store";
import {
  createRoom,
  getCategories,
  getRoomState,
  joinRoom,
  lockRound,
  revealRound,
  startGame,
  startRound,
  submitAnswer,
} from "@/lib/game/service";
import type { AgeBand, GameConfig, Question } from "@/types/game";
import { ROUND_PREPARE_MS } from "@/lib/game/timing";
import { isQuestionAgeCompatible } from "@/lib/questions/assignment";

// Every round opens after a short preparation window, so answer as if it has passed.
const prepared = () => Date.now() + ROUND_PREPARE_MS;

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
    }, prepared());
    await submitAnswer(room.roomCode, secondPlayer.sessionKey, {
      assignedQuestionId: secondAssignment!.id,
      answerKey: "D",
      confidenceMode: "safe",
      useHint: false,
    }, prepared());

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
    }, prepared());

    const lockedState = await getRoomState(room.roomCode, room.sessionKey);
    expect(lockedState.currentRound?.status).toBe("locked");

    const revealedState = await revealRound(room.roomCode, room.sessionKey);
    const result = revealedState.revealedRound?.results[0];
    expect(result?.assignedDifficulty).toBe("hard");
    expect(result?.pointsAwarded).toBe(3);
  });

  it("does not share learning history between unrelated players with the same name", async () => {
    const store = getStore();
    store.categories = [
      {
        id: "category_repeat_guard",
        slug: "repeat-guard",
        name: "Repeat Guard",
        icon: "🧠",
        active: true,
      },
    ];
    store.questions = [
      {
        id: "question_repeat_guard_1",
        categoryId: "category_repeat_guard",
        title: "Repeat Guard Q1",
        prompt: "Prompt 1",
        modality: "text",
        difficulty: "easy",
        ageBandMin: "9_to_11",
        ageBandMax: "9_to_11",
        answerType: "multiple_choice",
        options: { A: "A", B: "B", C: "C", D: "D" },
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
      {
        id: "question_repeat_guard_2",
        categoryId: "category_repeat_guard",
        title: "Repeat Guard Q2",
        prompt: "Prompt 2",
        modality: "text",
        difficulty: "easy",
        ageBandMin: "9_to_11",
        ageBandMax: "9_to_11",
        answerType: "multiple_choice",
        options: { A: "A", B: "B", C: "C", D: "D" },
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

    const firstRoom = await createRoom({
      hostName: "Morgan",
      config: {
        numberOfRounds: 5,
        answerTimeLimitSeconds: 15,
        categoryMode: "host_selects_each_round",
        enabledCategoryIds: ["category_repeat_guard"],
        fastestCorrectBonus: false,
        confidenceWager: false,
        teamBonus: false,
        hints: false,
      },
    });

    const firstSession = await joinRoom(
      firstRoom.roomCode,
      {
        displayName: "Ava",
        ageBand: "9_to_11",
        difficultyMode: "easy",
        avatarColor: "cyan",
      },
      null,
    );

    await startGame(firstRoom.roomCode, firstRoom.sessionKey);
    await startRound(firstRoom.roomCode, firstRoom.sessionKey, "category_repeat_guard");
    const firstAssignment = getStore()
      .rooms.get(firstRoom.roomCode)
      ?.rounds.at(-1)
      ?.assignments.find((entry) => entry.gamePlayerId === firstSession.playerId);

    expect(firstAssignment).toBeDefined();

    await submitAnswer(firstRoom.roomCode, firstSession.sessionKey, {
      assignedQuestionId: firstAssignment!.id,
      answerKey: firstAssignment!.questionSnapshot.correctAnswer,
      confidenceMode: "safe",
      useHint: false,
    }, prepared());

    const secondRoom = await createRoom({
      hostName: "Morgan",
      config: {
        numberOfRounds: 5,
        answerTimeLimitSeconds: 15,
        categoryMode: "host_selects_each_round",
        enabledCategoryIds: ["category_repeat_guard"],
        fastestCorrectBonus: false,
        confidenceWager: false,
        teamBonus: false,
        hints: false,
      },
    });

    const secondSession = await joinRoom(
      secondRoom.roomCode,
      {
        displayName: "Ava",
        ageBand: "9_to_11",
        difficultyMode: "easy",
        avatarColor: "cyan",
      },
      null,
    );

    store.questions = store.questions.filter((question) => question.id === firstAssignment!.questionId);
    await startGame(secondRoom.roomCode, secondRoom.sessionKey);
    await startRound(secondRoom.roomCode, secondRoom.sessionKey, "category_repeat_guard");
    const secondAssignment = getStore()
      .rooms.get(secondRoom.roomCode)
      ?.rounds.at(-1)
      ?.assignments.find((entry) => entry.gamePlayerId === secondSession.playerId);

    expect(secondAssignment).toBeDefined();
    expect(secondAssignment?.questionId).toBe(firstAssignment?.questionId);
  });

  describe("players joining mid-game", () => {
    const profile = (displayName: string, ageBand: AgeBand = "9_to_11") => ({ displayName, ageBand, difficultyMode: "adaptive" as const, avatarColor: "cyan" });
    const config = (overrides: Partial<GameConfig> = {}): GameConfig => ({
      numberOfRounds: 5, answerTimeLimitSeconds: 15, categoryMode: "host_selects_each_round", enabledCategoryIds: [],
      fastestCorrectBonus: true, confidenceWager: false, teamBonus: false, hints: false, ...overrides,
    });

    it("lets a latecomer in without giving them the active round, then includes them from the next", async () => {
      const [first, second] = (await getCategories()).slice(0, 2);
      const room = await createRoom({ hostName: "Morgan", config: config({ enabledCategoryIds: [first.id, second.id] }) });
      const ava = await joinRoom(room.roomCode, profile("Ava"), null);
      await startGame(room.roomCode, room.sessionKey);
      await startRound(room.roomCode, room.sessionKey, first.id);

      const noah = await joinRoom(room.roomCode, profile("Noah", "6_to_8"), null);
      const live = getStore().rooms.get(room.roomCode)!;
      expect(live.rounds[0].assignments.map((assignment) => assignment.gamePlayerId)).toEqual([ava.playerId]);
      const noahView = await getRoomState(room.roomCode, noah.sessionKey);
      expect(noahView.playerQuestion).toBeNull();
      expect(noahView.currentRound?.answerStats).toEqual({ totalPlayers: 1, answeredPlayers: 0 });
      await expect(submitAnswer(room.roomCode, noah.sessionKey, { assignedQuestionId: live.rounds[0].assignments[0].id, answerKey: "A" }, prepared())).rejects.toThrow("isn't assigned to you");

      // Ava alone settles the round: the latecomer neither blocks it nor scores in it, and mixed ages do not cancel the speed bonus.
      const assignment = live.rounds[0].assignments[0];
      await submitAnswer(room.roomCode, ava.sessionKey, { assignedQuestionId: assignment.id, answerKey: assignment.questionSnapshot.correctAnswer }, prepared());
      expect((await getRoomState(room.roomCode, room.sessionKey)).currentRound?.status).toBe("locked");
      const revealed = await revealRound(room.roomCode, room.sessionKey);
      expect(revealed.revealedRound?.results.map((result) => result.playerId)).toEqual([ava.playerId]);
      expect(revealed.revealedRound?.results[0].fastestCorrect).toBe(true);
      expect(revealed.leaderboard.map((entry) => [entry.displayName, entry.totalPoints > 0])).toEqual([["Ava", true], ["Noah", false]]);

      await startRound(room.roomCode, room.sessionKey, second.id);
      expect(live.rounds[1].assignments.map((entry) => entry.gamePlayerId).sort()).toEqual([ava.playerId, noah.playerId].sort());
      expect((await getRoomState(room.roomCode, noah.sessionKey)).playerQuestion).not.toBeNull();
    });

    it("turns away newcomers once the game has finished, and the host's own device", async () => {
      const [category] = await getCategories();
      const room = await createRoom({ hostName: "Morgan", config: config({ enabledCategoryIds: [category.id] }) });
      await joinRoom(room.roomCode, profile("Ava"), null);
      await expect(joinRoom(room.roomCode, profile("Host again"), room.sessionKey)).rejects.toThrow("hosting");
      getStore().rooms.get(room.roomCode)!.status = "finished";
      await expect(joinRoom(room.roomCode, profile("Noah"), null)).rejects.toThrow("finished");
    });
  });

  describe("random category choice", () => {
    const question = (id: string, categoryId: string, ageBand: AgeBand): Question => ({
      id, categoryId, title: id, prompt: id, modality: "text", difficulty: "easy", ageBandMin: ageBand, ageBandMax: ageBand,
      answerType: "multiple_choice", options: { A: "A", B: "B", C: "C", D: "D" }, correctAnswer: "A", explanation: "",
      mediaUrl: null, mediaAltText: null, estimatedSeconds: 15, active: true, tags: [], createdAt: "", updatedAt: "",
    });
    const setup = async (questions: Question[], ageBand: AgeBand = "6_to_8") => {
      const store = getStore();
      store.categories = ["a", "b", "c"].map((id) => ({ id, slug: id, name: id, icon: "", active: true }));
      store.questions = questions;
      const room = await createRoom({ hostName: "Morgan", config: { numberOfRounds: 15, answerTimeLimitSeconds: 15, categoryMode: "random_from_selected_pool", enabledCategoryIds: ["a", "b", "c"], fastestCorrectBonus: false, confidenceWager: false, teamBonus: false, hints: false } });
      const player = await joinRoom(room.roomCode, profile("Ava", ageBand), null);
      await startGame(room.roomCode, room.sessionKey);
      return { room, player, rounds: getStore().rooms.get(room.roomCode)!.rounds };
    };
    const profile = (displayName: string, ageBand: AgeBand) => ({ displayName, ageBand, difficultyMode: "adaptive" as const, avatarColor: "cyan" });
    afterEach(() => vi.restoreAllMocks());

    it("never lands on a category that lacks a question for a player's age band", async () => {
      // Category "a" only has questions for older children, so a 6-8 player must never be given it, whatever the dice say.
      for (const roll of [0, 0.5, 0.99]) {
        vi.spyOn(Math, "random").mockReturnValue(roll);
        const { room, rounds } = await setup([question("a1", "a", "12_to_14"), question("b1", "b", "6_to_8"), question("c1", "c", "6_to_8")]);
        await startRound(room.roomCode, room.sessionKey);
        expect(["b", "c"]).toContain(rounds[0].categoryId);
        vi.restoreAllMocks();
      }
    });

    it("rotates through every category before repeating one, and keeps going once all questions are used", async () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      const { room, rounds } = await setup(["a", "b", "c"].flatMap((id) => [question(`${id}1`, id, "6_to_8"), question(`${id}2`, id, "6_to_8")]));
      for (let round = 0; round < 7; round += 1) {
        await startRound(room.roomCode, room.sessionKey);
        await lockRound(room.roomCode, room.sessionKey);
        await revealRound(room.roomCode, room.sessionKey);
      }
      expect(rounds.slice(0, 3).map((round) => round.categoryId)).toEqual(["a", "b", "c"]);
      expect(rounds).toHaveLength(7);
    });

    it("says so, instead of looping, when no enabled category suits every player", async () => {
      const { room } = await setup([question("a1", "a", "15_plus")]);
      await expect(startRound(room.roomCode, room.sessionKey)).rejects.toThrow("every player's age band");
    });
  });
});
