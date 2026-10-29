import { beforeAll, describe, expect, it } from "vitest";
import { simulatorConnector } from "@/lib/agents/connector";
import { runTool, type GatewayDeps } from "@/lib/agents/gateway";
import { resolveCompany, saysPhrase } from "@/lib/business-rules/company-resolution";
import { sublimePatioConfig } from "@/lib/business-rules/tenants/sublime-patio";
import { theFridgeConfig } from "@/lib/business-rules/tenants/the-fridge";
import { christmasLightGuysConfig } from "@/lib/business-rules/tenants/christmas-light-guys";
import { seedOffice, type Queryable } from "@/lib/db";
import { assignBusiness, getCallContext } from "@/lib/db/agent";
import { loadActiveConfig } from "@/lib/db/config";
import { csvCell, exportLeads, leadsCsv } from "@/lib/db/export";
import { openPglite } from "@/lib/db/pglite";
import { handleInbound, handleStatus, type VoiceDeps } from "@/lib/server/voice";

// One office, three companies: dedicated numbers, a shared line that asks,
// switching, merging and the guards around a forward that hides the caller.
const BASE = "https://clg.example.test";
const OWNER = "+15125550199";
const LINES = {
  tv: "+15125550101",
  web: "+15125550102",
  print: "+15125550103",
  sublime: "+15125550104",
  fridge: "+15125550105",
  shared: "+15125550106",
  /** Bestline forwards here only after Amy didn't answer. */
  sharedMissed: "+15125550107",
};
const NIGHT = new Date("2026-10-21T04:00:00Z"); // Tue 11:00 pm in Austin
const DAYTIME = new Date("2026-10-20T18:00:00Z"); // Tue 1:00 pm in Austin

let db: Queryable;
let ids: Awaited<ReturnType<typeof seedOffice>>;
let seq = 0;
const sid = () => `CA${(++seq).toString(16).padStart(32, "0")}`;
const caller = () => `+1512555${String(700 + seq).padStart(4, "0")}`;

const voice = (now = NIGHT): VoiceDeps => ({ db, now: () => now, baseUrl: BASE, agent: simulatorConnector() });
const gateway = (now = NIGHT): GatewayDeps => ({
  db,
  now,
  loadConfig: async (id) => (await loadActiveConfig(db, id))?.config ?? null,
  scheduleHandoff: async () => {},
});
const tool = (callSid: string, name: string, args: Record<string, unknown>) =>
  runTool(name, { call_sid: callSid, conversation_id: `conv_${callSid}`, ...args }, gateway());
const param = (twiml: string, name: string) =>
  new RegExp(`name="${name}" value="([^"]*)"`).exec(twiml)?.[1]?.replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'") ?? null;
const leadOf = async (callSid: string) =>
  (await db.query<{ business_id: string; state: string; contact_phone: string | null }>(
    "select l.business_id, l.state, l.contact_phone from public.lead l join public.call c on c.lead_id = l.id where c.twilio_call_sid = $1",
    [callSid],
  )).rows[0]!;

beforeAll(async () => {
  db = await openPglite();
  ids = await seedOffice(db, {
    ownerName: "Amy",
    ownerRingE164: OWNER,
    numbers: { tv: LINES.tv, web: LINES.web, print: LINES.print },
    alertSms: "+15125550198",
    alertEmail: "amy@example.com",
    ringStart: "09:00",
    ringEnd: "18:00",
    aiMode: "overflow",
    agentId: "agent_office",
    maxConcurrentSessions: 50,
    office: { sublimePatio: LINES.sublime, theFridge: LINES.fridge, sharedLine: LINES.shared },
  });
  // A second shared-line number that Bestline forwards to after its own ring.
  await seedOffice(db, {
    ownerName: "Amy",
    ownerRingE164: OWNER,
    numbers: { tv: LINES.tv, web: LINES.web, print: LINES.print },
    office: { sharedLine: LINES.sharedMissed, carrierRingsFirst: [LINES.sharedMissed], sublimePatio: LINES.sublime, theFridge: LINES.fridge },
  });
});

describe("company resolution (pure)", () => {
  const options = [
    { businessId: "clg", config: christmasLightGuysConfig() },
    { businessId: "sp", config: sublimePatioConfig() },
    { businessId: "tf", config: theFridgeConfig() },
  ];
  const pick = (said: string) => {
    const r = resolveCompany(said, options);
    return r.kind === "set" ? r.option.businessId : r.kind === "ambiguous" ? r.options.map((o) => o.businessId).sort().join("|") : "none";
  };

  it("a name decides, then a need; a shared need asks; nothing known asks again", () => {
    expect(pick("Hi, is this the Light Guys?")).toBe("clg");
    expect(pick("calling about Sublime")).toBe("sp");
    expect(pick("the vending company")).toBe("tf");
    expect(pick("I want an outdoor kitchen and a pergola")).toBe("sp");
    expect(pick("the machine at my shop took my money")).toBe("tf");
    expect(pick("Christmas lights on my roofline")).toBe("clg");
    expect(pick("landscape lighting for the backyard")).toBe("clg|sp");
    expect(pick("Is this Bestline?")).toBe("none");
  });

  it("matches whole phrases only", () => {
    expect(saysPhrase("we decked the halls", "deck")).toBe(false);
    expect(saysPhrase("a new deck please", "deck")).toBe(true);
    expect(saysPhrase("THE FRIDGE?", "The Fridge")).toBe(true);
    expect(saysPhrase("my fridge vending machine", "the fridge")).toBe(true);
  });
});

describe("a company's own number", () => {
  it("greets as that company, asks its own questions, and files the lead there", async () => {
    const call = sid();
    const twiml = await handleInbound({ CallSid: call, From: caller(), To: LINES.fridge }, voice());
    expect(param(twiml, "company_name")).toBe("The Fridge");
    expect(param(twiml, "opening")).toContain("Hi, you've reached The Fridge.");
    expect(param(twiml, "company_context")).toMatch(/vending machine/);
    const saved = await tool(call, "save_lead_details", { service_requested: "a drinks machine for our break room" });
    expect(saved.body.still_needed).toEqual(["property_type", "property_address", "caller_name", "notes", "callback_window", "lead_source"]);
    const answer = await tool(call, "get_approved_answer", { topic: "placement", question: "Is placement free?" });
    expect(answer.body).toMatchObject({ found: false }); // nothing approved for The Fridge yet
    expect((await leadOf(call)).business_id).toBe(ids.theFridgeId);
  });
});

describe("the shared line", () => {
  it("asks which company, answers nothing until it knows, then moves the lead with what was said", async () => {
    const call = sid();
    const twiml = await handleInbound({ CallSid: call, From: caller(), To: LINES.shared }, voice());
    expect(param(twiml, "company_name")).toBe("not known yet");
    expect(param(twiml, "opening")).toContain(
      "Which company are you calling about: The Christmas Light Guys, Sublime Patio or The Fridge?",
    );
    expect(param(twiml, "opening")).toContain("an automated system, not a person");
    expect((await leadOf(call)).business_id).toBe(ids.frontDeskId);

    expect((await tool(call, "get_approved_answer", { topic: "hours", question: "Are you open Saturday?" })).body).toMatchObject({
      status: "company_unknown",
    });
    await tool(call, "save_lead_details", { caller_name: "Priya" });

    const chosen = await tool(call, "select_business", { caller_words: "I'd like an outdoor kitchen" });
    expect(chosen.body).toMatchObject({ status: "set", company: "Sublime Patio" });
    expect(String(chosen.body.instruction)).toContain('Say "Got it, Sublime Patio."');
    expect(chosen.body.still_needed).not.toContain("caller_name"); // what she said moved with her

    const lead = await leadOf(call);
    expect(lead.business_id).toBe(ids.sublimePatioId);
    const ctx = (await getCallContext(db, call))!;
    expect(ctx.businessId).toBe(ids.sublimePatioId);
    const resolution = await db.query<{ business_resolution: string }>("select business_resolution from public.call where id = $1", [ctx.callId]);
    expect(resolution.rows[0]!.business_resolution).toBe("caller_said");
    const facts = await db.query<{ business_id: string }>("select distinct business_id from public.lead_fact where lead_id = $1", [ctx.leadId]);
    expect(facts.rows).toEqual([{ business_id: ids.sublimePatioId }]);
  });

  it("asks one question when a need fits two companies, and retries once when nothing fits", async () => {
    const call = sid();
    await handleInbound({ CallSid: call, From: caller(), To: LINES.shared }, voice());
    const ambiguous = await tool(call, "select_business", { caller_words: "landscape lighting" });
    expect(ambiguous.body).toMatchObject({ status: "ambiguous" });
    expect(String(ambiguous.body.instruction)).toMatch(/The Christmas Light Guys or Sublime Patio/);

    const first = await tool(call, "select_business", { caller_words: "is this Bestline?" });
    expect(String(first.body.instruction)).toContain("This line answers for The Christmas Light Guys, Sublime Patio and The Fridge");
    const second = await tool(call, "select_business", { caller_words: "I'm not sure, honestly" });
    expect(String(second.body.instruction)).toMatch(/Take a message/);
    expect((await leadOf(call)).business_id).toBe(ids.frontDeskId); // still unassigned for Amy to place
  });

  it("switches company when the caller corrects it, and never replays the old company's answer", async () => {
    const call = sid();
    await handleInbound({ CallSid: call, From: caller(), To: LINES.shared }, voice());
    await tool(call, "select_business", { caller_words: "Christmas lights" });
    const asked = { topic: "service", question: "Do you do this?" };
    const before = await tool(call, "get_approved_answer", asked);
    const switched = await tool(call, "select_business", { caller_words: "oh sorry, it's actually about the Fridge" });
    expect(switched.body).toMatchObject({ status: "set", company: "The Fridge" });
    expect(String(switched.body.instruction)).toContain("I've moved this to The Fridge");
    const after = await tool(call, "get_approved_answer", asked);
    expect(before.body.replayed).toBeUndefined();
    expect(after.body.replayed).toBeUndefined(); // a fresh answer for the new company
    expect((await leadOf(call)).business_id).toBe(ids.theFridgeId);
  });

  it("merges a repeat caller into the company lead they already have", async () => {
    const phone = caller();
    const first = sid();
    await handleInbound({ CallSid: first, From: phone, To: LINES.fridge }, voice());
    await tool(first, "save_lead_details", { caller_name: "Marco" });
    const fridgeLead = (await getCallContext(db, first))!.leadId;
    await handleStatus({ CallSid: first, CallStatus: "completed" }, voice());

    const second = sid();
    await handleInbound({ CallSid: second, From: phone, To: LINES.shared }, voice());
    const deskLead = (await getCallContext(db, second))!.leadId;
    await tool(second, "save_lead_details", { notes: "machine is out of chips" });
    const merged = await tool(second, "select_business", { caller_words: "the vending machine" });
    expect(merged.body).toMatchObject({ status: "set", company: "The Fridge" });
    const ctx = (await getCallContext(db, second))!;
    expect(ctx.leadId).toBe(fridgeLead);
    const old = await db.query<{ state: string }>("select state from public.lead where id = $1", [deskLead]);
    expect(old.rows[0]!.state).toBe("duplicate");
    const notes = await db.query<{ value: string }>("select value from public.lead_fact_current where lead_id = $1 and field = 'notes'", [fridgeLead]);
    expect(notes.rows[0]!.value).toContain("out of chips");
  });

  it("refuses a company the line doesn't answer for", async () => {
    const call = sid();
    await handleInbound({ CallSid: call, From: caller(), To: LINES.shared }, voice());
    const { rows } = await db.query<{ id: string }>("insert into public.business (tenant_id, name) values ($1, 'Unrelated Co') returning id", [ids.tenantId]);
    await expect(assignBusiness(db, { callSid: call, businessId: rows[0]!.id, how: "amy_assigned", actor: "test" })).rejects.toThrow();
  });

  it("a caller who hangs up before saying is filed as 'company not given' for Amy to assign", async () => {
    const call = sid();
    await handleInbound({ CallSid: call, From: caller(), To: LINES.shared }, voice());
    await handleStatus({ CallSid: call, CallStatus: "completed" }, voice());
    expect((await leadOf(call)).business_id).toBe(ids.frontDeskId);
    const result = await assignBusiness(db, { callSid: call, businessId: ids.businessId, how: "amy_assigned", actor: "operator" });
    expect(result.status).toBe("assigned");
    expect((await leadOf(call)).business_id).toBe(ids.businessId);
  });
});

describe("forwarded calls", () => {
  it("a forward that replaced the caller ID with our own number is stored as an unknown caller", async () => {
    const call = sid();
    const twiml = await handleInbound({ CallSid: call, From: LINES.shared, To: LINES.shared, ForwardedFrom: LINES.shared }, voice());
    expect(param(twiml, "caller_number")).toBe("unknown");
    expect((await leadOf(call)).contact_phone).toBeNull();
    // Two such callers must not merge into one lead.
    const other = sid();
    await handleInbound({ CallSid: other, From: LINES.shared, To: LINES.shared }, voice());
    expect((await getCallContext(db, other))!.leadId).not.toBe((await getCallContext(db, call))!.leadId);
  });

  it("on a number Bestline forwards to only after Amy missed it, the assistant answers at once in her hours", async () => {
    const call = sid();
    const twiml = await handleInbound({ CallSid: call, From: caller(), To: LINES.sharedMissed }, voice(DAYTIME));
    expect(twiml).not.toContain("<Dial");
    expect(param(twiml, "entry")).toBe("owner_unavailable");
  });

  it("a company number still rings Amy first in her hours", async () => {
    const twiml = await handleInbound({ CallSid: sid(), From: caller(), To: LINES.sublime }, voice(DAYTIME));
    expect(twiml).toContain("<Dial");
  });
});

describe("one AI plan for every company", () => {
  it("counts live sessions across companies, not per company", async () => {
    // 50 slots configured; fill them on the Christmas line and the next Fridge caller is captured.
    const { rows } = await db.query<{ n: number | string }>("select count(*) as n from public.agent_session where status = 'active'");
    const active = Number(rows[0]!.n);
    for (let i = active; i < 50; i++) await handleInbound({ CallSid: sid(), From: caller(), To: LINES.tv }, voice());
    const twiml = await handleInbound({ CallSid: sid(), From: caller(), To: LINES.fridge }, voice());
    expect(twiml).not.toContain("<Connect");
    expect(twiml).toContain("<Record");
  });
});

describe("spreadsheet export", () => {
  it("lists every lead with its company, and never lets a caller's words run as a formula", async () => {
    const rows = await exportLeads(db);
    expect(rows.some((r) => r.company === "Sublime Patio")).toBe(true);
    expect(rows.some((r) => r.company === "Company not given")).toBe(true);
    expect(rows.every((r) => r.status !== "duplicate")).toBe(true);
    const csv = leadsCsv(rows);
    expect(csv.split("\r\n")[0]).toContain("Date,Company,Status");
    expect(csvCell("=HYPERLINK(\"http://evil\")")).toBe("\"'=HYPERLINK(\"\"http://evil\"\")\"");
    expect(csvCell("+1 512 555 0101")).toBe("'+1 512 555 0101");
    expect(csvCell("Priya, Lakeway")).toBe("\"Priya, Lakeway\"");
  });
});
