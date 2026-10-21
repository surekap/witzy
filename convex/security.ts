import { internalMutationGeneric, internalQueryGeneric } from "convex/server";
import { v } from "convex/values";

export const consumeAuthBudget = internalMutationGeneric({
  args: { keys: v.array(v.object({ key: v.string(), limit: v.number() })) },
  handler: async (ctx, { keys }) => {
    const now = Date.now();
    const rows = [];
    for (const entry of keys) {
      const row = await ctx.db.query("rateLimits").withIndex("by_key", (q) => q.eq("key", entry.key)).unique();
      if (row && row.resetsAt > now && row.count >= entry.limit) return false;
      rows.push({ entry, row });
    }
    for (const { entry, row } of rows) {
      const value = { key: entry.key, count: row && row.resetsAt > now ? row.count + 1 : 1, resetsAt: row && row.resetsAt > now ? row.resetsAt : now + 15 * 60_000 };
      if (row) await ctx.db.replace(row._id, value);
      else await ctx.db.insert("rateLimits", value);
    }
    const expired = await ctx.db.query("rateLimits").withIndex("by_reset", (q) => q.lt("resetsAt", now)).take(50);
    for (const row of expired) await ctx.db.delete(row._id);
    return true;
  },
});

export const isSessionRevoked = internalQueryGeneric({
  args: { tokenHash: v.string() },
  handler: async (ctx, { tokenHash }) => Boolean(await ctx.db.query("revokedSessions").withIndex("by_token", (q) => q.eq("tokenHash", tokenHash)).unique()),
});

export const revokeSession = internalMutationGeneric({
  args: { tokenHash: v.string() },
  handler: async (ctx, { tokenHash }) => {
    const existing = await ctx.db.query("revokedSessions").withIndex("by_token", (q) => q.eq("tokenHash", tokenHash)).unique();
    if (!existing) await ctx.db.insert("revokedSessions", { tokenHash, expiresAt: Date.now() + 7 * 24 * 60 * 60_000 });
    const expired = await ctx.db.query("revokedSessions").withIndex("by_expiry", (q) => q.lt("expiresAt", Date.now())).take(50);
    for (const row of expired) await ctx.db.delete(row._id);
  },
});

export const applyRetentionPolicy = internalMutationGeneric({
  args: {},
  handler: async (ctx) => {
    // Opt-in rollout avoids deleting existing family history without review.
    if (process.env.WITZY_RETENTION_ENABLED !== "1") return { enabled: false };
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString();
    const rooms = await ctx.db.query("rooms").withIndex("by_updated_at", (q) => q.lt("updatedAt", cutoff)).take(100);
    for (const room of rooms) await ctx.db.delete(room._id);
    const flagCutoff = new Date(Date.now() - 180 * 24 * 60 * 60_000).toISOString();
    const flags = await ctx.db.query("questionFlags").withIndex("by_reported_at", (q) => q.lt("reportedAt", flagCutoff)).take(100);
    for (const flag of flags) await ctx.db.delete(flag._id);
    const timingCutoff = Date.now() - 90 * 24 * 60 * 60_000;
    const timings = await ctx.db.query("timingObservations").withIndex("by_created_at", (q) => q.lt("createdAt", timingCutoff)).take(500);
    for (const timing of timings) await ctx.db.delete(timing._id);
    return { enabled: true, rooms: rooms.length, flags: flags.length, timings: timings.length };
  },
});
