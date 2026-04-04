import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

const nullableString = v.union(v.string(), v.null());

const settingValidator = v.object({
  key: v.string(),
  stringValue: nullableString,
  updatedAt: v.string(),
});

const userValidator = v.object({
  accountId: v.string(),
  username: v.string(),
  displayName: v.string(),
  passwordHash: nullableString,
  passwordSalt: nullableString,
  createdAt: v.string(),
  lastLoginAt: nullableString,
});

const practiceAttemptValidator = v.object({
  accountId: v.string(),
  questionId: v.string(),
  submittedAnswer: v.string(),
  isCorrect: v.boolean(),
  answeredAt: v.string(),
});

const questionFlagValidator = v.object({
  questionId: v.string(),
  questionTitle: v.string(),
  questionPrompt: v.string(),
  reporterKey: v.string(),
  reporterScope: v.union(v.literal("practice_account"), v.literal("room_player")),
  reporterUserId: nullableString,
  reporterDisplayName: v.string(),
  source: v.union(v.literal("solo_practice"), v.literal("live_room")),
  roomCode: nullableString,
  reportedAt: v.string(),
});

const roomStateValidator = v.object({
  roomCode: v.string(),
  room: v.any(),
  version: v.number(),
  updatedAt: v.string(),
});

export const listSettings = queryGeneric({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query("settings").collect();
    return settings
      .map((setting) => ({
        key: setting.key,
        stringValue: setting.stringValue,
        updatedAt: setting.updatedAt,
      }))
      .sort((left, right) => left.key.localeCompare(right.key));
  },
});

export const listQuestionFlags = queryGeneric({
  args: {},
  handler: async (ctx) => {
    const flags = await ctx.db.query("questionFlags").collect();
    return flags
      .map((flag) => ({
        questionId: flag.questionId,
        questionTitle: flag.questionTitle,
        questionPrompt: flag.questionPrompt,
        reporterKey: flag.reporterKey,
        reporterScope: flag.reporterScope,
        reporterUserId: flag.reporterUserId,
        reporterDisplayName: flag.reporterDisplayName,
        source: flag.source,
        roomCode: flag.roomCode,
        reportedAt: flag.reportedAt,
      }))
      .sort(
        (left, right) =>
          new Date(left.reportedAt).getTime() - new Date(right.reportedAt).getTime() ||
          left.questionId.localeCompare(right.questionId) ||
          left.reporterKey.localeCompare(right.reporterKey),
      );
  },
});

export const seedSettingsBatch = mutationGeneric({
  args: {
    settings: v.array(settingValidator),
  },
  handler: async (ctx, args) => {
    for (const setting of args.settings) {
      const existing = await ctx.db
        .query("settings")
        .withIndex("by_key", (query) => query.eq("key", setting.key))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          stringValue: setting.stringValue,
          updatedAt: setting.updatedAt,
        });
        continue;
      }

      await ctx.db.insert("settings", setting);
    }

    return { insertedCount: args.settings.length };
  },
});

export const seedUsersBatch = mutationGeneric({
  args: {
    users: v.array(userValidator),
  },
  handler: async (ctx, args) => {
    for (const user of args.users) {
      const existing = await ctx.db
        .query("users")
        .withIndex("by_account_id", (query) => query.eq("accountId", user.accountId))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          username: user.username,
          usernameLower: user.username.trim().toLowerCase(),
          displayName: user.displayName,
          passwordHash: user.passwordHash,
          passwordSalt: user.passwordSalt,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt,
        });
        continue;
      }

      await ctx.db.insert("users", {
        accountId: user.accountId,
        username: user.username,
        usernameLower: user.username.trim().toLowerCase(),
        displayName: user.displayName,
        passwordHash: user.passwordHash,
        passwordSalt: user.passwordSalt,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      });
    }

    return { insertedCount: args.users.length };
  },
});

export const seedPracticeAttemptsBatch = mutationGeneric({
  args: {
    attempts: v.array(practiceAttemptValidator),
  },
  handler: async (ctx, args) => {
    for (const attempt of args.attempts) {
      await ctx.db.insert("practiceAttempts", attempt);
    }

    return { insertedCount: args.attempts.length };
  },
});

export const seedQuestionFlagsBatch = mutationGeneric({
  args: {
    flags: v.array(questionFlagValidator),
  },
  handler: async (ctx, args) => {
    for (const flag of args.flags) {
      await ctx.db.insert("questionFlags", flag);
    }

    return { insertedCount: args.flags.length };
  },
});

export const seedRoomsBatch = mutationGeneric({
  args: {
    rooms: v.array(roomStateValidator),
  },
  handler: async (ctx, args) => {
    for (const roomState of args.rooms) {
      const existing = await ctx.db
        .query("rooms")
        .withIndex("by_room_code", (query) => query.eq("roomCode", roomState.roomCode))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          room: roomState.room,
          version: roomState.version,
          updatedAt: roomState.updatedAt,
        });
        continue;
      }

      await ctx.db.insert("rooms", roomState);
    }

    return { insertedCount: args.rooms.length };
  },
});
