import { assignQuestionForPlayer, resolvePlayerDifficulty } from "@/lib/questions/assignment";
import { scoreRoundAnswers } from "@/lib/scoring/score-round";
import { getStore } from "@/lib/game/store";
import { env } from "@/lib/utils/env";
import { createId, createRoomCode, createSessionKey, stableIndex } from "@/lib/utils/ids";
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
  return getStore().categories.find((category) => category.id === categoryId) ?? null;
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
  const cutoff = Date.now() - 10_000;
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
      touchPlayer(player);
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

function chooseCategory(room: GameRoom, requestedCategoryId?: string) {
  if (requestedCategoryId) {
    if (!room.config.enabledCategoryIds.includes(requestedCategoryId)) {
      throw new GameError("That category is not enabled for this game.", 400);
    }

    return requestedCategoryId;
  }

  const enabledCategories = room.config.enabledCategoryIds;
  if (enabledCategories.length === 0) {
    throw new GameError("This room doesn't have any categories enabled.", 400);
  }

  const selectedIndex = stableIndex(`${room.id}:${room.currentRoundNumber + 1}`, enabledCategories.length);
  return enabledCategories[selectedIndex];
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
    room: {
      id: room.id,
      roomCode: room.roomCode,
      hostName: room.hostName,
      status: room.status,
      currentRoundNumber: room.currentRoundNumber,
      config: room.config,
      joinUrl: `${env.NEXT_PUBLIC_APP_URL}/join?room=${room.roomCode}`,
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
            answerStats: {
              totalPlayers: room.players.length,
              answeredPlayers: currentRound.assignments.filter((entry) => entry.answer !== null).length,
            },
          }
        : null,
    playerQuestion:
      playerQuestion && viewer.role === "player"
        ? {
            assignedQuestionId: playerQuestion.id,
            questionId: playerQuestion.questionId,
            title: playerQuestion.questionSnapshot.title,
            prompt: playerQuestion.questionSnapshot.prompt,
            modality: playerQuestion.questionSnapshot.modality,
            answerType: playerQuestion.questionSnapshot.answerType,
            mediaUrl: playerQuestion.questionSnapshot.mediaUrl,
            mediaAltText: playerQuestion.questionSnapshot.mediaAltText,
            options: playerQuestion.questionSnapshot.options,
            submittedAnswer: playerQuestion.answer?.submittedAnswer ?? null,
            confidenceMode: playerQuestion.confidenceMode,
            hintUsed: playerQuestion.hintUsed,
            hintRemoves: (["A", "B", "C", "D"] as const).filter(
              (key) =>
                key !== playerQuestion.questionSnapshot.correctAnswer &&
                playerQuestion.questionSnapshot.options[key],
            ).slice(0, 2),
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
      fastestCorrectBonus: room.config.fastestCorrectBonus,
      teamBonus: room.config.teamBonus,
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

  const hasExpired = Date.now() >= new Date(round.endsAt).getTime();
  const everyoneAnswered = round.assignments.every((assignment) => assignment.answer !== null);

  if (hasExpired || everyoneAnswered) {
    lockCurrentRound(room);
  }
}

export function createRoom(input: { hostName: string; config: GameConfig }) {
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

export function joinRoom(
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

  if (room.status !== "lobby") {
    throw new GameError("This room has already started, so new players can't join right now.", 409);
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

    matchingPlayer.sessionKey = createSessionKey();
    touchPlayer(matchingPlayer);

    return {
      roomCode: room.roomCode,
      sessionKey: matchingPlayer.sessionKey,
      playerId: matchingPlayer.id,
    };
  }

  const player: GamePlayer = {
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

export function startGame(roomCode: string, sessionKey: string | null) {
  const room = getRoomOrThrow(roomCode);
  ensureHost(room, sessionKey);

  if (room.players.length === 0) {
    throw new GameError("Invite at least one player before starting the game.", 400);
  }

  room.status = "in_progress";
  room.updatedAt = new Date().toISOString();
  return buildRoomView(room, resolveViewer(room, sessionKey));
}

export function startRound(roomCode: string, sessionKey: string | null, requestedCategoryId?: string) {
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

  const categoryId =
    room.config.categoryMode === "host_selects_each_round"
      ? chooseCategory(room, requestedCategoryId)
      : chooseCategory(room);

  const usedQuestionIds = new Set(
    room.rounds.flatMap((round) => round.assignments.map((assignment) => assignment.questionId)),
  );

  const questions = getStore().questions;
  const assignments = room.players.map((player) => {
    const targetDifficulty = resolvePlayerDifficulty(player);
    const question = assignQuestionForPlayer({
      questions,
      categoryId,
      ageBand: player.ageBand,
      targetDifficulty,
      usedQuestionIds,
    });

    if (!question) {
      throw new GameError("There were no suitable questions left for one of the players.", 500);
    }

    usedQuestionIds.add(question.id);

    return {
      id: createId("assigned"),
      gamePlayerId: player.id,
      questionId: question.id,
      questionSnapshot: question,
      assignedDifficulty: targetDifficulty,
      confidenceMode: null,
      hintUsed: false,
      answer: null,
    };
  });

  const startedAt = new Date();
  const endsAt = new Date(startedAt.getTime() + room.config.answerTimeLimitSeconds * 1000);

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

export function submitAnswer(
  roomCode: string,
  sessionKey: string | null,
  input: {
    assignedQuestionId: string;
    answerKey: AnswerKey;
    confidenceMode?: ConfidenceMode;
    useHint?: boolean;
  },
) {
  const room = getRoomOrThrow(roomCode);
  const player = getPlayerBySession(room, sessionKey);
  synchronizeRound(room);

  const round = getCurrentRound(room);
  if (!round || round.status !== "active") {
    throw new GameError("That round is no longer accepting answers.", 409);
  }

  const assignment = round.assignments.find((entry) => entry.id === input.assignedQuestionId);
  if (!assignment || assignment.gamePlayerId !== player.id) {
    throw new GameError("That question isn't assigned to you.", 403);
  }

  if (assignment.answer) {
    throw new GameError("You already locked in an answer for this question.", 409);
  }

  if (input.useHint && room.config.hints && player.hintUsesRemaining <= 0) {
    throw new GameError("You already used your hint for this game.", 409);
  }

  if (input.useHint && room.config.hints) {
    assignment.hintUsed = true;
    player.hintUsesRemaining -= 1;
  }

  assignment.confidenceMode = room.config.confidenceWager ? input.confidenceMode ?? "safe" : null;

  const startedTimestamp = round.startedAt ? new Date(round.startedAt).getTime() : Date.now();
  const responseMs = Math.max(0, Date.now() - startedTimestamp);

  assignment.answer = {
    submittedAnswer: input.answerKey,
    isCorrect: input.answerKey === assignment.questionSnapshot.correctAnswer,
    responseMs,
    pointsAwarded: 0,
    answeredAt: new Date().toISOString(),
  };

  room.updatedAt = new Date().toISOString();
  synchronizeRound(room);

  return buildRoomView(room, resolveViewer(room, sessionKey));
}

export function lockRound(roomCode: string, sessionKey: string | null) {
  const room = getRoomOrThrow(roomCode);
  ensureHost(room, sessionKey);
  const round = lockCurrentRound(room);

  if (!round) {
    throw new GameError("There isn't an active round to lock.", 409);
  }

  return buildRoomView(room, resolveViewer(room, sessionKey));
}

export function revealRound(roomCode: string, sessionKey: string | null) {
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

export function getRoomState(roomCode: string, sessionKey: string | null) {
  const room = getRoomOrThrow(roomCode);
  synchronizeRound(room);
  const viewer = resolveViewer(room, sessionKey);
  return buildRoomView(room, viewer);
}

export function getLeaderboard(roomCode: string) {
  const room = getRoomOrThrow(roomCode);
  synchronizeRound(room);
  return sortLeaderboard(room.players);
}

export function getSoloQuestion(input: {
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

export function getCategories() {
  return [...getStore().categories];
}
