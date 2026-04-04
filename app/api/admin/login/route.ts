import { z } from "zod";

import { setAdminSession } from "@/lib/admin/session";
import { jsonError } from "@/lib/utils/http";
import { requireAdminPanelPassword } from "@/lib/utils/env";

const loginSchema = z.object({
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Please provide the admin password.", 400, parsed.error.flatten());
  }

  let expectedPassword: string;
  try {
    expectedPassword = requireAdminPanelPassword();
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Admin panel is not configured.", 503);
  }

  if (parsed.data.password !== expectedPassword) {
    return jsonError("Invalid admin password.", 401);
  }

  await setAdminSession();
  return Response.json({ ok: true });
}
