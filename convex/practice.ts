import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

function mapUser(user: {
  accountId: string;
  username: string;
  displayName: string;
  passwordHash: string | null;
  passwordSalt: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}) {
  return {
    id: user.accountId,
    username: user.username,
    displayName: user.displayName,
    passwordHash: user.passwordHash,
    passwordSalt: user.passwordSalt,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

export const getAccountById = queryGeneric({
  args: {
    accountId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.query("users").withIndex("by_account_id", (query) => query.eq("accountId", args.accountId)).unique();
    return user ? mapUser(user) : null;
  },
});

export const getAccountByUsername = queryGeneric({
  args: {
    username: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.query("users").withIndex("by_username_lower", (query) => query.eq("usernameLower", args.username.trim().toLowerCase())).unique();
    return user ? mapUser(user) : null;
  },
});

export const listAttemptsByAccountId = queryGeneric({
  args: {
    accountId: v.string(),
  },
  handler: async (ctx, args) => {
    const attempts = await ctx.db.query("practiceAttempts").withIndex("by_account_answered_at", (query) => query.eq("accountId", args.accountId)).collect();

    return attempts.map((attempt) => ({
      questionId: attempt.questionId,
      submittedAnswer: attempt.submittedAnswer,
      isCorrect: attempt.isCorrect,
      answeredAt: attempt.answeredAt,
    }));
  },
});

export const listAccounts = queryGeneric({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();

    return users
      .map((user) => mapUser(user))
      .sort((left, right) => left.username.localeCompare(right.username));
  },
});

export const listAllAttempts = queryGeneric({
  args: {},
  handler: async (ctx) => {
    const attempts = await ctx.db.query("practiceAttempts").collect();

    return attempts
      .map((attempt) => ({
        accountId: attempt.accountId,
        questionId: attempt.questionId,
        submittedAnswer: attempt.submittedAnswer,
        isCorrect: attempt.isCorrect,
        answeredAt: attempt.answeredAt,
      }))
      .sort(
        (left, right) =>
          new Date(left.answeredAt).getTime() - new Date(right.answeredAt).getTime() ||
          left.accountId.localeCompare(right.accountId) ||
          left.questionId.localeCompare(right.questionId),
      );
  },
});

export const createAccount = mutationGeneric({
  args: {
    accountId: v.string(),
    username: v.string(),
    displayName: v.string(),
    passwordHash: v.string(),
    passwordSalt: v.string(),
    createdAt: v.string(),
    lastLoginAt: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("users").withIndex("by_username_lower", (query) => query.eq("usernameLower", args.username.trim().toLowerCase())).unique();

    if (existing) {
      throw new Error("That username already exists.");
    }

    await ctx.db.insert("users", {
      accountId: args.accountId,
      username: args.username,
      usernameLower: args.username.trim().toLowerCase(),
      displayName: args.displayName,
      passwordHash: args.passwordHash,
      passwordSalt: args.passwordSalt,
      createdAt: args.createdAt,
      lastLoginAt: args.lastLoginAt,
    });

    return {
      id: args.accountId,
      username: args.username,
      displayName: args.displayName,
      passwordHash: args.passwordHash,
      passwordSalt: args.passwordSalt,
      createdAt: args.createdAt,
      lastLoginAt: args.lastLoginAt,
    };
  },
});

export const updateLastLoginAt = mutationGeneric({
  args: {
    accountId: v.string(),
    lastLoginAt: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.query("users").withIndex("by_account_id", (query) => query.eq("accountId", args.accountId)).unique();

    if (!user) {
      return null;
    }

    await ctx.db.patch(user._id, {
      lastLoginAt: args.lastLoginAt,
    });

    return {
      id: user.accountId,
      username: user.username,
      displayName: user.displayName,
      passwordHash: user.passwordHash,
      passwordSalt: user.passwordSalt,
      createdAt: user.createdAt,
      lastLoginAt: args.lastLoginAt,
    };
  },
});

export const insertPracticeAttempt = mutationGeneric({
  args: {
    accountId: v.string(),
    questionId: v.string(),
    submittedAnswer: v.string(),
    isCorrect: v.boolean(),
    answeredAt: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("practiceAttempts", {
      accountId: args.accountId,
      questionId: args.questionId,
      submittedAnswer: args.submittedAnswer,
      isCorrect: args.isCorrect,
      answeredAt: args.answeredAt,
    });

    return { saved: true };
  },
});
