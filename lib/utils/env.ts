import { z } from "zod";

const environmentSchema = z.object({
  // Pasted values can carry a trailing newline or arrive URL-encoded ("|" as "%7C"); either breaks the auth header.
  // Deploy keys never contain "%", so decoding is safe.
  NEXT_PUBLIC_CONVEX_URL: z.string().trim().url().optional(),
  CONVEX_ADMIN_KEY: z.string().trim().min(1).transform((key) => decodeURIComponent(key)).optional(),
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
  // Deploy keys look like "prod:<deployment>|<secret>". Describe a mismatch without revealing any of the secret.
  const key = env.CONVEX_ADMIN_KEY;
  if (!/^(prod|dev|preview):[\w:-]+\|\S+$/.test(key)) {
    const prefix = `prod:${new URL(requireConvexUrl()).hostname.split(".")[0]}`;
    const nonAscii = [...key].flatMap((char, index) => (char.codePointAt(0)! > 126 ? [`${index}:U+${char.codePointAt(0)!.toString(16)}`] : []));
    console.error(`CONVEX_ADMIN_KEY is not a Convex deploy key: length ${key.length}, "|" count ${key.split("|").length - 1}, ` +
      `whitespace ${/\s/.test(key)}, quoted ${/^["']/.test(key)}, starts with ${prefix} ${key.startsWith(prefix)}, ` +
      `next char U+${key.codePointAt(prefix.length)?.toString(16)}, non-ASCII [${nonAscii.join(" ")}]`);
  }

  return key;
}

export function requireAdminPanelPassword() {
  if (!env.ADMIN_PANEL_PASSWORD) {
    throw new Error("ADMIN_PANEL_PASSWORD is required to access admin panel features.");
  }

  return env.ADMIN_PANEL_PASSWORD;
}
