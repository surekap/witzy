import { AdminPanel } from "@/components/admin-panel";
import { hasAdminSession } from "@/lib/admin/session";
import { env } from "@/lib/utils/env";

export default async function AdminPage() {
  return (
    <AdminPanel
      initiallySignedIn={await hasAdminSession()}
      isConfigured={Boolean(env.ADMIN_PANEL_PASSWORD)}
    />
  );
}
