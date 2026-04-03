import { joinRoom } from "@/lib/game/service";
import { getRoomSessionKey, setRoomSessionKey } from "@/lib/game/session";
import { joinRoomSchema } from "@/lib/game/validators";
import { jsonError } from "@/lib/utils/http";

export async function POST(
  request: Request,
  context: {
    params: Promise<{ roomCode: string }>;
  },
) {
  const body = await request.json();
  const parsed = joinRoomSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Please check the player details and try again.", 400, parsed.error.flatten());
  }

  const { roomCode } = await context.params;

  try {
    const existingSessionKey = await getRoomSessionKey(roomCode);
    const result = await joinRoom(roomCode, parsed.data, existingSessionKey);
    await setRoomSessionKey(roomCode, result.sessionKey);

    return Response.json(
      {
        roomCode: result.roomCode,
        playerId: result.playerId,
      },
      { status: 201 },
    );
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Couldn't join the room.", 400);
  }
}
