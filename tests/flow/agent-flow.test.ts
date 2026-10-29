import { beforeAll, describe, expect, it } from "vitest";
import { VendorCircuit } from "@/lib/agents/circuit";
import { simulatorConnector, type AgentConnector } from "@/lib/agents/connector";
import { runTool, type GatewayDeps } from "@/lib/agents/gateway";
import { parseBusinessConfig } from "@/lib/business-rules/config";
import { seedChristmasLightGuys, type Queryable } from "@/lib/db";
import { getCallContext } from "@/lib/db/agent";
import { activateConfig, loadActiveConfig } from "@/lib/db/config";
import { openPglite } from "@/lib/db/pglite";
import { signLikeElevenLabs } from "@/lib/elevenlabs/webhook-signature";
import { handlePostCallWebhook } from "@/lib/server/post-call-webhook";
import {
  handleAgentEnded,
  handleDialResult,
  handleHandoff,
  handleHandoffResult,
  handleInbound,
  handleScreen,
  handleStatus,
  type VoiceDeps,
} from "@/lib/server/voice";
import { processPostCall, RECONCILE_FROM_ATTEMPT, runDueJobs } from "@/workflows/post-call/runner";

// Simulated agent calls through the real handlers, tool gateway, webhook and
// post-call workflow on an embedded Postgres. No phone, no vendor, no network.
const BASE = "https://clg.example.test";
const TV = "+15125550101";
const OWNER = "+15125550199";
const SECRET = "test-webhook-secret";
const DAYTIME = new Date("2026-10-20T18:00:00Z"); // Tue 1:00 pm in Austin
const NIGHT = new Date("2026-10-21T04:00:00Z"); // Tue 11:00 pm in Austin

let db: Queryable;
let tenantId: string;
let businessId: string;
let seq = 0;
const sid = () => `CA${(++seq).toString(16).padStart(32, "0")}`;
const caller = () => `+1512555${String(600 + seq).padStart(4, "0")}`;
const handoffs: string[] = [];

function voiceDeps(now = DAYTIME, agent: AgentConnector | undefined = simulatorConnector(), circuit?: VendorCircuit): VoiceDeps {
  return { db, now: () => now, baseUrl: BASE, ...(agent ? { agent } : {}), ...(circuit ? { circuit } : {}) };
}

function gateway(now = DAYTIME): GatewayDeps {
  return {
    db,
    now,
    loadConfig: async (id) => (await loadActiveConfig(db, id))?.config ?? null,
    scheduleHandoff: async (callSid) => {
      handoffs.push(callSid);
    },
  };
}

const tool = (callSid: string, name: string, args: Record<string, unknown>, now = DAYTIME) =>
  runTool(name, { call_sid: callSid, conversation_id: `conv_${callSid}`, ...args }, gateway(now));

const sessionOf = (twiml: string) => /name="session_id" value="([^"]+)"/.exec(twiml)?.[1] ?? null;

async function postCall(
  callSid: string,
  sessionId: string | null,
  conversationId: string,
  transcript: Array<{ role: "agent" | "user"; message: string }>,
  extra: Record<string, unknown> = {},
) {
  const body = JSON.stringify({
    type: "post_call_transcription",
    event_timestamp: 1_792_000_000,
    data: {
      agent_id: "agent_test",
      conversation_id: conversationId,
      status: "done",
      transcript,
      metadata: { call_duration_secs: 95, phone_call: { call_sid: callSid } },
      analysis: { transcript_summary: "Caller wants roofline lights.", call_successful: "success", data_collection_results: {}, ...extra },
      conversation_initiation_client_data: { dynamic_variables: { call_sid: callSid, session_id: sessionId } },
    },
  });
  const now = Math.floor(Date.now() / 1000);
  return handlePostCallWebhook({ db, secret: SECRET, signature: signLikeElevenLabs(SECRET, body, now), rawBody: body, nowSeconds: now });
}

async function setAiMode(mode: "off" | "overflow" | "after_hours_only", extra: Record<string, unknown> = {}) {
  const active = (await loadActiveConfig(db, businessId))!.config;
  await activateConfig(db, {
    tenantId,
    businessId,
    config: parseBusinessConfig({ ...active, ai: { ...active.ai, mode, ...extra } }),
    createdBy: "test",
  });
}

beforeAll(async () => {
  const pg = await openPglite();
  const seed = await seedChristmasLightGuys(pg, {
    ownerName: "Amy",
    ownerRingE164: OWNER,
    numbers: { tv: TV, web: "+15125550102", print: "+15125550103" },
    alertSms: "+15125550198",
    alertEmail: "amy@example.com",
    ringStart: "09:00",
    ringEnd: "18:00",
    aiMode: "overflow",
    agentId: "agent_test",
    maxConcurrentSessions: 50,
    demoApprovedKeys: ["christmas_services", "residential_commercial", "quote_process"],
  });
  db = pg;
  tenantId = seed.tenantId;
  businessId = seed.businessId;
});

describe("the Amy-ignores-the-call demo", () => {
  it("rings Amy, hands the caller to the agent, tries Amy again, saves everything and alerts her", async () => {
    const call = sid();
    const from = caller();

    // 1. Amy's phone rings first, screened.
    expect(await handleInbound({ CallSid: call, From: from, To: TV }, voiceDeps())).toContain("<Dial");

    // 2. She doesn't press 1 (her voicemail took the leg): the agent answers, and hands control back to us when done.
    const agentTwiml = await handleDialResult({ CallSid: call, From: from, To: TV, DialCallStatus: "completed", DialBridged: "false" }, voiceDeps());
    expect(agentTwiml).toContain(`<Connect action="${BASE}/api/voice/agent-ended" method="POST">`);
    expect(agentTwiml).toContain(`<Parameter name="call_sid" value="${call}"/>`);
    expect(agentTwiml).toContain(`<Parameter name="entry" value="owner_unavailable"/>`);

    // 3. The agent saves what the caller says and learns what is still missing.
    const saved = await tool(call, "save_lead_details", {
      property_type: "residential",
      customer_type: "new",
      service_requested: "front of the house and roofline",
      property_address: "112 Lakeview Dr, Lakeway",
      zip: "78734",
      desired_timing: "November 12",
    });
    expect(saved.body).toMatchObject({ ok: true });
    // Only Amy's core questions remain, in her order (2026-10-29).
    expect(saved.body.still_needed).toEqual(["caller_name", "maps_visible", "callback_window"]);

    // 4. Price question: approved process answer only, no number, escalated to Amy.
    const price = await tool(call, "get_approved_answer", { topic: "price", question: "How much for the roofline?" });
    // Amy approved (demo seed) exactly one sentence for price questions: how quotes work. No number.
    expect(price.body).toMatchObject({ ok: true, found: true, fact_id: "quote_process" });
    expect(String(price.body.answer)).toMatch(/^Josh handles the pricing/);
    expect(String(price.body.answer)).not.toMatch(/\$|\d/);

    // 5. Service area is unconfirmed: the agent may not say yes or no.
    const area = await tool(call, "check_service_area", { city: "Lakeway" });
    expect(area.body).toMatchObject({ status: "unknown" });

    // 6. Caller asks for Amy; transfer allowed in ring hours, once.
    const transfer = await tool(call, "transfer_to_amy", { summary: "Sarah in Lakeway, roofline, wants Nov 12", reason: "caller_asked" });
    expect(transfer.body).toMatchObject({ ok: true, transferring: true });
    expect(handoffs).toContain(call);

    // 7. The redirected call rings Amy with a whisper of the summary.
    expect(await handleHandoff({ CallSid: call, From: from, To: TV }, voiceDeps())).toContain(`${BASE}/api/voice/screen?stage=handoff`);
    const whisper = await handleScreen({ CallSid: sid(), ParentCallSid: call }, voiceDeps(), new URLSearchParams("stage=handoff"));
    expect(whisper).toContain("Sarah in Lakeway, roofline, wants Nov 12");
    expect(whisper).toContain("Press any key to take it.");

    // 8. Amy misses again: a high-priority callback exists before anything else, and the caller is back with the agent.
    const back = await handleHandoffResult({ CallSid: call, From: from, To: TV, DialCallStatus: "no-answer" }, voiceDeps());
    expect(back).toContain(`<Parameter name="entry" value="handoff_failed"/>`);
    expect(back).toContain("Sarah in Lakeway");

    // 9. Second conversation: name, window, callback, wrap-up. A second transfer is refused.
    await tool(call, "save_lead_details", { caller_name: "Sarah Mitchell", callback_window: "after 4 PM", lead_source: "TV ad" });
    expect((await tool(call, "transfer_to_amy", { summary: "again", reason: "caller_asked" })).body).toMatchObject({ ok: false, why: "already_tried" });
    await tool(call, "request_callback", { window: "after 4 PM", reason: "Wants a quote", urgent: true });
    await tool(call, "finish_call", { outcome: "callback_requested", summary: "Sarah wants roofline lights by Nov 12; call after 4." });
    expect(await handleAgentEnded({ CallSid: call, CallStatus: "in-progress" }, voiceDeps())).toContain("<Hangup/>");

    // 10. Both conversations' transcripts arrive (signed), in reverse order, and the call completes.
    const first = sessionOf(agentTwiml);
    const second = sessionOf(back);
    expect(first).not.toBeNull();
    expect(second).not.toBe(first);
    const webhook = await postCall(call, second, `conv2_${call}`, [
      { role: "agent", message: "Amy couldn't pick up, but I've saved everything. When's the best time for her to call?" },
      { role: "user", message: "After 4 PM." },
    ]);
    expect(webhook.status).toBe(200);
    expect((await postCall(call, first, `conv_${call}`, [
      { role: "agent", message: "Hi, thanks for calling The Christmas Light Guys. I'm Amy's virtual assistant." },
      { role: "user", message: "How much would the roofline cost? Can you do November 12?" },
      { role: "agent", message: "I don't want to give you the wrong answer on that. I'll make sure Amy covers it when she calls." },
      { role: "agent", message: "I can't promise a date until Amy checks the schedule." },
      { role: "user", message: "Can I just talk to Amy?" },
    ])).status).toBe(200);
    await handleStatus({ CallSid: call, CallStatus: "completed" }, voiceDeps());
    const ran = await runDueJobs(db);
    expect(ran.failed).toBe(0);

    // 11. What Amy sees: one hot lead, honest flags, a callback task, alerts queued.
    const ctx = (await getCallContext(db, call))!;
    const { rows } = await db.query<{ intent: string; contact_name: string; timing: string; needs_review: boolean; compliance: { summary: Record<string, boolean>; violations: unknown[] } }>(
      "select intent, contact_name, timing, needs_review, compliance from public.lead where id = $1",
      [ctx.leadId],
    );
    expect(rows[0]).toMatchObject({ intent: "hot", contact_name: "Sarah Mitchell", timing: "November 12", needs_review: false });
    expect(rows[0]!.compliance.violations).toEqual([]);
    expect(rows[0]!.compliance.summary).toMatchObject({ priceAsked: true, priceStated: false, dateRequested: true, availabilityPromised: false, humanRequested: true });

    const tasks = await db.query<{ priority: string; status: string }>("select priority, status from public.task where lead_id = $1 and kind = 'callback'", [ctx.leadId]);
    expect(tasks.rows).toEqual([{ priority: "high", status: "open" }]);
    const alerts = await db.query<{ kind: string }>("select distinct kind from public.outbox where lead_id = $1 order by kind", [ctx.leadId]);
    expect(alerts.rows.map((r) => r.kind)).toEqual(["agent_lead", "transfer_missed"]);
    const escalation = await db.query<{ n: string | number }>("select count(*) as n from public.job where kind = 'callback_escalation'");
    expect(Number(escalation.rows[0]!.n)).toBe(1);

    // 12. Replays change nothing.
    expect((await postCall(call, first, `conv_${call}`, [])).status).toBe(200);
    const replay = await tool(call, "finish_call", { outcome: "callback_requested", summary: "Sarah wants roofline lights by Nov 12; call after 4." });
    expect(replay.body.replayed).toBe(true);
  });
});

describe("failure paths never lose the caller", () => {
  it("vendor error on hand-off: caller is captured, the session is failed, an incident is raised", async () => {
    const call = sid();
    const from = caller();
    await handleInbound({ CallSid: call, From: from, To: TV }, voiceDeps());
    const broken = simulatorConnector({ fail: () => true });
    const twiml = await handleDialResult({ CallSid: call, From: from, To: TV, DialCallStatus: "no-answer" }, voiceDeps(DAYTIME, broken));
    expect(twiml).toContain("<Record");
    expect((await getCallContext(db, call))!.state).toBe("recovery");
    const incidents = await db.query<{ kind: string }>("select kind from public.incident where call_id = (select id from public.call where twilio_call_sid = $1)", [call]);
    expect(incidents.rows.map((r) => r.kind)).toEqual(["agent_connect_failed"]);
  });

  it("three vendor failures open the circuit; the next caller skips the agent without waiting", async () => {
    const circuit = new VendorCircuit(3, 60_000, 60_000);
    let attempts = 0;
    const broken = simulatorConnector({ fail: () => { attempts += 1; return true; } });
    for (let i = 0; i < 4; i += 1) {
      const call = sid();
      await handleInbound({ CallSid: call, From: caller(), To: TV }, voiceDeps(NIGHT, broken, circuit));
    }
    expect(attempts).toBe(3);
    expect(circuit.healthy()).toBe(false);
  });

  it("the agent's stream drops before wrap-up: apology plus message capture, and an incident", async () => {
    const call = sid();
    await handleInbound({ CallSid: call, From: caller(), To: TV }, voiceDeps(NIGHT));
    expect((await getCallContext(db, call))!.state).toBe("agent_active");
    const twiml = await handleAgentEnded({ CallSid: call, CallStatus: "in-progress" }, voiceDeps(NIGHT));
    expect(twiml).toContain("lost the connection");
    expect(twiml).toContain("<Record");
    expect((await getCallContext(db, call))!.state).toBe("recovery");
  });

  it("after hours, transfers are refused and the agent offers a callback instead", async () => {
    const call = sid();
    await handleInbound({ CallSid: call, From: caller(), To: TV }, voiceDeps(NIGHT));
    const result = await tool(call, "transfer_to_amy", { summary: "wants Amy", reason: "caller_asked" }, NIGHT);
    expect(result.body).toMatchObject({ ok: false, transferring: false, why: "outside_hours" });
    expect(String(result.body.instruction)).toMatch(/request_callback/);
  });

  it("kill switch: with AI off, an unanswered call goes to capture, never the agent", async () => {
    await setAiMode("off");
    try {
      const call = sid();
      await handleInbound({ CallSid: call, From: caller(), To: TV }, voiceDeps());
      const twiml = await handleDialResult({ CallSid: call, DialCallStatus: "no-answer" }, voiceDeps());
      expect(twiml).not.toContain("<Connect");
      expect(twiml).toContain("<Record");
    } finally {
      await setAiMode("overflow");
    }
  });

  it("a full AI tier sends the next caller to capture", async () => {
    await setAiMode("overflow", { maxConcurrentSessions: 0 });
    try {
      const call = sid();
      await handleInbound({ CallSid: call, From: caller(), To: TV }, voiceDeps());
      expect(await handleDialResult({ CallSid: call, DialCallStatus: "busy" }, voiceDeps())).toContain("<Record");
    } finally {
      await setAiMode("overflow", { maxConcurrentSessions: 50 });
    }
  });

  it("a transcript that breaks policy marks the lead for review and raises a critical incident", async () => {
    const call = sid();
    await handleInbound({ CallSid: call, From: caller(), To: TV }, voiceDeps(NIGHT));
    await tool(call, "save_lead_details", { service_requested: "roofline" }, NIGHT);
    await tool(call, "finish_call", { outcome: "info_only", summary: "asked price" }, NIGHT);
    await postCall(call, null, `conv_bad_${call}`, [
      { role: "user", message: "How much?" },
      { role: "agent", message: "Usually about $450 for a house like yours, and we can do November 12." },
    ]);
    await handleStatus({ CallSid: call, CallStatus: "completed" }, voiceDeps(NIGHT));
    await runDueJobs(db);
    const ctx = (await getCallContext(db, call))!;
    const lead = await db.query<{ needs_review: boolean }>("select needs_review from public.lead where id = $1", [ctx.leadId]);
    expect(lead.rows[0]!.needs_review).toBe(true);
    const incident = await db.query<{ severity: string; detail: { codes: string[] } }>(
      "select severity, detail from public.incident where call_id = $1 and kind = 'agent_policy_violation'",
      [ctx.callId],
    );
    expect(incident.rows[0]).toMatchObject({ severity: "critical" });
    expect(incident.rows[0]!.detail.codes.sort()).toEqual(["availability_promised", "price_stated"]);
  });
});

describe("tool gateway boundaries", () => {
  it("rejects unknown tools, unknown calls, malformed input and calls that are not live", async () => {
    expect((await runTool("drop_table", { call_sid: `CA${"0".repeat(32)}` }, gateway())).status).toBe(404);
    expect((await runTool("save_lead_details", { call_sid: "not-a-sid" }, gateway())).status).toBe(400);
    expect((await runTool("save_lead_details", { call_sid: `CA${"f".repeat(32)}` }, gateway())).status).toBe(404);

    const call = sid();
    await handleInbound({ CallSid: call, From: caller(), To: TV }, voiceDeps(NIGHT));
    const bad = await tool(call, "save_lead_details", { zip: "7873", sql: "drop table lead" }, NIGHT);
    expect(bad.body).toMatchObject({ ok: false, error: "invalid_input" });
    expect(JSON.stringify(bad.body)).not.toMatch(/stack|at Object|ZodError/);

    await handleStatus({ CallSid: call, CallStatus: "completed" }, voiceDeps(NIGHT));
    const late = await tool(call, "request_callback", { window: "tomorrow" }, NIGHT);
    expect(late.body).toMatchObject({ ok: false, error: "call_not_live" });
  });

  it("webhook signatures fail closed", async () => {
    const body = JSON.stringify({ type: "post_call_transcription", data: {} });
    const now = Math.floor(Date.now() / 1000);
    expect((await handlePostCallWebhook({ db, secret: SECRET, signature: null, rawBody: body, nowSeconds: now })).status).toBe(401);
    expect((await handlePostCallWebhook({ db, secret: undefined, signature: signLikeElevenLabs(SECRET, body, now), rawBody: body, nowSeconds: now })).status).toBe(401);
    expect((await handlePostCallWebhook({ db, secret: SECRET, signature: signLikeElevenLabs("other", body, now), rawBody: body, nowSeconds: now })).status).toBe(401);
    expect((await handlePostCallWebhook({ db, secret: SECRET, signature: signLikeElevenLabs(SECRET, body, now - 3600), rawBody: body, nowSeconds: now })).status).toBe(401);
    expect((await handlePostCallWebhook({ db, secret: SECRET, signature: signLikeElevenLabs(SECRET, `${body} `, now), rawBody: body, nowSeconds: now })).status).toBe(401);
  });
});

describe("caller declines recording", () => {
  it("keeps notes and consent evidence, stores no transcript, and schedules the vendor purge", async () => {
    const call = sid();
    const agentTwiml = await handleInbound({ CallSid: call, From: caller(), To: TV }, voiceDeps(NIGHT));
    const session = sessionOf(agentTwiml);
    expect((await tool(call, "recording_declined", {}, NIGHT)).body).toMatchObject({ ok: true });
    await tool(call, "save_lead_details", { service_requested: "wreaths and garland", caller_name: "Dana" }, NIGHT);
    await tool(call, "request_callback", { window: "tomorrow morning" }, NIGHT);
    await tool(call, "finish_call", { outcome: "callback_requested", summary: "Dana wants wreaths; call tomorrow morning." }, NIGHT);
    await postCall(call, session, `conv_declined_${call}`, [
      { role: "user", message: "Please don't record this." },
      { role: "agent", message: "No problem. I won't keep a recording of this call." },
    ]);
    await handleStatus({ CallSid: call, CallStatus: "completed" }, voiceDeps(NIGHT));
    await runDueJobs(db);

    const stored = await db.query<{ transcript: unknown; summary: string | null; metadata: { recording_declined?: boolean } }>(
      "select transcript, summary, metadata from public.agent_session where id = $1",
      [session],
    );
    expect(stored.rows[0]).toMatchObject({ transcript: null, summary: null });
    expect(stored.rows[0]!.metadata.recording_declined).toBe(true);
    const ctx = (await getCallContext(db, call))!;
    const consent = await db.query<{ n: string | number }>(
      "select count(*) as n from public.event where aggregate_id = $1 and type = 'consent.recording_declined'",
      [ctx.callId],
    );
    expect(Number(consent.rows[0]!.n)).toBe(1);
    const lead = await db.query<{ contact_name: string; intent: string }>("select contact_name, intent from public.lead where id = $1", [ctx.leadId]);
    expect(lead.rows[0]).toMatchObject({ contact_name: "Dana", intent: "warm" });
    const purge = await db.query<{ status: string }>("select status from public.job where kind = 'vendor_purge' and subject_id = $1", [session]);
    expect(purge.rows[0]?.status).toBe("done"); // simulator session: nothing held at a vendor
  });
});

describe("spam and sales calls", () => {
  it("are kept for Amy to confirm, but never text her (her line is full of them)", async () => {
    const call = sid();
    await handleInbound({ CallSid: call, From: caller(), To: TV }, voiceDeps(NIGHT));
    await tool(call, "save_lead_details", { notes: "Offering to lower our credit card processing rates" }, NIGHT);
    await tool(call, "finish_call", { outcome: "spam", summary: "Sales call about card processing." }, NIGHT);
    await handleAgentEnded({ CallSid: call, CallStatus: "in-progress" }, voiceDeps(NIGHT));
    await handleStatus({ CallSid: call, CallStatus: "completed" }, voiceDeps(NIGHT));
    await runDueJobs(db);

    const ctx = (await getCallContext(db, call))!;
    const lead = await db.query<{ intent: string; needs_review: boolean }>("select intent, needs_review from public.lead where id = $1", [ctx.leadId]);
    expect(lead.rows[0]).toMatchObject({ intent: "not_a_lead", needs_review: true });
    const alerts = await db.query<{ n: string | number }>("select count(*) as n from public.outbox where lead_id = $1", [ctx.leadId]);
    expect(Number(alerts.rows[0]!.n)).toBe(0);
  });
});

describe("lost post-call webhook", () => {
  it("fetches the call's finished conversation from the vendor and stores it as the webhook would", async () => {
    const call = sid();
    const agentTwiml = await handleInbound({ CallSid: call, From: caller(), To: TV }, voiceDeps(NIGHT));
    const session = sessionOf(agentTwiml);
    await tool(call, "save_lead_details", { caller_name: "Ruth", service_requested: "roofline" }, NIGHT);
    await tool(call, "finish_call", { outcome: "callback_requested", summary: "Ruth wants roofline lights." }, NIGHT);
    await handleStatus({ CallSid: call, CallStatus: "completed" }, voiceDeps(NIGHT));
    // As a live ElevenLabs session would be stored (the simulator never reaches a vendor).
    await db.query("update public.agent_session set provider = 'elevenlabs', agent_id = 'agent_test' where id = $1", [session]);
    const ctx = (await getCallContext(db, call))!;

    const conversation = (id: string, callSid: string) => ({
      agent_id: "agent_test",
      conversation_id: id,
      status: "done",
      transcript: [{ role: "agent", message: "Thanks Ruth, I'll have Amy call you." }],
      metadata: { call_duration_secs: 40, phone_call: { call_sid: callSid } },
      analysis: { transcript_summary: "Ruth wants roofline lights.", data_collection_results: { lead_source: { value: "Google" } } },
      conversation_initiation_client_data: { dynamic_variables: { call_sid: callSid, session_id: session } },
    });
    const requested: string[] = [];
    const fakeFetch = (async (url: URL | string) => {
      const path = new URL(String(url)).pathname;
      requested.push(path);
      if (path === "/v1/convai/conversations") {
        return Response.json({
          conversations: [
            { conversation_id: "conv_lost", status: "done" },
            { conversation_id: "conv_other_call", status: "done" },
            { conversation_id: "conv_still_running", status: "in-progress" },
          ],
        });
      }
      if (path.endsWith("/conv_lost")) return Response.json(conversation("conv_lost", call));
      if (path.endsWith("/conv_other_call")) return Response.json(conversation("conv_other_call", `CA${"f".repeat(32)}`));
      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    // Before the reconcile attempt the job only waits; nothing is fetched.
    const early = await processPostCall(db, { subjectId: ctx.callId, attempts: 0 }, { apiKey: "k", fetchImpl: fakeFetch });
    expect(early.status).toBe("retry");
    expect(requested).toEqual([]);

    const outcome = await processPostCall(db, { subjectId: ctx.callId, attempts: RECONCILE_FROM_ATTEMPT }, { apiKey: "k", fetchImpl: fakeFetch });
    expect(outcome).toMatchObject({ status: "done", transcript: true });
    expect(requested).not.toContain("/v1/convai/conversations/conv_still_running");
    const stored = await db.query<{ conversation_id: string; summary: string; post_call_at: Date | null }>(
      "select conversation_id, summary, post_call_at from public.agent_session where id = $1",
      [session],
    );
    expect(stored.rows[0]).toMatchObject({ conversation_id: "conv_lost", summary: "Ruth wants roofline lights." });
    expect(stored.rows[0]!.post_call_at).not.toBeNull();
    const source = await db.query<{ value: string }>(
      "select value from public.lead_fact_current where lead_id = $1 and field = 'lead_source'",
      [ctx.leadId],
    );
    expect(source.rows[0]?.value).toBe("Google");
  });
});

describe("runaway agent", () => {
  it("stops a tool loop at the per-call cap and tells the agent to wrap up", async () => {
    const call = sid();
    await handleInbound({ CallSid: call, From: caller(), To: TV }, voiceDeps(NIGHT));
    let last: Awaited<ReturnType<typeof tool>> | null = null;
    for (let i = 0; i < 41; i += 1) {
      last = await tool(call, "save_lead_details", { notes: `loop ${i}` }, NIGHT);
    }
    expect(last!.body).toMatchObject({ ok: false, error: "tool_limit" });
    expect(String(last!.body.instruction)).toMatch(/finish_call/);
  });
});
