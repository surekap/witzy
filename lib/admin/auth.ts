import { hasAdminSession } from "@/lib/admin/session";
import { requireAdminPanelPassword } from "@/lib/utils/env";

export class AdminAuthError extends Error {
  constructor(
    message: string,
    public status = 401,
  ) {
    super(message);
    this.name = "AdminAuthError";
  }
}

export async function assertAdminSession() {
  try {
    requireAdminPanelPassword();
  } catch {
    throw new AdminAuthError(
      "Admin panel is not configured. Set ADMIN_PANEL_PASSWORD in environment variables.",
      503,
    );
  }

  const signedIn = await hasAdminSession();
  if (!signedIn) {
    throw new AdminAuthError("Please sign in to access admin tools.", 401);
  }
}
