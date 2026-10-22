import {
  assignQuestionForPlayer,
  isQuestionAgeCompatible,
  resolvePlayerDifficulty,
} from "@/lib/questions/assignment";
import {
  insertRoomStateIntoDatabase,
  loadAllRoomStatesFromDatabase,
  loadQuestionBankFromDatabase,
  loadCategoriesFromDatabase,
  loadRoomStateFromDatabase,
  updateRoomStateInDatabase,
} from "@/lib/db/runtime-storage";
import { recordQuestionFlag } from "@/lib/question-flags/service";
import { scoreRoundAnswers } from "@/lib/scoring/score-round";
import { getStore } from "@/lib/game/store";
import { runConvexMutation, runConvexQuery } from "@/lib/db/convex";
import { recordRoomAnswer } from "@/lib/game/answer";
import { shuffleQuestionOptions } from "@/lib/questions/shuffle";
import { PRESENCE_TIMEOUT_MS, ROUND_PREPARE_MS, SUBMISSION_GRACE_MS, roundDurationSeconds, roundTimingSamples, type TimingSample } from "@/lib/game/timing";
import { env } from "@/lib/utils/env";
import { createId, createRoomCode, createSessionKey } from "@/lib/utils/ids";
import type {
  AgeBand,
  AnswerKey,
  Category,
  ConfidenceMode,
  GameConfig,
  GamePlayer,
  GameRoom,
  GameRound,
  LeaderboardEntry,
  Question,
  RevealedRoundView,
  RoomStateView,
  RoundResult,
  RoomViewer,
} from "@/types/game";

export class GameError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "GameError";
  }
}

function getCategoryById(categoryId: string) {
  return getStore().categories.find((category) => category.id === categoryId) ??
    [...getStore().rooms.values()].flatMap((room) => room.categorySnapshots ?? []).find((category) => category.id === categoryId) ?? null;
}

function getRoomOrThrow(roomCode: string) {
  const room = getStore().rooms.get(roomCode.toUpperCase());
  if (!room) {
    throw new GameError("That room code doesn't exist yet.", 404);
  }

  return room;
}

function getCurrentRound(room: GameRoom) {
  return room.rounds.at(-1) ?? null;
}

function touchPlayer(player: GamePlayer) {
  const now = new Date().toISOString();
  player.lastSeenAt = now;
  player.isConnected = true;
}

function refreshPresence(room: GameRoom) {
  const cutoff = Date.now() - PRESENCE_TIMEOUT_MS;
  for (const player of room.players) {
    player.isConnected = new Date(player.lastSeenAt).getTime() >= cutoff;
  }
}

function resolveViewer(room: GameRoom, sessionKey: string | null): RoomViewer {
  if (sessionKey && sessionKey === room.hostSessionKey) {
    return {
      role: "host",
      playerId: null,
      displayName: room.hostName,
    };
  }

  if (sessionKey) {
    const player = room.players.find((entry) => entry.sessionKey === sessionKey);
    if (player) {
      return {
        role: "player",
        playerId: player.id,
        displayName: player.displayName,
      };
    }
  }

  return {
    role: "spectator",
    playerId: null,
    displayName: "Guest",
  };
}

function sortLeaderboard(players: GamePlayer[]): LeaderboardEntry[] {
  return [...players]
    .sort((left, right) => {
      if (right.totalPoints !== left.totalPoints) {
        return right.totalPoints - left.totalPoints;
      }

      return new Date(left.joinedAt).getTime() - new Date(right.joinedAt).getTime();
    })
    .map((player, index) => ({
      playerId: player.id,
      displayName: player.displayName,
      avatarColor: player.avatarColor,
      totalPoints: player.totalPoints,
      rank: index + 1,
      ageBand: player.ageBand,
    }));
}

function updatePlayerStreak(player: GamePlayer, isCorrect: boolean) {
  if (isCorrect) {
    player.streak = player.streak >= 0 ? player.streak + 1 : 1;
  } else {
    player.streak = player.streak <= 0 ? player.streak - 1 : -1;
  }
}

function chooseCategory(room: GameRoom, questions: Question[], usedQuestionIds: Set<string>, requestedCategoryId?: string) {
  if (requestedCategoryId) {
    if (!room.config.enabledCategoryIds.includes(requestedCategoryId)) {
      throw new GameError("That category is not enabled for this game.", 400);
    }

    return requestedCategoryId;
  }

  // Prefer a category not yet played whose unused questions cover every player's age band, then any with unused
  // questions, then any playable with repeats. Random within a tier, so a retry can never meet the same dead end.
  const unused = questions.filter((question) => !usedQuestionIds.has(question.id));
  const played = new Set(room.rounds.map((round) => round.categoryId));
  const covers = (pool: Question[]) => (categoryId: string) =>
    getMissingAgeBandsForCategory({ categoryId, players: room.players, questions: pool }).length === 0;
  const enabled = room.config.enabledCategoryIds;
  const choices = [enabled.filter((id) => !played.has(id)).filter(covers(unused)), enabled.filter(covers(unused)), enabled.filter(covers(questions))]
    .find((tier) => tier.length > 0);
  if (!choices) throw new GameError("No enabled category has questions for every player's age band.", 400);

  return choices[Math.floor(Math.random() * choices.length)];
}

function getAgeBandLabel(ageBand: AgeBand) {
  if (ageBand === "6_to_8") {
    return "6 to 8 years";
  }

  if (ageBand === "9_to_11") {
    return "9 to 11 years";
  }

  if (ageBand === "12_to_14") {
    return "12 to 14 years";
  }

  return "15+ years";
}

function getMissingAgeBandsForCategory(params: {
  categoryId: string;
  players: GamePlayer[];
  questions: Question[];
}) {
  const missingAgeBands = new Set<AgeBand>();

  for (const player of params.players) {
    const hasQuestionForAgeBand = params.questions.some(
      (question) =>
        question.categoryId === params.categoryId &&
        question.active &&
        isQuestionAgeCompatible(question, player.ageBand),
    );

    if (!hasQuestionForAgeBand) {
      missingAgeBands.add(player.ageBand);
    }
  }

  return [...missingAgeBands].sort((left, right) => {
    const order: AgeBand[] = ["6_to_8", "9_to_11", "12_to_14", "15_plus"];
    return order.indexOf(left) - order.indexOf(right);
  });
}

function ensureHost(room: GameRoom, sessionKey: string | null) {
  if (!sessionKey || sessionKey !== room.hostSessionKey) {
    throw new GameError("Only the host can do that.", 403);
  }
}

function getPlayerBySession(room: GameRoom, sessionKey: string | null) {
  if (!sessionKey) {
    throw new GameError("Join the room before answering questions.", 401);
  }

  const player = room.players.find((entry) => entry.sessionKey === sessionKey);
  if (!player) {
    throw new GameError("Your player session could not be found. Please rejoin the room.", 401);
  }

  touchPlayer(player);
  return player;
}

function buildPlayerStatus(room: GameRoom, playerId: string) {
  const currentRound = getCurrentRound(room);
  if (!currentRound) {
    return "pending" as const;
  }

  const assignment = currentRound.assignments.find((entry) => entry.gamePlayerId === playerId);
  if (!assignment) {
    return "pending" as const;
  }

  if (currentRound.status === "revealed" && assignment.answer) {
    return assignment.answer.isCorrect ? "correct" : "incorrect";
  }

  if (assignment.answer) {
    return "pending" as const;
  }

  return currentRound.status === "active" ? "unanswered" : "pending";
}

function buildRoomView(room: GameRoom, viewer: RoomViewer): RoomStateView {
  refreshPresence(room);
  const categories = getStore().categories.filter((category) => room.config.enabledCategoryIds.includes(category.id));
  const currentRound = getCurrentRound(room);
  const leaderboard = sortLeaderboard(room.players);
  const playerQuestion =
    viewer.role === "player" && viewer.playerId && currentRound
      ? currentRound.assignments.find((entry) => entry.gamePlayerId === viewer.playerId)
      : null;

  const revealedRound = [...room.rounds]
    .reverse()
    .find((round: GameRound) => round.status === "revealed") ?? null;
  const currentCategory = currentRound ? getCategoryById(currentRound.categoryId) : null;
  const winner = room.status === "finished" ? leaderboard[0] ?? null : null;

  return {
    serverNow: Date.now(),
    ...(viewer.role === "host" && room.hostViewToken ? { subscriptionToken: room.hostViewToken } : {}),
    ...(viewer.role === "player" && room.players.find((player) => player.id === viewer.playerId)?.viewToken
      ? { subscriptionToken: room.players.find((player) => player.id === viewer.playerId)!.viewToken } : {}),
    room: {
      id: room.id,
      roomCode: room.roomCode,
      hostName: room.hostName,
      status: room.status,
      currentRoundNumber: room.currentRoundNumber,
      config: room.config,
      createdAt: room.createdAt,
    },
    viewer,
    categories,
    players: room.players.map((player) => ({
      id: player.id,
      displayName: player.displayName,
      ageBand: player.ageBand,
      avatarColor: player.avatarColor,
      isConnected: player.isConnected,
      totalPoints: player.totalPoints,
      streak: player.streak,
      lastRoundStatus: buildPlayerStatus(room, player.id),
    })),
    currentRound:
      currentRound && currentCategory
        ? {
            roundId: currentRound.id,
            roundNumber: currentRound.roundNumber,
            status: currentRound.status,
            categoryId: currentRound.categoryId,
            categoryName: currentCategory.name,
            endsAt: currentRound.endsAt,
            startedAt: currentRound.startedAt,
            answerStats: {
              totalPlayers: currentRound.assignments.length,
              answeredPlayers: currentRound.assignments.filter((entry) => entry.answer !== null).length,
            },
          }
        : null,
    playerQuestion:
      playerQuestion && viewer.role === "player"
        ? {
            assignedQuestionId: playerQuestion.id,
            questionId: playerQuestion.questionId,
            assignedDifficulty: playerQuestion.assignedDifficulty,
            // No title while answering: titles often name the answer, and every extra word slows the round.
            prompt: playerQuestion.questionSnapshot.prompt,
            modality: playerQuestion.questionSnapshot.modality,
            answerType: playerQuestion.questionSnapshot.answerType,
            mediaUrl: playerQuestion.questionSnapshot.mediaUrl,
            mediaAltText: playerQuestion.questionSnapshot.mediaAltText,
            options: playerQuestion.questionSnapshot.options,
            submittedAnswer: playerQuestion.answer?.submittedAnswer ?? null,
            confidenceMode: playerQuestion.confidenceMode,
            hintUsed: playerQuestion.hintUsed,
            hintRemoves: playerQuestion.hintUsed ? (["A", "B", "C", "D"] as const).filter(
              (key) =>
                key !== playerQuestion.questionSnapshot.correctAnswer &&
                playerQuestion.questionSnapshot.options[key],
            ).slice(0, 2) : [],
            locked: playerQuestion.answer !== null || currentRound?.status !== "active",
            hintsRemaining: room.players.find((player) => player.id === viewer.playerId)?.hintUsesRemaining ?? 0,
          }
        : null,
    revealedRound:
      revealedRound && getCategoryById(revealedRound.categoryId)
        ? ({
            roundId: revealedRound.id,
            roundNumber: revealedRound.roundNumber,
            categoryName: getCategoryById(revealedRound.categoryId)?.name ?? "Category",
            status: revealedRound.status,
            results: revealedRound.results,
          } satisfies RevealedRoundView)
        : null,
    leaderboard,
    finalWinner: winner,
  };
}

function scoreRound(room: GameRoom, round: GameRound) {
  if (round.results.length > 0) {
    return;
  }

  const scoredAnswers = scoreRoundAnswers(
    round.assignments.map((assignment) => ({
      playerId: assignment.gamePlayerId,
      displayName:
        room.players.find((player) => player.id === assignment.gamePlayerId)?.displayName ?? "Player",
      difficulty: assignment.assignedDifficulty,
      isCorrect: assignment.answer?.isCorrect ?? false,
      responseMs: assignment.answer?.responseMs ?? null,
      confidenceMode: assignment.confidenceMode,
      hintUsed: assignment.hintUsed,
    })),
    {
      // Mixed ages are judged among the players actually in this round, not one who joined during it.
      fastestCorrectBonus: room.config.fastestCorrectBonus &&
        new Set(round.assignments.map((assignment) => room.players.find((player) => player.id === assignment.gamePlayerId)?.ageBand)).size === 1,
      teamBonus: room.config.teamBonus,
      equalBasePoints: room.config.equalBasePoints,
    },
  );

  round.results = scoredAnswers.map<RoundResult>((scoreEntry) => {
    const assignment = round.assignments.find((entry) => entry.gamePlayerId === scoreEntry.playerId);
    const player = room.players.find((entry) => entry.id === scoreEntry.playerId);

    if (!assignment || !player) {
      throw new GameError("Round scoring failed because a player assignment was missing.", 500);
    }

    if (!assignment.answer) {
      assignment.answer = {
        submittedAnswer: null,
        isCorrect: false,
        responseMs: null,
        pointsAwarded: 0,
        answeredAt: null,
      };
    }

    assignment.answer.pointsAwarded = scoreEntry.pointsAwarded;
    player.totalPoints += scoreEntry.pointsAwarded;
    updatePlayerStreak(player, assignment.answer.isCorrect);

    const submittedAnswerText =
      assignment.answer.submittedAnswer
        ? assignment.questionSnapshot.options[assignment.answer.submittedAnswer] ?? null
        : null;

    return {
      playerId: player.id,
      displayName: player.displayName,
      ageBand: player.ageBand,
      submittedAnswer: assignment.answer.submittedAnswer,
      submittedAnswerText,
      correctAnswer: assignment.questionSnapshot.correctAnswer,
      correctAnswerText:
        assignment.questionSnapshot.options[assignment.questionSnapshot.correctAnswer] ?? "Correct answer",
      isCorrect: assignment.answer.isCorrect,
      pointsAwarded: scoreEntry.pointsAwarded,
      responseMs: assignment.answer.responseMs,
      fastestCorrect: scoreEntry.fastestCorrect,
      confidenceMode: assignment.confidenceMode,
      hintUsed: assignment.hintUsed,
      explanation: assignment.questionSnapshot.explanation,
      assignedDifficulty: assignment.assignedDifficulty,
      questionTitle: assignment.questionSnapshot.title,
      questionPrompt: assignment.questionSnapshot.prompt,
    };
  });
}

function lockCurrentRound(room: GameRoom, triggerTime = new Date().toISOString()) {
  const round = getCurrentRound(room);
  if (!round || round.status !== "active") {
    return round;
  }

  round.status = "locked";
  round.lockedAt = triggerTime;
  scoreRound(room, round);
  room.updatedAt = triggerTime;
  return round;
}

function synchronizeRound(room: GameRoom) {
  const round = getCurrentRound(room);
  if (!round || round.status !== "active" || !round.endsAt) {
    return;
  }

  const hasExpired = Date.now() > new Date(round.endsAt).getTime() + SUBMISSION_GRACE_MS;
  const everyoneAnswered = round.assignments.every((assignment) => assignment.answer !== null);

  if (hasExpired || everyoneAnswered) {
    lockCurrentRound(room);
  }
}

function createRoomInMemory(input: { hostName: string; config: GameConfig }) {
  const store = getStore();

  let roomCode = createRoomCode();
  while (store.rooms.has(roomCode)) {
    roomCode = createRoomCode();
  }

  const timestamp = new Date().toISOString();
  const room: GameRoom = {
    id: createId("room"),
    roomCode,
    hostName: input.hostName.trim(),
    hostSessionKey: createSessionKey(),
    hostViewToken: createSessionKey(),
    categorySnapshots: store.categories.filter((category) => input.config.enabledCategoryIds.includes(category.id)),
    status: "lobby",
    config: input.config,
    currentRoundNumber: 0,
    players: [],
    rounds: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  store.rooms.set(room.roomCode, room);

  return {
    roomCode: room.roomCode,
    sessionKey: room.hostSessionKey,
  };
}

function joinRoomInMemory(
  roomCode: string,
  input: {
    displayName: string;
    ageBand: AgeBand;
    difficultyMode: GamePlayer["difficultyMode"];
    avatarColor: string;
  },
  existingSessionKey: string | null,
) {
  const room = getRoomOrThrow(roomCode);

  if (existingSessionKey && existingSessionKey === room.hostSessionKey) {
    throw new GameError("This device is hosting the room. Open the join link on another device to play.", 409);
  }
  const returningPlayer = room.players.find((player) => existingSessionKey && player.sessionKey === existingSessionKey);
  if (returningPlayer) {
    touchPlayer(returningPlayer);
    return { roomCode: room.roomCode, sessionKey: returningPlayer.sessionKey, playerId: returningPlayer.id };
  }
  // Anyone may join until the game ends; rounds already started keep their assignments, so a latecomer plays from the next one.
  if (room.status === "finished") {
    throw new GameError("This game has already finished.", 409);
  }

  const normalizedName = input.displayName.trim();
  const matchingPlayer = room.players.find(
    (player) => player.displayName.toLowerCase() === normalizedName.toLowerCase(),
  );

  if (matchingPlayer) {
    if (existingSessionKey && matchingPlayer.sessionKey === existingSessionKey) {
      touchPlayer(matchingPlayer);
      return {
        roomCode: room.roomCode,
        sessionKey: matchingPlayer.sessionKey,
        playerId: matchingPlayer.id,
      };
    }

    if (matchingPlayer.isConnected) {
      throw new GameError("Someone is already using that player name in this room.", 409);
    }

    throw new GameError("That name belongs to another player. Please choose a different name.", 409);
  }

  const player: GamePlayer = {
    viewToken: createSessionKey(),
    id: createId("player"),
    displayName: normalizedName,
    ageBand: input.ageBand,
    difficultyMode: input.difficultyMode,
    avatarColor: input.avatarColor,
    joinedAt: new Date().toISOString(),
    isConnected: true,
    lastSeenAt: new Date().toISOString(),
    hintUsesRemaining: 1,
    totalPoints: 0,
    streak: 0,
    sessionKey: createSessionKey(),
  };

  room.players.push(player);
  room.updatedAt = new Date().toISOString();

  return {
    roomCode: room.roomCode,
    sessionKey: player.sessionKey,
    playerId: player.id,
  };
}

function startGameInMemory(roomCode: string, sessionKey: string | null) {
  const room = getRoomOrThrow(roomCode);
  ensureHost(room, sessionKey);
  if (room.status !== "lobby") return buildRoomView(room, resolveViewer(room, sessionKey));

  if (room.players.length === 0) {
    throw new GameError("Invite at least one player before starting the game.", 400);
  }

  room.status = "in_progress";
  room.updatedAt = new Date().toISOString();
  return buildRoomView(room, resolveViewer(room, sessionKey));
}

function startRoundInMemory(roomCode: string, sessionKey: string | null, requestedCategoryId?: string) {
  const room = getRoomOrThrow(roomCode);
  ensureHost(room, sessionKey);
  synchronizeRound(room);

  if (room.status === "lobby") {
    throw new GameError("Start the game before you launch the first round.", 400);
  }

  if (room.status === "finished") {
    throw new GameError("This game has already finished.", 409);
  }

  const existingRound = getCurrentRound(room);
  if (existingRound && existingRound.status !== "revealed") {
    throw new GameError("Finish revealing the current round before starting another one.", 409);
  }

  if (room.currentRoundNumber >= room.config.numberOfRounds) {
    throw new GameError("This game already reached its round limit.", 409);
  }

  const questions = getStore().questions;
  const usedQuestionIds = new Set(
    room.rounds.flatMap((round) => round.assignments.map((assignment) => assignment.questionId)),
  );
  const categoryId = chooseCategory(
    room,
    questions,
    usedQuestionIds,
    room.config.categoryMode === "host_selects_each_round" ? requestedCategoryId : undefined,
  );
  const missingAgeBands = getMissingAgeBandsForCategory({
    categoryId,
    players: room.players,
    questions,
  });
  if (missingAgeBands.length > 0) {
    const categoryName = getCategoryById(categoryId)?.name ?? "That category";
    const missingAgeBandLabels = missingAgeBands.map(getAgeBandLabel).join(", ");
    throw new GameError(
      `${categoryName} has no seeded questions for ${missingAgeBandLabels}. Ask an admin to seed this category for those age bands.`,
      400,
    );
  }

  const assignments = room.players.map((player) => {
    const question = assignQuestionForPlayer({
      questions,
      categoryId,
      ageBand: player.ageBand,
      targetDifficulty: resolvePlayerDifficulty(player),
      usedQuestionIds,
    });

    if (!question) {
      const categoryName = getCategoryById(categoryId)?.name ?? "That category";
      throw new GameError(
        `${categoryName} did not have a valid question for ${player.displayName} (${getAgeBandLabel(
          player.ageBand,
        )}) at the selected difficulty settings.`,
        400,
      );
    }

    usedQuestionIds.add(question.id);

    return {
      id: createId("assigned"),
      gamePlayerId: player.id,
      questionId: question.id,
      questionSnapshot: shuffleQuestionOptions(question),
      assignedDifficulty: question.difficulty,
      confidenceMode: null,
      hintUsed: false,
      answer: null,
    };
  });

  const timingSamples = getStore().timingSamples ?? room.rounds.filter((round) => round.status === "revealed").flatMap((round) => roundTimingSamples(room, round));
  const duration = roundDurationSeconds(assignments.map((assignment) => ({
    question: assignment.questionSnapshot,
    ageBand: room.players.find((player) => player.id === assignment.gamePlayerId)!.ageBand,
  })), room.config, timingSamples);
  const startedAt = new Date(Date.now() + ROUND_PREPARE_MS);
  const endsAt = new Date(startedAt.getTime() + duration * 1000);

  room.currentRoundNumber += 1;
  room.rounds.push({
    id: createId("round"),
    gameRoomId: room.id,
    roundNumber: room.currentRoundNumber,
    categoryId,
    status: "active",
    startedAt: startedAt.toISOString(),
    endsAt: endsAt.toISOString(),
    lockedAt: null,
    revealedAt: null,
    assignments,
    results: [],
  });
  room.updatedAt = new Date().toISOString();

  return buildRoomView(room, resolveViewer(room, sessionKey));
}

function submitAnswerInMemory(
  roomCode: string,
  sessionKey: string | null,
  input: {
    assignedQuestionId: string;
    answerKey: AnswerKey;
    confidenceMode?: ConfidenceMode;
    useHint?: boolean;
  },
  receivedAt = Date.now(),
) {
  const room = getRoomOrThrow(roomCode);
  recordRoomAnswer(room, sessionKey, input, receivedAt);
  synchronizeRound(room);

  return buildRoomView(room, resolveViewer(room, sessionKey));
}

function lockRoundInMemory(roomCode: string, sessionKey: string | null) {
  const room = getRoomOrThrow(roomCode);
  ensureHost(room, sessionKey);
  const round = lockCurrentRound(room);

  if (!round) {
    throw new GameError("There isn't an active round to lock.", 409);
  }

  return buildRoomView(room, resolveViewer(room, sessionKey));
}

function revealRoundInMemory(roomCode: string, sessionKey: string | null) {
  const room = getRoomOrThrow(roomCode);
  ensureHost(room, sessionKey);
  const round = getCurrentRound(room);

  if (!round || (round.status !== "locked" && round.status !== "revealed")) {
    throw new GameError("Lock the round before revealing the answers.", 409);
  }

  round.status = "revealed";
  round.revealedAt = new Date().toISOString();

  if (room.currentRoundNumber >= room.config.numberOfRounds) {
    room.status = "finished";
  }

  room.updatedAt = new Date().toISOString();
  return buildRoomView(room, resolveViewer(room, sessionKey));
}

function getRoomStateInMemory(roomCode: string, sessionKey: string | null) {
  const room = getRoomOrThrow(roomCode);
  synchronizeRound(room);
  const viewer = resolveViewer(room, sessionKey);
  return buildRoomView(room, viewer);
}

function getLeaderboardInMemory(roomCode: string) {
  const room = getRoomOrThrow(roomCode);
  synchronizeRound(room);
  return sortLeaderboard(room.players);
}

async function flagRoomQuestionInMemory(
  roomCode: string,
  sessionKey: string | null,
  input: {
    assignedQuestionId: string;
  },
) {
  const room = getRoomOrThrow(roomCode);
  synchronizeRound(room);
  const player = getPlayerBySession(room, sessionKey);
  const currentRound = getCurrentRound(room);

  if (!currentRound) {
    throw new GameError("There isn't an active question to flag right now.", 404);
  }

  const assignment = currentRound.assignments.find(
    (candidate) =>
      candidate.id === input.assignedQuestionId && candidate.gamePlayerId === player.id,
  );

  if (!assignment) {
    throw new GameError("You can only flag the question assigned to you.", 403);
  }

  const result = await recordQuestionFlag({
    questionId: assignment.questionId,
    questionTitle: assignment.questionSnapshot.title,
    questionPrompt: assignment.questionSnapshot.prompt,
    reporterKey: `room:${room.roomCode}:${player.id}`,
    reporterScope: "room_player",
    reporterUserId: null,
    reporterDisplayName: player.displayName,
    source: "live_room",
    roomCode: room.roomCode,
  });

  return {
    questionId: assignment.questionId,
    alreadyFlagged: result.alreadyFlagged,
    summary: result.summary,
  };
}

function getSoloQuestionInMemory(input: {
  categoryId: string;
  ageBand: AgeBand;
  difficultyMode?: GamePlayer["difficultyMode"];
  askedQuestionIds: string[];
}) {
  const questions = getStore().questions;
  const question = assignQuestionForPlayer({
    questions,
    categoryId: input.categoryId,
    ageBand: input.ageBand,
    targetDifficulty:
      input.difficultyMode && input.difficultyMode !== "adaptive"
        ? input.difficultyMode
        : resolvePlayerDifficulty({
            ageBand: input.ageBand,
            difficultyMode: input.difficultyMode ?? "adaptive",
            streak: 0,
          }),
    usedQuestionIds: new Set(input.askedQuestionIds),
  });

  if (!question) {
    throw new GameError("No solo questions were available for that category.", 404);
  }

  const category = getCategoryById(question.categoryId);
  if (!category) {
    throw new GameError("The question category could not be found.", 500);
  }

  return {
    category,
    question,
  };
}

function getCategoriesInMemory() {
  return [...getStore().categories];
}

const RUNTIME_ROOM_RETRIES = 3;

async function withScratchStore<T>(
  options: {
    roomCode?: string;
    includeAllRooms?: boolean;
    needsQuestions?: boolean;
  },
  callback: () => T,
) {
  const previousStore = globalThis.__kidsQuizStore;
  const { categories, questions } = options.needsQuestions
    ? await loadQuestionBankFromDatabase()
    : { categories: await loadCategoriesFromDatabase(), questions: [] as Question[] };
  const rooms = new Map<string, GameRoom>();
  let version: number | null = null;

  if (options.includeAllRooms) {
    const persistedRooms = await loadAllRoomStatesFromDatabase();
    for (const persistedRoom of persistedRooms) {
      rooms.set(persistedRoom.room.roomCode, persistedRoom.room);
    }

    if (options.roomCode) {
      const targetRoom = persistedRooms.find(
        (persistedRoom) => persistedRoom.roomCode.toUpperCase() === options.roomCode?.toUpperCase(),
      );
      if (!targetRoom) {
        throw new GameError("That room code doesn't exist yet.", 404);
      }

      version = targetRoom.version;
    }
  } else if (options.roomCode) {
    const persistedRoom = await loadRoomStateFromDatabase(options.roomCode);
    if (!persistedRoom) {
      throw new GameError("That room code doesn't exist yet.", 404);
    }

    rooms.set(persistedRoom.room.roomCode, persistedRoom.room);
    version = persistedRoom.version;
  }

  globalThis.__kidsQuizStore = {
    categories,
    questions,
    rooms,
    ...(options.needsQuestions ? { timingSamples: await runConvexQuery<Record<string, never>, TimingSample[]>("rooms:listTimingObservations", {}) } : {}),
  };

  try {
    const result = callback();

    return {
      result,
      rooms,
      version,
    };
  } finally {
    globalThis.__kidsQuizStore = previousStore;
  }
}

async function withPersistedRoom<T>(roomCode: string, callback: () => T, needsQuestions = false) {
  let attempts = 0;

  while (attempts < RUNTIME_ROOM_RETRIES) {
    attempts += 1;

    const { result, rooms, version } = await withScratchStore({ roomCode, needsQuestions }, callback);
    const updatedRoom = rooms.get(roomCode.toUpperCase());

    if (!updatedRoom || version === null) {
      throw new GameError("That room code doesn't exist yet.", 404);
    }

    const nextVersion = await updateRoomStateInDatabase(updatedRoom, version);
    if (nextVersion !== null) {
      if (result && typeof result === "object" && "serverNow" in result) Object.assign(result, { revision: nextVersion });
      return result;
    }
  }

  throw new GameError("That room changed while this action was running. Please try again.", 409);
}

export async function createRoom(input: { hostName: string; config: GameConfig }) {
  if (env.USE_MEMORY_STORE) {
    return createRoomInMemory(input);
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const { result, rooms } = await withScratchStore({}, () => createRoomInMemory(input));
      const createdRoom = rooms.get(result.roomCode);

      if (!createdRoom) {
        throw new GameError("The new room state could not be created.", 500);
      }

      await insertRoomStateIntoDatabase(createdRoom);
      return result;
    } catch (error) {
      if (
        attempt < 4 &&
        error instanceof Error &&
        /duplicate|unique/i.test(error.message)
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new GameError("Couldn't create the room.", 500);
}

export async function joinRoom(
  roomCode: string,
  input: {
    displayName: string;
    ageBand: AgeBand;
    difficultyMode: GamePlayer["difficultyMode"];
    avatarColor: string;
  },
  existingSessionKey: string | null,
) {
  if (env.USE_MEMORY_STORE) {
    return joinRoomInMemory(roomCode, input, existingSessionKey);
  }

  return withPersistedRoom(roomCode, () => joinRoomInMemory(roomCode, input, existingSessionKey));
}

export async function startGame(roomCode: string, sessionKey: string | null) {
  if (env.USE_MEMORY_STORE) {
    return startGameInMemory(roomCode, sessionKey);
  }

  return withPersistedRoom(roomCode, () => startGameInMemory(roomCode, sessionKey));
}

export async function startRound(roomCode: string, sessionKey: string | null, requestedCategoryId?: string) {
  if (env.USE_MEMORY_STORE) {
    return startRoundInMemory(roomCode, sessionKey, requestedCategoryId);
  }

  return withPersistedRoom(roomCode, () =>
    startRoundInMemory(roomCode, sessionKey, requestedCategoryId),
    true,
  );
}

export async function submitAnswer(
  roomCode: string,
  sessionKey: string | null,
  input: {
    assignedQuestionId: string;
    answerKey: AnswerKey;
    confidenceMode?: ConfidenceMode;
    useHint?: boolean;
  },
  receivedAt = Date.now(),
) {
  if (env.USE_MEMORY_STORE) {
    return submitAnswerInMemory(roomCode, sessionKey, input, receivedAt);
  }

  if (!sessionKey) throw new GameError("Join this room before answering.", 403);
  await runConvexMutation("rooms:submitAnswer", { roomCode: roomCode.toUpperCase(), sessionKey, ...input, receivedAt });
  return getRoomState(roomCode, sessionKey);
}

export async function lockRound(roomCode: string, sessionKey: string | null) {
  if (env.USE_MEMORY_STORE) {
    return lockRoundInMemory(roomCode, sessionKey);
  }

  return withPersistedRoom(roomCode, () => lockRoundInMemory(roomCode, sessionKey));
}

export async function applyRoomHint(roomCode: string, sessionKey: string | null, assignedQuestionId: string) {
  const action = () => {
    const room = getRoomOrThrow(roomCode);
    const player = getPlayerBySession(room, sessionKey);
    const round = getCurrentRound(room);
    const assignment = round?.assignments.find((entry) => entry.id === assignedQuestionId && entry.gamePlayerId === player.id);
    if (!assignment || round?.status !== "active" || !round.endsAt || Date.now() >= Date.parse(round.endsAt) || assignment.answer) {
      throw new GameError("Hints are not available for this question now.", 409);
    }
    if (!room.config.hints) throw new GameError("Hints are disabled.", 403);
    // Removing two wrong options from a 2- or 3-option question would reveal the answer.
    if (Object.keys(assignment.questionSnapshot.options).length !== 4) throw new GameError("Hints are only available for four-choice questions.", 409);
    if (!assignment.hintUsed) {
      if (player.hintUsesRemaining <= 0) throw new GameError("You already used your hint.", 409);
      assignment.hintUsed = true;
      player.hintUsesRemaining -= 1;
    }
    return buildRoomView(room, resolveViewer(room, sessionKey));
  };
  return env.USE_MEMORY_STORE ? action() : withPersistedRoom(roomCode, action);
}

export async function heartbeatRoom(roomCode: string, sessionKey: string | null) {
  if (env.USE_MEMORY_STORE) {
    getPlayerBySession(getRoomOrThrow(roomCode), sessionKey);
    return { ok: true };
  }

  // Presence never goes through withPersistedRoom: it must not bump the room version.
  if (!sessionKey) throw new GameError("Join this room first.", 403);
  return runConvexMutation<{ roomCode: string; sessionKey: string }, { ok: true }>("rooms:touchPresence", { roomCode: roomCode.toUpperCase(), sessionKey });
}

export async function revealRound(roomCode: string, sessionKey: string | null) {
  if (env.USE_MEMORY_STORE) {
    return revealRoundInMemory(roomCode, sessionKey);
  }

  return withPersistedRoom(roomCode, () => revealRoundInMemory(roomCode, sessionKey));
}

export async function getRoomState(roomCode: string, sessionKey: string | null) {
  if (env.USE_MEMORY_STORE) {
    return getRoomStateInMemory(roomCode, sessionKey);
  }

  for (let attempt = 0; attempt < RUNTIME_ROOM_RETRIES; attempt += 1) {
    let statusBefore: string | undefined;
    const { result, rooms, version } = await withScratchStore({ roomCode }, () => {
      statusBefore = getCurrentRound(getRoomOrThrow(roomCode))?.status;
      return getRoomStateInMemory(roomCode, sessionKey);
    });
    // Ordinary reads never rewrite room state. Only deadline transitions persist.
    if (statusBefore === result.currentRound?.status) return { ...result, revision: version ?? 0 };
    const nextVersion = await updateRoomStateInDatabase(rooms.get(roomCode.toUpperCase())!, version!);
    if (nextVersion !== null) return { ...result, revision: nextVersion };
  }
  throw new GameError("Room is busy. Please retry.", 409);
}

export async function getLeaderboard(roomCode: string) {
  if (env.USE_MEMORY_STORE) {
    return getLeaderboardInMemory(roomCode);
  }

  return (await getRoomState(roomCode, null)).leaderboard;
}

export async function flagRoomQuestion(
  roomCode: string,
  sessionKey: string | null,
  input: {
    assignedQuestionId: string;
  },
) {
  if (env.USE_MEMORY_STORE) {
    return flagRoomQuestionInMemory(roomCode, sessionKey, input);
  }

  const { result } = await withScratchStore({ roomCode }, () =>
    flagRoomQuestionInMemory(roomCode, sessionKey, input),
  );
  return result;
}

export async function getSoloQuestion(input: {
  categoryId: string;
  ageBand: AgeBand;
  difficultyMode?: GamePlayer["difficultyMode"];
  askedQuestionIds: string[];
}) {
  if (env.USE_MEMORY_STORE) {
    return getSoloQuestionInMemory(input);
  }

  const { result } = await withScratchStore({ needsQuestions: true }, () => getSoloQuestionInMemory(input));
  return result;
}

export async function getCategories() {
  if (env.USE_MEMORY_STORE) {
    return getCategoriesInMemory();
  }

  return loadCategoriesFromDatabase();
}
