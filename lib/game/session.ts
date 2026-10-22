import { cookies } from "next/headers";
import { env } from "@/lib/utils/env";

type SessionRole = "host" | "player";

// Hosts and players get separate cookies, so a host who opens their own join link keeps host control.
// The player cookie keeps the original shared name, so rooms already in play survive a deploy.
function sessionCookieName(roomCode: string, role: SessionRole) {
  return `witzy_${role === "host" ? "host_" : ""}${roomCode.toLowerCase()}`.replace(/[^a-z0-9_]/g, "_");
}

// A device that hosts the room acts as the host there; otherwise as its player.
export async function getRoomSessionKey(roomCode: string) {
  const cookieStore = await cookies();
  return (cookieStore.get(sessionCookieName(roomCode, "host")) ?? cookieStore.get(sessionCookieName(roomCode, "player")))?.value ?? null;
}

export async function setRoomSessionKey(roomCode: string, sessionKey: string, role: SessionRole) {
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName(roomCode, role), sessionKey, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
  });
}
