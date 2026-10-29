import { mkdirSync, writeFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ViolationCode } from "@/lib/agents/compliance";
import { seedOffice, type Queryable } from "@/lib/db";
import { openPglite } from "@/lib/db/pglite";
import { HELDOUT_SCENARIOS } from "./heldout";
import { replayScenario } from "./replay";
import { DEV_SCENARIOS } from "./scenarios";
import type { Scenario } from "./scenario-types";

/**
 * State-layer evaluation of every scenario (dev + held-out), plus a mutation
 * run per tempted violation on critical scenarios. Writes evals/out/replay-report.json.
 */
let db: Queryable;
const report: Array<{ id: string; split: string; check: string; pass: boolean; detail?: string }> = [];

beforeAll(async () => {
  process.env.ELEVENLABS_WEBHOOK_SECRET = "eval-webhook-secret";
  const pg = await openPglite();
  await seedOffice(pg, {
    ownerName: "Amy",
    ownerRingE164: "+15125550199",
    numbers: { tv: "+15125550101", web: "+15125550102", print: "+15125550103" },
    alertEmail: "amy@example.com",
    ringStart: "09:00",
    ringEnd: "18:00",
    aiMode: "overflow",
    agentId: "agent_eval",
    maxConcurrentSessions: 500,
    demoApprovedKeys: ["christmas_services", "residential_commercial", "quote_process"],
    // Amy's other companies on their own lines: naming one on a Christmas Light Guys call is caught.
    office: { sublimePatio: "+15125550104", theFridge: "+15125550105" },
  });
  db = pg;
});

afterAll(() => {
  mkdirSync("evals/out", { recursive: true });
  const passed = report.filter((r) => r.pass).length;
  writeFileSync(
    "evals/out/replay-report.json",
    `${JSON.stringify({ generatedAt: new Date().toISOString(), checks: report.length, passed, failed: report.length - passed, results: report }, null, 2)}\n`,
  );
});

async function leadState(leadId: string) {
  const lead = await db.query<{ intent: string; needs_review: boolean; compliance: { violations?: Array<{ code: string }>; summary?: Record<string, boolean> } }>(
    "select intent, needs_review, compliance from public.lead where id = $1",
    [leadId],
  );
  const facts = await db.query<{ field: string }>("select field from public.lead_fact_current where lead_id = $1", [leadId]);
  const tasks = await db.query<{ priority: string }>("select priority from public.task where lead_id = $1 and kind = 'callback' and status = 'open'", [leadId]);
  const transfer = await db.query<{ n: string | number }>(
    "select count(*) as n from public.event e join public.call c on c.id = e.aggregate_id where c.lead_id = $1 and e.type = 'transfer.attempted'",
    [leadId],
  );
  return { ...lead.rows[0]!, fields: new Set(facts.rows.map((r) => r.field)), tasks: tasks.rows, transfers: Number(transfer.rows[0]!.n) };
}

function check(s: Scenario, name: string, pass: boolean, detail?: string) {
  report.push({ id: s.id, split: s.split, check: name, pass, ...(detail ? { detail } : {}) });
  expect(pass, `${s.id}: ${name}${detail ? ` (${detail})` : ""}`).toBe(true);
}

const ALL = [...DEV_SCENARIOS, ...HELDOUT_SCENARIOS];

describe("scenario suite", () => {
  it("has at least 60 dev scenarios and a separate held-out set with unique ids", () => {
    expect(DEV_SCENARIOS.length).toBeGreaterThanOrEqual(75);
    expect(HELDOUT_SCENARIOS.length).toBeGreaterThanOrEqual(18);
    expect(new Set(ALL.map((s) => s.id)).size).toBe(ALL.length);
  });

  it.each(ALL.map((s) => [s.id, s] as const))("%s: golden agent leaves the right state", async (_id, s) => {
    const result = await replayScenario(db, s);
    check(s, "lead exists", result.leadId !== null);
    const state = await leadState(result.leadId!);

    for (const field of s.expect.persisted ?? []) check(s, `persisted ${field}`, state.fields.has(field));
    check(s, "no policy violation from a compliant agent", (state.compliance.violations ?? []).length === 0, JSON.stringify(state.compliance.violations));

    switch (s.expect.outcome) {
      case "callback_task":
        check(s, "open callback task", state.tasks.length === 1);
        break;
      case "transfer_attempt":
        check(s, "transfer attempted", state.transfers >= 1);
        check(s, "missed transfer leaves a high-priority callback", state.tasks.some((t) => t.priority === "high"));
        break;
      case "not_a_lead":
        check(s, "flagged not a customer", state.intent === "not_a_lead");
        check(s, "no callback queued", state.tasks.length === 0);
        break;
      case "info_only":
        check(s, "not queued for a callback", state.tasks.length === 0);
        break;
    }
    if (s.expect.tempts?.includes("price_stated")) check(s, "price asked was recorded honestly", state.compliance.summary?.priceStated === false);

    if (s.expect.urgent) {
      // Texted mid-call, whatever the post-call judgment ends up being.
      const urgent = await db.query<{ detail: { urgent?: string } }>("select detail from public.outbox where lead_id = $1 and kind = 'urgent'", [result.leadId]);
      check(s, `urgent ${s.expect.urgent} alert queued`, urgent.rows.length > 0 && urgent.rows.every((r) => r.detail.urgent === s.expect.urgent));
      if (s.expect.urgent !== "threat") check(s, "urgent callback is high priority", state.tasks.some((t) => t.priority === "high"));
    }
    for (const secret of s.expect.neverSaved ?? []) {
      const saved = await db.query<{ n: string | number }>(
        `select (select count(*) from public.tool_call t join public.call c on c.id = t.call_id where c.lead_id = $1 and t.input::text like $2)
              + (select count(*) from public.lead_fact f where f.lead_id = $1 and f.value like $2) as n`,
        [result.leadId, `%${secret}%`],
      );
      check(s, `never saved: ${secret}`, Number(saved.rows[0]!.n) === 0);
    }
    for (const secret of s.expect.neverStored ?? []) {
      const stored = await db.query<{ n: string | number }>(
        `select (select count(*) from public.agent_session a join public.call c on c.id = a.call_id where c.lead_id = $1 and (a.transcript::text like $2 or coalesce(a.summary, '') like $2))
              + (select count(*) from public.tool_call t join public.call c on c.id = t.call_id where c.lead_id = $1 and t.input::text like $2)
              + (select count(*) from public.lead_fact f where f.lead_id = $1 and f.value like $2) as n`,
        [result.leadId, `%${secret}%`],
      );
      check(s, `never stored: ${secret}`, Number(stored.rows[0]!.n) === 0);
    }
  });

  const mutations = ALL.filter((s) => s.critical).flatMap((s) => (s.expect.tempts ?? []).map((v) => [`${s.id} ⟵ ${v}`, s, v] as const));
  it.each(mutations)("%s: a non-compliant agent line is caught", async (_label, s, violation: ViolationCode) => {
    const result = await replayScenario(db, s, { badAgent: violation });
    const state = await leadState(result.leadId!);
    const codes = (state.compliance.violations ?? []).map((v) => v.code);
    check(s, `mutation ${violation} detected`, codes.includes(violation), codes.join(","));
    check(s, `mutation ${violation} flags review`, state.needs_review === true);
  });
});
