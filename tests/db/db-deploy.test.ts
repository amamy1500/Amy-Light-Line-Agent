import { beforeEach, describe, expect, it } from "vitest";
import { parseBusinessConfig } from "@/lib/business-rules/config";
import { activateConfig } from "@/lib/db/config";
import { primaryBusiness } from "@/lib/db/dashboard";
import type { Executor } from "@/lib/db/migrate";
import { openPglite } from "@/lib/db/pglite";
import { seedChristmasLightGuys } from "@/lib/db/seed";
import { prepareDatabase } from "@/scripts/db-deploy";

// Render's pre-deploy step against a fresh database, as on the first deploy
// to Supabase, then again as on every later deploy.

const ENV = {
  OWNER_NAME: "Amy",
  CLG_MAIN_NUMBER: "+15125550160",
  AI_MODE: "always",
  RING_START: "09:00",
  RING_END: "18:00",
  RING_DAYS: "1,2,3,4,5,6",
  AMY_DECISIONS: "on",
};
const quiet = () => {};

async function aiOf(db: Executor) {
  const clg = (await primaryBusiness(db))!;
  return { clg, ai: parseBusinessConfig(clg.config).ai };
}

describe("db:deploy", () => {
  let db: Executor;
  beforeEach(async () => {
    db = await openPglite();
  });

  it("seeds the office on the first deploy, with the real number, AI mode and Amy's answers", async () => {
    const log: string[] = [];
    await prepareDatabase(db, ENV, (m) => log.push(m));
    expect(log[0]).toMatch(/^office: seeded \(AI mode always, number \+15125550160\)/);
    const { rows } = await db.query<{ e164: string }>("select e164 from public.tracking_number where e164 = $1", [ENV.CLG_MAIN_NUMBER]);
    expect(rows).toHaveLength(1);
    const { ai } = await aiOf(db);
    expect(ai.mode).toBe("always");
    const { rows: approved } = await db.query("select 1 from public.knowledge_item where key = 'quote_process' and status = 'approved'");
    expect(approved).toHaveLength(1);
  });

  it("a later deploy brings the agent id but keeps what Amy changed in Settings", async () => {
    await prepareDatabase(db, ENV, quiet);
    const { clg, ai } = await aiOf(db);
    // Amy turns the AI off from the dashboard.
    await activateConfig(db, { tenantId: clg.tenantId, businessId: clg.businessId, config: { ...parseBusinessConfig(clg.config), ai: { ...ai, mode: "off" } }, createdBy: "amy" });

    const log: string[] = [];
    await prepareDatabase(db, { ...ENV, AGENT_ID: "agent_live_1" }, (m) => log.push(m));
    expect(log).toContain("office: up to date");
    const after = await aiOf(db);
    expect(after.ai.agentId).toBe("agent_live_1");
    expect(after.ai.mode).toBe("off");

    // Nothing changed: no new config version.
    const version = after.clg.version;
    await prepareDatabase(db, { ...ENV, AGENT_ID: "agent_live_1" }, quiet);
    expect((await aiOf(db)).clg.version).toBe(version);
  });

  it("brings an office seeded on 2026-10-29 up to this release: 'our team', weekday callback hours, Amy's goodbye", async () => {
    await prepareDatabase(db, ENV, quiet);
    const { clg } = await aiOf(db);
    // As the live office was seeded that morning: Josh named, no callback hours, no goodbye.
    const { callbackBy: _, goodbye: __, ...brand } = parseBusinessConfig(clg.config).brand;
    const seeded = parseBusinessConfig(clg.config);
    await activateConfig(db, {
      tenantId: clg.tenantId,
      businessId: clg.businessId,
      config: parseBusinessConfig({
        ...seeded,
        configVersion: "clg-2026.10.29-1",
        brand: { ...brand, callbackFirstName: "Josh" },
        profile: { ...seeded.profile, collect: seeded.profile.collect.replace("our team", "Josh") },
        callbackHours: undefined,
      }),
      createdBy: "scripts/db-deploy.ts",
    });

    const log: string[] = [];
    await prepareDatabase(db, ENV, (m) => log.push(m));
    expect(log).toContain("Christmas Light Guys: config clg-2026.10.29-2");
    const now = parseBusinessConfig((await aiOf(db)).clg.config);
    expect(now.brand.callbackBy).toBe("our team");
    expect(now.brand.goodbye).toMatch(/^Thanks for calling The Christmas Light Guys, we are looking forward/);
    expect(now.callbackHours).toEqual([1, 2, 3, 4, 5].map((day) => ({ day, open: "09:00", close: "17:00" })));
    expect(now.profile.collect).toContain("the best time for our team to call back");

    // The next deploy has nothing to do.
    const version = (await aiOf(db)).clg.version;
    await prepareDatabase(db, ENV, quiet);
    expect((await aiOf(db)).clg.version).toBe(version);
  });

  it("puts Amy's ring number on every line once it is set", async () => {
    await prepareDatabase(db, ENV, quiet);
    await prepareDatabase(db, { ...ENV, OWNER_RING_E164: "+15125550177" }, quiet);
    const { rows } = await db.query<{ owner_ring_e164: string }>("select distinct owner_ring_e164 from public.tracking_number");
    expect(rows.map((r) => r.owner_ring_e164)).toEqual(["+15125550177"]);
  });

  it("refuses a database without the real number, or one holding the demo seed", async () => {
    await expect(prepareDatabase(db, { ...ENV, CLG_MAIN_NUMBER: "" }, quiet)).rejects.toThrow(/CLG_MAIN_NUMBER/);
    await seedChristmasLightGuys(db, {
      ownerName: "Amy",
      ownerRingE164: "+15125550199",
      numbers: { tv: "+15125550101", web: "+15125550102", print: "+15125550103" },
      demoApprovedKeys: ["quote_process"],
    });
    await expect(prepareDatabase(db, ENV, quiet)).rejects.toThrow(/demo seed/);
  });
});
