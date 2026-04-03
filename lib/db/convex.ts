import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference, type DefaultFunctionArgs } from "convex/server";

import { env, requireConvexUrl } from "@/lib/utils/env";

function createConvexAdminClient() {
  const client = new ConvexHttpClient(requireConvexUrl(), { logger: false });
  if (env.CONVEX_ADMIN_KEY) {
    (client as unknown as { setAdminAuth: (token: string) => void }).setAdminAuth(env.CONVEX_ADMIN_KEY);
  }
  return client;
}

export async function runConvexQuery<TArgs extends DefaultFunctionArgs, TResult>(
  name: string,
  args: TArgs,
): Promise<TResult> {
  const client = createConvexAdminClient();
  return (client as unknown as {
    query: (reference: unknown, functionArgs: TArgs) => Promise<TResult>;
  }).query(makeFunctionReference<"query", TArgs, TResult>(name), args);
}

export async function runConvexMutation<TArgs extends DefaultFunctionArgs, TResult>(
  name: string,
  args: TArgs,
): Promise<TResult> {
  const client = createConvexAdminClient();
  return (client as unknown as {
    mutation: (reference: unknown, functionArgs: TArgs, options: { skipQueue: true }) => Promise<TResult>;
  }).mutation(makeFunctionReference<"mutation", TArgs, TResult>(name), args, { skipQueue: true });
}
