import fs from "node:fs/promises";
import path from "node:path";

import { loadLocalEnv } from "./load-env";

loadLocalEnv();

async function main() {
  const [{ env }] = await Promise.all([import("@/lib/utils/env")]);

  if (!env.NEXT_PUBLIC_CONVEX_URL) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is missing. Run `corepack pnpm convex:dev` first.");
  }

  const schemaPath = path.join(process.cwd(), "convex", "schema.ts");
  await fs.access(schemaPath);
  console.log(`Convex schema is defined in ${schemaPath}. Run \`corepack pnpm convex:dev\` locally or \`corepack pnpm convex:deploy\` to sync it.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
