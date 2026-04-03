import { SoloPractice } from "@/components/solo-practice";
import { getCategories } from "@/lib/game/service";
import { getPracticeSessionAccountId } from "@/lib/practice/session";
import { getPracticeAccountProfile } from "@/lib/practice/service";

export default async function SoloPage() {
  const accountId = await getPracticeSessionAccountId();
  const account = accountId ? await getPracticeAccountProfile(accountId) : null;

  return <SoloPractice categories={await getCategories()} initialAccount={account} />;
}
