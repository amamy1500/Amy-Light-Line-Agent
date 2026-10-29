import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { migrations } from "@/lib/db/migrations.generated";
import { asAnon, asUser, freshDb, type TestDb } from "./helpers";

const STAFF = "00000000-0000-4000-8000-00000000a001";
const CLG_VIEWER = "00000000-0000-4000-8000-00000000a002";
const SUBLIME_VIEWER = "00000000-0000-4000-8000-00000000a003";
const OTHER_TENANT_STAFF = "00000000-0000-4000-8000-00000000b001";
const OUTSIDER = "00000000-0000-4000-8000-00000000c001";

describe("migrations bundle", () => {
  it("matches the .sql files exactly (run `npm run db:bundle` after editing a migration)", () => {
    const dir = fileURLToPath(new URL("../../supabase/migrations", import.meta.url));
    const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    expect(migrations.map((m) => m.id)).toEqual(files.map((f) => f.replace(/\.sql$/, "")));
    for (const file of files) {
      const sql = readFileSync(join(dir, file), "utf8").replace(/\r\n/g, "\n");
      expect(migrations.find((m) => m.id === file.replace(/\.sql$/, ""))?.sql).toBe(sql);
    }
  });
});

describe("I1 tenant and business isolation (RLS)", () => {
  let t: TestDb;
  let sublimeId: string;
  let otherTenantLead: string;
  let clgLead: string;
  let sublimeLead: string;

  beforeAll(async () => {
    t = await freshDb();
    const { db, seed } = t;
    const id = async (sql: string, params: unknown[]) => (await db.query<{ id: string }>(sql, params)).rows[0]!.id;

    sublimeId = await id(
      "insert into public.business (tenant_id, name, lifecycle_stage) values ($1, 'Sublime Patio', 'client') returning id",
      [seed.tenantId],
    );
    clgLead = await id(
      "insert into public.lead (tenant_id, business_id, source, contact_phone) values ($1, $2, 'web_form', '+15125550111') returning id",
      [seed.tenantId, seed.businessId],
    );
    sublimeLead = await id(
      "insert into public.lead (tenant_id, business_id, source, contact_phone) values ($1, $2, 'web_form', '+15125550112') returning id",
      [seed.tenantId, sublimeId],
    );
    const otherTenant = await id("insert into public.tenant (name) values ('Other Agency') returning id", []);
    const otherBusiness = await id(
      "insert into public.business (tenant_id, name) values ($1, 'Other Plumbing') returning id",
      [otherTenant],
    );
    otherTenantLead = await id(
      "insert into public.lead (tenant_id, business_id, source, contact_phone) values ($1, $2, 'web_form', '+15125550113') returning id",
      [otherTenant, otherBusiness],
    );

    await db.query(
      `insert into public.membership (tenant_id, user_id, role, business_id) values
         ($1, $2, 'operator', null),
         ($1, $3, 'client_viewer', $4),
         ($1, $5, 'client_viewer', $6),
         ($7, $8, 'owner', null)`,
      [seed.tenantId, STAFF, CLG_VIEWER, seed.businessId, SUBLIME_VIEWER, sublimeId, otherTenant, OTHER_TENANT_STAFF],
    );
  });

  const visibleLeads = (user: string) =>
    asUser(t.db, user, async (tx) => (await tx.query<{ id: string }>("select id from public.lead")).rows.map((r) => r.id));

  it("staff see every business in their tenant and nothing from another tenant", async () => {
    const ids = await visibleLeads(STAFF);
    expect(ids).toEqual(expect.arrayContaining([clgLead, sublimeLead]));
    expect(ids).not.toContain(otherTenantLead);
  });

  it("a client_viewer sees only their own business", async () => {
    expect(await visibleLeads(CLG_VIEWER)).toEqual([clgLead]);
    expect(await visibleLeads(SUBLIME_VIEWER)).toEqual([sublimeLead]);
  });

  it("another tenant's staff see only their tenant", async () => {
    expect(await visibleLeads(OTHER_TENANT_STAFF)).toEqual([otherTenantLead]);
  });

  it("a signed-in user with no membership sees nothing", async () => {
    expect(await visibleLeads(OUTSIDER)).toEqual([]);
  });

  it("client viewers cannot see phone-routing config, alert contacts or the outbox", async () => {
    await asUser(t.db, CLG_VIEWER, async (tx) => {
      for (const table of ["tracking_number", "alert_contact", "outbox"]) {
        const { rows } = await tx.query(`select 1 from public.${table}`);
        expect(rows, table).toEqual([]);
      }
    });
  });

  it("anonymous requests cannot read leads at all", async () => {
    await expect(asAnon(t.db, (tx) => tx.query("select * from public.lead"))).rejects.toThrow(/permission denied/);
  });

  it("signed-in users cannot write tables directly", async () => {
    await expect(
      asUser(t.db, STAFF, (tx) => tx.query("update public.lead set state = 'won', amount_cents = 1 where id = $1", [clgLead])),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(t.db, STAFF, (tx) =>
        tx.query("insert into public.lead (tenant_id, business_id, source) values ($1, $2, 'web_form')", [
          t.seed.tenantId,
          t.seed.businessId,
        ]),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("signed-in users cannot call the webhook-only writer functions", async () => {
    await expect(
      asUser(t.db, STAFF, (tx) => tx.query("select app.ingest_inbound_call('CAx', '+15125550147', '+15125550101', false)")),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(t.db, STAFF, (tx) =>
        tx.query("select app.emit($1, null, 'lead', $2, 'forged', '{}', 'user', null)", [t.seed.tenantId, clgLead]),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("staff can record an outcome, and are logged as themselves whatever actor they claim", async () => {
    await asUser(t.db, STAFF, (tx) =>
      tx.query("select app.transition_lead($1, 'connected', 'system', 'spoofed', null)", [clgLead]),
    );
    const { rows } = await t.db.query<{ actor_type: string; actor_id: string }>(
      "select actor_type, actor_id from public.event where aggregate_id = $1 and type = 'lead.state_changed' order by id desc limit 1",
      [clgLead],
    );
    expect(rows[0]).toEqual({ actor_type: "user", actor_id: STAFF });
  });

  it("client viewers cannot record outcomes, even for their own business", async () => {
    await expect(
      asUser(t.db, CLG_VIEWER, (tx) => tx.query("select app.transition_lead($1, 'quoted', 'user', null, null)", [clgLead])),
    ).rejects.toThrow(/not allowed/);
  });
});

describe("I2 the event log is append-only", () => {
  it("rejects UPDATE, DELETE and TRUNCATE even for the database owner", async () => {
    const { db } = await freshDb();
    await db.query(
      "insert into public.event (tenant_id, aggregate_type, aggregate_id, type, actor_type) select id, 'tenant', id, 'test', 'system' from public.tenant limit 1",
    );
    await expect(db.query("update public.event set type = 'changed'")).rejects.toThrow(/append-only/);
    await expect(db.query("delete from public.event")).rejects.toThrow(/append-only/);
    await expect(db.query("truncate public.event")).rejects.toThrow(/append-only/);
  });
});
