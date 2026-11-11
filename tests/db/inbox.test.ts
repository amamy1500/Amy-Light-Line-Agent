import { beforeAll, describe, expect, it } from "vitest";
import { inbox, type InboxQuery } from "@/lib/db/dashboard";
import { freshDb, type TestDb } from "./helpers";

// The calls inbox (2026-11-10 redesign): tabs, search, quick filters and sorting over the leads Amy works.
let t: TestDb;
const ids: Record<string, string> = {};

const q = (over: Partial<InboxQuery> = {}): InboxQuery => ({ view: "all", filters: [], search: "", sort: "newest", businessId: null, ...over });
const names = async (over: Partial<InboxQuery>) => (await inbox(t.db, q(over))).leads.map((l) => l.contactName);

async function lead(name: string, fields: { phone: string; state?: string; intent?: string; address?: string; wants?: string; property?: string; returning?: boolean; price?: boolean; minutesAgo: number; callback?: boolean; mapsHidden?: boolean }) {
  const { rows } = await t.db.query<{ id: string }>(
    `insert into public.lead (tenant_id, business_id, source, state, intent, contact_name, contact_phone, address, service_wanted, property_type,
                              customer_type, compliance, amount_cents, created_at)
     values ($1, $2, 'call_recovery', $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, case when $3 = 'won' then 120000 end,
             now() - make_interval(mins => $12::int)) returning id`,
    [t.seed.tenantId, t.seed.businessId, fields.state ?? "new", fields.intent ?? "warm", name, fields.phone, fields.address ?? null, fields.wants ?? null,
     fields.property ?? "residential", fields.returning ? "returning" : "new", JSON.stringify({ summary: { priceAsked: Boolean(fields.price) } }), fields.minutesAgo],
  );
  const id = rows[0]!.id;
  ids[name] = id;
  if (fields.callback) {
    await t.db.query("insert into public.task (tenant_id, business_id, lead_id, kind, due_window) values ($1, $2, $3, 'callback', 'this afternoon')", [t.seed.tenantId, t.seed.businessId, id]);
  }
  if (fields.mapsHidden) {
    await t.db.query(
      "insert into public.lead_fact (tenant_id, business_id, lead_id, field, value, source) values ($1, $2, $3, 'maps_visible', 'no', 'caller_via_agent')",
      [t.seed.tenantId, t.seed.businessId, id],
    );
  }
}

beforeAll(async () => {
  t = await freshDb();
  await lead("Sam Patel", { phone: "+15125550120", intent: "hot", address: "2014 Robs Glen, Austin", wants: "roofline and two wreaths", price: true, minutesAgo: 5, callback: true });
  await lead("Dana Mohs", { phone: "+15125550121", address: "19128 Sedge Wren Ln, Pflugerville", wants: "holiday lighting quote", minutesAgo: 60, callback: true, mapsHidden: true });
  await lead("Mike Turner", { phone: "+15125550122", address: "400 W Parsons St, Manor", wants: "patio lights for a restaurant", property: "commercial", minutesAgo: 120, callback: true });
  await lead("Angela White", { phone: "+15125550123", state: "connected", wants: "same setup as last year", returning: true, minutesAgo: 600 });
  await lead("Lisa Nguyen", { phone: "+15125550124", state: "won", wants: "roofline and trees", minutesAgo: 2000 });
  await lead("Kevin Brooks", { phone: "+15125550125", state: "lost", minutesAgo: 3000 });
  await lead("Robocall", { phone: "+15125550126", state: "spam", intent: "not_a_lead", minutesAgo: 30 });
  await lead("Hung up", { phone: "+15125550127", intent: "unknown", minutesAgo: 40 });
});

describe("the calls inbox", () => {
  it("puts each lead in exactly one working tab, and counts every tab", async () => {
    const { counts } = await inbox(t.db, q());
    expect(counts).toEqual({ waiting: 3, followed_up: 1, won: 1, lost: 1, noise: 2, all: 8 });
    expect(await names({ view: "waiting", sort: "newest" })).toEqual(["Sam Patel", "Dana Mohs", "Mike Turner"]);
    expect(await names({ view: "followed_up" })).toEqual(["Angela White"]);
    expect(await names({ view: "noise" })).toEqual(["Robocall", "Hung up"]);
  });

  it("works the waiting list hottest first, and sorts by time either way", async () => {
    expect((await names({ view: "waiting", sort: "priority" }))[0]).toBe("Sam Patel");
    expect(await names({ view: "waiting", sort: "oldest" })).toEqual(["Mike Turner", "Dana Mohs", "Sam Patel"]);
  });

  it("finds a caller by name, address, what they want, or any part of the phone number", async () => {
    expect(await names({ search: "patel" })).toEqual(["Sam Patel"]);
    expect(await names({ search: "Pflugerville" })).toEqual(["Dana Mohs"]);
    expect(await names({ search: "wreath" })).toEqual(["Sam Patel"]);
    expect(await names({ search: "(512) 555-0122" })).toEqual(["Mike Turner"]);
    expect(await names({ search: "0123" })).toEqual(["Angela White"]);
    // Search text is data, never SQL or a wildcard.
    expect(await names({ search: "%" })).toEqual([]);
    expect(await names({ search: "'; drop table public.lead; --" })).toEqual([]);
    expect((await inbox(t.db, q({ search: "patel" }))).counts).toMatchObject({ waiting: 1, all: 1 });
  });

  it("narrows any tab with quick filters, which combine", async () => {
    expect(await names({ filters: ["hot"] })).toEqual(["Sam Patel"]);
    expect(await names({ filters: ["site_visit"] })).toEqual(["Dana Mohs"]);
    expect(await names({ filters: ["price"] })).toEqual(["Sam Patel"]);
    expect(await names({ filters: ["business"] })).toEqual(["Mike Turner"]);
    expect(await names({ filters: ["returning"] })).toEqual(["Angela White"]);
    expect(await names({ view: "waiting", filters: ["hot", "site_visit"] })).toEqual([]);
  });

  it("says when a tab holds more than it shows", async () => {
    const page = await inbox(t.db, q({ limit: 2 }));
    expect(page.leads).toHaveLength(2);
    expect(page.truncated).toBe(true);
    expect(page.leads[0]).toMatchObject({ callCount: 0, lastCallAt: null });
  });
});
