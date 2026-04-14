import { HostCreateForm } from "@/components/host-create-form";
import { getCategories } from "@/lib/game/service";

export const dynamic = "force-dynamic";

export default async function HostPage() {
  return <HostCreateForm categories={await getCategories()} />;
}
