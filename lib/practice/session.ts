import { signToken } from "@/lib/utils/tokens";
import { readActiveSession, revokeSessionToken } from "@/lib/utils/session-revocation";

import { cookies } from "next/headers";

import { env } from "@/lib/utils/env";

const PRACTICE_SESSION_COOKIE = "witzy_practice_account";

function createSessionToken(accountId: string) {
  return signToken(accountId, "practice", 60 * 60 * 24 * 7);
}

function readAccountIdFromToken(token: string | undefined) {
  return readActiveSession(token, "practice");
}

export async function getPracticeSessionAccountId() {
  const cookieStore = await cookies();
  const token = cookieStore.get(PRACTICE_SESSION_COOKIE)?.value;
  return readAccountIdFromToken(token);
}

export async function setPracticeSession(accountId: string) {
  const cookieStore = await cookies();
  cookieStore.set(PRACTICE_SESSION_COOKIE, createSessionToken(accountId), {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearPracticeSession() {
  const cookieStore = await cookies();
  await revokeSessionToken(cookieStore.get(PRACTICE_SESSION_COOKIE)?.value);
  cookieStore.delete(PRACTICE_SESSION_COOKIE);
}
