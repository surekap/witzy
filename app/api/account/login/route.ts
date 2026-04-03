import { practiceAuthSchema } from "@/lib/game/validators";
import { loginPracticeAccount, PracticeError } from "@/lib/practice/service";
import { setPracticeSession } from "@/lib/practice/session";
import { jsonError } from "@/lib/utils/http";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = practiceAuthSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Please enter a valid username and password.", 400, parsed.error.flatten());
  }

  try {
    const account = await loginPracticeAccount(parsed.data);
    await setPracticeSession(account.id);
    return Response.json({ account });
  } catch (error) {
    if (error instanceof PracticeError) {
      return jsonError(error.message, error.status);
    }

    return jsonError("Couldn't sign in right now.", 500);
  }
}
