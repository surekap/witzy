import { soloQuestionFlagSchema } from "@/lib/game/validators";
import { flagPracticeQuestion, PracticeError } from "@/lib/practice/service";
import { getPracticeSessionAccountId } from "@/lib/practice/session";
import { jsonError } from "@/lib/utils/http";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = soloQuestionFlagSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Please choose a valid question to flag.", 400, parsed.error.flatten());
  }

  const accountId = await getPracticeSessionAccountId();
  if (!accountId) {
    return jsonError("Please sign in to flag practice questions.", 401);
  }

  try {
    return Response.json(await flagPracticeQuestion(accountId, parsed.data));
  } catch (error) {
    if (error instanceof PracticeError) {
      return jsonError(error.message, error.status);
    }

    return jsonError("Couldn't flag that question right now.", 500);
  }
}
