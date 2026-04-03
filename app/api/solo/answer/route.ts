import { soloAnswerSchema } from "@/lib/game/validators";
import { PracticeError, submitPracticeAnswer } from "@/lib/practice/service";
import { getPracticeSessionAccountId } from "@/lib/practice/session";
import { jsonError } from "@/lib/utils/http";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = soloAnswerSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Please choose a valid answer.", 400, parsed.error.flatten());
  }

  const accountId = await getPracticeSessionAccountId();
  if (!accountId) {
    return jsonError("Please sign in to save progress and answer practice questions.", 401);
  }

  try {
    return Response.json(await submitPracticeAnswer(accountId, parsed.data));
  } catch (error) {
    if (error instanceof PracticeError) {
      return jsonError(error.message, error.status);
    }

    return jsonError("Couldn't save that answer right now.", 500);
  }
}
