import { beforeAll, describe, expect, it } from "vitest";
import { simulatorConnector } from "@/lib/agents/connector";
import { runTool } from "@/lib/agents/gateway";
import { seedChristmasLightGuys, type ClgSeedOptions, type Queryable } from "@/lib/db";
import { raiseIncident } from "@/lib/db/agent";
import { loadActiveConfig } from "@/lib/db/config";
import { openPglite } from "@/lib/db/pglite";
import { openIncidents, recentEvents, stuckAlerts, systemLines, traffic, unansweredQuestions } from "@/lib/db/system";
import { handleDialResult, handleInbound, handleScreen, handleScreenAccept, handleStatus, type VoiceDeps } from "@/lib/server/voice";

// The System health page's numbers come from real calls through the real
// handlers: what Amy took, what the assistant took, what it couldn't answer,
// and what failed. The Christmas Light Guys' own number is a "main line".
const BASE = "https://clg.example.test";
const MAIN = "+15125550104"; // fictional stand-in for 737-339-8333
const DAYTIME = new Date("2026-10-20T18:00:00Z"); // Tue 1:00 pm in Austin
const OPTS: ClgSeedOptions = {
  ownerName: "Amy",
  ownerRingE164: "+15125550199",
  numbers: { tv: "+15125550101", web: "+15125550102", print: "+15125550103", main: MAIN },
  alertSms: "+15125550198",
  alertEmail: "amy@example.com",
  ringStart: "09:00",
  ringEnd: "17:00",
  ringDays: [1, 2, 3, 4, 5, 6],
  aiMode: "overflow",
  agentId: "agent_test",
  maxConcurrentSessions: 50,
};

let db: Queryable;
let seq = 0;
const sid = () => `CA${(0xd00 + ++seq).toString(16).padStart(32, "0")}`;
const caller = () => `+1512555${String(800 + seq).padStart(4, "0")}`;
const deps = (): VoiceDeps => ({ db, now: () => DAYTIME, baseUrl: BASE, agent: simulatorConnector() });

beforeAll(async () => {
  db = await openPglite();
  await seedChristmasLightGuys(db, OPTS);
});

describe("the Christmas Light Guys' own number", () => {
  it("is a main line: the whisper names the company, not an ad channel", async () => {
    const line = (await systemLines(db)).find((l) => l.e164 === MAIN)!;
    expect(line).toMatchObject({ company: "Christmas Light Guys", channel: "main_line", ringOwner: true });
    const call = sid();
    expect(await handleInbound({ CallSid: call, From: caller(), To: MAIN }, deps())).toContain("<Dial");
    const whisper = await handleScreen({ CallSid: sid(), ParentCallSid: call }, deps());
    expect(whisper).toContain("The Christmas Light Guys call. Press any key to take it.");
    expect(whisper).not.toContain(" from ");
    await handleStatus({ CallSid: call, CallStatus: "completed" }, deps());
  });

  it("seeding again adds no second line for the same number", async () => {
    await seedChristmasLightGuys(db, OPTS);
    const { rows } = await db.query<{ n: number }>("select count(*)::int as n from public.tracking_number where e164 = $1", [MAIN]);
    expect(rows[0]!.n).toBe(1);
  });
});

describe("System health", () => {
  it("counts what Amy took, what the assistant took, and lists what it couldn't answer", async () => {
    const before = await traffic(db, 24);

    // Amy takes one.
    const taken = sid();
    const from1 = caller();
    await handleInbound({ CallSid: taken, From: from1, To: MAIN }, deps());
    await handleScreenAccept({ CallSid: sid(), ParentCallSid: taken, Digits: "#" }, deps());
    await handleDialResult({ CallSid: taken, From: from1, To: MAIN, DialCallStatus: "completed", DialBridged: "true" }, deps());
    await handleStatus({ CallSid: taken, CallStatus: "completed" }, deps());

    // She misses the next; the assistant gets a question nobody approved an answer for.
    const missed = sid();
    const from2 = caller();
    await handleInbound({ CallSid: missed, From: from2, To: MAIN }, deps());
    await handleDialResult({ CallSid: missed, From: from2, To: MAIN, DialCallStatus: "no-answer", DialBridged: "false" }, deps());
    const answer = await runTool(
      "get_approved_answer",
      { call_sid: missed, conversation_id: `conv_${missed}`, topic: "boats", question: "Do you put lights on boats?" },
      { db, now: DAYTIME, loadConfig: async (id) => (await loadActiveConfig(db, id))?.config ?? null, scheduleHandoff: async () => {} },
    );
    expect(answer.body).toMatchObject({ ok: true, found: false });
    await handleStatus({ CallSid: missed, CallStatus: "completed" }, deps());

    const after = await traffic(db, 24);
    expect(after.total - before.total).toBe(2);
    expect(after.ownerAnswered - before.ownerAnswered).toBe(1);
    expect(after.assistant - before.assistant).toBe(1);

    const questions = await unansweredQuestions(db);
    expect(questions[0]).toMatchObject({ question: "Do you put lights on boats?", topic: "boats" });
    expect(questions[0]!.leadId).not.toBeNull();
  });

  it("shows failed alerts and open incidents, and the latest events", async () => {
    const { rows } = await db.query<{ id: string; tenant_id: string; business_id: string }>(
      "select id, tenant_id, business_id from public.outbox order by created_at desc limit 1",
    );
    const alert = rows[0]!;
    await db.query("update public.outbox set status = 'failed', attempts = 5, last_error = 'Resend responded 401' where id = $1", [alert.id]);
    expect((await stuckAlerts(db)).find((a) => a.id === alert.id)).toMatchObject({ status: "failed", lastError: "Resend responded 401" });

    await raiseIncident(db, {
      tenantId: alert.tenant_id,
      businessId: alert.business_id,
      callId: null,
      leadId: null,
      kind: "agent_stream_dropped",
      severity: "warning",
      detail: {},
      dedupeKey: "system-health-test",
    });
    expect((await openIncidents(db)).map((i) => i.kind)).toContain("agent_stream_dropped");
    expect((await recentEvents(db)).length).toBeGreaterThan(0);
  });
});
