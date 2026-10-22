import type { AnswerKey, ConfidenceMode, GameRoom } from "@/types/game";
import { MAX_RELAY_MS, SUBMISSION_GRACE_MS } from "@/lib/game/timing";

export interface AnswerSubmission { assignedQuestionId: string; answerKey: AnswerKey; confidenceMode?: ConfidenceMode; useHint?: boolean }

// Runs in one Convex mutation in production, so simultaneous players never
// overwrite each other's answers and retries cannot double-consume a hint.
// `receivedAt` is when our own server got the request, so the hop to Convex and its
// cold starts are not charged to the child; `now` (the executing clock) only bounds how stale a relay may be.
export function recordRoomAnswer(room: GameRoom, sessionKey: string | null, input: AnswerSubmission, receivedAt: number, now = receivedAt) {
  const player = room.players.find((entry) => entry.sessionKey === sessionKey);
  if (!player) throw new Error("Join this room before answering.");
  const round = room.rounds.find((entry) => entry.assignments.some((assignment) => assignment.id === input.assignedQuestionId));
  const assignment = round?.assignments.find((entry) => entry.id === input.assignedQuestionId && entry.gamePlayerId === player.id);
  if (!round || !assignment) throw new Error("That question isn't assigned to you.");
  if (assignment.answer) {
    if (assignment.answer.submittedAnswer === input.answerKey) return;
    throw new Error("You already locked in an answer for this question.");
  }
  const deadline = round.endsAt ? Date.parse(round.endsAt) + SUBMISSION_GRACE_MS : 0;
  if (round.status !== "active" || !deadline || receivedAt > deadline || now > deadline + MAX_RELAY_MS) throw new Error("That round is no longer accepting answers.");
  if (round.startedAt && receivedAt < Date.parse(round.startedAt)) throw new Error("The round is about to start.");
  if (!assignment.questionSnapshot.options[input.answerKey]) throw new Error("Choose one of the displayed answers.");
  if (input.useHint && room.config.hints && !assignment.hintUsed) {
    if (player.hintUsesRemaining <= 0) throw new Error("You already used your hint.");
    player.hintUsesRemaining -= 1;
    assignment.hintUsed = true;
  }
  assignment.confidenceMode = room.config.confidenceWager ? input.confidenceMode ?? "safe" : null;
  assignment.answer = { submittedAnswer: input.answerKey, isCorrect: input.answerKey === assignment.questionSnapshot.correctAnswer,
    responseMs: Math.max(0, receivedAt - Date.parse(round.startedAt!)), pointsAwarded: 0, answeredAt: new Date(receivedAt).toISOString() };
  player.lastSeenAt = new Date(receivedAt).toISOString();
  player.isConnected = true;
  room.updatedAt = new Date(receivedAt).toISOString();
}
