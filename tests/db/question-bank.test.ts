import { beforeAll, describe, expect, it } from "vitest";
import { simulatorConnector } from "@/lib/agents/connector";
import { runTool } from "@/lib/agents/gateway";
import { seedChristmasLightGuys, type Queryable } from "@/lib/db";
import { loadActiveConfig } from "@/lib/db/config";
import { decideKnowledge, listKnowledge, syncConfigFromKnowledge } from "@/lib/db/knowledge";
import { openPglite } from "@/lib/db/pglite";
import { isQuestionBank, queueCategory } from "@/lib/knowledge/model";
import { CLG_KNOWLEDGE } from "@/lib/knowledge/tenants/christmas-light-guys";
import { CLG_QUESTION_BANK } from "@/lib/knowledge/tenants/clg-questions";
import { handleInbound, type VoiceDeps } from "@/lib/server/voice";

// The questions customers ask most (docs/research/clg-customer-questions.md §5):
// templates for Amy to answer once, never facts until she writes them.
const LINE = "+15125550101";
const NIGHT = new Date("2026-10-21T04:00:00Z");

describe("question bank (pure)", () => {
  it("is 39 templates, each a blank only Amy can fill, with keys of its own", () => {
    expect(CLG_QUESTION_BANK).toHaveLength(39);
    const keys = CLG_QUESTION_BANK.map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
    const siteKeys = new Set(CLG_KNOWLEDGE.map((i) => i.key));
    for (const item of CLG_QUESTION_BANK) {
      expect(item.key).toMatch(/^[a-z][a-z0-9_]{1,63}$/);
      expect(siteKeys.has(item.key)).toBe(false);
      expect(item.kind).toBe("policy");
      expect(item.status).toBe("pending");
      expect(item.suggestedText).toMatch(/\[[^\]]*\]/); // can't be approved as-is
      expect(isQuestionBank(item)).toBe(true);
      expect(queueCategory(item)).toBe("question_bank");
      expect(item.topics.length).toBeGreaterThanOrEqual(2);
    }
    // Site claims are never mistaken for questions.
    for (const item of CLG_KNOWLEDGE) expect(isQuestionBank(item)).toBe(false);
  });
});

describe("question bank in the database", () => {
  let db: Queryable;
  let tenantId: string;
  let businessId: string;

  beforeAll(async () => {
    db = await openPglite();
    ({ tenantId, businessId } = await seedChristmasLightGuys(db, {
      ownerName: "Amy",
      ownerRingE164: "+15125550199",
      numbers: { tv: LINE, web: "+15125550102", print: "+15125550103" },
      alertSms: "+15125550198",
      ringStart: "09:00",
      ringEnd: "18:00",
      aiMode: "always",
      agentId: "agent_qb",
      maxConcurrentSessions: 50,
    }));
  });

  const item = async (key: string) => (await listKnowledge(db, businessId)).find((i) => i.key === key)!;
  const ask = async (topic: string, question: string) => {
    const call = `CA${Date.now().toString(16).padStart(32, "0")}`;
    const deps: VoiceDeps = { db, now: () => NIGHT, baseUrl: "https://qb.example.test", agent: simulatorConnector() };
    await handleInbound({ CallSid: call, From: `+1512555${String(Date.now() % 9000 + 1000)}`, To: LINE }, deps);
    return runTool("get_approved_answer", { call_sid: call, topic, question }, {
      db,
      now: NIGHT,
      loadConfig: async (id: string) => (await loadActiveConfig(db, id))?.config ?? null,
      scheduleHandoff: async () => {},
    });
  };

  it("is seeded beside the site claims, waiting for Amy", async () => {
    const items = await listKnowledge(db, businessId);
    expect(items.filter((i) => queueCategory(i) === "question_bank" && i.status === "pending")).toHaveLength(39);
  });

  it("until Amy answers, the assistant defers and the question is kept for her", async () => {
    const res = await ask("colors", "What colors can I get?");
    expect(res.body).toMatchObject({ ok: true, found: false });
  });

  it("a template with [blanks] can never be approved, by any path", async () => {
    const colors = await item("color_options");
    await expect(
      decideKnowledge(db, { itemId: colors.id, status: "approved", text: colors.suggestedText, value: null, by: "operator" }),
    ).rejects.toThrow(/bracketed/);
    expect((await item("color_options")).status).toBe("pending");
  });

  it("reaches an office seeded before it existed, without touching Amy's decisions", async () => {
    // As if this database predates one of the questions.
    const missing = await item("payment_methods");
    await db.query("delete from public.knowledge_claim where item_id = $1", [missing.id]);
    await db.query("delete from public.knowledge_item where id = $1", [missing.id]);
    const before = (await listKnowledge(db, businessId)).length;
    await seedChristmasLightGuys(db, { ownerName: "Amy", ownerRingE164: "+15125550199", numbers: { tv: LINE, web: "+15125550102", print: "+15125550103" } });
    const after = await listKnowledge(db, businessId);
    expect(after.length).toBe(before + 1);
    expect(after.find((i) => i.key === "payment_methods")?.status).toBe("pending");
  });

  it("once Amy writes her words, the next call answers with exactly them", async () => {
    const colors = await item("color_options");
    await decideKnowledge(db, { itemId: colors.id, status: "approved", text: "We offer classic warm white and multicolor.", value: null, by: "operator" });
    await syncConfigFromKnowledge(db, { tenantId, businessId, by: "approval:color_options" });
    const res = await ask("colors", "What colors can I get?");
    expect(res.body).toMatchObject({ ok: true, found: true, answer: "We offer classic warm white and multicolor." });
  });
});
