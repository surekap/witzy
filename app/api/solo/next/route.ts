import { soloQuestionSchema } from "@/lib/game/validators";
import { getSoloPracticeQuestion, PracticeError } from "@/lib/practice/service";
import { getPracticeSessionAccountId } from "@/lib/practice/session";
import { jsonError } from "@/lib/utils/http";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = soloQuestionSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Please choose a valid solo practice setup.", 400, parsed.error.flatten());
  }

  const accountId = await getPracticeSessionAccountId();
  if (!accountId) {
    return jsonError("Please sign in to load personalized practice questions.", 401);
  }

  try {
    return Response.json(await getSoloPracticeQuestion(accountId, parsed.data));
  } catch (error) {
    if (error instanceof PracticeError) {
      return jsonError(error.message, error.status);
    }

    return jsonError(error instanceof Error ? error.message : "Couldn't fetch the solo question.", 400);
  }
}
