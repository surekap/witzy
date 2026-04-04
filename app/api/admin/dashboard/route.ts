import { AdminAuthError, assertAdminSession } from "@/lib/admin/auth";
import { getAdminDashboardData } from "@/lib/admin/service";
import { jsonError } from "@/lib/utils/http";

export async function GET() {
  try {
    await assertAdminSession();
    return Response.json(await getAdminDashboardData());
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return jsonError(error.message, error.status);
    }

    return jsonError(error instanceof Error ? error.message : "Couldn't load admin dashboard data.", 500);
  }
}
