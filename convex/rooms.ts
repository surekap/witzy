import { internalMutationGeneric as mutationGeneric, internalQueryGeneric as queryGeneric, queryGeneric as publicQuery } from "convex/server";
import { v } from "convex/values";
import { recordRoomAnswer } from "../lib/game/answer";
import { roundTimingSamples } from "../lib/game/timing";
import type { GameRoom } from "../types/game";

// A separate, read-only bearer capability reveals only a revision number. Never
// expose the host/player action credential to the browser subscription client.
export const watchRevision = publicQuery({
  args: { roomCode: v.string(), token: v.string() },
  handler: async (ctx, { roomCode, token }) => {
    const stored = await ctx.db.query("rooms").withIndex("by_room_code", (q) => q.eq("roomCode", roomCode)).unique();
    const room = stored?.room as GameRoom | undefined;
    if (!token || !room || (room.hostViewToken !== token && !room.players.some((player) => player.viewToken === token))) {
      throw new Error("Invalid room subscription.");
    }
    return stored!.version;
  },
});

export const getRoomState = queryGeneric({
  args: {
    roomCode: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.query("rooms").withIndex("by_room_code", (query) => query.eq("roomCode", args.roomCode)).unique();

    if (!room) {
      return null;
    }

    return {
      room: room.room,
      version: room.version,
    };
  },
});

export const listRoomStates = queryGeneric({
  args: {},
  handler: async (ctx) => {
    const rooms = await ctx.db.query("rooms").collect();

    return rooms
      .map((entry) => ({
        roomCode: entry.roomCode,
        room: entry.room,
        version: entry.version,
        updatedAt: entry.updatedAt,
      }))
      .sort(
        (left, right) =>
          new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime() ||
          left.roomCode.localeCompare(right.roomCode),
      );
  },
});

export const insertRoomState = mutationGeneric({
  args: {
    room: v.any(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("rooms").withIndex("by_room_code", (query) => query.eq("roomCode", args.room.roomCode)).unique();

    if (existing) {
      throw new Error("duplicate room code");
    }

    await ctx.db.insert("rooms", {
      roomCode: args.room.roomCode,
      room: args.room,
      version: 0,
      updatedAt: args.room.updatedAt,
    });

    return { version: 0 };
  },
});

export const updateRoomState = mutationGeneric({
  args: {
    room: v.any(),
    expectedVersion: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("rooms").withIndex("by_room_code", (query) => query.eq("roomCode", args.room.roomCode)).unique();

    if (!existing || existing.version !== args.expectedVersion) {
      return null;
    }

    const nextVersion = existing.version + 1;
    const previous = existing.room as GameRoom;
    const updated = args.room as GameRoom;
    const round = updated.rounds.at(-1);
    if (round?.status === "locked" && previous.rounds.at(-1)?.status === "active") {
      for (const sample of roundTimingSamples(updated, round)) await ctx.db.insert("timingObservations", { ...sample, createdAt: Date.now() });
    }
    await ctx.db.patch(existing._id, {
      room: args.room,
      version: nextVersion,
      updatedAt: args.room.updatedAt,
    });

    return nextVersion;
  },
});

export const listTimingObservations = queryGeneric({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 90 * 24 * 60 * 60_000;
    const rows = await ctx.db.query("timingObservations").withIndex("by_created_at", (q) => q.gte("createdAt", cutoff)).order("desc").take(2000);
    return rows.map(({ ageBand, difficulty, words, seconds, timedOut }) => ({ ageBand, difficulty, words, seconds, timedOut }));
  },
});

// Presence is deliberately outside the room's compare-and-swap: it patches one player in place and
// leaves `version` alone, so heartbeats neither wake every subscriber nor make host actions retry.
export const touchPresence = mutationGeneric({
  args: { roomCode: v.string(), sessionKey: v.string() },
  handler: async (ctx, args) => {
    const stored = await ctx.db.query("rooms").withIndex("by_room_code", (q) => q.eq("roomCode", args.roomCode)).unique();
    const room = stored?.room as GameRoom | undefined;
    const player = room?.players.find((entry) => entry.sessionKey === args.sessionKey);
    if (!stored || !room || !player) throw new Error("Join this room first.");
    player.lastSeenAt = new Date().toISOString();
    player.isConnected = true;
    await ctx.db.patch(stored._id, { room });
    return { ok: true };
  },
});

export const submitAnswer = mutationGeneric({
  args: {
    roomCode: v.string(), sessionKey: v.string(), assignedQuestionId: v.string(),
    answerKey: v.union(v.literal("A"), v.literal("B"), v.literal("C"), v.literal("D")),
    confidenceMode: v.optional(v.union(v.literal("safe"), v.literal("bold"))), useHint: v.optional(v.boolean()),
    // When the web server received the request; absent from builds that predate it.
    receivedAt: v.optional(v.number()),
  },
  handler: async (ctx, { receivedAt, ...args }) => {
    const now = Date.now();
    const stored = await ctx.db.query("rooms").withIndex("by_room_code", (q) => q.eq("roomCode", args.roomCode)).unique();
    if (!stored) throw new Error("Room not found.");
    const room = stored.room as GameRoom;
    recordRoomAnswer(room, args.sessionKey, args, receivedAt ?? now, now);
    await ctx.db.patch(stored._id, { room, version: stored.version + 1, updatedAt: room.updatedAt });
    return { accepted: true };
  },
});
