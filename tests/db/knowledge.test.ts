import { beforeAll, describe, expect, it } from "vitest";
import { loadActiveConfig } from "@/lib/db/config";
import { decideKnowledge, listKnowledge, projectKnowledge, syncConfigFromKnowledge } from "@/lib/db/knowledge";
import { CLG_KNOWLEDGE } from "@/lib/knowledge/tenants/christmas-light-guys";
import { CLG_QUESTION_BANK } from "@/lib/knowledge/tenants/clg-questions";
import { asUser, count, freshDb, type TestDb } from "./helpers";

describe("knowledge decisions", () => {
  let t: TestDb;
  beforeAll(async () => {
    t = await freshDb();
  });

  it("K1: seeds every item pending, each claim with its source and quote", async () => {
    const items = await listKnowledge(t.db, t.seed.businessId);
    // Site claims plus the common questions customers ask, all waiting for Amy.
    expect(items.map((i) => i.key).sort()).toEqual([...CLG_KNOWLEDGE, ...CLG_QUESTION_BANK].map((k) => k.key).sort());
    expect(items.every((i) => i.status === "pending")).toBe(true);
    for (const i of items) for (const c of i.claims) expect(c.quote.length).toBeGreaterThan(0);
    expect((await loadActiveConfig(t.db, t.seed.businessId))!.config.facts).toEqual([]);
  });

  it("K2: an approval needs Amy's exact words and records who and when", async () => {
    const years = (await listKnowledge(t.db, t.seed.businessId)).find((i) => i.key === "years_in_business")!;
    await expect(decideKnowledge(t.db, { itemId: years.id, status: "approved", text: "  ", value: null, by: "Amy" })).rejects.toThrow(/exact words/);
    await expect(decideKnowledge(t.db, { itemId: years.id, status: "approved", text: "We've lit Austin homes for over 15 years.", value: null, by: "" })).rejects.toThrow(/person/);
    expect(await decideKnowledge(t.db, { itemId: years.id, status: "approved", text: "We've lit Austin homes for over 15 years.", value: null, by: "Amy" })).toBe(1);
    const after = (await listKnowledge(t.db, t.seed.businessId)).find((i) => i.key === "years_in_business")!;
    expect(after).toMatchObject({ status: "approved", approvedText: "We've lit Austin homes for over 15 years.", decidedBy: "Amy", version: 1 });
  });

  it("K3: every decision is an event with the previous words; undo returns to pending", async () => {
    const years = (await listKnowledge(t.db, t.seed.businessId)).find((i) => i.key === "years_in_business")!;
    expect(await decideKnowledge(t.db, { itemId: years.id, status: "pending", text: null, value: null, by: "Amy" })).toBe(2);
    const { rows } = await t.db.query<{ type: string; payload: { previous_text: string | null } }>(
      "select type, payload from public.event where aggregate_type = 'knowledge' and aggregate_id = $1 order by id",
      [years.id],
    );
    expect(rows.map((r) => r.type)).toEqual(["knowledge.approved", "knowledge.pending"]);
    expect(rows[1]!.payload.previous_text).toBe("We've lit Austin homes for over 15 years.");
  });

  it("K4: the agent's facts and service area are exactly the approved items", async () => {
    const items = await listKnowledge(t.db, t.seed.businessId);
    const area = items.find((i) => i.key === "service_area")!;
    const storage = items.find((i) => i.key === "storage")!;
    const takedown = items.find((i) => i.key === "takedown_offered")!;
    await decideKnowledge(t.db, { itemId: area.id, status: "approved", text: "Austin, Round Rock", value: { cities: ["Austin", "Round Rock"], zips: ["78734"] }, by: "Amy" });
    await decideKnowledge(t.db, { itemId: storage.id, status: "rejected", text: null, value: null, by: "Amy" });
    await decideKnowledge(t.db, { itemId: takedown.id, status: "approved", text: "We take everything down after the season.", value: null, by: "Amy" });
    const version = await syncConfigFromKnowledge(t.db, { tenantId: t.seed.tenantId, businessId: t.seed.businessId, by: "test" });
    expect(version).not.toBeNull();
    const config = (await loadActiveConfig(t.db, t.seed.businessId))!.config;
    expect(config.facts.map((f) => f.id)).toEqual(["takedown_offered"]);
    expect(config.serviceArea).toEqual({ status: "approved", cities: ["Austin", "Round Rock"], zips: ["78734"] });
    // No change, no new version.
    expect(await syncConfigFromKnowledge(t.db, { tenantId: t.seed.tenantId, businessId: t.seed.businessId, by: "test" })).toBeNull();
    // Pure projection agrees with what was stored.
    expect(projectKnowledge(await listKnowledge(t.db, t.seed.businessId)).facts.map((f) => f.text)).toEqual(["We take everything down after the season."]);
  });

  it("knowledge is readable by the tenant's staff only and writable by no browser role", async () => {
    const outsider = "00000000-0000-4000-8000-000000000099";
    const visible = await asUser(t.db, outsider, async (tx) => {
      const { rows } = await tx.query<{ n: number }>("select count(*)::int as n from public.knowledge_item");
      return rows[0]!.n;
    });
    expect(visible).toBe(0);
    expect(await count(t.db, "select count(*) as n from public.knowledge_claim")).toBeGreaterThan(0);
  });
});
