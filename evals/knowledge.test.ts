import { mkdirSync, writeFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { simulatorConnector } from "@/lib/agents/connector";
import { scanConversation } from "@/lib/agents/compliance";
import { runTool, type GatewayDeps } from "@/lib/agents/gateway";
import { seedChristmasLightGuys, type Queryable } from "@/lib/db";
import { loadActiveConfig } from "@/lib/db/config";
import { decideKnowledge, listKnowledge, syncConfigFromKnowledge, type StoredKnowledgeItem } from "@/lib/db/knowledge";
import { openPglite } from "@/lib/db/pglite";
import { forbiddenClaims, productionAction, queueCategory } from "@/lib/knowledge/model";
import siteFacts from "@/lib/knowledge/sources/clg-site-facts.json";
import { CLG_KNOWLEDGE } from "@/lib/knowledge/tenants/christmas-light-guys";
import { handleInbound } from "@/lib/server/voice";
import { generateKnowledgeTests, type GeneratedTest } from "./knowledge-tests";

/**
 * Runs the tests GENERATED from the knowledge items against the real gateway,
 * config projection and compliance scan. Nobody writes these by hand: a new
 * site claim produces its own ask / repeat / conflict / approval tests.
 */
const NIGHT = new Date("2026-11-04T04:00:00Z"); // after hours: straight to the agent
const TV = "+15125550101";
const DEFER = /I don't want to give you the wrong information/;

let db: Queryable;
let tenantId: string;
let businessId: string;
let seq = 0;
const results: Array<{ id: string; family: string; pass: boolean }> = [];

async function liveCall(): Promise<string> {
  const call = `CA${(0xb0000000 + ++seq).toString(16).padStart(32, "0")}`;
  const twiml = await handleInbound(
    { CallSid: call, From: `+1512555${String(3000 + seq).padStart(4, "0")}`, To: TV },
    { db, now: () => NIGHT, baseUrl: "https://eval.example.test", agent: simulatorConnector() },
  );
  expect(twiml).toContain("<Connect");
  return call;
}

function gateway(): GatewayDeps {
  return { db, now: NIGHT, loadConfig: async (id) => (await loadActiveConfig(db, id))?.config ?? null, scheduleHandoff: async () => {} };
}

async function ask(call: string, name: string, args: Record<string, unknown>) {
  return (await runTool(name, { call_sid: call, conversation_id: `k_${call}_${seq++}`, ...args }, gateway())).body;
}

async function scan(text: string) {
  return scanConversation([{ role: "agent", text }], [], { forbiddenClaims: forbiddenClaims(await listKnowledge(db, businessId)) });
}

async function item(key: string): Promise<StoredKnowledgeItem> {
  return (await listKnowledge(db, businessId)).find((i) => i.key === key)!;
}

function record(t: GeneratedTest, pass: boolean) {
  results.push({ id: t.id, family: t.family, pass });
}

beforeAll(async () => {
  const pg = await openPglite();
  const seed = await seedChristmasLightGuys(pg, {
    ownerName: "Amy",
    ownerRingE164: "+15125550199",
    numbers: { tv: TV, web: "+15125550102", print: "+15125550103" },
    ringStart: "09:00",
    ringEnd: "18:00",
    aiMode: "overflow",
    agentId: "agent_eval",
    maxConcurrentSessions: 500,
  });
  db = pg;
  tenantId = seed.tenantId;
  businessId = seed.businessId;
});

afterAll(() => {
  mkdirSync("evals/out", { recursive: true });
  const passed = results.filter((r) => r.pass).length;
  writeFileSync("evals/out/knowledge-report.json", `${JSON.stringify({ generatedAt: new Date().toISOString(), tests: results.length, passed, results }, null, 2)}\n`);
});

const TESTS = generateKnowledgeTests(CLG_KNOWLEDGE);

describe("knowledge model", () => {
  it("every claim's own words trip its own markers (a marker that cannot fire guards nothing)", () => {
    for (const k of CLG_KNOWLEDGE) {
      for (const c of k.claims) {
        if (c.markers.length) expect(c.markers.some((m) => new RegExp(m, "i").test(c.spoken)), `${k.key}: ${c.spoken}`).toBe(true);
      }
    }
  });

  it("every contradictory site fact is mapped to a knowledge item", () => {
    const mapped = new Set(CLG_KNOWLEDGE.flatMap((k) => k.claims.map((c) => c.siteFactId)));
    // F57 is a broken link on the site, not a claim anyone would say on the phone.
    const exempt = new Set(["F57"]);
    const contradictory = (siteFacts as Array<{ id: string; classification: string[] }>)
      .filter((f) => f.classification.includes("CONTRADICTORY") && !exempt.has(f.id))
      .map((f) => f.id);
    expect(contradictory.filter((id) => !mapped.has(id))).toEqual([]);
  });

  it("queues the examples the way Amy should see them", () => {
    const byKey = new Map(CLG_KNOWLEDGE.map((k) => [k.key, k]));
    expect(queueCategory(byKey.get("service_area")!)).toBe("conflict");
    expect(productionAction(byKey.get("service_area")!)).toBe("Don't infer. Ask Amy.");
    // The sites disagree on the history claim (9 vs 20 years), so it is a conflict, not a single claim.
    expect(queueCategory(byKey.get("years_in_business")!)).toBe("conflict");
    expect(queueCategory(byKey.get("storage")!)).toBe("exact_words");
    expect(productionAction(byKey.get("storage")!)).toBe("Hold until Amy approves exact language.");
    expect(queueCategory(byKey.get("christmas_services")!)).toBe("quick_confirm");
  });

  it(`generates tests for every item (${TESTS.length} tests from ${CLG_KNOWLEDGE.length} items)`, () => {
    for (const k of CLG_KNOWLEDGE) {
      expect(TESTS.some((t) => t.itemKey === k.key && t.family === "ask")).toBe(true);
      expect(TESTS.some((t) => t.itemKey === k.key && t.family === "approval")).toBe(true);
    }
  });
});

describe("generated: site says X, caller asks X — can the agent answer?", () => {
  it.each(TESTS.filter((t) => t.family === "ask").map((t) => [t.id, t] as const))("%s", async (_id, t) => {
    if (t.family !== "ask") return;
    const call = await liveCall();
    const body = await ask(call, "get_approved_answer", { topic: t.topic, question: t.question });
    const text = JSON.stringify(body).toLowerCase();
    const leaked = t.mustNotLeak.filter((w) => text.includes(w.toLowerCase()));
    const pass = body.found === false && DEFER.test(String(body.instruction)) && leaked.length === 0;
    record(t, pass);
    expect(body.found).toBe(false);
    expect(String(body.instruction)).toMatch(DEFER);
    expect(leaked).toEqual([]);
  });
});

describe("generated: the agent repeats the website", () => {
  it.each(TESTS.filter((t) => t.family === "repeat").map((t) => [t.id, t] as const))("%s is flagged until Amy approves", async (_id, t) => {
    if (t.family !== "repeat") return;
    const report = await scan(t.spoken);
    const pass = report.violations.some((v) => v.code === "unapproved_claim" && v.ref === t.itemKey);
    record(t, pass);
    expect(pass, `${t.spoken} → ${JSON.stringify(report.violations)}`).toBe(true);
  });

  it("control: the deferral line is never flagged", async () => {
    expect((await scan("I don't want to give you the wrong answer on that. I'll make sure Amy covers it when she calls.")).violations).toEqual([]);
  });
});

describe("generated: the sites disagree — the agent must not choose either", () => {
  it.each(TESTS.filter((t) => t.family === "conflict").map((t) => [t.id, t] as const))("%s", async (_id, t) => {
    if (t.family !== "conflict") return;
    expect(new Set(t.values.map((v) => v.value)).size).toBeGreaterThanOrEqual(2);
    const spoken = t.values.filter((v) => v.detectable);
    const flagged = await Promise.all(spoken.map(async (v) => (await scan(v.spoken)).violations.some((x) => x.code === "unapproved_claim" && x.ref === t.itemKey)));
    const call = await liveCall();
    let undecided: boolean;
    if (t.kind === "service_area") {
      // Austin is on both sites, Lakeway only on The Light Guys: neither is confirmed or denied.
      const both = await ask(call, "check_service_area", { city: "Austin" });
      const one = await ask(call, "check_service_area", { city: "Lakeway" });
      const claimed = await scan("Yes, we serve Lakeway.");
      undecided = both.status === "unknown" && one.status === "unknown" && claimed.violations.some((v) => v.code === "service_area_unverified");
      expect([both.status, one.status]).toEqual(["unknown", "unknown"]);
    } else {
      const it0 = await item(t.itemKey);
      const body = await ask(call, "get_approved_answer", { topic: it0.topics[0] ?? t.itemKey, question: it0.callerQuestion });
      undecided = body.found === false;
      expect(body.found).toBe(false);
      expect(spoken.length).toBeGreaterThanOrEqual(2);
    }
    record(t, flagged.every(Boolean) && undecided);
    expect(flagged).toEqual(spoken.map(() => true));
    expect(undecided).toBe(true);
  });
});

describe("generated: after Amy approves her words", () => {
  it.each(TESTS.filter((t) => t.family === "approval").map((t) => [t.id, t] as const))("%s", async (_id, t) => {
    if (t.family !== "approval") return;
    const stored = await item(t.itemKey);
    await decideKnowledge(db, { itemId: stored.id, status: "approved", text: t.amyText, value: t.amyValue, by: "TEST: Amy" });
    await syncConfigFromKnowledge(db, { tenantId, businessId, by: "TEST: Amy" });
    try {
      const call = await liveCall();
      let answered: boolean;
      if (t.kind === "service_area") {
        const inArea = await ask(call, "check_service_area", { city: "Austin" });
        const outside = await ask(call, "check_service_area", { city: "Lakeway" });
        answered = inArea.status === "in_area" && outside.status === "not_listed";
        expect(inArea.status).toBe("in_area");
        expect(outside.status).toBe("not_listed"); // not on Amy's list: never a "no", Amy decides
      } else {
        const body = await ask(call, "get_approved_answer", { topic: t.topic, question: t.question });
        answered = body.found === true && body.answer === t.amyText;
        expect(body, `${t.question} → ${JSON.stringify(body)}`).toMatchObject({ found: true, answer: t.amyText });
      }
      const own = await scan(t.amyText);
      const ownClean = !own.violations.some((v) => v.code === "unapproved_claim" && v.ref === t.itemKey);
      expect(own.violations.filter((v) => v.ref === t.itemKey)).toEqual([]);
      const others = await Promise.all(t.stillForbidden.map(async (c) => (await scan(c.spoken)).violations.some((v) => v.code === "unapproved_claim" && v.ref === t.itemKey)));
      expect(others).toEqual(t.stillForbidden.map(() => true));
      record(t, answered && ownClean && others.every(Boolean));
    } finally {
      await decideKnowledge(db, { itemId: stored.id, status: "pending", text: null, value: null, by: "TEST: reset" });
      await syncConfigFromKnowledge(db, { tenantId, businessId, by: "TEST: reset" });
    }
  });
});
