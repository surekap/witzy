import { getRoomState } from "@/lib/game/service";
import { getRoomSessionKey } from "@/lib/game/session";
import { jsonError } from "@/lib/utils/http";

export async function GET(
  _: Request,
  context: {
    params: Promise<{ roomCode: string }>;
  },
) {
  const { roomCode } = await context.params;

  try {
    const sessionKey = await getRoomSessionKey(roomCode);
    return Response.json(await getRoomState(roomCode, sessionKey));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Couldn't load that room.", 400);
  }
}
