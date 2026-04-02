import { startGame } from "@/lib/game/service";
import { getRoomSessionKey } from "@/lib/game/session";
import { jsonError } from "@/lib/utils/http";

export async function POST(
  _: Request,
  context: {
    params: Promise<{ roomCode: string }>;
  },
) {
  const { roomCode } = await context.params;

  try {
    const sessionKey = await getRoomSessionKey(roomCode);
    return Response.json(startGame(roomCode, sessionKey));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Couldn't start the game.", 400);
  }
}
