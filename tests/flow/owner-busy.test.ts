import { beforeAll, describe, expect, it } from "vitest";
import { simulatorConnector } from "@/lib/agents/connector";
import { runTool, type GatewayDeps } from "@/lib/agents/gateway";
import { parseBusinessConfig } from "@/lib/business-rules/config";
import { seedChristmasLightGuys, type Queryable } from "@/lib/db";
import { activateConfig, loadActiveConfig } from "@/lib/db/config";
import { openPglite } from "@/lib/db/pglite";
import { handleDialResult, handleInbound, handleScreenAccept, handleStatus, type VoiceDeps } from "@/lib/server/voice";

// Amy takes a call by pressing any key; while she's on it, the next caller goes
// straight to the assistant instead of ringing her call waiting. Every call she
// takes is still saved as a lead and sent to her (text and email).
const BASE = "https://clg.example.test";
const TV = "+15125550101";
const OWNER = "+15125550199";
const DAYTIME = new Date("2026-10-20T18:00:00Z"); // Tue 1:00 pm in Austin

let db: Queryable;
let tenantId: string;
let businessId: string;
let seq = 0;
const sid = () => `CA${(++seq).toString(16).padStart(32, "0")}`;
const caller = () => `+1512555${String(700 + seq).padStart(4, "0")}`;
const deps = (): VoiceDeps => ({ db, now: () => DAYTIME, baseUrl: BASE, agent: simulatorConnector() });
const gateway = (): GatewayDeps => ({
  db,
  now: DAYTIME,
  loadConfig: async (id) => (await loadActiveConfig(db, id))?.config ?? null,
  scheduleHandoff: async () => {},
});

async function setAiMode(mode: "overflow" | "after_hours_only") {
  const active = (await loadActiveConfig(db, businessId))!.config;
  await activateConfig(db, { tenantId, businessId, config: parseBusinessConfig({ ...active, ai: { ...active.ai, mode } }), createdBy: "test" });
}

/** A call Amy answers with the given key; it stays live until `hangUp`. */
async function amyTakes(key: string) {
  const call = sid();
  const from = caller();
  expect(await handleInbound({ CallSid: call, From: from, To: TV }, deps())).toContain("<Dial");
  expect(await handleScreenAccept({ CallSid: sid(), ParentCallSid: call, Digits: key }, deps())).not.toContain("Hangup");
  expect(await handleDialResult({ CallSid: call, From: from, To: TV, DialCallStatus: "completed", DialBridged: "true" }, deps())).toContain("<Hangup/>");
  return { call, hangUp: () => handleStatus({ CallSid: call, CallStatus: "completed" }, deps()) };
}

beforeAll(async () => {
  db = await openPglite();
  const seed = await seedChristmasLightGuys(db, {
    ownerName: "Amy",
    ownerRingE164: OWNER,
    numbers: { tv: TV, web: "+15125550102", print: "+15125550103" },
    alertSms: "+15125550198",
    alertEmail: "amy@example.com",
    ringStart: "09:00",
    ringEnd: "17:00",
    ringDays: [1, 2, 3, 4, 5, 6],
    aiMode: "overflow",
    agentId: "agent_test",
    maxConcurrentSessions: 50,
  });
  tenantId = seed.tenantId;
  businessId = seed.businessId;
});

describe("Amy takes a call with any key", () => {
  it("saves the call as a lead and queues it to her by text and email", async () => {
    const taken = await amyTakes("#");
    const { rows: lead } = await db.query<{ state: string; source: string }>(
      "select l.state, l.source from public.lead l join public.call c on c.lead_id = l.id where c.twilio_call_sid = $1",
      [taken.call],
    );
    expect(lead[0]).toMatchObject({ state: "connected", source: "call_answered" });
    const { rows: alerts } = await db.query<{ channel: string }>(
      "select o.channel from public.outbox o join public.call c on c.id = o.call_id where c.twilio_call_sid = $1 and o.kind = 'answered' order by o.channel",
      [taken.call],
    );
    expect(alerts.map((a) => a.channel)).toEqual(["email", "sms"]);
    await taken.hangUp();
  });
});

describe("Amy is already on a call", () => {
  it("sends the next caller straight to the assistant, which says she's on another call", async () => {
    const first = await amyTakes("5");
    try {
      const twiml = await handleInbound({ CallSid: sid(), From: caller(), To: TV }, deps());
      expect(twiml).not.toContain("<Dial");
      expect(twiml).toContain('<Parameter name="entry" value="owner_busy"/>');
      expect(twiml).toContain("Amy's on another call right now, but I'd be happy to get a few details");
    } finally {
      await first.hangUp();
    }
  });

  it("without the assistant available, the busy caller hears she can't get to the phone, not that we're closed", async () => {
    const first = await amyTakes("3");
    try {
      const twiml = await handleInbound({ CallSid: sid(), From: caller(), To: TV }, { ...deps(), agent: { provider: "simulator", connect: async () => { throw new Error("vendor down"); } } });
      expect(twiml).toContain("can't get to the phone right now");
      expect(twiml).not.toContain("We're closed");
    } finally {
      await first.hangUp();
    }
  });

  it("won't try to transfer to her while she's still on the other call", async () => {
    const first = await amyTakes("1");
    try {
      const second = sid();
      await handleInbound({ CallSid: second, From: caller(), To: TV }, deps());
      const transfer = await runTool(
        "transfer_to_amy",
        { call_sid: second, conversation_id: `conv_${second}`, summary: "Ann, roofline", reason: "caller_asked" },
        gateway(),
      );
      expect(transfer.body).toMatchObject({ ok: false, why: "owner_busy" });
    } finally {
      await first.hangUp();
    }
  });

  it("rings her again as soon as that call ends", async () => {
    const first = await amyTakes("0");
    await first.hangUp();
    expect(await handleInbound({ CallSid: sid(), From: caller(), To: TV }, deps())).toContain("<Dial");
  });

  it("with no assistant for missed calls, her phone still rings (call waiting), exactly as before", async () => {
    await setAiMode("after_hours_only");
    try {
      const first = await amyTakes("2");
      expect(await handleInbound({ CallSid: sid(), From: caller(), To: TV }, deps())).toContain("<Dial");
      await first.hangUp();
    } finally {
      await setAiMode("overflow");
    }
  });
});
