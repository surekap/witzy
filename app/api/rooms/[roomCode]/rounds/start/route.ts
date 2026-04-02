import { startRound } from "@/lib/game/service";
import { getRoomSessionKey } from "@/lib/game/session";
import { startRoundSchema } from "@/lib/game/validators";
import { jsonError } from "@/lib/utils/http";

export async function POST(
  request: Request,
  context: {
    params: Promise<{ roomCode: string }>;
  },
) {
  const body = await request.json().catch(() => ({}));
  const parsed = startRoundSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Please choose a valid category.", 400, parsed.error.flatten());
  }

  const { roomCode } = await context.params;

  try {
    const sessionKey = await getRoomSessionKey(roomCode);
    return Response.json(startRound(roomCode, sessionKey, parsed.data.categoryId));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Couldn't start the round.", 400);
  }
}
