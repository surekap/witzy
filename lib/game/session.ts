import { cookies } from "next/headers";
import { env } from "@/lib/utils/env";

function sessionCookieName(roomCode: string) {
  return `witzy_${roomCode.toLowerCase()}`.replace(/[^a-z0-9_]/g, "_");
}

export async function getRoomSessionKey(roomCode: string) {
  const cookieStore = await cookies();
  return cookieStore.get(sessionCookieName(roomCode))?.value ?? null;
}

export async function setRoomSessionKey(roomCode: string, sessionKey: string) {
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName(roomCode), sessionKey, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
  });
}
