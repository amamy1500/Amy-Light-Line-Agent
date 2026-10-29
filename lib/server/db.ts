import type { AiMode } from "@/lib/business-rules/config";
import { seedOffice, type ClgSeedOptions, type Queryable } from "@/lib/db";
import { CLG_AMY_DECISIONS, CLG_DECIDED_BY } from "@/lib/knowledge/tenants/clg-decisions";
import { readEnv } from "./env";

const globalForDb = globalThis as typeof globalThis & { __lgosDb?: Promise<Queryable> };

/**
 * One database handle per server process (kept on globalThis so dev reloads
 * do not open a second embedded database on the same directory).
 */
export function getDb(): Promise<Queryable> {
  globalForDb.__lgosDb ??= open().catch((error) => {
    globalForDb.__lgosDb = undefined; // let the next request retry
    throw error;
  });
  return globalForDb.__lgosDb;
}

async function open(): Promise<Queryable> {
  const env = readEnv();
  if (env.databaseUrl) {
    const { openPgPool } = await import("@/lib/db/pg");
    return openPgPool(env.databaseUrl);
  }
  if (env.isProduction) {
    throw new Error("DATABASE_URL is required in production");
  }
  // Development and tests: embedded Postgres with the same migrations.
  const { openPglite } = await import("@/lib/db/pglite");
  const db = await openPglite(env.pgliteDir);
  await seedForDevelopment(db);
  return db;
}

/**
 * Seeds the pilot with fictional 555-01xx numbers unless real ones are set,
 * so local runs never ring a real phone by accident.
 */
async function seedForDevelopment(db: Queryable): Promise<void> {
  // Runs on an existing office too: the seed is idempotent, and that is how knowledge
  // items added in a later release reach a database made by an earlier one.
  await seedOffice(db, developmentSeedOptions());
}

/** The development seed as configured by the environment (also used by scripts/live). */
export function developmentSeedOptions(source: Record<string, string | undefined> = process.env): ClgSeedOptions {
  const value = (key: string) => (source[key]?.trim() ? source[key]!.trim() : undefined);
  return {
    ownerName: value("OWNER_NAME") ?? "Amy",
    ownerRingE164: value("OWNER_RING_E164") ?? "+15125550199",
    numbers: {
      tv: value("CLG_TV_NUMBER") ?? "+15125550101",
      web: value("CLG_WEB_NUMBER") ?? "+15125550102",
      print: value("CLG_PRINT_NUMBER") ?? "+15125550103",
      // The real Christmas Light Guys number (site, TV, QR): 737-339-8333 since 2026-10-28.
      main: value("CLG_MAIN_NUMBER") ?? null,
    },
    alertSms: value("ALERT_SMS_TO") ?? null,
    alertEmail: value("ALERT_EMAIL_TO") ?? null,
    ringStart: value("RING_START") ?? "08:00",
    ringEnd: value("RING_END") ?? "20:00",
    // e.g. "1,2,3,4,5,6" for Amy's Mon–Sat; empty = every day.
    ...(value("RING_DAYS") ? { ringDays: value("RING_DAYS")!.split(",").map(Number).filter((d) => d >= 0 && d <= 6) } : {}),
    aiMode: aiModeFromEnv(value("AI_MODE")),
    // Amy's cloned voice is opt-in, and only with her written consent (docs/research/amy-voice-clone.md).
    voice: value("AI_VOICE") === "owner_clone" ? "owner_clone" : "stock",
    ...(value("AGENT_ID") ? { agentId: value("AGENT_ID")! } : {}),
    demoApprovedKeys: (value("DEMO_APPROVED_KEYS") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    // Amy's email answers (2026-10-22) are the starting truth; AMY_DECISIONS=off leaves every item pending.
    ...(value("AMY_DECISIONS") === "off" ? {} : { ownerDecisions: { decisions: CLG_AMY_DECISIONS, by: CLG_DECIDED_BY } }),
    office: {
      sublimePatio: value("SUBLIME_PATIO_NUMBER") ?? null,
      theFridge: value("THE_FRIDGE_NUMBER") ?? null,
      sharedLine: value("SHARED_LINE_NUMBER") ?? null,
      bestlineMissed: value("BESTLINE_MISSED_NUMBER") ?? null,
      carrierRingsFirst: (value("CARRIER_RINGS_FIRST") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    },
  };
}

function aiModeFromEnv(value: string | undefined): AiMode {
  return value === "after_hours_only" || value === "overflow" || value === "always" ? value : "off";
}
