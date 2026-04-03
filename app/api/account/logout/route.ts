import { clearPracticeSession } from "@/lib/practice/session";

export async function POST() {
  await clearPracticeSession();
  return Response.json({ ok: true });
}
