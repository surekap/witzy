import { JoinRoomForm } from "@/components/join-room-form";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string }>;
}) {
  const params = await searchParams;
  return <JoinRoomForm initialRoomCode={params.room?.toUpperCase() ?? ""} />;
}
