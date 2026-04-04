import { z } from "zod";

import { AdminAuthError, assertAdminSession } from "@/lib/admin/auth";
import { uploadQuestionsFromAdmin } from "@/lib/admin/service";
import { jsonError } from "@/lib/utils/http";

const uploadSchema = z.object({
  mode: z.union([z.literal("append"), z.literal("replace")]).default("append"),
  payload: z.unknown(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = uploadSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Please provide a valid upload payload.", 400, parsed.error.flatten());
  }

  try {
    await assertAdminSession();
    return Response.json(await uploadQuestionsFromAdmin(parsed.data));
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return jsonError(error.message, error.status);
    }

    return jsonError(error instanceof Error ? error.message : "Couldn't upload questions.", 400);
  }
}
