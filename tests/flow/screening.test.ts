import { beforeAll, describe, expect, it } from "vitest";
import { simulatorConnector } from "@/lib/agents/connector";
import { runTool } from "@/lib/agents/gateway";
import { claimPendingAlerts, seedChristmasLightGuys, type Queryable } from "@/lib/db";
import { getCallContext, type ClaimedJob } from "@/lib/db/agent";
import { callbackTarget } from "@/lib/db/callback";
import { loadActiveConfig } from "@/lib/db/config";
import { quietLeads } from "@/lib/db/dashboard";
import { openPglite } from "@/lib/db/pglite";
import { blockNumber, findBlock, recentInboundSms, saveInboundSms } from "@/lib/db/screening";
import { renderAlert } from "@/lib/server/alerts";
import { ingestPostCall } from "@/lib/server/post-call-webhook";
import { handleAgentEnded, handleInbound, handleScreenCaller, handleStatus, type VoiceDeps } from "@/lib/server/voice";
import { callbackBridgeTwiml, ringOwnerTwiml, voiceUrls } from "@/lib/telephony";
import { gateReason, passedGate } from "@/lib/telephony/screening";
import { localTimeToUtc, nextDigestAt, processDigest } from "@/workflows/post-call/digest";
import { runDueJobs } from "@/workflows/post-call/runner";

// Spam screening and the "when in doubt, text Amy" rule
// (docs/research/spam-screening.md, docs/research/ai-first-vs-ring-first.md).
const BASE = "https://clg.example.test";
const LINE = "+15125550101";
const AMY = "+15125550199";
const NIGHT = new Date("2026-10-21T04:00:00Z"); // Tue 11:00 pm in Austin

let db: Queryable;
let tenantId: string;
let businessId: string;
let seq = 0;
const sid = () => `CA${(0xd000 + ++seq).toString(16).padStart(32, "0")}`;
let phones = 0;
const caller = () => `+1512555${6000 + ++phones}`;
const voice = (): VoiceDeps => ({ db, now: () => NIGHT, baseUrl: BASE, agent: simulatorConnector() });
const gateway = () => ({
  db,
  now: NIGHT,
  loadConfig: async (id: string) => (await loadActiveConfig(db, id))?.config ?? null,
  scheduleHandoff: async () => {},
});
const tool = (call: string, name: string, args: Record<string, unknown>) => runTool(name, { call_sid: call, ...args }, gateway());
const sessionOf = (twiml: string) => /name="session_id" value="([^"]+)"/.exec(twiml)?.[1] ?? null;
/** The vendor's post-call transcript, as its webhook delivers it. */
const transcript = (call: string, twiml: string, said: string[]) =>
  ingestPostCall(db, {
    type: "post_call_transcription",
    event_timestamp: 1_792_000_000,
    data: {
      agent_id: "agent_test",
      conversation_id: `conv_${call}`,
      status: "done",
      transcript: [
        { role: "agent", message: "Thanks for calling The Christmas Light Guys! How can I help?" },
        ...said.map((message) => ({ role: "user", message })),
      ],
      metadata: { call_duration_secs: 30, phone_call: { call_sid: call } },
      analysis: { transcript_summary: "Test call.", call_successful: "success", data_collection_results: {} },
      conversation_initiation_client_data: { dynamic_variables: { call_sid: call, session_id: sessionOf(twiml) } },
    },
  });
const callRow = async (call: string) =>
  (await db.query<{ screened: string | null; stir_verstat: string | null }>(
    "select screened, stir_verstat from public.call where twilio_call_sid = $1",
    [call],
  )).rows[0];

/** A whole AI call: answered, what the caller said, the assistant's outcome, hang-up, transcript, post-call. */
async function aiCall(from: string, said: Record<string, unknown>, outcome: string): Promise<string> {
  const call = sid();
  const twiml = await handleInbound({ CallSid: call, From: from, To: LINE, StirVerstat: "TN-Validation-Passed-A" }, voice());
  if (Object.keys(said).length) await tool(call, "save_lead_details", said);
  await tool(call, "finish_call", { outcome, summary: "Test call." });
  await handleAgentEnded({ CallSid: call, CallStatus: "in-progress" }, voice());
  await transcript(call, twiml, ["Hi there."]);
  await handleStatus({ CallSid: call, CallStatus: "completed" }, voice());
  await runDueJobs(db);
  return call;
}
const alertsFor = async (call: string) => {
  const ctx = (await getCallContext(db, call))!;
  const sent = await db.query<{ n: string | number }>("select count(*) as n from public.outbox where lead_id = $1", [ctx.leadId]);
  const held = await db.query<{ n: string | number }>(
    "select count(*) as n from public.event where aggregate_id = $1 and type = 'alert.held'",
    [ctx.leadId],
  );
  return { texted: Number(sent.rows[0]!.n) > 0, held: Number(held.rows[0]!.n) > 0 };
};

beforeAll(async () => {
  db = await openPglite();
  const seed = await seedChristmasLightGuys(db, {
    ownerName: "Amy",
    ownerRingE164: AMY,
    numbers: { tv: LINE, web: "+15125550102", print: "+15125550103" },
    alertSms: "+15125550198",
    ringStart: "09:00",
    ringEnd: "18:00",
    ringDays: [1, 2, 3, 4, 5, 6],
    aiMode: "always",
    agentId: "agent_test",
    maxConcurrentSessions: 50,
  });
  tenantId = seed.tenantId;
  businessId = seed.businessId;
});

describe("who has to say yes first (pure)", () => {
  it("gates hidden numbers, failed caller-ID checks and flagged numbers, nobody else", () => {
    const gate = (from: string, stirVerstat?: string, autoBlocked = false) => gateReason({ from, stirVerstat, autoBlocked });
    expect(gate("+266696687")).toBe("hidden_number");
    expect(gate("anonymous")).toBe("hidden_number");
    expect(gate("")).toBe("hidden_number");
    expect(gate("+15125550123", "TN-Validation-Failed-B")).toBe("caller_id_failed");
    expect(gate("+15125550123", undefined, true)).toBe("flagged_spam");
    expect(gate("+15125550123", "TN-Validation-Passed-A")).toBeNull();
    // About 45% of real callers arrive unverified (landlines, small carriers): never gated for that alone.
    expect(gate("+15125550123", "No-TN-Validation")).toBeNull();
  });

  it("a 1 or a spoken yes passes; silence or a pitch doesn't", () => {
    expect(passedGate({ digits: "1", speech: null })).toBe(true);
    expect(passedGate({ digits: null, speech: "Yeah, sure." })).toBe(true);
    expect(passedGate({ digits: null, speech: "Sí" })).toBe(true);
    expect(passedGate({ digits: null, speech: "" })).toBe(false);
    expect(passedGate({ digits: "9", speech: "press nine to lower your rates" })).toBe(false);
  });
});

describe("the gate on a live call", () => {
  it("a hidden caller is asked first, and nothing is stored or rung until they answer", async () => {
    const call = sid();
    const twiml = await handleInbound({ CallSid: call, From: "+266696687", To: LINE }, voice());
    expect(twiml).toContain("<Gather");
    expect(twiml).toContain(`${BASE}/api/voice/screen-caller`);
    expect(twiml).toContain("press 1, or say yes");
    expect(await callRow(call)).toBeUndefined();
  });

  it("saying yes goes on to the assistant, and the screen's result is logged", async () => {
    const call = sid();
    const twiml = await handleScreenCaller({ CallSid: call, From: "+266696687", To: LINE, SpeechResult: "yes", StirVerstat: "No-TN-Validation" }, voice());
    expect(twiml).toContain("<Connect");
    expect(await callRow(call)).toMatchObject({ screened: "passed", stir_verstat: "No-TN-Validation" });
  });

  it("silence never hangs up: the caller can leave a message", async () => {
    const call = sid();
    const twiml = await handleScreenCaller({ CallSid: call, From: "+266696687", To: LINE }, voice());
    expect(twiml).toContain("<Record");
    expect(twiml).not.toContain("<Connect");
    expect(await callRow(call)).toMatchObject({ screened: "no_response" });
  });

  it("a number Amy blocked is refused before anyone answers, and counted", async () => {
    const pest = "+15125550666";
    await blockNumber(db, { tenantId, e164: pest, kind: "manual", reason: "test", days: null, by: "operator" });
    const call = sid();
    expect(await handleInbound({ CallSid: call, From: pest, To: LINE }, voice())).toContain("<Reject");
    expect(await callRow(call)).toBeUndefined();
    const { rows } = await db.query<{ hits: number }>("select hits from public.blocked_number where e164 = $1", [pest]);
    expect(rows[0]!.hits).toBe(1);
  });

  it("Amy's own block always wins over the assistant's automatic one", async () => {
    const pest = "+15125550667";
    await blockNumber(db, { tenantId, e164: pest, kind: "manual", reason: "Amy", days: null, by: "operator" });
    await blockNumber(db, { tenantId, e164: pest, kind: "auto", reason: "assistant", days: 30, by: "assistant" });
    expect(await findBlock(db, tenantId, pest)).toMatchObject({ kind: "manual", blockedUntil: null });
  });
});

describe("when in doubt, text Amy", () => {
  it("spam with nothing a customer would say is held for the daily summary", async () => {
    const call = await aiCall(caller(), { notes: "Robot selling extended warranties" }, "spam");
    expect(await alertsFor(call)).toEqual({ texted: false, held: true });
  });

  it("a caller who hung up before saying anything is held too", async () => {
    const call = sid();
    const twiml = await handleInbound({ CallSid: call, From: caller(), To: LINE }, voice());
    await handleAgentEnded({ CallSid: call, CallStatus: "completed" }, voice());
    await transcript(call, twiml, []);
    await handleStatus({ CallSid: call, CallStatus: "completed" }, voice());
    await runDueJobs(db);
    expect(await alertsFor(call)).toEqual({ texted: false, held: true });
  });

  it("but a 'spam' call that gave real details still texts Amy: the label might be wrong", async () => {
    const call = await aiCall(caller(), { service_requested: "roofline lights", property_address: "12 Elm St, Austin" }, "spam");
    expect(await alertsFor(call)).toEqual({ texted: true, held: false });
  });

  it("a real customer always texts", async () => {
    const call = await aiCall(caller(), { caller_name: "Rosa", service_requested: "trees and roofline" }, "callback_requested");
    expect(await alertsFor(call)).toEqual({ texted: true, held: false });
  });
});

describe("a number the assistant calls spam twice", () => {
  it("must press 1 for 30 days afterwards (screened, not refused)", async () => {
    const robo = "+15125550777";
    await aiCall(robo, {}, "spam");
    expect(await findBlock(db, tenantId, robo)).toBeNull(); // once isn't enough
    await aiCall(robo, {}, "spam");
    const block = await findBlock(db, tenantId, robo);
    expect(block).toMatchObject({ kind: "auto" });
    expect(block!.blockedUntil!.getTime()).toBeGreaterThan(Date.now() + 29 * 24 * 3600 * 1000);
    const twiml = await handleInbound({ CallSid: sid(), From: robo, To: LINE, StirVerstat: "TN-Validation-Passed-A" }, voice());
    expect(twiml).toContain("<Gather");
  });
});

describe("the daily summary", () => {
  it("goes out at 8 AM Austin time, through daylight saving", () => {
    expect(localTimeToUtc("2026-10-23", "08:00", "America/Chicago").toISOString()).toBe("2026-10-23T13:00:00.000Z"); // CDT
    expect(localTimeToUtc("2026-11-02", "08:00", "America/Chicago").toISOString()).toBe("2026-11-02T14:00:00.000Z"); // CST
    expect(nextDigestAt(new Date("2026-10-23T12:00:00Z"), "America/Chicago").date).toBe("2026-10-23");
    expect(nextDigestAt(new Date("2026-10-23T15:00:00Z"), "America/Chicago").date).toBe("2026-10-24");
  });

  it("is one text with the count, and points at the list", async () => {
    const job: ClaimedJob = { id: "00000000-0000-4000-8000-0000000000d1", kind: "daily_digest", subjectId: businessId, tenantId, businessId, attempts: 1 };
    const held = await processDigest(db, job);
    expect(held).toBeGreaterThanOrEqual(2);
    expect(await processDigest(db, job)).toBe(held); // a replay queues nothing new
    const alerts = (await claimPendingAlerts(db, 50)).filter((a) => a.kind === "digest");
    expect(alerts).toHaveLength(1);
    const { subject, body } = renderAlert(alerts[0]!, BASE);
    expect(subject).toBe(`${alerts[0]!.companyName}: ${held} calls in the last day looked like spam or left no details`);
    expect(alerts[0]!.companyName).toMatch(/Christmas Light Guys/);
    expect(body).toContain(`${BASE}/dashboard?view=quiet`);
    // The list the link opens: one row per caller (the twice-flagged number made two of the calls).
    expect((await quietLeads(db)).length).toBe(held - 1);
    const scheduled = await db.query<{ n: string | number }>("select count(*) as n from public.job where kind = 'daily_digest'");
    expect(Number(scheduled.rows[0]!.n)).toBeGreaterThanOrEqual(1); // runDueJobs keeps the next one scheduled
  });
});

describe("texts to our numbers", () => {
  it("are kept (e.g. a Google verification code); replays and unknown numbers are ignored", async () => {
    expect(await saveInboundSms(db, { twilioSid: "SM1", to: LINE, from: "+15125550000", body: "Your Google code is 123456" })).toBe(true);
    expect(await saveInboundSms(db, { twilioSid: "SM1", to: LINE, from: "+15125550000", body: "Your Google code is 123456" })).toBe(true);
    expect(await saveInboundSms(db, { twilioSid: "SM2", to: "+15125559999", from: null, body: "?" })).toBe(false);
    const texts = await recentInboundSms(db);
    expect(texts.filter((t) => t.body.includes("123456"))).toHaveLength(1);
  });
});

describe("Amy's phone sees the business number", () => {
  it("when we ring her, and when she calls a customer back", async () => {
    const urls = voiceUrls(BASE);
    const ring = ringOwnerTwiml(
      { brandName: "The Christmas Light Guys", ownerName: "Amy", ownerPhone: AMY, sourceLabel: "", ringTimeoutSeconds: 18, recoveryAsk: "x", lineNumber: LINE },
      urls,
    );
    expect(ring).toContain(`callerId="${LINE}"`);

    const call = await aiCall(caller(), { caller_name: "Dee", callback_phone: "(512) 555-0142" }, "callback_requested");
    const ctx = (await getCallContext(db, call))!;
    const target = (await callbackTarget(db, ctx.leadId!))!;
    expect(target).toMatchObject({ customerPhone: "+15125550142", lineE164: LINE, ownerPhone: AMY });
    const bridge = callbackBridgeTwiml(target);
    expect(bridge).toContain(`callerId="${LINE}"`);
    expect(bridge).toContain("+15125550142");
  });
});
