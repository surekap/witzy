import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

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
    await ctx.db.patch(existing._id, {
      room: args.room,
      version: nextVersion,
      updatedAt: args.room.updatedAt,
    });

    return nextVersion;
  },
});
