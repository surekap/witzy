import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

import { env } from "@/lib/utils/env";

const ADMIN_SESSION_COOKIE = "witzy_admin";
const ADMIN_SESSION_VALUE = "admin";

function signAdminSession(value: string) {
  return createHmac("sha256", env.SESSION_SECRET).update(value).digest("base64url");
}

function createAdminSessionToken() {
  return `${ADMIN_SESSION_VALUE}.${signAdminSession(ADMIN_SESSION_VALUE)}`;
}

function validateAdminSessionToken(token: string | undefined) {
  if (!token) {
    return false;
  }

  const [value, signature] = token.split(".");
  if (!value || !signature || value !== ADMIN_SESSION_VALUE) {
    return false;
  }

  const expectedSignature = signAdminSession(value);
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

export async function hasAdminSession() {
  const cookieStore = await cookies();
  return validateAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
}

export async function setAdminSession() {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, createAdminSessionToken(), {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
}
