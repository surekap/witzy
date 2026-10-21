import { createHash } from "node:crypto";
import { runConvexMutation, runConvexQuery } from "@/lib/db/convex";
import { env } from "@/lib/utils/env";
import { readToken } from "@/lib/utils/tokens";

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
export async function readActiveSession(token: string | undefined, purpose: string) {
  const subject = readToken(token, purpose);
  if (!subject || !token) return null;
  if (env.USE_MEMORY_STORE) return subject;
  const revoked = await runConvexQuery<{ tokenHash: string }, boolean>("security:isSessionRevoked", { tokenHash: tokenHash(token) });
  return revoked ? null : subject;
}
export async function revokeSessionToken(token: string | undefined) {
  if (!token || env.USE_MEMORY_STORE) return;
  await runConvexMutation("security:revokeSession", { tokenHash: tokenHash(token) });
}
