import { SoloPractice } from "@/components/solo-practice";
import { getCategories } from "@/lib/game/service";

export default function SoloPage() {
  return <SoloPractice categories={getCategories()} />;
}
