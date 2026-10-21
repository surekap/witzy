import { applyRoomHint } from "@/lib/game/service";
import { getRoomSessionKey } from "@/lib/game/session";
import { roomQuestionFlagSchema } from "@/lib/game/validators";
import { jsonError } from "@/lib/utils/http";

export async function POST(request: Request, context: { params: Promise<{ roomCode: string }> }) {
  try {
    const { roomCode } = await context.params;
    const input = roomQuestionFlagSchema.parse(await request.json());
    return Response.json(await applyRoomHint(roomCode, await getRoomSessionKey(roomCode), input.assignedQuestionId));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Couldn't use hint.", 400);
  }
}
