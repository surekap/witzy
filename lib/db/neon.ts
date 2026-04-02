import { neon } from "@neondatabase/serverless";

import { requireDatabaseUrl } from "@/lib/utils/env";

export function createNeonSql() {
  return neon(requireDatabaseUrl());
}
