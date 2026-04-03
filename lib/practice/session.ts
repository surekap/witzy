import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

import { env } from "@/lib/utils/env";

const PRACTICE_SESSION_COOKIE = "witzy_practice_account";

function signAccountId(accountId: string) {
  return createHmac("sha256", env.SESSION_SECRET).update(accountId).digest("base64url");
}

function createSessionToken(accountId: string) {
  return `${accountId}.${signAccountId(accountId)}`;
}

function readAccountIdFromToken(token: string | undefined) {
  if (!token) {
    return null;
  }

  const [accountId, signature] = token.split(".");
  if (!accountId || !signature) {
    return null;
  }

  const expectedSignature = signAccountId(accountId);
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (providedBuffer.length !== expectedBuffer.length) {
    return null;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer) ? accountId : null;
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
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearPracticeSession() {
  const cookieStore = await cookies();
  cookieStore.delete(PRACTICE_SESSION_COOKIE);
}
