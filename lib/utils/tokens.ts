import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/utils/env";

function secret() {
  if (!env.SESSION_SECRET) throw new Error("SESSION_SECRET must be configured before using sessions.");
  return env.SESSION_SECRET;
}
export function signToken(subject: string, purpose: string, lifetimeSeconds: number) {
  const payload = Buffer.from(JSON.stringify({ subject, purpose, nonce: randomUUID(), expires: Date.now() + lifetimeSeconds * 1000 })).toString("base64url");
  return `${payload}.${createHmac("sha256", secret()).update(payload).digest("base64url")}`;
}
export function readToken(token: string | undefined, purpose: string) {
  if (!token || token.length > 4096) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  const expected = createHmac("sha256", secret()).update(payload).digest();
  const supplied = Buffer.from(signature, "base64url");
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString());
    return parsed.purpose === purpose && typeof parsed.subject === "string" && Number.isFinite(parsed.expires) && parsed.expires > Date.now()
      ? parsed.subject as string : null;
  } catch { return null; }
}
