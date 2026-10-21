import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { env } from "@/lib/utils/env";
import type { Question } from "@/types/game";

function key() {
  if (!env.SESSION_SECRET) throw new Error("SESSION_SECRET is required for practice.");
  return createHash("sha256").update(`practice-ticket:${env.SESSION_SECRET}`).digest();
}

export function issuePracticeTicket(accountId: string, question: Question) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const payload = JSON.stringify({ accountId, question, attemptId: randomUUID(), expires: Date.now() + 3_600_000 });
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

export function readPracticeTicket(token: string, accountId: string) {
  if (token.length > 100_000) throw new Error("Invalid practice ticket.");
  try {
    const bytes = Buffer.from(token, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key(), bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28));
    const value = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString()) as {
      accountId: string; question: Question; attemptId: string; expires: number;
    };
    if (value.accountId !== accountId || value.expires <= Date.now()) throw new Error("expired");
    return value;
  } catch { throw new Error("This practice question has expired. Please load another."); }
}

export function publicPracticeQuestion(question: Question) {
  const { correctAnswer: _correctAnswer, explanation: _explanation, ...publicQuestion } = question;
  void _correctAnswer;
  void _explanation;
  return publicQuestion;
}
