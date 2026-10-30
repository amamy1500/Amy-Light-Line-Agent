/**
 * Render's pre-deploy step (render.yaml): brings the production database up
 * to this release before the new version takes calls. If it fails, Render
 * stops the deploy and the running version keeps answering.
 *
 *   1. migrations (app.schema_migration records what ran)
 *   2. first deploy: seeds the office from the environment (CLG_MAIN_NUMBER,
 *      AI_MODE, ring hours, Amy's decisions); later deploys add knowledge
 *      items new in this release, and Amy's decisions on items still pending
 *   3. release defaults that changed since the office was seeded (who calls
 *      back, callback hours, Amy's goodbye), where they still hold the old default
 *   4. the agent id from AGENT_ID (set by scripts/deploy/render.ts), and
 *      Amy's ring number from OWNER_RING_E164 when it is set
 *
 * AI mode, hours and voice are seeded once and then belong to Settings and
 * the AI switch: a deploy never overrides what Amy changed there.
 *
 * Usage: DATABASE_URL=… npm run db:deploy
 */
import { pathToFileURL } from "node:url";
import { parseBusinessConfig } from "@/lib/business-rules/config";
import { upgradeChristmasLightGuysConfig } from "@/lib/business-rules/tenants/christmas-light-guys";
import { migrations, seedOffice, type Queryable } from "@/lib/db";
import { activateConfig } from "@/lib/db/config";
import { officeBusinesses, primaryBusiness } from "@/lib/db/dashboard";
import { applyOwnerDecisions } from "@/lib/db/knowledge";
import { migratePg } from "@/lib/db/pg";
import { developmentSeedOptions } from "@/lib/server/db";
import { connectionProblem, openPool } from "./db-connect";

type Log = (message: string) => void;
type Env = Record<string, string | undefined>;

/** Fictional 555-01xx demo data (scripts/db-setup.ts --seed-demo) must never take real calls. */
async function hasDemoSeed(db: Queryable): Promise<boolean> {
  const { rows } = await db.query("select 1 from public.knowledge_item where decided_by = 'DEMO SEED (not Amy)' limit 1");
  return rows.length > 0;
}

export async function prepareDatabase(db: Queryable, env: Env, log: Log = console.log): Promise<void> {
  if (!env.CLG_MAIN_NUMBER?.trim()) throw new Error("CLG_MAIN_NUMBER is not set: production answers the real number only");
  if (await hasDemoSeed(db)) {
    throw new Error("this database holds the demo seed (fictional numbers, demo answers); clear it before going live");
  }
  const options = developmentSeedOptions(env);
  const existed = Boolean(await primaryBusiness(db));
  // Safe to run on every deploy: an existing office only gains what this release adds.
  await seedOffice(db, options);
  log(existed ? "office: up to date" : `office: seeded (AI mode ${options.aiMode}, number ${options.numbers.main})`);

  const clg = await primaryBusiness(db);
  if (!clg) throw new Error("the office was not seeded");
  if (options.ownerDecisions) {
    const applied = await applyOwnerDecisions(db, { tenantId: clg.tenantId, businessId: clg.businessId, ...options.ownerDecisions });
    if (applied > 0) log(`applied ${applied} of Amy's decisions`);
  }

  const current = (await primaryBusiness(db))!;
  const stored = parseBusinessConfig(current.config);
  const upgraded = upgradeChristmasLightGuysConfig(stored);
  if (upgraded !== stored) {
    await activateConfig(db, { tenantId: current.tenantId, businessId: current.businessId, config: upgraded, createdBy: "scripts/db-deploy.ts" });
    log(`${current.name}: config ${upgraded.configVersion}`);
  }

  if (options.agentId) {
    for (const business of await officeBusinesses(db)) {
      const config = parseBusinessConfig(business.config);
      if (config.ai.agentId === options.agentId) continue;
      await activateConfig(db, {
        tenantId: business.tenantId,
        businessId: business.businessId,
        config: { ...config, ai: { ...config.ai, agentId: options.agentId } },
        createdBy: "scripts/db-deploy.ts",
      });
      log(`${business.name}: agent ${options.agentId}`);
    }
  }

  const ring = env.OWNER_RING_E164?.trim();
  if (ring) {
    const { rows } = await db.query(
      "update public.tracking_number set owner_ring_e164 = $1 where tenant_id = $2 and owner_ring_e164 <> $1 returning id",
      [ring, clg.tenantId],
    );
    if (rows.length > 0) log(`Amy's ring number updated on ${rows.length} line(s)`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const url = process.env.DATABASE_URL?.trim() ?? "";
  const problem = url ? connectionProblem(url) : "DATABASE_URL is not set.";
  if (problem) {
    console.error(`db:deploy: ${problem}`);
    process.exit(1);
  }
  const pool = openPool(url);
  try {
    const applied = await migratePg(pool, migrations);
    console.log(`migrations: ${applied.length ? applied.join(", ") : "up to date"}`);
    await prepareDatabase(pool, process.env);
  } catch (error) {
    // pg's messages name the problem (password, host, timeout) without the connection string.
    console.error(`db:deploy failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
