/**
 * Burst test over HTTP against a running server (ideally `next start` on real
 * Postgres). Each simulated caller: inbound → Amy doesn't answer → agent or
 * capture → a few tool calls → hang-up → post-call webhook → status callback.
 * All callers in a burst hold their agent session until every caller in the
 * burst has been routed, so concurrency is real, not sequential.
 *
 * Checks per burst: every call ends with exactly one lead; agent sessions
 * never exceed the configured limit; overflow goes to capture; webhook
 * latency p50/p95/max. Writes evals/out/load-report.json.
 *
 *   BASE=http://localhost:3100 DATABASE_URL=postgres://... npx tsx scripts/load-test.ts 1 5 10 20 50 100
 */
import { mkdirSync, writeFileSync } from "node:fs";
import pg from "pg";
import { signLikeElevenLabs } from "@/lib/elevenlabs/webhook-signature";
import { signLikeTwilio } from "@/lib/telephony/signature";

const BASE = process.env.BASE ?? "http://localhost:3100";
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN ?? "dev";
const TOOL_SECRET = process.env.AGENT_TOOL_SECRET ?? "dev-tools";
const HOOK_SECRET = process.env.ELEVENLABS_WEBHOOK_SECRET ?? "dev-hooks";
const LIMIT = Number(process.env.MAX_SESSIONS ?? 10);
const TV = "+15125550101";
const bursts = process.argv.slice(2).map(Number).filter((n) => n > 0);
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4 });

const latencies: Record<string, number[]> = {};
let seq = Date.now() % 10_000_000;

async function timed<T>(kind: string, fn: () => Promise<T>): Promise<T> {
  const t0 = performance.now();
  try {
    return await fn();
  } finally {
    (latencies[kind] ??= []).push(performance.now() - t0);
  }
}

async function twilio(path: string, params: Record<string, string>): Promise<string> {
  return timed(path, async () => {
    const url = `${BASE}${path}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "x-twilio-signature": signLikeTwilio(TWILIO_TOKEN, url, params) },
      body: new URLSearchParams(params),
    });
    if (res.status >= 400) throw new Error(`${path} ${res.status}`);
    return res.text();
  });
}

async function tool(callSid: string, name: string, args: Record<string, unknown>) {
  return timed(`tool:${name}`, async () => {
    const res = await fetch(`${BASE}/api/agent/tools/${name}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-lightline-tool-key": TOOL_SECRET },
      body: JSON.stringify({ call_sid: callSid, conversation_id: `load_${callSid}`, ...args }),
    });
    if (res.status >= 400) throw new Error(`tool ${name} ${res.status}`);
    return res.json();
  });
}

async function postCall(callSid: string, sessionId: string | null) {
  const body = JSON.stringify({
    type: "post_call_transcription",
    data: {
      agent_id: "agent_sim",
      conversation_id: `load_conv_${callSid}`,
      transcript: [{ role: "agent", message: "Hi, I'm Amy's AI assistant." }, { role: "user", message: "I want roofline lights." }],
      metadata: { phone_call: { call_sid: callSid } },
      analysis: { transcript_summary: "Load test caller." },
      conversation_initiation_client_data: { dynamic_variables: { call_sid: callSid, session_id: sessionId } },
    },
  });
  await timed("webhook:post-call", async () => {
    const res = await fetch(`${BASE}/api/webhooks/elevenlabs`, {
      method: "POST",
      headers: { "content-type": "application/json", "elevenlabs-signature": signLikeElevenLabs(HOOK_SECRET, body, Math.floor(Date.now() / 1000)) },
      body,
    });
    if (res.status >= 400) throw new Error(`post-call ${res.status}`);
  });
}

function pct(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0);
}

async function burst(n: number) {
  const calls = Array.from({ length: n }, () => {
    seq += 1;
    return { sid: `CA${seq.toString(16).padStart(32, "0")}`, from: `+1512${String(2000000 + (seq % 7000000)).padStart(7, "0")}` };
  });
  const started = performance.now();
  // Phase 1: everyone calls at once; Amy answers no one.
  const routed = await Promise.all(
    calls.map(async (c) => {
      await twilio("/api/voice/inbound", { CallSid: c.sid, From: c.from, To: TV });
      const twiml = await twilio("/api/voice/dial-result", { CallSid: c.sid, From: c.from, To: TV, DialCallStatus: "no-answer" });
      return { ...c, agent: twiml.includes("<Connect"), session: /name="session_id" value="([^"]+)"/.exec(twiml)?.[1] ?? null };
    }),
  );
  const { rows: peak } = await db.query("select count(*)::int as n from public.agent_session where status = 'active'");
  // Phase 2: agent callers talk; captured callers leave a message.
  await Promise.all(
    routed.map(async (c) => {
      if (c.agent) {
        await tool(c.sid, "save_lead_details", { property_type: "residential", service_requested: "roofline", property_address: "1 Load St, Austin" });
        await tool(c.sid, "request_callback", { window: "tomorrow" });
        await tool(c.sid, "finish_call", { outcome: "callback_requested", summary: "Load caller." });
        await twilio("/api/voice/agent-ended", { CallSid: c.sid, CallStatus: "in-progress" });
        await postCall(c.sid, c.session);
      } else {
        await twilio("/api/voice/recording", { CallSid: c.sid, RecordingSid: `RE${c.sid.slice(2)}`, RecordingUrl: `https://api.twilio.com/fake/${c.sid}`, RecordingDuration: "12", RecordingStatus: "completed" });
      }
      await twilio("/api/voice/status", { CallSid: c.sid, CallStatus: "completed" });
    }),
  );
  const elapsed = performance.now() - started;
  const sids = calls.map((c) => c.sid);
  const { rows } = await db.query(
    `select count(*)::int as calls, count(lead_id)::int as with_lead,
            count(*) filter (where state = 'agent_completed')::int as agent,
            count(*) filter (where state = 'message_captured')::int as captured
       from public.call where twilio_call_sid = any($1)`,
    [sids],
  );
  return {
    burst: n,
    seconds: Number((elapsed / 1000).toFixed(2)),
    peakActiveAgentSessions: peak[0].n,
    limit: LIMIT,
    ...rows[0],
    pass: rows[0].calls === n && rows[0].with_lead === n && peak[0].n <= LIMIT && rows[0].agent + rows[0].captured === n,
  };
}

const results = [];
for (const n of bursts.length ? bursts : [1, 5, 10, 20, 50, 100]) {
  const r = await burst(n);
  results.push(r);
  console.log(JSON.stringify(r));
}
const summary = Object.fromEntries(
  Object.entries(latencies).map(([k, v]) => [k, { n: v.length, p50: pct(v, 50), p95: pct(v, 95), max: Math.round(Math.max(...v)) }]),
);
console.log(JSON.stringify(summary, null, 1));
mkdirSync("evals/out", { recursive: true });
writeFileSync("evals/out/load-report.json", `${JSON.stringify({ base: BASE, limit: LIMIT, results, latencyMs: summary }, null, 2)}\n`);
await db.end();
