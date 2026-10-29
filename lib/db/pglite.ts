import { mkdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { migrate, type Executor } from "./migrate";
import { migrations } from "./migrations.generated";
import { SUPABASE_SHIM_SQL } from "./supabase-shim";

/**
 * Embedded Postgres for local development and tests. `dataDir` undefined
 * keeps the database in memory. Applies the Supabase shim and all migrations.
 */
export async function openPglite(dataDir?: string): Promise<PGlite & Executor> {
  // PGlite creates only the last path segment; make sure the parents exist.
  if (dataDir) mkdirSync(dataDir, { recursive: true });
  const db = dataDir ? await PGlite.create(dataDir) : await PGlite.create();
  await db.exec(SUPABASE_SHIM_SQL);
  await migrate(db as unknown as Executor, migrations);
  return db as PGlite & Executor;
}
