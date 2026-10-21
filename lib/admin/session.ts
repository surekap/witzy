import { signToken } from "@/lib/utils/tokens";
import { readActiveSession, revokeSessionToken } from "@/lib/utils/session-revocation";

import { cookies } from "next/headers";

import { env } from "@/lib/utils/env";

const ADMIN_SESSION_COOKIE = "witzy_admin";
const ADMIN_SESSION_VALUE = "admin";

function createAdminSessionToken() {
  return signToken(ADMIN_SESSION_VALUE, "admin", 60 * 60 * 8);
}

async function validateAdminSessionToken(token: string | undefined) {
  return (await readActiveSession(token, "admin")) === ADMIN_SESSION_VALUE;
}

export async function hasAdminSession() {
  const cookieStore = await cookies();
  return validateAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
}

export async function setAdminSession() {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, createAdminSessionToken(), {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 8,
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  await revokeSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  cookieStore.delete(ADMIN_SESSION_COOKIE);
}
