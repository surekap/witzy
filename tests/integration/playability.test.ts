import { vi } from "vitest";
import { createRoom, joinRoom, startGame, startRound, submitAnswer, getRoomState, applyRoomHint } from "@/lib/game/service";
import { getStore, resetStore } from "@/lib/game/store";
import { ROUND_PREPARE_MS, SUBMISSION_GRACE_MS } from "@/lib/game/timing";

async function setup() {
  resetStore();
  const category = getStore().categories.find((c) => c.slug === "math")!;
  const room = await createRoom({ hostName: "Host", config: { numberOfRounds: 5, answerTimeLimitSeconds: "auto", questionMode: "quick", equalBasePoints: true, categoryMode: "host_selects_each_round", enabledCategoryIds: [category.id], fastestCorrectBonus: false, confidenceWager: false, teamBonus: false, hints: true } });
  const input = { displayName: "Ava", ageBand: "6_to_8" as const, difficultyMode: "adaptive" as const, avatarColor: "cyan" };
  const player = await joinRoom(room.roomCode, input, null);
  await startGame(room.roomCode, room.sessionKey);
  await startRound(room.roomCode, room.sessionKey, category.id);
  const round = getStore().rooms.get(room.roomCode)!.rounds[0];
  return { room, player, round, assignment: round.assignments[0], input };
}

describe("quick-play lifecycle", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-21T12:00:00Z")); });
  afterEach(() => vi.useRealTimers());
  it("prepares before accepting answers and preserves assignments on reconnect", async () => {
    const { room, player, round, assignment, input } = await setup();
    await expect(submitAnswer(room.roomCode, player.sessionKey, { assignedQuestionId: assignment.id, answerKey: assignment.questionSnapshot.correctAnswer })).rejects.toThrow("about to start");
    const rejoined = await joinRoom(room.roomCode, input, player.sessionKey);
    expect(rejoined.playerId).toBe(player.playerId);
    expect((await getRoomState(room.roomCode, player.sessionKey)).playerQuestion?.options).toEqual(assignment.questionSnapshot.options);
    expect(Date.parse(round.startedAt!) - Date.now()).toBe(ROUND_PREPARE_MS);
  });
  it("accepts transport grace, then returns the same successful result on retry", async () => {
    const { room, player, round, assignment } = await setup();
    vi.setSystemTime(Date.parse(round.endsAt!) + SUBMISSION_GRACE_MS - 1);
    const input = { assignedQuestionId: assignment.id, answerKey: assignment.questionSnapshot.correctAnswer };
    await submitAnswer(room.roomCode, player.sessionKey, input);
    const points = getStore().rooms.get(room.roomCode)!.players[0].totalPoints;
    await submitAnswer(room.roomCode, player.sessionKey, input);
    expect(getStore().rooms.get(room.roomCode)!.players[0].totalPoints).toBe(points);
    expect(points).toBe(2);
  });
  it("rejects after grace and keeps hints secret until consumed", async () => {
    const { room, player, round, assignment } = await setup();
    expect((await getRoomState(room.roomCode, player.sessionKey)).playerQuestion?.hintRemoves).toEqual([]);
    vi.setSystemTime(Date.parse(round.startedAt!));
    const hinted = await applyRoomHint(room.roomCode, player.sessionKey, assignment.id);
    expect(hinted.playerQuestion?.hintRemoves).toHaveLength(2);
    expect(hinted.playerQuestion?.hintsRemaining).toBe(0);
    await applyRoomHint(room.roomCode, player.sessionKey, assignment.id);
    expect(getStore().rooms.get(room.roomCode)!.players[0].hintUsesRemaining).toBe(0);
    vi.setSystemTime(Date.parse(round.endsAt!) + SUBMISSION_GRACE_MS + 1);
    await expect(submitAnswer(room.roomCode, player.sessionKey, { assignedQuestionId: assignment.id, answerKey: assignment.questionSnapshot.correctAnswer })).rejects.toThrow("no longer accepting");
  });
});
