import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrations, seedChristmasLightGuys, SUPABASE_SHIM_SQL } from "@/lib/db";
import {
  activeAgentSessions,
  getCallContext,
  requestCallback,
  saveToolCall,
  startAgentSession,
} from "@/lib/db/agent";
import { migratePg } from "@/lib/db/pg";
import { finalizeCall, ingestInboundCall, resolveDial } from "@/lib/db/repo";

/**
 * The same invariants under true parallelism: many connections, real row
 * locks. PGlite (used elsewhere) has one connection, so races cannot happen
 * there. Runs only when PG_TEST_URL points at a disposable server, e.g.
 *   PG_TEST_URL=postgres://postgres@127.0.0.1:54331/postgres npx vitest run tests/db/real-postgres.test.ts
 */
const ADMIN_URL = process.env.PG_TEST_URL;
const DB_NAME = `lightline_race_${process.pid}`;
let pool: pg.Pool;
let admin: pg.Client;
let businessId: string;
let seq = 0;
const sid = () => `CA${(0xa0000000 + ++seq).toString(16).padStart(32, "0")}`;

describe.skipIf(!ADMIN_URL)("real Postgres under concurrency", () => {
  beforeAll(async () => {
    admin = new pg.Client({ connectionString: ADMIN_URL });
    await admin.connect();
    await admin.query(`drop database if exists ${DB_NAME}`);
    await admin.query(`create database ${DB_NAME}`);
    const url = new URL(ADMIN_URL!);
    url.pathname = `/${DB_NAME}`;
    pool = new pg.Pool({ connectionString: url.toString(), max: 40 });
    await pool.query(SUPABASE_SHIM_SQL);
    await migratePg(pool, migrations);
    const seed = await seedChristmasLightGuys(pool, {
      ownerName: "Amy",
      ownerRingE164: "+15125550199",
      numbers: { tv: "+15125550101", web: "+15125550102", print: "+15125550103" },
      aiMode: "overflow",
      agentId: "agent_race",
    });
    businessId = seed.businessId;
  }, 120_000);

  afterAll(async () => {
    await pool?.end();
    await admin?.query(`drop database if exists ${DB_NAME}`);
    await admin?.end();
  });

  async function readyCall(): Promise<string> {
    const call = sid();
    await ingestInboundCall(pool, { callSid: call, from: `+1512555${String(seq).padStart(4, "0")}`, to: "+15125550101", afterHours: false });
    await resolveDial(pool, { callSid: call, dialCallStatus: "no-answer", dialBridged: false });
    return call;
  }

  it("A6: 60 callers arriving at once never get more than the 10 agent slots", async () => {
    const calls = await Promise.all(Array.from({ length: 60 }, readyCall));
    const started = await Promise.all(
      calls.map((callSid) =>
        startAgentSession(pool, { callSid, provider: "simulator", agentId: "a", agentVersion: "v", routeReason: "owner_unavailable", maxSessions: 10 }),
      ),
    );
    expect(started.filter(Boolean)).toHaveLength(10);
    expect(await activeAgentSessions(pool, businessId)).toBe(10);
    // Every refused caller is still a call we hold, ready for capture.
    const refused = calls.filter((_, i) => started[i] === null);
    const states = await Promise.all(refused.map(async (c) => (await getCallContext(pool, c))?.state));
    expect(new Set(states)).toEqual(new Set(["recovery"]));
  });

  it("A2: 25 simultaneous retries of one tool call store and act once", async () => {
    const call = await readyCall();
    await startAgentSession(pool, { callSid: call, provider: "simulator", agentId: "a", agentVersion: "v", routeReason: "x", maxSessions: 10_000 });
    const ctx = (await getCallContext(pool, call))!;
    const results = await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        saveToolCall(pool, {
          context: ctx, tenantId: ctx.tenantId, businessId: ctx.businessId, toolName: "request_callback",
          idempotencyKey: `race:${call}`, input: {}, output: { attempt: i }, outcome: "ok", latencyMs: 1,
        }),
      ),
    );
    expect(results.filter((r) => !r.replayed)).toHaveLength(1);
    expect(new Set(results.map((r) => JSON.stringify(r.output))).size).toBe(1);
    const { rows } = await pool.query("select count(*)::int as n from public.tool_call where idempotency_key = $1", [`race:${call}`]);
    expect(rows[0].n).toBe(1);
  });

  it("A5: 25 simultaneous callback requests leave one open task", async () => {
    const call = await readyCall();
    await startAgentSession(pool, { callSid: call, provider: "simulator", agentId: "a", agentVersion: "v", routeReason: "x", maxSessions: 10_000 });
    const ctx = (await getCallContext(pool, call))!;
    const ids = await Promise.all(
      Array.from({ length: 25 }, () => requestCallback(pool, { leadId: ctx.leadId!, callId: ctx.callId, window: "after 4", reason: null, priority: "normal" })),
    );
    expect(new Set(ids).size).toBe(1);
  });

  it("I3/A4: duplicated, simultaneous status callbacks finalize once with one lead and one post-call job", async () => {
    const call = await readyCall();
    await startAgentSession(pool, { callSid: call, provider: "simulator", agentId: "a", agentVersion: "v", routeReason: "x", maxSessions: 10_000 });
    const finals = await Promise.all(Array.from({ length: 10 }, () => finalizeCall(pool, { callSid: call, callStatus: "completed" })));
    expect(new Set(finals)).toEqual(new Set(["agent_completed"]));
    const ctx = (await getCallContext(pool, call))!;
    const jobs = await pool.query("select count(*)::int as n from public.job where subject_id = $1", [ctx.callId]);
    const completed = await pool.query("select count(*)::int as n from public.event where aggregate_id = $1 and type = 'call.completed'", [ctx.callId]);
    expect(jobs.rows[0].n).toBe(1);
    expect(completed.rows[0].n).toBe(1);
  });
});
