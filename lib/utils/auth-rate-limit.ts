import { createHmac } from "node:crypto";
import { runConvexMutation } from "@/lib/db/convex";
import { env } from "@/lib/utils/env";

export async function authRateLimit(request: Request, identity: string) {
  if (env.USE_MEMORY_STORE) return null;
  if (!env.SESSION_SECRET) return Response.json({ error: "Authentication is not configured." }, { status: 503 });
  const ip = process.env.VERCEL === "1" ? request.headers.get("x-vercel-forwarded-for") ?? "unknown" : "local";
  const hash = (value: string) => createHmac("sha256", env.SESSION_SECRET).update(value).digest("hex");
  try {
    const allowed = await runConvexMutation<{ keys: Array<{ key: string; limit: number }> }, boolean>("security:consumeAuthBudget", {
      keys: [{ key: hash(`ip:${ip}`), limit: 30 }, { key: hash(`identity:${identity.trim().toLowerCase()}`), limit: 10 }],
    });
    return allowed ? null : Response.json({ error: "Too many attempts. Please try again in 15 minutes." }, { status: 429, headers: { "Retry-After": "900" } });
  } catch { return Response.json({ error: "Sign-in is temporarily unavailable." }, { status: 503 }); }
}
