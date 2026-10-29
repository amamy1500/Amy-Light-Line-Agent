/**
 * Drives simulated calls through a running Lightline server, over HTTP, with
 * the same signatures Twilio and ElevenLabs use. It plays three parts: the
 * caller's phone network (Twilio webhooks), the voice agent (tool calls), and
 * the vendor's post-call webhook. Nothing rings a real phone.
 *
 * Start the server with the simulator agent, e.g.:
 *   AGENT_PROVIDER=simulator AI_MODE=overflow AGENT_ID=agent_sim RING_START=00:00 RING_END=00:00 \
 *   TWILIO_AUTH_TOKEN=dev AGENT_TOOL_SECRET=dev-tools ELEVENLABS_WEBHOOK_SECRET=dev-hooks OPERATOR_TOKEN=dev \
 *   DEMO_APPROVED_KEYS=christmas_services,residential_commercial,quote_process npm run dev
 * then: npx tsx scripts/simulate-calls.ts
 */
import { signLikeElevenLabs } from "@/lib/elevenlabs/webhook-signature";
import { signLikeTwilio } from "@/lib/telephony/signature";

const BASE = process.env.PUBLIC_BASE_URL ?? "http://localhost:3000";
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN ?? "dev";
const TOOL_SECRET = process.env.AGENT_TOOL_SECRET ?? "dev-tools";
const HOOK_SECRET = process.env.ELEVENLABS_WEBHOOK_SECRET ?? "dev-hooks";
const TV = process.env.CLG_TV_NUMBER ?? "+15125550101";
const WEB = process.env.CLG_WEB_NUMBER ?? "+15125550102";

let seq = Date.now() % 1_000_000;
const sid = () => `CA${(seq++).toString(16).padStart(32, "0")}`;

async function twilio(path: string, params: Record<string, string>): Promise<string> {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "x-twilio-signature": signLikeTwilio(TWILIO_TOKEN, url, params) },
    body: new URLSearchParams(params),
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.text();
}

async function tool(callSid: string, name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE}/api/agent/tools/${name}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-lightline-tool-key": TOOL_SECRET },
    body: JSON.stringify({ call_sid: callSid, conversation_id: `sim_${callSid}`, ...args }),
  });
  const body = (await res.json()) as Record<string, unknown>;
  console.log(`   tool ${name} -> ${res.status} ${JSON.stringify(body).slice(0, 140)}`);
  return body;
}

async function postCall(callSid: string, sessionId: string | null, conversationId: string, transcript: Array<[string, string]>, collected: Record<string, string> = {}) {
  const body = JSON.stringify({
    type: "post_call_transcription",
    event_timestamp: Math.floor(Date.now() / 1000),
    data: {
      agent_id: "agent_sim",
      conversation_id: conversationId,
      status: "done",
      transcript: transcript.map(([role, message]) => ({ role, message })),
      metadata: { call_duration_secs: 90, phone_call: { call_sid: callSid } },
      analysis: {
        transcript_summary: (collected.summary as string | undefined) ?? (transcript.length ? "Caller spoke with the assistant." : null),
        call_successful: "success",
        data_collection_results: Object.fromEntries(Object.entries(collected).map(([k, v]) => [k, { value: v }])),
      },
      conversation_initiation_client_data: { dynamic_variables: { call_sid: callSid, session_id: sessionId } },
    },
  });
  const res = await fetch(`${BASE}/api/webhooks/elevenlabs`, {
    method: "POST",
    headers: { "content-type": "application/json", "elevenlabs-signature": signLikeElevenLabs(HOOK_SECRET, body, Math.floor(Date.now() / 1000)) },
    body,
  });
  console.log(`   post-call webhook -> ${res.status}`);
}

const sessionOf = (twiml: string) => /name="session_id" value="([^"]+)"/.exec(twiml)?.[1] ?? null;

async function sarah() {
  console.log("\n1) Sarah, TV ad. Amy ignores the call; asks for Amy; Amy misses again; callback.");
  const call = sid();
  const from = "+15125550147";
  await twilio("/api/voice/inbound", { CallSid: call, From: from, To: TV });
  const agent = await twilio("/api/voice/dial-result", { CallSid: call, From: from, To: TV, DialCallStatus: "completed", DialBridged: "false" });
  console.log(`   agent connected: ${agent.includes("<Connect") ? "yes" : "NO"}`);
  const first = sessionOf(agent);
  await tool(call, "save_lead_details", { property_type: "residential", customer_type: "new", service_requested: "front of the house and roofline", property_address: "112 Lakeview Dr, Lakeway", zip: "78734", desired_timing: "November 12" });
  await tool(call, "get_approved_answer", { topic: "price", question: "How much would the roofline be?" });
  await tool(call, "check_service_area", { city: "Lakeway" });
  await tool(call, "transfer_to_amy", { summary: "Sarah in Lakeway, roofline, wants Nov 12", reason: "caller_asked" });
  await twilio("/api/voice/handoff", { CallSid: call, From: from, To: TV });
  const back = await twilio("/api/voice/handoff-result", { CallSid: call, From: from, To: TV, DialCallStatus: "no-answer" });
  const second = sessionOf(back);
  await tool(call, "save_lead_details", { caller_name: "Sarah Mitchell", callback_window: "after 4 PM", lead_source: "TV ad" });
  await tool(call, "request_callback", { window: "after 4 PM", reason: "Wants a quote for roofline", urgent: true });
  await tool(call, "finish_call", { outcome: "callback_requested", summary: "Sarah wants the front and roofline lit by Nov 12. Asked about price; none given. Call after 4." });
  await twilio("/api/voice/agent-ended", { CallSid: call, CallStatus: "in-progress" });
  await postCall(call, first, `sim1_${call}`, [
    ["agent", "Hi, thanks for calling The Christmas Light Guys. I'm Amy's AI assistant, an automated system, not a person. This call is recorded and transcribed, and our AI service providers process it to help us respond. If you'd rather not be recorded, just say so. Amy is tied up right now, but I can get everything started for you. What can I help you with?"],
    ["user", "Hi, I saw your ad on TV. I want lights on the front of my house and the roofline. Can you do November 12?"],
    ["agent", "Sure, I can help with that. I can't promise a date until Amy checks the schedule, but I'll pass along that you'd like it by then. Is this your home, and have we worked on it before?"],
    ["user", "It's my house in Lakeway, first time. How much would the roofline be?"],
    ["agent", "I don't want to give you the wrong answer on that. Amy prepares every quote herself once she knows the property. What's the address?"],
    ["user", "112 Lakeview Drive. Actually, can I just talk to Amy?"],
    ["agent", "Let me try Amy for you, one moment."],
  ]);
  await postCall(call, second, `sim2_${call}`, [
    ["agent", "Sorry about that, Amy couldn't pick up. You're back with Amy's AI assistant, and I've kept everything you told me. When's a good time for her to call you back?"],
    ["user", "After 4 PM works. I'm Sarah Mitchell."],
    ["agent", "Thanks, Sarah. Amy will call you back after 4 PM. Have a great evening."],
  ]);
  await twilio("/api/voice/status", { CallSid: call, CallStatus: "completed" });
}

async function quickHangUp() {
  console.log("\n2) A caller hangs up while Amy's phone rings.");
  const call = sid();
  await twilio("/api/voice/inbound", { CallSid: call, From: "+15125550123", To: TV });
  await twilio("/api/voice/status", { CallSid: call, CallStatus: "completed" });
}

async function vendor() {
  console.log("\n3) A sales call: the assistant marks it not a customer.");
  const call = sid();
  const from = "+15125550188";
  await twilio("/api/voice/inbound", { CallSid: call, From: from, To: TV });
  const agent = await twilio("/api/voice/dial-result", { CallSid: call, From: from, To: TV, DialCallStatus: "no-answer" });
  await tool(call, "save_lead_details", { notes: "Selling SEO services" });
  await tool(call, "finish_call", { outcome: "not_a_lead", summary: "Vendor selling SEO services." });
  await twilio("/api/voice/agent-ended", { CallSid: call, CallStatus: "in-progress" });
  await postCall(call, sessionOf(agent), `sim3_${call}`, [["user", "Hi, I'm calling about getting your website to rank on Google."], ["agent", "Thanks for calling. I'll let Amy know you called. Have a good day."]]);
  await twilio("/api/voice/status", { CallSid: call, CallStatus: "completed" });
}

async function webForm() {
  console.log("\n4) A web quote request from a postcard QR code.");
  const page = await (await fetch(`${BASE}/christmas-lights-austin?utm_source=postcard&qr=oct-north`)).text();
  const campaign = /name="campaign" value="([^"]+)"/.exec(page)?.[1];
  const stamp = /name="stamp" value="([^"]+)"/.exec(page)?.[1];
  if (!campaign || !stamp) throw new Error("landing page form not found");
  await new Promise((r) => setTimeout(r, 3_200)); // a person takes a few seconds to fill the form
  const res = await fetch(`${BASE}/api/leads/web`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ campaign, stamp, utm_source: "postcard", qr: "oct-north", name: "Luis Ortega", phone: "(512) 555-0161", address: "4 Brushy Creek Rd, Round Rock", service: "roofline and two oak trees", timing: "before Thanksgiving" }),
  });
  console.log(`   web form -> ${res.status} ${res.headers.get("location")}`);
}

const SHARED = process.env.SHARED_LINE_NUMBER;
const FRIDGE = process.env.THE_FRIDGE_NUMBER;

async function sharedLinePatio() {
  if (!SHARED) return;
  console.log("\n5) The shared office line: the caller names a need, the assistant files it under Sublime Patio.");
  const call = sid();
  const from = "+15125550172";
  const agent = await twilio("/api/voice/inbound", { CallSid: call, From: from, To: SHARED });
  await twilio("/api/voice/dial-result", { CallSid: call, From: from, To: SHARED, DialCallStatus: "no-answer" });
  const chosen = await tool(call, "select_business", { caller_words: "We want an outdoor kitchen and a pergola out back" });
  console.log(`   select_business -> ${chosen.status} ${chosen.company ?? ""}`);
  await tool(call, "save_lead_details", {
    caller_name: "Priya Raman",
    property_type: "residential",
    customer_type: "new",
    service_requested: "outdoor kitchen and pergola",
    property_address: "88 Hidden Hills Dr, Dripping Springs",
    desired_timing: "before spring",
    callback_window: "weekday mornings",
  });
  await tool(call, "request_callback", { window: "weekday mornings", reason: "Wants an estimate visit" });
  await tool(call, "finish_call", { outcome: "callback_requested", summary: "Priya wants an outdoor kitchen and a pergola in Dripping Springs, before spring. Call weekday mornings." });
  await twilio("/api/voice/agent-ended", { CallSid: call, CallStatus: "in-progress" });
  await postCall(call, sessionOf(agent), `sim5_${call}`, [
    ["agent", "Hi, thanks for calling. Which company are you calling about: The Christmas Light Guys, Sublime Patio or The Fridge?"],
    ["user", "We want an outdoor kitchen and a pergola out back."],
    ["agent", "Got it, Sublime Patio. Can I get your name?"],
  ]);
  await twilio("/api/voice/status", { CallSid: call, CallStatus: "completed" });
}

async function fridgeMachine() {
  if (!FRIDGE) return;
  console.log("\n6) The Fridge's own number: a gym asks for a machine; the assistant asks what and where.");
  const call = sid();
  const from = "+15125550184";
  await twilio("/api/voice/inbound", { CallSid: call, From: from, To: FRIDGE });
  const agent = await twilio("/api/voice/dial-result", { CallSid: call, From: from, To: FRIDGE, DialCallStatus: "no-answer" });
  await tool(call, "save_lead_details", {
    service_requested: "drinks and healthy snacks machine",
    property_type: "commercial",
    property_address: "Iron Oak Gym, 1200 E 6th St, Austin",
    notes: "About 300 members a day",
    caller_name: "Marcus Lee",
    callback_window: "after 2 pm",
  });
  await tool(call, "get_approved_answer", { topic: "cost", question: "Does it cost us anything to have the machine?" });
  await tool(call, "request_callback", { window: "after 2 pm" });
  await tool(call, "finish_call", { outcome: "callback_requested", summary: "Marcus at Iron Oak Gym (about 300 a day) wants a drinks and snacks machine. Asked if it costs anything: deferred to Amy." });
  await twilio("/api/voice/agent-ended", { CallSid: call, CallStatus: "in-progress" });
  await postCall(call, sessionOf(agent), `sim6_${call}`, [
    ["agent", "Hi, thanks for calling The Fridge. What can I help you with?"],
    ["user", "We'd like a vending machine at our gym. Does it cost us anything?"],
    ["agent", "I don't want to give you the wrong answer on that. I'll make sure Amy covers it when she calls."],
  ]);
  await twilio("/api/voice/status", { CallSid: call, CallStatus: "completed" });
}

await sarah();
await quickHangUp();
await vendor();
await webForm();
await sharedLinePatio();
await fridgeMachine();
const jobs = await fetch(`${BASE}/api/jobs/run`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET ?? "dev-cron"}` } });
console.log(`\njob sweep -> ${jobs.status} ${await jobs.text()}`);
console.log(`\nOpen ${BASE}/dashboard (access code: your OPERATOR_TOKEN).`);
