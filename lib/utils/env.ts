import { z } from "zod";

const environmentSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  SESSION_SECRET: z.string().min(16).optional(),
  MEDIA_BASE_URL: z.string().url().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const parsedEnvironment = environmentSchema.safeParse({
  DATABASE_URL: process.env.DATABASE_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  SESSION_SECRET: process.env.SESSION_SECRET,
  MEDIA_BASE_URL: process.env.MEDIA_BASE_URL,
  NODE_ENV: process.env.NODE_ENV,
});

if (!parsedEnvironment.success) {
  throw new Error(`Invalid environment configuration: ${parsedEnvironment.error.message}`);
}

export const env = {
  ...parsedEnvironment.data,
  SESSION_SECRET:
    parsedEnvironment.data.SESSION_SECRET ??
    (parsedEnvironment.data.NODE_ENV === "production"
      ? ""
      : "dev-session-secret-for-local-builds"),
  NEXT_PUBLIC_APP_URL: parsedEnvironment.data.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
};

export function requireDatabaseUrl() {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for Neon operations.");
  }

  return env.DATABASE_URL;
}
