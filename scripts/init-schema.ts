import fs from "node:fs/promises";
import path from "node:path";

import { loadLocalEnv } from "./load-env";

loadLocalEnv();

async function main() {
  const [{ createNeonSql }, { env }] = await Promise.all([
    import("@/lib/db/neon"),
    import("@/lib/utils/env"),
  ]);

  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing. Run `vercel env pull .env.local --yes` first.");
  }

  const sql = createNeonSql();
  const schemaPath = path.join(process.cwd(), "lib", "db", "schema.sql");
  const schemaSql = await fs.readFile(schemaPath, "utf8");

  const statements = schemaSql
    .split(/;\s*\n/g)
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await sql.query(`${statement};`);
  }

  console.log(`Applied ${statements.length} schema statements from ${schemaPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
