import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { getStore, resetStore } from "@/lib/game/store";
import {
  createRoom,
  flagRoomQuestion,
  joinRoom,
  startGame,
  startRound,
} from "@/lib/game/service";
import { getQuestionFlagSummaries } from "@/lib/question-flags/service";
import { resetQuestionFlagStore } from "@/lib/question-flags/store";
import {
  flagPracticeQuestion,
  getSoloPracticeQuestion,
  registerPracticeAccount,
} from "@/lib/practice/service";
import { createPracticeStore } from "@/lib/practice/store";

describe("question flagging", () => {
  let tempDir: string;

  beforeEach(async () => {
    resetStore();
    resetQuestionFlagStore();
    tempDir = await mkdtemp(path.join(os.tmpdir(), "kids-quiz-question-flags-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("counts only unique solo reporters for the same question", async () => {
    const store = createPracticeStore(path.join(tempDir, "practice-store.json"));
    const firstAccount = await registerPracticeAccount(
      { username: "Ava", password: "secret1" },
      store,
    );
    const secondAccount = await registerPracticeAccount(
      { username: "Noah", password: "secret2" },
      store,
    );
    const category = getStore().categories[0];

    const firstQuestion = await getSoloPracticeQuestion(
      firstAccount.id,
      {
        categoryId: category.id,
        ageBand: "9_to_11",
        difficultyMode: "adaptive",
        askedQuestionIds: [],
      },
      store,
    );
    const secondQuestion = await getSoloPracticeQuestion(
      secondAccount.id,
      {
        categoryId: category.id,
        ageBand: "9_to_11",
        difficultyMode: "adaptive",
        askedQuestionIds: [],
      },
      store,
    );

    expect(secondQuestion.question.id).toBe(firstQuestion.question.id);

    const firstFlag = await flagPracticeQuestion(
      firstAccount.id,
      { questionId: firstQuestion.question.id },
      store,
    );
    const duplicateFlag = await flagPracticeQuestion(
      firstAccount.id,
      { questionId: firstQuestion.question.id },
      store,
    );
    const secondFlag = await flagPracticeQuestion(
      secondAccount.id,
      { questionId: secondQuestion.question.id },
      store,
    );

    expect(firstFlag.alreadyFlagged).toBe(false);
    expect(duplicateFlag.alreadyFlagged).toBe(true);
    expect(secondFlag.alreadyFlagged).toBe(false);

    const [summary] = await getQuestionFlagSummaries([firstQuestion.question.id]);

    expect(summary).toMatchObject({
      questionId: firstQuestion.question.id,
      distinctReporterCount: 2,
      practiceAccountFlagCount: 2,
      roomPlayerFlagCount: 0,
    });
  });

  it("only lets a room player flag the question assigned to them", async () => {
    const categories = getStore().categories;
    const room = await createRoom({
      hostName: "Morgan",
      config: {
        numberOfRounds: 5,
        answerTimeLimitSeconds: 15,
        categoryMode: "host_selects_each_round",
        enabledCategoryIds: categories.slice(0, 2).map((category) => category.id),
        fastestCorrectBonus: false,
        confidenceWager: false,
        teamBonus: false,
        hints: false,
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

    const activeRound = getStore().rooms.get(room.roomCode)?.rounds.at(-1);
    const firstAssignment = activeRound?.assignments.find(
      (assignment) => assignment.gamePlayerId === firstPlayer.playerId,
    );

    expect(firstAssignment).toBeDefined();

    const firstFlag = await flagRoomQuestion(room.roomCode, firstPlayer.sessionKey, {
      assignedQuestionId: firstAssignment!.id,
    });

    expect(firstFlag.alreadyFlagged).toBe(false);
    expect(firstFlag.questionId).toBe(firstAssignment!.questionId);

    await expect(
      flagRoomQuestion(room.roomCode, secondPlayer.sessionKey, {
        assignedQuestionId: firstAssignment!.id,
      }),
    ).rejects.toMatchObject({
      message: "You can only flag the question assigned to you.",
      status: 403,
    });

    const [summary] = await getQuestionFlagSummaries([firstAssignment!.questionId]);

    expect(summary).toMatchObject({
      questionId: firstAssignment!.questionId,
      distinctReporterCount: 1,
      practiceAccountFlagCount: 0,
      roomPlayerFlagCount: 1,
    });
  });
});
