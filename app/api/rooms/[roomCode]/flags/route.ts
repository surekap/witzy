import { flagRoomQuestion, GameError } from "@/lib/game/service";
import { getRoomSessionKey } from "@/lib/game/session";
import { roomQuestionFlagSchema } from "@/lib/game/validators";
import { jsonError } from "@/lib/utils/http";

export async function POST(
  request: Request,
  context: {
    params: Promise<{ roomCode: string }>;
  },
) {
  const body = await request.json();
  const parsed = roomQuestionFlagSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Please choose a valid question to flag.", 400, parsed.error.flatten());
  }

  const { roomCode } = await context.params;

  try {
    const sessionKey = await getRoomSessionKey(roomCode);
    return Response.json(await flagRoomQuestion(roomCode, sessionKey, parsed.data));
  } catch (error) {
    if (error instanceof GameError) {
      return jsonError(error.message, error.status);
    }

    return jsonError("Couldn't flag that room question right now.", 500);
  }
}
