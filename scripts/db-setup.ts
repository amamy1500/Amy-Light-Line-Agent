/**
 * Applies migrations (and optionally the pilot seed) to a Postgres database.
 * On Supabase, run without --local-shim: Supabase already has the roles and
 * auth.uid() the migrations use.
 *
 *   npx tsx scripts/db-setup.ts [--local-shim] [--seed-demo]
 *
 * It reads DATABASE_URL, or asks for the connection string with hidden input
 * (scripts/db-connect.ts). Check the result with scripts/db-check.ts.
 *
 * --seed-demo uses fictional 555-01xx numbers and the simulator agent; never
 * run it against the production database.
 */
import { migrations, seedChristmasLightGuys, SUPABASE_SHIM_SQL } from "@/lib/db";
import { migratePg } from "@/lib/db/pg";
import { connectionUrl, openPool } from "./db-connect";

const pool = openPool(await connectionUrl());
try {
  if (process.argv.includes("--local-shim")) await pool.query(SUPABASE_SHIM_SQL);
  const applied = await migratePg(pool, migrations);
  console.log(`migrations applied: ${applied.length ? applied.join(", ") : "none (up to date)"}`);
  const { rows } = await pool.query<{ tables: number }>(
    "select count(*)::int as tables from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'",
  );
  console.log(`connected: ${rows[0]!.tables} tables in place, all ${migrations.length} migrations applied`);
  if (process.argv.includes("--seed-demo")) {
    const seed = await seedChristmasLightGuys(pool, {
      ownerName: "Amy",
      ownerRingE164: "+15125550199",
      numbers: { tv: "+15125550101", web: "+15125550102", print: "+15125550103" },
      alertEmail: "amy@example.com",
      ringStart: "00:00",
      ringEnd: "00:00",
      aiMode: "overflow",
      agentId: process.env.AGENT_ID ?? "agent_sim",
      maxConcurrentSessions: Number(process.env.MAX_SESSIONS ?? 10),
      demoApprovedKeys: ["christmas_services", "residential_commercial", "quote_process"],
    });
    console.log(`seeded business ${seed.businessId}`);
  }
} catch (error) {
  // pg's messages name the problem (password, host, timeout) without the connection string.
  console.error(`Database setup failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
