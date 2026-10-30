import { beforeAll, describe, expect, it } from "vitest";
import { simulatorConnector } from "@/lib/agents/connector";
import { scanConversation } from "@/lib/agents/compliance";
import { runTool, type GatewayDeps } from "@/lib/agents/gateway";
import { seedChristmasLightGuys, type Queryable } from "@/lib/db";
import { loadActiveConfig } from "@/lib/db/config";
import { applyOwnerDecisions, decideKnowledge, listKnowledge, tenantScanOptions } from "@/lib/db/knowledge";
import { openPglite } from "@/lib/db/pglite";
import { CLG_AMY_DECISIONS, CLG_DECIDED_BY } from "@/lib/knowledge/tenants/clg-decisions";
import { handleInbound } from "@/lib/server/voice";

// Amy's email answers (2026-10-22) as the live starting point: what the
// assistant now says, what it still won't, and what it asks for.
const NIGHT = new Date("2026-10-21T04:00:00Z"); // Tue 11:00 pm in Austin
const LINE = "+15125550101";

let db: Queryable;
let tenantId: string;
let businessId: string;
let seq = 0;
const sid = () => `CA${(0xc000 + ++seq).toString(16).padStart(32, "0")}`;

const gateway = (): GatewayDeps => ({
  db,
  now: NIGHT,
  loadConfig: async (id) => (await loadActiveConfig(db, id))?.config ?? null,
  scheduleHandoff: async () => {},
});

async function liveCall(): Promise<string> {
  const call = sid();
  await handleInbound(
    { CallSid: call, From: `+1512555${String(4000 + seq)}`, To: LINE },
    { db, now: () => NIGHT, baseUrl: "https://clg.example.test", agent: simulatorConnector() },
  );
  return call;
}
const ask = async (call: string, topic: string, question: string) =>
  (await runTool("get_approved_answer", { call_sid: call, topic, question }, gateway())).body;

beforeAll(async () => {
  db = await openPglite();
  const seed = await seedChristmasLightGuys(db, {
    ownerName: "Amy",
    ownerRingE164: "+15125550199",
    numbers: { tv: LINE, web: "+15125550102", print: "+15125550103" },
    ringStart: "09:00",
    ringEnd: "18:00",
    ringDays: [1, 2, 3, 4, 5, 6],
    aiMode: "overflow",
    agentId: "agent_test",
    ownerDecisions: { decisions: CLG_AMY_DECISIONS, by: CLG_DECIDED_BY },
  });
  tenantId = seed.tenantId;
  businessId = seed.businessId;
});

describe("Amy's answers, live", () => {
  it("records each one as hers, audited, and leaves the rest pending", async () => {
    const items = await listKnowledge(db, businessId);
    const decided = items.filter((i) => i.status !== "pending");
    expect(decided.map((i) => i.key).sort()).toEqual(CLG_AMY_DECISIONS.map((d) => d.key).sort());
    // Her 10-22 email answers, and her 10-29 requirements where they replaced or added one.
    expect(decided.every((i) => i.decidedBy === (CLG_AMY_DECISIONS.find((d) => d.key === i.key)!.by ?? CLG_DECIDED_BY))).toBe(true);
    expect(items.find((i) => i.key === "licensing_insurance")!.status).toBe("rejected");
    expect(items.filter((i) => i.status === "pending").map((i) => i.key)).toContain("service_calls");
  });

  it("answers in her words and picks the right one", async () => {
    const call = await liveCall();
    expect((await ask(call, "price", "How much would the roofline cost?")).answer).toMatch(/^Our team handles pricing, because it depends on the property/);
    expect((await ask(call, "estimate", "Is the estimate free?")).answer).toBe("Yes, estimates are free.");
    expect((await ask(call, "years", "How long have you been in business?")).answer).toBe("We've been in business for 20 years.");
    expect((await ask(call, "storage", "Do you store the lights for me?")).answer).toMatch(/^Storage is included in the service/);
    expect((await ask(call, "permanent", "Do you do permanent lights?")).answer).toMatch(/not installing permanent lighting right now/);
    expect((await ask(call, "office", "Where's your office? Can I stop by?")).answer).toBe("Our team can go over everything when they call.");
    expect((await ask(call, "myself", "Why should I hire you instead of doing it myself?")).answer).toMatch(/instead of on a ladder\.$/);
  });

  it("gives no email, no address and nothing about drive-by checks or sister companies (her 10-29 calls)", async () => {
    const call = await liveCall();
    expect(await ask(call, "email", "What's your email?")).toMatchObject({ found: false });
    expect(await ask(call, "drive by", "Do you drive by and check on the lights?")).toMatchObject({ found: false });
    expect(await ask(call, "light guys", "Are you the same company as The Light Guys?")).toMatchObject({ found: false });
    const options = await tenantScanOptions(db, tenantId);
    for (const said of ["Our email is thelightguysaustin@gmail.com.", "We drive by and check on your lights during the season.", "We offer a white-glove, gold-standard service."]) {
      expect(scanConversation([{ role: "agent", text: said }], [], options).violations.map((v) => v.code), said).toContain("unapproved_claim");
    }
  });

  it("still won't talk about insurance (her call) or anything she hasn't answered", async () => {
    const call = await liveCall();
    expect(await ask(call, "insurance", "Are you insured?")).toMatchObject({ found: false });
    expect(await ask(call, "repair", "If a storm knocks the lights down, do you fix them for free?")).toMatchObject({ found: false });
  });

  it("knows her 18 areas, and never turns anyone else away", async () => {
    const call = await liveCall();
    const area = (city: string) => runTool("check_service_area", { call_sid: call, city }, gateway());
    expect((await area("Lakeway")).body).toMatchObject({ status: "in_area" });
    expect((await area("Volente")).body).toMatchObject({ status: "in_area" });
    expect((await area("Hutto")).body).toMatchObject({ status: "not_listed" });
  });

  it("asks only her core questions, and keeps what the caller volunteers", async () => {
    const call = await liveCall();
    const saved = await runTool(
      "save_lead_details",
      { call_sid: call, service_requested: "roofline and the two oaks", caller_email: " Dana.Whit@Gmail.com ", home_size: "about 2,400" },
      gateway(),
    );
    expect(saved.body.still_needed).toEqual(["caller_name", "property_address", "maps_visible", "callback_window"]);
    expect(saved.body.instruction).toContain("ask naturally for their name");
    const maps = await runTool("save_lead_details", { call_sid: call, maps_visible: "no" }, gateway());
    expect(maps.body.still_needed).toEqual(["caller_name", "property_address", "callback_window"]);
    const plugs = await runTool("save_lead_details", { call_sid: call, outdoor_plugs: "yes" }, gateway());
    expect(plugs.body).toMatchObject({ ok: false, error: "invalid_input" });
    const { rows } = await db.query<{ field: string; value: string }>(
      "select field, value from public.lead_fact_current f join public.call c on c.lead_id = f.lead_id where c.twilio_call_sid = $1 order by field",
      [call],
    );
    expect(Object.fromEntries(rows.map((r) => [r.field, r.value]))).toMatchObject({
      caller_email: "dana.whit@gmail.com",
      maps_visible: "no",
      home_size: "about 2,400",
    });
    const bad = await runTool("save_lead_details", { call_sid: call, caller_email: "dana at gmail" }, gateway());
    expect(bad.body).toMatchObject({ ok: false, error: "invalid_input" });
  });

  it("her approved words pass the scan; the site's other version still doesn't", async () => {
    const options = await tenantScanOptions(db, tenantId);
    for (const d of CLG_AMY_DECISIONS) {
      if (!d.text) continue;
      expect(scanConversation([{ role: "agent", text: d.text }], [], options).violations).toEqual([]);
    }
    const nine = scanConversation([{ role: "agent", text: "We've been doing this for 9 years." }], [], options);
    expect(nine.violations.map((v) => v.ref)).toContain("years_in_business");
  });

  it("answers the visit and hours questions in her words (texts, 2026-10-29 evening)", async () => {
    const call = await liveCall();
    const visit = "The visit is free, and we'll just need someone home for it.";
    expect((await ask(call, "visit", "Is the visit free?")).answer).toBe(visit);
    expect((await ask(call, "price", "Does the visit cost anything?")).answer).toBe(visit);
    expect((await ask(call, "home", "Do I need to be home for it?")).answer).toBe(visit);
    expect((await ask(call, "hours", "What are your hours?")).answer).toBe("We return calls Monday through Friday, nine to five.");
  });

  it("a home that's hard to see gets her visit line, and a weekend callback is steered to a weekday once", async () => {
    const call = await liveCall();
    const hidden = await runTool("save_lead_details", { call_sid: call, maps_visible: "no" }, gateway());
    expect(hidden.body.instruction).toContain(
      `Say: "Thanks for letting me know. Since it's hard to see on Google Maps, our team will call you to set up a time to come take a look. The visit is free."`,
    );
    const unsure = await runTool("save_lead_details", { call_sid: call, maps_visible: "unsure" }, gateway());
    expect(unsure.body.instruction).toContain("No problem. Our team will check, and if it's hard to see, they'll call to set up a time to come take a look.");

    // NIGHT is a Tuesday at 11 PM: the next times are tomorrow.
    const saturday = await runTool("save_lead_details", { call_sid: call, callback_window: "Saturday morning" }, gateway());
    expect(saturday.body).toMatchObject({ outside_callback_hours: true, saved: ["callback_window"] });
    expect(saturday.body.instruction).toContain(
      "I'm sorry, our team only makes calls on weekdays, between nine and five. Would tomorrow morning or afternoon work for you?",
    );
    // The caller can't do a weekday: keep what they said, never ask a third time.
    const again = await runTool("save_lead_details", { call_sid: call, callback_window: "Saturdays only" }, gateway());
    expect(again.body.outside_callback_hours).toBeUndefined();

    const weekday = await runTool("save_lead_details", { call_sid: await liveCall(), callback_window: "Thursday after 2" }, gateway());
    expect(weekday.body.outside_callback_hours).toBeUndefined();
  });

  it("a decision Amy changes later in the console is never overwritten by re-applying the email", async () => {
    const item = (await listKnowledge(db, businessId)).find((i) => i.key === "free_estimate")!;
    await decideKnowledge(db, { itemId: item.id, status: "approved", text: "Estimates are always free.", value: null, by: "operator" });
    const applied = await applyOwnerDecisions(db, { tenantId, businessId, decisions: CLG_AMY_DECISIONS, by: CLG_DECIDED_BY });
    expect(applied).toBe(0);
    const after = (await listKnowledge(db, businessId)).find((i) => i.key === "free_estimate")!;
    expect(after.approvedText).toBe("Estimates are always free.");
  });

  it("her evening texts update the words she approved that morning, but not words changed since in Approvals", async () => {
    // The live database as of the morning: the "Josh" words approved, one of them since edited in the console.
    const items = await listKnowledge(db, businessId);
    const quote = items.find((i) => i.key === "quote_process")!;
    const office = items.find((i) => i.key === "we_come_to_you")!;
    const morning = (key: string) => CLG_AMY_DECISIONS.find((d) => d.key === key)!.replaces!;
    await decideKnowledge(db, { itemId: quote.id, status: "approved", text: morning("quote_process"), value: null, by: CLG_DECIDED_BY });
    await decideKnowledge(db, { itemId: office.id, status: "approved", text: "We're happy to meet you at your home.", value: null, by: "operator" });

    expect(await applyOwnerDecisions(db, { tenantId, businessId, decisions: CLG_AMY_DECISIONS, by: CLG_DECIDED_BY })).toBe(1);
    const after = new Map((await listKnowledge(db, businessId)).map((i) => [i.key, i]));
    expect(after.get("quote_process")!.approvedText).toMatch(/^Our team handles pricing/);
    expect(after.get("we_come_to_you")!.approvedText).toBe("We're happy to meet you at your home.");
    expect((await loadActiveConfig(db, businessId))!.config.facts.find((f) => f.id === "quote_process")!.text).toMatch(/^Our team/);
  });
});
