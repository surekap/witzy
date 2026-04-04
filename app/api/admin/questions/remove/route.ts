import { z } from "zod";

import { AdminAuthError, assertAdminSession } from "@/lib/admin/auth";
import { removeQuestionsFromAdmin } from "@/lib/admin/service";
import { jsonError } from "@/lib/utils/http";

const removeSchema = z.object({
  questionIds: z.array(z.string().trim().min(1)).min(1),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = removeSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Please choose at least one valid question to remove.", 400, parsed.error.flatten());
  }

  try {
    await assertAdminSession();
    return Response.json(await removeQuestionsFromAdmin(parsed.data.questionIds));
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return jsonError(error.message, error.status);
    }

    return jsonError(error instanceof Error ? error.message : "Couldn't remove questions.", 500);
  }
}
