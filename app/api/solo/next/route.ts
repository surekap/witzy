import { getSoloQuestion } from "@/lib/game/service";
import { soloQuestionSchema } from "@/lib/game/validators";
import { jsonError } from "@/lib/utils/http";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = soloQuestionSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Please choose a valid solo practice setup.", 400, parsed.error.flatten());
  }

  try {
    return Response.json(getSoloQuestion(parsed.data));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Couldn't fetch the solo question.", 400);
  }
}
