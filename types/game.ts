export const ageBands = ["6_to_8", "9_to_11", "12_to_14", "15_plus"] as const;
export type AgeBand = (typeof ageBands)[number];

export const difficultyValues = ["easy", "medium", "hard"] as const;
export type QuestionDifficulty = (typeof difficultyValues)[number];

export type DifficultyMode = QuestionDifficulty | "adaptive";
export type QuestionModality = "text" | "image" | "audio";
export type AnswerType = "multiple_choice" | "single_tap_image" | "true_false";
export type AnswerKey = "A" | "B" | "C" | "D";
export type ConfidenceMode = "safe" | "bold";
export type CategoryMode = "host_selects_each_round" | "random_from_selected_pool";
export type GameRoomStatus = "lobby" | "in_progress" | "finished";
export type RoundStatus = "pending" | "active" | "locked" | "revealed";
export type ViewerRole = "host" | "player" | "spectator";

export interface Category {
  id: string;
  slug: string;
  name: string;
  icon: string;
  active: boolean;
}

export interface Question {
  id: string;
  categoryId: string;
  title: string;
  prompt: string;
  modality: QuestionModality;
  difficulty: QuestionDifficulty;
  ageBandMin: AgeBand;
  ageBandMax: AgeBand;
  answerType: AnswerType;
  options: Partial<Record<AnswerKey, string>>;
  correctAnswer: AnswerKey;
  explanation: string;
  mediaUrl: string | null;
  mediaAltText: string | null;
  estimatedSeconds: number;
  active: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface GameConfig {
  numberOfRounds: 5 | 10 | 15;
  answerTimeLimitSeconds: 10 | 15 | 20;
  categoryMode: CategoryMode;
  enabledCategoryIds: string[];
  fastestCorrectBonus: boolean;
  confidenceWager: boolean;
  teamBonus: boolean;
  hints: boolean;
}

export interface GamePlayer {
  id: string;
  displayName: string;
  ageBand: AgeBand;
  difficultyMode: DifficultyMode;
  avatarColor: string;
  joinedAt: string;
  isConnected: boolean;
  lastSeenAt: string;
  hintUsesRemaining: number;
  totalPoints: number;
  streak: number;
  sessionKey: string;
}

export interface RoundAnswer {
  submittedAnswer: AnswerKey | null;
  isCorrect: boolean;
  responseMs: number | null;
  pointsAwarded: number;
  answeredAt: string | null;
}

export interface AssignedRoundQuestion {
  id: string;
  gamePlayerId: string;
  questionId: string;
  questionSnapshot: Question;
  assignedDifficulty: QuestionDifficulty;
  confidenceMode: ConfidenceMode | null;
  hintUsed: boolean;
  answer: RoundAnswer | null;
}

export interface RoundResult {
  playerId: string;
  displayName: string;
  ageBand: AgeBand;
  submittedAnswer: AnswerKey | null;
  submittedAnswerText: string | null;
  correctAnswer: AnswerKey;
  correctAnswerText: string;
  isCorrect: boolean;
  pointsAwarded: number;
  responseMs: number | null;
  fastestCorrect: boolean;
  confidenceMode: ConfidenceMode | null;
  hintUsed: boolean;
  explanation: string;
  assignedDifficulty: QuestionDifficulty;
  questionTitle: string;
  questionPrompt: string;
}

export interface GameRound {
  id: string;
  gameRoomId: string;
  roundNumber: number;
  categoryId: string;
  status: RoundStatus;
  startedAt: string | null;
  endsAt: string | null;
  lockedAt: string | null;
  revealedAt: string | null;
  assignments: AssignedRoundQuestion[];
  results: RoundResult[];
}

export interface GameRoom {
  id: string;
  roomCode: string;
  hostName: string;
  hostSessionKey: string;
  status: GameRoomStatus;
  config: GameConfig;
  currentRoundNumber: number;
  players: GamePlayer[];
  rounds: GameRound[];
  createdAt: string;
  updatedAt: string;
}

export interface LeaderboardEntry {
  playerId: string;
  displayName: string;
  avatarColor: string;
  totalPoints: number;
  rank: number;
  ageBand: AgeBand;
}

export interface RoomViewer {
  role: ViewerRole;
  playerId: string | null;
  displayName: string;
}

export interface PlayerQuestionView {
  assignedQuestionId: string;
  questionId: string;
  title: string;
  prompt: string;
  modality: QuestionModality;
  answerType: AnswerType;
  mediaUrl: string | null;
  mediaAltText: string | null;
  options: Partial<Record<AnswerKey, string>>;
  submittedAnswer: AnswerKey | null;
  confidenceMode: ConfidenceMode | null;
  hintUsed: boolean;
  hintRemoves: AnswerKey[];
  locked: boolean;
  hintsRemaining: number;
}

export interface CurrentRoundView {
  roundId: string;
  roundNumber: number;
  status: RoundStatus;
  categoryId: string;
  categoryName: string;
  endsAt: string | null;
  answerStats: {
    totalPlayers: number;
    answeredPlayers: number;
  };
}

export interface RevealedRoundView {
  roundId: string;
  roundNumber: number;
  categoryName: string;
  status: RoundStatus;
  results: RoundResult[];
}

export interface RoomStateView {
  room: {
    id: string;
    roomCode: string;
    hostName: string;
    status: GameRoomStatus;
    currentRoundNumber: number;
    config: GameConfig;
    joinUrl: string;
    createdAt: string;
  };
  viewer: RoomViewer;
  categories: Category[];
  players: Array<{
    id: string;
    displayName: string;
    ageBand: AgeBand;
    avatarColor: string;
    isConnected: boolean;
    totalPoints: number;
    streak: number;
    lastRoundStatus: "correct" | "incorrect" | "pending" | "unanswered";
  }>;
  currentRound: CurrentRoundView | null;
  playerQuestion: PlayerQuestionView | null;
  revealedRound: RevealedRoundView | null;
  leaderboard: LeaderboardEntry[];
  finalWinner: LeaderboardEntry | null;
}
