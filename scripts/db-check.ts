/**
 * Proves a live database is exactly what the code needs: builds a fresh copy
 * from the migrations in memory, reads both through Postgres's own catalog,
 * and compares tables, columns (name, type, nullable), indexes, row-level
 * security, policies and the app.* functions. Read-only on the live side.
 *
 *   npx tsx scripts/db-check.ts
 *
 * Reads DATABASE_URL, or asks for the connection string with hidden input.
 */
import { openPglite } from "@/lib/db/pglite";
import { compareSchemas, readSchemaShape, type SchemaShape } from "@/lib/db/schema-check";
import { connectionUrl, openPool } from "./db-connect";

const LABEL: Record<keyof SchemaShape, string> = {
  tables: "tables",
  columns: "columns (name, type, required)",
  indexes: "indexes",
  rls: "tables with row-level security on",
  policies: "security policies",
  functions: "database functions (app.*)",
};

const expected = await readSchemaShape(await openPglite());
const pool = openPool(await connectionUrl());
try {
  const actual = await readSchemaShape(pool);
  const diffs = compareSchemas(expected, actual);
  for (const part of Object.keys(LABEL) as Array<keyof SchemaShape>) {
    const diff = diffs.find((d) => d.part === part);
    const mark = diff?.missing.length ? "MISSING" : diff?.extra.length ? "extra" : "ok";
    console.log(`${mark.padEnd(7)} ${String(expected[part].length).padStart(4)} ${LABEL[part]}`);
    if (diff) {
      for (const x of diff.missing) console.log(`          missing: ${x}`);
      for (const x of diff.extra) console.log(`          extra (not from our code): ${x}`);
    }
  }
  const missing = diffs.some((d) => d.missing.length);
  console.log(
    missing
      ? "RESULT: the live database is missing parts the code needs. Run scripts/db-setup.ts, then check again."
      : diffs.length
        ? "RESULT: everything the code needs is there (plus the extras listed, which nothing of ours uses)."
        : "RESULT: the live database matches the code exactly.",
  );
  if (missing) process.exitCode = 1;
} catch (error) {
  console.error(`Database check failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
