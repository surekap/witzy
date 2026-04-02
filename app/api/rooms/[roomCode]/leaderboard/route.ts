import { getLeaderboard } from "@/lib/game/service";
import { jsonError } from "@/lib/utils/http";

export async function GET(
  _: Request,
  context: {
    params: Promise<{ roomCode: string }>;
  },
) {
  const { roomCode } = await context.params;

  try {
    return Response.json(getLeaderboard(roomCode));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Couldn't load the leaderboard.", 400);
  }
}
