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
});
