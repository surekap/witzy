import { createRoom } from "@/lib/game/service";
import { setRoomSessionKey } from "@/lib/game/session";
import { createRoomSchema } from "@/lib/game/validators";
import { jsonError } from "@/lib/utils/http";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = createRoomSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Please check the room settings and try again.", 400, parsed.error.flatten());
  }

  try {
    const result = await createRoom({
      hostName: parsed.data.hostName,
      config: {
        numberOfRounds: parsed.data.numberOfRounds,
        answerTimeLimitSeconds: parsed.data.answerTimeLimitSeconds,
        categoryMode: parsed.data.categoryMode,
        enabledCategoryIds: parsed.data.enabledCategoryIds,
        fastestCorrectBonus: parsed.data.fastestCorrectBonus,
        confidenceWager: parsed.data.confidenceWager,
        teamBonus: parsed.data.teamBonus,
        hints: parsed.data.hints,
      },
    });

    await setRoomSessionKey(result.roomCode, result.sessionKey);

    return Response.json(
      {
        roomCode: result.roomCode,
      },
      { status: 201 },
    );
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Couldn't create the room.", 400);
  }
}
