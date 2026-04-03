import { submitAnswer } from "@/lib/game/service";
import { getRoomSessionKey } from "@/lib/game/session";
import { submitAnswerSchema } from "@/lib/game/validators";
import { jsonError } from "@/lib/utils/http";

export async function POST(
  request: Request,
  context: {
    params: Promise<{ roomCode: string }>;
  },
) {
  const body = await request.json();
  const parsed = submitAnswerSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Please choose a valid answer before locking in.", 400, parsed.error.flatten());
  }

  const { roomCode } = await context.params;

  try {
    const sessionKey = await getRoomSessionKey(roomCode);
    return Response.json(
      await submitAnswer(roomCode, sessionKey, {
        assignedQuestionId: parsed.data.assignedQuestionId,
        answerKey: parsed.data.answerKey,
        confidenceMode: parsed.data.confidenceMode,
        useHint: parsed.data.useHint,
      }),
    );
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Couldn't submit that answer.", 400);
  }
}
