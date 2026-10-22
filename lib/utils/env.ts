import { z } from "zod";

const environmentSchema = z.object({
  // Trimmed: values pasted into the Vercel dashboard can carry a trailing newline, which breaks the auth header.
  NEXT_PUBLIC_CONVEX_URL: z.string().trim().url().optional(),
  CONVEX_ADMIN_KEY: z.string().trim().min(1).optional(),
  SESSION_SECRET: z.string().min(16).optional(),
  ADMIN_PANEL_PASSWORD: z.string().min(8).optional(),
  MEDIA_BASE_URL: z.string().url().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const parsedEnvironment = environmentSchema.safeParse({
  NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
  CONVEX_ADMIN_KEY: process.env.CONVEX_ADMIN_KEY,
  SESSION_SECRET: process.env.SESSION_SECRET,
  ADMIN_PANEL_PASSWORD: process.env.ADMIN_PANEL_PASSWORD,
  MEDIA_BASE_URL: process.env.MEDIA_BASE_URL,
  NODE_ENV: process.env.NODE_ENV,
});

if (!parsedEnvironment.success) {
  throw new Error(`Invalid environment configuration: ${parsedEnvironment.error.message}`);
}

export const env = {
  ...parsedEnvironment.data,
  USE_MEMORY_STORE: parsedEnvironment.data.NODE_ENV === "test" ||
    (parsedEnvironment.data.NODE_ENV === "development" && process.env.WITZY_TEST_MODE === "1"),
  SESSION_SECRET:
    parsedEnvironment.data.SESSION_SECRET ??
    (parsedEnvironment.data.NODE_ENV === "production"
      ? ""
      : "dev-session-secret-for-local-builds"),
};

export function requireConvexUrl() {
  if (!env.NEXT_PUBLIC_CONVEX_URL) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is required for Convex operations.");
  }

  return env.NEXT_PUBLIC_CONVEX_URL;
}

export function requireConvexAdminKey() {
  if (!env.CONVEX_ADMIN_KEY) {
    throw new Error("CONVEX_ADMIN_KEY is required for server-side Convex operations.");
  }

  return env.CONVEX_ADMIN_KEY;
}

export function requireAdminPanelPassword() {
  if (!env.ADMIN_PANEL_PASSWORD) {
    throw new Error("ADMIN_PANEL_PASSWORD is required to access admin panel features.");
  }

  return env.ADMIN_PANEL_PASSWORD;
}
