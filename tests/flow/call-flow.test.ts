import { listInbox, seedChristmasLightGuys, type PendingAlert, type Queryable } from "@/lib/db";
import { openPglite } from "@/lib/db/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { drainAlerts, renderAlert, type AlertSender } from "@/lib/server/alerts";
import {
  handleDialResult,
  handleInbound,
  handleRecordDone,
  handleRecording,
  handleScreen,
  handleScreenAccept,
  handleStatus,
  handleTranscript,
  type VoiceDeps,
} from "@/lib/server/voice";

// Simulated calls through the real handlers and database. Clearly a
// simulation: no Twilio account, no phone numbers that can ring.
const BASE = "https://clg.example.test";
const TV = "+15125550101";
const OWNER = "+15125550199";
const DAYTIME = new Date("2026-10-20T18:00:00Z"); // 1:00 pm in Austin
const NIGHT = new Date("2026-10-21T04:00:00Z"); // 11:00 pm in Austin

let db: Queryable;
let seq = 0;
const sid = (prefix: string) => `${prefix}${(++seq).toString(16).padStart(32, "0")}`;
const caller = () => `+1512555${String(300 + seq).padStart(4, "0")}`;
const deps = (now = DAYTIME, overrideDb?: Queryable): VoiceDeps => ({ db: overrideDb ?? db, now: () => now, baseUrl: BASE });

async function callState(callSid: string) {
  const { rows } = await db.query<{ state: string; lead_id: string; lead_state: string; source: string; contact_name: string | null; address: string | null }>(
    `select c.state, c.lead_id, l.state as lead_state, l.source, l.contact_name, l.address
       from public.call c left join public.lead l on l.id = c.lead_id where c.twilio_call_sid = $1`,
    [callSid],
  );
  return rows[0]!;
}

beforeAll(async () => {
  const pg = await openPglite();
  await seedChristmasLightGuys(pg, {
    ownerName: "Amy",
    ownerRingE164: OWNER,
    numbers: { tv: TV, web: "+15125550102", print: "+15125550103" },
    alertSms: "+15125550198",
    alertEmail: "amy@example.com",
  });
  db = pg;
});

describe("simulated calls through the webhook handlers", () => {
  it("Amy presses 1 and talks: the call ends as answered and the lead is waiting for her outcome", async () => {
    const call = sid("CA");
    const from = caller();
    const ring = await handleInbound({ CallSid: call, From: from, To: TV }, deps());
    expect(ring).toContain(`<Number url="${BASE}/api/voice/screen" method="POST">${OWNER}</Number>`);

    const whisper = await handleScreen({ CallSid: sid("CA"), ParentCallSid: call }, deps());
    expect(whisper).toContain("The Christmas Light Guys call from TV. Press any key to take it.");

    expect(await handleScreenAccept({ ParentCallSid: call, Digits: "1" }, deps())).not.toContain("Hangup");
    expect(await handleDialResult({ CallSid: call, DialCallStatus: "completed", DialBridged: "true" }, deps())).toContain("<Hangup/>");
    await handleStatus({ CallSid: call, CallStatus: "completed" }, deps());

    expect(await callState(call)).toMatchObject({ state: "owner_answered", lead_state: "connected", source: "call_answered" });
  });

  it("Amy's voicemail picks up: the screen hangs up, the caller hears recovery, and the message becomes a lead", async () => {
    const call = sid("CA");
    await handleInbound({ CallSid: call, From: caller(), To: TV }, deps());
    await handleScreen({ CallSid: sid("CA"), ParentCallSid: call }, deps());
    // Voicemail never presses 1, so screen-accept is never requested.
    const recovery = await handleDialResult({ CallSid: call, DialCallStatus: "completed", DialBridged: "false" }, deps());
    expect(recovery).toContain("can't get to the phone right now");
    expect(recovery).toContain("<Record");

    await handleRecording(
      { CallSid: call, RecordingSid: sid("RE"), RecordingUrl: "https://api.twilio.com/2010-04-01/Accounts/AC1/Recordings/RE1", RecordingDuration: "12", RecordingStatus: "completed" },
      deps(),
    );
    await handleTranscript(
      {
        CallSid: call,
        TranscriptionStatus: "completed",
        TranscriptionText: "Hi this is Dana Whitfield at 4512 Oak Cove. Roofline and trees before Thanksgiving please. Call me back after 5 pm.",
      },
      deps(),
    );
    expect(await handleRecordDone({ CallSid: call }, deps())).toContain("Amy will call you back");
    await handleStatus({ CallSid: call, CallStatus: "completed" }, deps());

    expect(await callState(call)).toMatchObject({
      state: "message_captured",
      lead_state: "new",
      source: "call_recovery",
      contact_name: "Dana Whitfield",
      address: "4512 Oak Cove",
    });
  });

  it("after hours the phone does not ring Amy; the caller goes straight to the after-hours message", async () => {
    const call = sid("CA");
    const twiml = await handleInbound({ CallSid: call, From: caller(), To: TV }, deps(NIGHT));
    expect(twiml).not.toContain("<Dial");
    expect(twiml).toContain("We're closed right now");
    // Replayed webhook in the morning still gets the after-hours answer it got first.
    expect(await handleInbound({ CallSid: call, From: caller(), To: TV }, deps(DAYTIME))).toContain("We're closed right now");
  });

  it("a caller who hangs up during the ring is still a lead", async () => {
    const call = sid("CA");
    await handleInbound({ CallSid: call, From: caller(), To: TV }, deps());
    await handleStatus({ CallSid: call, CallStatus: "completed" }, deps());
    expect(await callState(call)).toMatchObject({ state: "abandoned", source: "abandoned_call" });
  });

  it("if the database fails mid-call, dial-result still never leaves the caller in silence", async () => {
    const broken: Queryable = { query: async () => { throw new Error("connection refused"); } };
    const notBridged = await handleDialResult({ CallSid: sid("CA"), DialCallStatus: "completed", DialBridged: "false" }, deps(DAYTIME, broken));
    expect(notBridged).toContain("<Record");
    expect(notBridged).toContain("This call is recorded");
    const bridged = await handleDialResult({ CallSid: sid("CA"), DialCallStatus: "completed", DialBridged: "true" }, deps(DAYTIME, broken));
    expect(bridged).toContain("<Hangup/>");
    // Amy's keypress still bridges even when it cannot be recorded.
    expect(await handleScreenAccept({ ParentCallSid: "CAx", Digits: "1" }, deps(DAYTIME, broken))).not.toContain("Hangup");
  });

  it("an inbound webhook with a dead database fails loudly so Twilio's fallback URL takes over", async () => {
    const broken: Queryable = { query: async () => { throw new Error("connection refused"); } };
    await expect(handleInbound({ CallSid: sid("CA"), From: caller(), To: TV }, deps(DAYTIME, broken))).rejects.toThrow();
  });

  it("the inbox lists one lead per completed call (the after-hours call is still in progress)", async () => {
    const rows = await listInbox(db);
    expect(rows.length).toBe(3);
    expect([...rows].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).map((r) => r.id)).toEqual(rows.map((r) => r.id));
    const sources = new Set(rows.map((r) => r.source));
    expect(sources).toEqual(new Set(["call_answered", "call_recovery", "abandoned_call"]));
    expect(rows.find((r) => r.source === "call_recovery")).toMatchObject({ hasRecording: true, contactName: "Dana Whitfield" });
  });
});

describe("alerts", () => {
  it("each alert is delivered once, readable, and points to the lead in the inbox", async () => {
    const delivered: Array<{ alert: PendingAlert; body: string }> = [];
    const capture: AlertSender = {
      async send(alert, rendered) {
        delivered.push({ alert, body: rendered.body });
        return "simulated";
      },
    };
    const first = await drainAlerts(db, capture, BASE);
    expect(first.failed).toBe(0);
    expect(first.delivered).toBeGreaterThan(0);

    const voicemail = delivered.find((d) => d.alert.kind === "message" && d.alert.channel === "sms");
    expect(voicemail?.body).toMatch(/^The Christmas Light Guys · TV: New voicemail from Dana Whitfield, \(512\) 555-\d{4}\./);
    expect(voicemail?.body).toContain(`${BASE}/leads/`);
    expect(delivered.every((d) => d.alert.channel !== "sms" || d.body.length <= 320)).toBe(true);

    const second = await drainAlerts(db, capture, BASE);
    expect(second).toEqual({ delivered: 0, failed: 0 });
  });

  it("a failing provider leaves alerts pending for retry instead of dropping them", async () => {
    await handleStatus({ CallSid: sid("CA"), CallStatus: "completed" }, deps()); // unknown call: no-op
    const call = sid("CA");
    await handleInbound({ CallSid: call, From: caller(), To: TV }, deps());
    await handleStatus({ CallSid: call, CallStatus: "completed" }, deps()); // abandoned → 2 alerts

    const failing: AlertSender = { send: async () => { throw new Error("provider down"); } };
    const result = await drainAlerts(db, failing, BASE);
    expect(result.failed).toBeGreaterThan(0);
    const { rows } = await db.query<{ status: string; last_error: string; claimed_until: Date | null }>(
      "select status, last_error, claimed_until from public.outbox where status <> 'simulated'",
    );
    expect(rows.length).toBe(2);
    expect(rows.every((r) => r.status === "pending" && r.last_error === "provider down" && r.claimed_until === null)).toBe(true);
  });

  it("SMS bodies are capped at 320 characters even with long details", () => {
    const alert: PendingAlert = {
      id: "x", kind: "message", channel: "sms", toAddress: "+15125550198", attempts: 1, leadId: "11111111-1111-4111-8111-111111111111",
      callId: null, brandName: "The Christmas Light Guys", campaignName: "TV", channelLabel: "tv", contactPhone: "+15125550147",
      contactName: "Dana", address: "4512 Oak Cove ".repeat(20), serviceWanted: "roofline", timing: null, callbackWindow: null, hasRecording: true,
      companyName: "Christmas Light Guys", companyKind: "company", summary: null, intent: "warm", email: null, siteVisit: null, detail: null,
    };
    const { body } = renderAlert(alert, BASE);
    expect(body.length).toBeLessThanOrEqual(320);
    expect(body).toContain(`${BASE}/leads/11111111-1111-4111-8111-111111111111`);
  });

  it("every alert kind renders a real headline, led by the company", () => {
    const kinds: PendingAlert["kind"][] = ["message", "abandoned", "answered", "web_form", "agent_lead", "callback", "transfer_missed", "review"];
    for (const kind of kinds) {
      for (const channel of ["sms", "email"] as const) {
        const { subject, body } = renderAlert(
          {
            id: "x", kind, channel, toAddress: "amy@example.com", attempts: 1, leadId: "11111111-1111-4111-8111-111111111111",
            callId: null, brandName: "Amy's office line", campaignName: "Shared office line", channelLabel: "main_line",
            contactPhone: "+15125550147", contactName: "Dana", address: null, serviceWanted: "vending machine for my shop",
            timing: null, callbackWindow: "after 3", hasRecording: false,
            companyName: "The Fridge", companyKind: "company", summary: "Dana wants a machine at her shop.", intent: "warm", email: "dana@example.com", siteVisit: null, detail: null,
          },
          BASE,
        );
        expect(subject).toMatch(/^The Fridge · /);
        expect(`${subject} ${body}`).not.toMatch(/undefined|null/);
      }
    }
  });

  it("a shared-line lead with no company yet says so instead of naming the office line", () => {
    const { subject } = renderAlert(
      {
        id: "x", kind: "agent_lead", channel: "sms", toAddress: "+15125550198", attempts: 1, leadId: "11111111-1111-4111-8111-111111111111",
        callId: null, brandName: "Amy's office line", campaignName: null, channelLabel: "main_line", contactPhone: "+15125550147",
        contactName: null, address: null, serviceWanted: null, timing: null, callbackWindow: null, hasRecording: false,
        companyName: "Amy's office line", companyKind: "front_desk", summary: null, intent: "unknown", email: null, siteVisit: null, detail: null,
      },
      BASE,
    );
    expect(subject).toMatch(/^Company not given · /);
  });
});
