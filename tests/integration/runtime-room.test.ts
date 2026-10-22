import { vi } from "vitest";
import type { GameRoom } from "@/types/game";
import { buildQuickQuestions } from "@/tests/fixtures/age-banded-questions";

const db = vi.hoisted(() => ({ room: null as GameRoom | null, version: 4, conflict: false }));
const category = { id: "math", slug: "math", name: "Math", icon: "", active: true };
vi.mock("@/lib/utils/env", () => ({ env: { USE_MEMORY_STORE: false } }));
vi.mock("@/lib/db/runtime-storage", () => ({
  loadCategoriesFromDatabase: vi.fn(async () => [{ id: "math", slug: "math", name: "Math", icon: "", active: true }]),
  loadQuestionBankFromDatabase: vi.fn(async () => { throw new Error("Room polling must not load the bank"); }),
  loadAllRoomStatesFromDatabase: vi.fn(async () => { throw new Error("Room polling must not enumerate rooms"); }),
  loadRoomStateFromDatabase: vi.fn(async () => ({ room: structuredClone(db.room), version: db.version })),
  updateRoomStateInDatabase: vi.fn(async (room: GameRoom, version: number) => {
    if (db.conflict) { db.conflict = false; db.version += 1; return null; }
    if (version !== db.version) return null;
    db.room = structuredClone(room);
    return ++db.version;
  }),
  insertRoomStateIntoDatabase: vi.fn(),
}));
vi.mock("@/lib/db/convex", () => ({ runConvexMutation: vi.fn(async () => ({ accepted: true })) }));
import { getRoomState, heartbeatRoom, submitAnswer } from "@/lib/game/service";
import { updateRoomStateInDatabase, loadQuestionBankFromDatabase, loadRoomStateFromDatabase } from "@/lib/db/runtime-storage";
import { runConvexMutation } from "@/lib/db/convex";

describe("persistent room path", () => {
  beforeEach(() => {
    vi.clearAllMocks(); db.version = 4; db.conflict = false;
    const now = new Date().toISOString();
    const question = buildQuickQuestions([category])[0];
    db.room = { id: "room", roomCode: "ABC123", hostName: "Host", hostSessionKey: "host-secret", status: "in_progress", currentRoundNumber: 1,
      config: { numberOfRounds: 5, answerTimeLimitSeconds: "auto", categoryMode: "host_selects_each_round", enabledCategoryIds: ["math"], fastestCorrectBonus: false, confidenceWager: false, teamBonus: false, hints: true },
      players: [{ id: "ava", displayName: "Ava", ageBand: "6_to_8", difficultyMode: "adaptive", avatarColor: "cyan", joinedAt: now, isConnected: true, lastSeenAt: now, hintUsesRemaining: 1, totalPoints: 0, streak: 0, sessionKey: "player-secret" }],
      rounds: [{ id: "round", gameRoomId: "room", roundNumber: 1, categoryId: "math", status: "active", startedAt: now, endsAt: new Date(Date.now() + 60_000).toISOString(), lockedAt: null, revealedAt: null,
        assignments: [{ id: "assignment", gamePlayerId: "ava", questionId: question.id, questionSnapshot: question, assignedDifficulty: "easy", confidenceMode: null, hintUsed: false, answer: null }], results: [] }], createdAt: now, updatedAt: now };
  });
  it("polls without reloading questions or rewriting a live room", async () => {
    const state = await getRoomState("ABC123", "player-secret");
    expect(state.revision).toBe(4);
    expect(state.playerQuestion?.hintRemoves).toEqual([]);
    expect(JSON.stringify(state)).not.toContain("host-secret");
    expect(JSON.stringify(state)).not.toContain("correctAnswer");
    expect(loadQuestionBankFromDatabase).not.toHaveBeenCalled();
    expect(updateRoomStateInDatabase).not.toHaveBeenCalled();
  });
  it("persists deadline scoring once, retrying a concurrent update", async () => {
    db.room!.rounds[0].endsAt = new Date(Date.now() - 5000).toISOString();
    db.conflict = true;
    expect((await getRoomState("ABC123", "player-secret")).currentRound?.status).toBe("locked");
    expect(updateRoomStateInDatabase).toHaveBeenCalledTimes(2);
    await getRoomState("ABC123", "player-secret");
    expect(updateRoomStateInDatabase).toHaveBeenCalledTimes(2);
    expect(db.room!.rounds[0].results).toHaveLength(1);
  });
  it("heartbeats through the presence mutation, never a versioned whole-room write", async () => {
    await heartbeatRoom("abc123", "player-secret");
    expect(runConvexMutation).toHaveBeenCalledWith("rooms:touchPresence", { roomCode: "ABC123", sessionKey: "player-secret" });
    expect(updateRoomStateInDatabase).not.toHaveBeenCalled();
    expect(loadRoomStateFromDatabase).not.toHaveBeenCalled();
    await expect(heartbeatRoom("ABC123", null)).rejects.toThrow("Join this room");
  });
  it("submits through the atomic backend mutation, not the whole-room write", async () => {
    const receivedAt = Date.now() - 4000; // the Next route stamped the request before the trip to Convex
    await submitAnswer("ABC123", "player-secret", { assignedQuestionId: "assignment", answerKey: "A" }, receivedAt);
    expect(runConvexMutation).toHaveBeenCalledWith("rooms:submitAnswer", { roomCode: "ABC123", sessionKey: "player-secret", assignedQuestionId: "assignment", answerKey: "A", receivedAt });
    expect(updateRoomStateInDatabase).not.toHaveBeenCalled();
  });
});
