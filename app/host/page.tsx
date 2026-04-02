import { HostCreateForm } from "@/components/host-create-form";
import { getCategories } from "@/lib/game/service";

export default function HostPage() {
  return <HostCreateForm categories={getCategories()} />;
}
