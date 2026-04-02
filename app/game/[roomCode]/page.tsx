import { RoomPageClient } from "@/components/room-page-client";

export default async function GameRoomPage({
  params,
}: {
  params: Promise<{ roomCode: string }>;
}) {
  const { roomCode } = await params;
  return <RoomPageClient roomCode={roomCode.toUpperCase()} />;
}
