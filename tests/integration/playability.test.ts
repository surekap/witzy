import { vi } from "vitest";
import * as convexRooms from "@/convex/rooms";
import { createRoom, joinRoom, startGame, startRound, submitAnswer, getRoomState, applyRoomHint, heartbeatRoom } from "@/lib/game/service";
import { getStore, resetStore } from "@/lib/game/store";
import { MAX_RELAY_MS, PRESENCE_TIMEOUT_MS, ROUND_PREPARE_MS, SUBMISSION_GRACE_MS } from "@/lib/game/timing";
import type { GameConfig, GameRoom } from "@/types/game";

// Runs a Convex function's handler against a one-document fake database.
function convexRoom(room: GameRoom, version = 7) {
  const doc = { _id: "doc", room: structuredClone(room), version, updatedAt: room.updatedAt };
  const patches: Array<Record<string, unknown>> = [];
  const ctx = {
    db: {
      query: () => ({ withIndex: () => ({ unique: async () => doc }) }),
      patch: async (_id: string, fields: Record<string, unknown>) => { patches.push(fields); Object.assign(doc, fields); },
    },
  };
  const call = (fn: unknown, args: Record<string, unknown>) => (fn as { _handler: (ctx: unknown, args: unknown) => Promise<unknown> })._handler(ctx, args);
  return { doc, patches, call };
}

async function setup(config: Partial<GameConfig> = {}) {
  resetStore();
  const category = getStore().categories.find((c) => c.slug === "math")!;
  const room = await createRoom({ hostName: "Host", config: { numberOfRounds: 5, answerTimeLimitSeconds: "auto", equalBasePoints: true, categoryMode: "host_selects_each_round", enabledCategoryIds: [category.id], fastestCorrectBonus: false, confidenceWager: false, teamBonus: false, hints: true, ...config } });
  const input = { displayName: "Ava", ageBand: "6_to_8" as const, difficultyMode: "adaptive" as const, avatarColor: "cyan" };
  const player = await joinRoom(room.roomCode, input, null);
  await startGame(room.roomCode, room.sessionKey);
  await startRound(room.roomCode, room.sessionKey, category.id);
  const round = getStore().rooms.get(room.roomCode)!.rounds[0];
  return { room, player, round, assignment: round.assignments[0], input };
}

describe("single-pool game lifecycle", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-21T12:00:00Z")); });
  afterEach(() => vi.useRealTimers());
  it("uses the original stored pool even when an existing room has a legacy mode", async () => {
    const { assignment } = await setup();
    expect(getStore().questions.some((question) => question.id === assignment.questionId)).toBe(true);
    expect(assignment.questionId).not.toMatch(/^quick-v1-/);
  });
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
  it("gives fixed timers the same preparation window", async () => {
    const { room, player, round, assignment } = await setup({ answerTimeLimitSeconds: 30 });
    expect(Date.parse(round.startedAt!) - Date.now()).toBe(ROUND_PREPARE_MS);
    expect(Date.parse(round.endsAt!) - Date.parse(round.startedAt!)).toBe(30_000);
    await expect(submitAnswer(room.roomCode, player.sessionKey, { assignedQuestionId: assignment.id, answerKey: assignment.questionSnapshot.correctAnswer })).rejects.toThrow("about to start");
  });
  it("judges the deadline on the web server's receipt time, within a sanity bound on the backend clock", async () => {
    const { room, player, round, assignment } = await setup();
    const deadline = Date.parse(round.endsAt!) + SUBMISSION_GRACE_MS;
    const input = { roomCode: room.roomCode, sessionKey: player.sessionKey, assignedQuestionId: assignment.id, answerKey: assignment.questionSnapshot.correctAnswer };
    const live = getStore().rooms.get(room.roomCode)!;

    // Received in time, but the hop to Convex (cold start) ran well past the deadline: still the child's answer.
    vi.setSystemTime(deadline + 4000);
    const slowRelay = convexRoom(live);
    await slowRelay.call(convexRooms.submitAnswer, { ...input, receivedAt: deadline - 200 });
    expect(slowRelay.doc.room.rounds[0].assignments[0].answer?.isCorrect).toBe(true);
    expect(slowRelay.doc.version).toBe(8);

    // Received after the deadline: late, however quickly it was relayed.
    const late = convexRoom(live);
    await expect(late.call(convexRooms.submitAnswer, { ...input, receivedAt: deadline + 1 })).rejects.toThrow("no longer accepting");

    // Received in time but relayed after the sanity bound: refused.
    vi.setSystemTime(deadline + MAX_RELAY_MS + 1);
    const stale = convexRoom(live);
    await expect(stale.call(convexRooms.submitAnswer, { ...input, receivedAt: deadline - 200 })).rejects.toThrow("no longer accepting");

    // Builds that predate receivedAt are judged on the backend clock.
    vi.setSystemTime(deadline + 1);
    await expect(convexRoom(live).call(convexRooms.submitAnswer, input)).rejects.toThrow("no longer accepting");
  });
  it("records presence without bumping the room version, and treats 45s as connected", async () => {
    const { room, player } = await setup();
    const live = getStore().rooms.get(room.roomCode)!;
    const stored = convexRoom({ ...live, players: live.players.map((entry) => ({ ...entry, isConnected: false, lastSeenAt: "2026-10-21T11:00:00.000Z" })) });
    await stored.call(convexRooms.touchPresence, { roomCode: room.roomCode, sessionKey: player.sessionKey });
    expect(stored.patches).toHaveLength(1);
    expect(Object.keys(stored.patches[0])).toEqual(["room"]);
    expect(stored.doc.version).toBe(7);
    expect(stored.doc.room.players[0]).toMatchObject({ isConnected: true, lastSeenAt: new Date().toISOString() });
    await expect(stored.call(convexRooms.touchPresence, { roomCode: room.roomCode, sessionKey: "someone-else" })).rejects.toThrow("Join this room");

    const online = async () => (await getRoomState(room.roomCode, player.sessionKey)).players[0].isConnected;
    vi.setSystemTime(Date.now() + PRESENCE_TIMEOUT_MS - 1000);
    expect(await online()).toBe(true);
    vi.setSystemTime(Date.now() + 2000);
    expect(await online()).toBe(false);
    await heartbeatRoom(room.roomCode, player.sessionKey);
    expect(await online()).toBe(true);
  });
  it("offers hints only on four-choice questions", async () => {
    const { room, player, round, assignment } = await setup();
    vi.setSystemTime(Date.parse(round.startedAt!));
    delete assignment.questionSnapshot.options.C;
    delete assignment.questionSnapshot.options.D;
    await expect(applyRoomHint(room.roomCode, player.sessionKey, assignment.id)).rejects.toThrow("four-choice");
    expect(getStore().rooms.get(room.roomCode)!.players[0].hintUsesRemaining).toBe(1);
    expect(assignment.hintUsed).toBe(false);
  });
});
