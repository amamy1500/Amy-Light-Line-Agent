import type { PGlite, Transaction } from "@electric-sql/pglite";
import { openPglite } from "@/lib/db/pglite";
import { seedChristmasLightGuys, type ClgSeedResult } from "@/lib/db/seed";
import type { Executor } from "@/lib/db/migrate";

// 555-01xx numbers are reserved for fiction; nothing here can ring a real phone.
export const NUMBERS = { tv: "+15125550101", web: "+15125550102", print: "+15125550103" } as const;
export const OWNER_PHONE = "+15125550199";
export const CALLER = "+15125550147";

export interface TestDb {
  db: PGlite & Executor;
  seed: ClgSeedResult;
}

export async function freshDb(): Promise<TestDb> {
  const db = await openPglite();
  const seed = await seedChristmasLightGuys(db, {
    ownerName: "Amy",
    ownerRingE164: OWNER_PHONE,
    numbers: NUMBERS,
    alertSms: "+15125550198",
    alertEmail: "amy@example.com",
  });
  return { db, seed };
}

/** Runs `fn` as the Supabase `authenticated` role impersonating `userId`. */
export async function asUser<T>(
  db: PGlite,
  userId: string | null,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query("set local role authenticated");
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId ?? ""]);
    return fn(tx);
  });
}

/** Runs `fn` as the anonymous role. */
export async function asAnon<T>(db: PGlite, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query("set local role anon");
    return fn(tx);
  });
}

let sidCounter = 0;
/** A unique, Twilio-shaped call SID. */
export function newCallSid(): string {
  sidCounter += 1;
  return `CA${sidCounter.toString(16).padStart(32, "0")}`;
}
export function newRecordingSid(): string {
  sidCounter += 1;
  return `RE${sidCounter.toString(16).padStart(32, "0")}`;
}

export async function count(db: PGlite, sql: string, params: unknown[] = []): Promise<number> {
  const { rows } = await db.query<{ n: number | string }>(sql, params);
  return Number(rows[0]?.n ?? 0);
}
