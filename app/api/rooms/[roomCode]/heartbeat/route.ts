import { heartbeatRoom } from "@/lib/game/service";
import { getRoomSessionKey } from "@/lib/game/session";
import { jsonError } from "@/lib/utils/http";

export async function POST(_request: Request, context: { params: Promise<{ roomCode: string }> }) {
  try {
    const { roomCode } = await context.params;
    return Response.json(await heartbeatRoom(roomCode, await getRoomSessionKey(roomCode)));
  } catch {
    return jsonError("Unable to update presence.", 403);
  }
}
