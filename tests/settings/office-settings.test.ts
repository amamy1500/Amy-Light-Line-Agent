import { beforeAll, describe, expect, it } from "vitest";
import { simulatorConnector } from "@/lib/agents/connector";
import { parseBusinessConfig } from "@/lib/business-rules/config";
import { seedOffice, type Queryable } from "@/lib/db";
import { activateConfig, loadActiveConfig } from "@/lib/db/config";
import { openPglite } from "@/lib/db/pglite";
import { handleInbound, type VoiceDeps } from "@/lib/server/voice";
import { changedSections, configHistory, parseClosures, restoreConfigVersion, saveSettings } from "@/lib/settings/office-settings";
import { ensureDigestJobs, nextDigestAt } from "@/workflows/post-call/digest";

// Settings: everything Amy can change without a developer takes effect on
// the next call, is validated by the same schema the phone path uses, and is
// kept as a version she can restore.
const BASE = "https://clg.example.test";
const AMY = "+15125550199";
const LINE = "+15125550101";
const NIGHT = new Date("2026-10-21T04:00:00Z"); // Tue 11:00 pm in Austin
const DAYTIME = new Date("2026-10-20T18:00:00Z"); // Tue 1:00 pm in Austin

let db: Queryable;
let ids: Awaited<ReturnType<typeof seedOffice>>;
let seq = 0;
const sid = () => `CA${(0xe000 + ++seq).toString(16).padStart(32, "0")}`;
const voice = (now = NIGHT): VoiceDeps => ({ db, now: () => now, baseUrl: BASE, agent: simulatorConnector() });
const param = (twiml: string, name: string) =>
  new RegExp(`name="${name}" value="([^"]*)"`).exec(twiml)?.[1]?.replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'") ?? null;
const form = (fields: Record<string, string | string[]>) => {
  const f = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) for (const x of [v].flat()) f.append(k, x);
  return f;
};
const save = (section: string, fields: Record<string, string | string[]>, businessId: string | null = null) =>
  saveSettings(db, { section, businessId, form: form(fields), actor: "operator" });
const config = async (businessId = ids.businessId) => (await loadActiveConfig(db, businessId))!;
const officeIds = () => [ids.businessId, ids.sublimePatioId!, ids.theFridgeId!, ids.frontDeskId!];
const HOURS = Object.fromEntries(
  [1, 2, 3, 4, 5, 6].flatMap((d) => [[`day_${d}`, "on"], [`open_${d}`, "09:00"], [`close_${d}`, "18:00"]]),
) as Record<string, string>;

beforeAll(async () => {
  db = await openPglite();
  ids = await seedOffice(db, {
    ownerName: "Amy",
    ownerRingE164: AMY,
    numbers: { tv: LINE, web: "+15125550102", print: "+15125550103" },
    alertSms: "+15125550198",
    ringStart: "09:00",
    ringEnd: "18:00",
    ringDays: [1, 2, 3, 4, 5, 6],
    aiMode: "overflow",
    agentId: "agent_settings",
    maxConcurrentSessions: 50,
    office: { sublimePatio: "+15125550104", theFridge: "+15125550105", sharedLine: "+15125550106" },
  });
});

describe("who answers", () => {
  it("one save switches every company and the shared line to 'assistant answers first'", async () => {
    const before = await config();
    const result = await save("answering", { mode: "always", transfer_enabled: "on", transfer_only_in_hours: "on", transfer_max_attempts: "1" });
    expect(result).toEqual({ ok: true, changed: 4 });
    for (const id of officeIds()) expect((await config(id)).config.ai.mode).toBe("always");
    expect((await config()).version).toBe(before.version + 1);
    // Saving the same thing again writes nothing.
    expect(await save("answering", { mode: "always", transfer_enabled: "on", transfer_only_in_hours: "on", transfer_max_attempts: "1" })).toEqual({ ok: true, changed: 0 });
  });

  it("an unknown mode is refused and nothing changes", async () => {
    const before = await config();
    const result = await save("answering", { mode: "sometimes", transfer_max_attempts: "9" });
    expect(result.ok).toBe(false);
    expect((await config()).version).toBe(before.version);
  });
});

describe("a new person takes over the phones (Amy is hiring after Jan 1)", () => {
  it("name, greeting and ring phone change on the very next call, with no agent re-publish", async () => {
    expect(await save("owner", { owner_first_name: "Jordan", ring_phone: "(512) 555-0177", ring_seconds: "25" })).toMatchObject({ ok: true });
    for (const id of officeIds()) {
      expect((await config(id)).config.brand).toMatchObject({ ownerFirstName: "Jordan", assistantRole: "Jordan's AI assistant" });
    }
    const lines = await db.query<{ owner_name: string; owner_ring_e164: string; ring_timeout_s: number }>(
      "select distinct owner_name, owner_ring_e164, ring_timeout_s from public.tracking_number",
    );
    expect(lines.rows).toEqual([{ owner_name: "Jordan", owner_ring_e164: "+15125550177", ring_timeout_s: 25 }]);

    const ai = await handleInbound({ CallSid: sid(), From: "+15125550301", To: LINE }, voice());
    expect(param(ai, "opening")).toContain("I'm Jordan's AI assistant");

    await save("answering", { mode: "overflow", transfer_enabled: "on", transfer_only_in_hours: "on", transfer_max_attempts: "1" });
    const ring = await handleInbound({ CallSid: sid(), From: "+15125550302", To: LINE }, voice(DAYTIME));
    expect(ring).toContain("+15125550177");
    expect(ring).toContain('timeout="25"');
  });

  it("refuses an introduction that hides it's an AI, and a phone that isn't one", async () => {
    const before = await config();
    const result = await save("owner", { owner_first_name: "Jordan", assistant_role: "Jordan from the office", ring_phone: "555", ring_seconds: "25" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(" ")).toMatch(/must say it's an AI/);
      expect(result.errors.join(" ")).toMatch(/US number/);
    }
    expect((await config()).version).toBe(before.version);
  });
});

describe("hours and closed days", () => {
  it("on a closed day Amy's phone doesn't ring; the assistant knows today and the days coming up", async () => {
    const result = await save("hours", {
      ...HOURS,
      timezone: "America/Chicago",
      closures: "2026-10-20 Crew day off\n2026-10-29: Fall cleanup\n2026-11-26 - Thanksgiving",
    });
    expect(result).toMatchObject({ ok: true });
    expect((await config()).config.closures.map((c) => c.date)).toEqual(["2026-10-20", "2026-10-29", "2026-11-26"]);

    const twiml = await handleInbound({ CallSid: sid(), From: "+15125550303", To: LINE }, voice(DAYTIME));
    expect(twiml).not.toContain("<Dial"); // Tuesday 1 PM would ring, but the office is closed
    const note = param(twiml, "ring_hours_note")!;
    expect(note).toContain("closed today (Crew day off)");
    expect(note).toContain("Thursday, October 29 (Fall cleanup)");
    expect(note).not.toContain("Thanksgiving"); // more than three weeks out
  });

  it("callback hours reach every company and the very next call (Amy, 2026-10-29)", async () => {
    const weekdays = Object.fromEntries(
      [1, 2, 3, 4, 5].flatMap((d) => [[`cb_day_${d}`, "on"], [`cb_open_${d}`, "10:00"], [`cb_close_${d}`, "16:00"]]),
    ) as Record<string, string>;
    expect(await save("callbacks", weekdays)).toMatchObject({ ok: true });
    for (const id of officeIds()) expect((await config(id)).config.callbackHours).toHaveLength(5);

    const twiml = await handleInbound({ CallSid: sid(), From: "+15125550304", To: LINE }, voice());
    expect(param(twiml, "callback_hours")).toBe("on weekdays, between ten and four");

    const none = await save("callbacks", {});
    expect(none.ok).toBe(false);
    if (!none.ok) expect(none.errors).toEqual(["Callback hours: keep at least one day, so callers can be offered a time."]);
    expect(changedSections({ callbackHours: [] }, { callbackHours: [{ day: 1, open: "09:00", close: "17:00" }] })).toEqual(["Callback hours"]);
  });

  it("bad times and dates are explained, and the old hours stay", async () => {
    const before = await config();
    const result = await save("hours", { day_1: "on", open_1: "18:00", close_1: "09:00", timezone: "America/Chicago", closures: "next tuesday" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toEqual([
      "Monday: closing time must be after opening time.",
      'Closed days: "next tuesday" isn\'t a date like 2026-11-26.',
    ]);
    expect((await config()).version).toBe(before.version);
  });

  it("closed-day lines: impossible dates rejected, duplicates merged", () => {
    const errors: string[] = [];
    expect(parseClosures("2026-02-30 nope\n2026-12-25 Christmas\n2026-12-25 Christmas Day", errors)).toEqual([
      { date: "2026-12-25", label: "Christmas Day" },
    ]);
    expect(errors).toHaveLength(1);
  });
});

describe("spam screening", () => {
  it("can be loosened: hidden numbers then reach the assistant without pressing 1", async () => {
    const off = await save("spam", { gate_failed_caller_id: "on", auto_flag_after: "3", auto_flag_days: "14" });
    expect(off).toMatchObject({ ok: true });
    expect((await config()).config.screening).toEqual({ gateHiddenNumbers: false, gateFailedCallerId: true, autoFlagAfter: 3, autoFlagDays: 14 });
    const twiml = await handleInbound({ CallSid: sid(), From: "+266696687", To: LINE }, voice());
    expect(twiml).not.toContain("<Gather");
    expect(twiml).toContain("<Connect");

    await save("spam", { gate_hidden: "on", gate_failed_caller_id: "on", auto_flag_after: "2", auto_flag_days: "30" });
    expect(await handleInbound({ CallSid: sid(), From: "+266696687", To: LINE }, voice())).toContain("<Gather");
  });
});

describe("alerts", () => {
  it("never leaves the office with nobody to tell", async () => {
    const result = await save("alerts", { sms: "", email: "", daily_summary_time: "08:00" });
    expect(result).toEqual({ ok: false, errors: ["Keep at least one phone or email, so every caller reaches someone."] });
  });

  it("the contact list is what gets texted and emailed", async () => {
    const result = await save("alerts", {
      sms: "(512) 555-0111, 512-555-0112",
      email: "Amy@Example.com",
      hold_likely_spam: "on",
      daily_summary: "on",
      daily_summary_time: "07:30",
    });
    expect(result).toMatchObject({ ok: true });
    const { rows } = await db.query<{ channel: string; address: string; active: boolean }>(
      "select channel, address, active from public.alert_contact where business_id = $1 order by channel, address",
      [ids.businessId],
    );
    expect(rows).toEqual([
      { channel: "email", address: "amy@example.com", active: true },
      { channel: "sms", address: "+15125550111", active: true },
      { channel: "sms", address: "+15125550112", active: true },
      { channel: "sms", address: "+15125550198", active: false },
    ]);
    expect((await config()).config.alerts).toEqual({ holdLikelySpam: true, dailySummary: true, dailySummaryTime: "07:30" });
  });

  it("the daily summary follows its time, and stops being scheduled when turned off", async () => {
    expect(nextDigestAt(new Date("2026-10-23T12:00:00Z"), "America/Chicago", "07:30").at.toISOString()).toBe("2026-10-23T12:30:00.000Z");
    const jobs = async (date: string) =>
      Number((await db.query<{ n: string | number }>("select count(*) as n from public.job where dedupe_key = $1", [`daily_digest:${ids.businessId}:${date}`])).rows[0]!.n);
    await ensureDigestJobs(db, new Date("2026-10-24T06:00:00Z"));
    expect(await jobs("2026-10-24")).toBe(1);

    await save("alerts", { sms: "(512) 555-0111", hold_likely_spam: "on", daily_summary_time: "07:30" });
    await ensureDigestJobs(db, new Date("2026-10-25T06:00:00Z"));
    expect(await jobs("2026-10-25")).toBe(0);
  });
});

describe("company details", () => {
  it("apply to the one company picked, and need at least one question", async () => {
    expect((await save("company", { spoken_name: "Sublime Patio" }, ids.sublimePatioId)).ok).toBe(false);
    const clgIntake = (await config()).config.intake;
    const result = await save(
      "company",
      {
        spoken_name: "Sublime Patio",
        description: "an outdoor living and patio company in Austin",
        caller_focus: "Callers want patios, pergolas and outdoor kitchens.",
        collect: "Their name, the address, the project, and the best time to call back.",
        aliases: "Sublime, Sublime Patios",
        signals: "patio, pergola",
        escalate_topics: "complaint",
        intake: ["callback_window", "caller_name", "property_address"],
      },
      ids.sublimePatioId,
    );
    expect(result).toEqual({ ok: true, changed: 1 });
    const sublime = (await config(ids.sublimePatioId!)).config;
    expect(sublime.profile.aliases).toEqual(["Sublime", "Sublime Patios"]);
    expect(new Set(sublime.intake)).toEqual(new Set(["callback_window", "caller_name", "property_address"]));
    expect((await config()).config.intake).toEqual(clgIntake); // other companies untouched
  });

  it("can't be saved for the shared line, which isn't a company", async () => {
    const result = await save("company", { spoken_name: "Front desk" }, ids.frontDeskId);
    expect(result).toEqual({ ok: false, errors: ["Pick a company first."] });
  });
});

describe("history", () => {
  it("lists what each version changed", async () => {
    const history = await configHistory(db, ids.businessId);
    expect(history[0]!.active).toBe(true);
    expect(history.map((h) => h.changes).flat()).toEqual(expect.arrayContaining(["Who answers", "Owner & ring phone", "Hours & closed days", "Spam screening", "Alerts"]));
    expect(changedSections({ ai: { mode: "off" } }, { ai: { mode: "always" } })).toEqual(["Who answers"]);
  });

  it("restore brings old settings back as a new version, and keeps answers approved since", async () => {
    // An answer approved after version 1 (as /approvals would project it).
    const now = await config();
    const fact = { id: "f_storage", text: "Storage is included in the service.", topics: ["storage"], status: "approved" as const };
    await activateConfig(db, { tenantId: ids.tenantId, businessId: ids.businessId, config: { ...now.config, facts: [...now.config.facts, fact] }, createdBy: "approvals" });

    const result = await restoreConfigVersion(db, { businessId: ids.businessId, version: 1, actor: "operator" });
    expect(result).toEqual({ ok: true, changed: 1 });
    const restored = await config();
    const v1 = parseBusinessConfig((await db.query<{ config: unknown }>("select config from public.business_config where business_id = $1 and version = 1", [ids.businessId])).rows[0]!.config);
    expect(restored.config.brand.ownerFirstName).toBe(v1.brand.ownerFirstName);
    expect(restored.config.closures).toEqual([]);
    expect(restored.config.facts).toContainEqual(fact);
    const by = await db.query<{ created_by: string }>("select created_by from public.business_config where business_id = $1 and active", [ids.businessId]);
    expect(by.rows[0]!.created_by).toBe("operator (restored v1)");
  });
});
