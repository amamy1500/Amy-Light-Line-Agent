import fc from "fast-check";
import { beforeAll, describe, expect, it } from "vitest";
import {
  attachTranscript,
  captureRecording,
  createWebLead,
  finalizeCall,
  ingestInboundCall,
  markOwnerAccepted,
  resolveDial,
  transitionLead,
  type LeadState,
} from "@/lib/db/repo";
import { CALLER, NUMBERS, count, freshDb, newCallSid, newRecordingSid, type TestDb } from "./helpers";

interface CallSnapshot {
  state: string;
  lead_id: string | null;
  lead_source: string | null;
  lead_state: string | null;
}

async function snapshot(t: TestDb, sid: string): Promise<CallSnapshot> {
  const { rows } = await t.db.query<CallSnapshot>(
    `select c.state, c.lead_id, l.source as lead_source, l.state as lead_state
       from public.call c left join public.lead l on l.id = c.lead_id
      where c.twilio_call_sid = $1`,
    [sid],
  );
  return rows[0]!;
}

/** Each test file gets one database; callers get unique numbers so dedup never links tests. */
let callerSeq = 200;
function uniqueCaller(): string {
  callerSeq += 1;
  return `+1512555${String(callerSeq).padStart(4, "0")}`;
}

describe("call lifecycle", () => {
  let t: TestDb;
  beforeAll(async () => {
    t = await freshDb();
  });

  it("I4: the owner pressed 1 and Twilio bridged → owner_answered, lead connected, 'answered' alerts", async () => {
    const sid = newCallSid();
    const from = uniqueCaller();
    await ingestInboundCall(t.db, { callSid: sid, from, to: NUMBERS.tv, afterHours: false });
    expect(await markOwnerAccepted(t.db, sid)).toBe(true);
    expect(await resolveDial(t.db, { callSid: sid, dialCallStatus: "completed", dialBridged: true })).toBe("owner_answered");

    const snap = await snapshot(t, sid);
    expect(snap).toMatchObject({ state: "owner_answered", lead_source: "call_answered", lead_state: "connected" });
    expect(await count(t.db, "select count(*) as n from public.outbox where lead_id = $1 and kind = 'answered'", [snap.lead_id])).toBe(2);
  });

  it("I4: voicemail picked up the owner's leg (status completed, not bridged) → recovery, never 'answered'", async () => {
    const sid = newCallSid();
    await ingestInboundCall(t.db, { callSid: sid, from: uniqueCaller(), to: NUMBERS.tv, afterHours: false });
    expect(await resolveDial(t.db, { callSid: sid, dialCallStatus: "completed", dialBridged: false })).toBe("recovery");
    expect((await snapshot(t, sid)).state).toBe("recovery");
  });

  it("I4: bridged without our accept flag still counts as answered, and the mismatch is logged", async () => {
    const sid = newCallSid();
    await ingestInboundCall(t.db, { callSid: sid, from: uniqueCaller(), to: NUMBERS.tv, afterHours: false });
    expect(await resolveDial(t.db, { callSid: sid, dialCallStatus: "completed", dialBridged: true })).toBe("owner_answered");
    expect(
      await count(
        t.db,
        "select count(*) as n from public.event e join public.call c on c.id = e.aggregate_id where c.twilio_call_sid = $1 and e.type = 'call.accept_flag_mismatch'",
        [sid],
      ),
    ).toBe(1);
  });

  it("I4 truth table: only dial_bridged decides", async () => {
    for (const accepted of [true, false]) {
      for (const bridged of [true, false, null]) {
        const sid = newCallSid();
        await ingestInboundCall(t.db, { callSid: sid, from: uniqueCaller(), to: NUMBERS.web, afterHours: false });
        if (accepted) await markOwnerAccepted(t.db, sid);
        const decision = await resolveDial(t.db, { callSid: sid, dialCallStatus: "completed", dialBridged: bridged });
        expect(decision, `accepted=${accepted} bridged=${bridged}`).toBe(bridged === true ? "owner_answered" : "recovery");
      }
    }
  });

  it("a recorded message becomes a new call_recovery lead with 'message' alerts and extracted fields", async () => {
    const sid = newCallSid();
    await ingestInboundCall(t.db, { callSid: sid, from: uniqueCaller(), to: NUMBERS.tv, afterHours: false });
    await resolveDial(t.db, { callSid: sid, dialCallStatus: "no-answer", dialBridged: false });
    await attachTranscript(t.db, {
      callSid: sid,
      text: "Hi this is Dana, 4512 Oak Cove, roofline please.",
      status: "completed",
      fields: { contactName: "Dana", address: "4512 Oak Cove", serviceWanted: "roofline" },
    });
    expect(await captureRecording(t.db, { callSid: sid, recordingSid: newRecordingSid(), recordingUrl: "https://example.test/r", durationSeconds: 14 })).toBe("message_captured");

    const snap = await snapshot(t, sid);
    expect(snap).toMatchObject({ state: "message_captured", lead_source: "call_recovery", lead_state: "new" });
    const { rows } = await t.db.query<{ contact_name: string; address: string; service_wanted: string }>(
      "select contact_name, address, service_wanted from public.lead where id = $1",
      [snap.lead_id],
    );
    // Transcript arrived before the lead existed; its fields were applied when the lead was created.
    expect(rows[0]).toEqual({ contact_name: "Dana", address: "4512 Oak Cove", service_wanted: "roofline" });
    expect(await count(t.db, "select count(*) as n from public.outbox where lead_id = $1 and kind = 'message'", [snap.lead_id])).toBe(2);
  });

  it("after hours, the call skips the ring and starts in recovery", async () => {
    const sid = newCallSid();
    const call = await ingestInboundCall(t.db, { callSid: sid, from: uniqueCaller(), to: NUMBERS.print, afterHours: true });
    expect(call).toMatchObject({ state: "recovery", afterHours: true });
  });

  it("I5: a caller who hangs up while it rings becomes an abandoned_call lead with alerts", async () => {
    const sid = newCallSid();
    await ingestInboundCall(t.db, { callSid: sid, from: uniqueCaller(), to: NUMBERS.tv, afterHours: false });
    expect(await finalizeCall(t.db, { callSid: sid, callStatus: "completed" })).toBe("abandoned");
    const snap = await snapshot(t, sid);
    expect(snap).toMatchObject({ state: "abandoned", lead_source: "abandoned_call", lead_state: "new" });
    expect(await count(t.db, "select count(*) as n from public.outbox where lead_id = $1 and kind = 'abandoned'", [snap.lead_id])).toBe(2);
  });

  it("an empty recording is not a message", async () => {
    const sid = newCallSid();
    await ingestInboundCall(t.db, { callSid: sid, from: uniqueCaller(), to: NUMBERS.tv, afterHours: true });
    expect(await captureRecording(t.db, { callSid: sid, recordingSid: newRecordingSid(), recordingUrl: null, durationSeconds: 0 })).toBe("recovery");
    expect(await finalizeCall(t.db, { callSid: sid, callStatus: "completed" })).toBe("abandoned");
  });

  it("I3: every webhook replay is a no-op", async () => {
    const sid = newCallSid();
    const from = uniqueCaller();
    const rec = newRecordingSid();
    for (let i = 0; i < 3; i++) await ingestInboundCall(t.db, { callSid: sid, from, to: NUMBERS.tv, afterHours: false });
    for (let i = 0; i < 3; i++) await resolveDial(t.db, { callSid: sid, dialCallStatus: "busy", dialBridged: false });
    for (let i = 0; i < 3; i++) await captureRecording(t.db, { callSid: sid, recordingSid: rec, recordingUrl: "https://example.test/r", durationSeconds: 9 });
    for (let i = 0; i < 3; i++) await finalizeCall(t.db, { callSid: sid, callStatus: "completed" });

    expect(await count(t.db, "select count(*) as n from public.call where twilio_call_sid = $1", [sid])).toBe(1);
    const eventTypes = (
      await t.db.query<{ type: string }>(
        "select e.type from public.event e join public.call c on c.id = e.aggregate_id where c.twilio_call_sid = $1 order by e.id",
        [sid],
      )
    ).rows.map((r) => r.type);
    expect(eventTypes).toEqual(["call.received", "call.recovery", "call.message_captured", "call.completed"]);
    const lead = (await snapshot(t, sid)).lead_id;
    expect(await count(t.db, "select count(*) as n from public.outbox where lead_id = $1", [lead])).toBe(2);
  });

  it("I5: a message that arrives after the hang-up upgrades the abandoned lead instead of creating a second one", async () => {
    const sid = newCallSid();
    await ingestInboundCall(t.db, { callSid: sid, from: uniqueCaller(), to: NUMBERS.tv, afterHours: false });
    await resolveDial(t.db, { callSid: sid, dialCallStatus: "no-answer", dialBridged: false });
    await finalizeCall(t.db, { callSid: sid, callStatus: "completed" });
    const before = await snapshot(t, sid);
    expect(before).toMatchObject({ state: "abandoned", lead_source: "abandoned_call" });

    await captureRecording(t.db, { callSid: sid, recordingSid: newRecordingSid(), recordingUrl: "https://example.test/r", durationSeconds: 21 });
    const after = await snapshot(t, sid);
    expect(after).toMatchObject({ state: "message_captured", lead_source: "call_recovery", lead_id: before.lead_id });
  });

  it("I5 (property): any order of recording / transcript / hang-up callbacks ends with exactly one lead and the right final state", async () => {
    type Step = "recording" | "transcript" | "finalize";
    await fc.assert(
      fc.asyncProperty(
        fc.shuffledSubarray<Step>(["recording", "transcript", "finalize"], { minLength: 3, maxLength: 3 }),
        fc.integer({ min: 0, max: 30 }),
        fc.boolean(),
        async (order, duration, afterHours) => {
          const sid = newCallSid();
          await ingestInboundCall(t.db, { callSid: sid, from: uniqueCaller(), to: NUMBERS.tv, afterHours });
          if (!afterHours) await resolveDial(t.db, { callSid: sid, dialCallStatus: "no-answer", dialBridged: false });
          for (const step of order) {
            if (step === "recording") {
              await captureRecording(t.db, { callSid: sid, recordingSid: newRecordingSid(), recordingUrl: duration ? "https://example.test/r" : null, durationSeconds: duration });
            } else if (step === "transcript") {
              await attachTranscript(t.db, { callSid: sid, text: duration ? "this is Sam" : "", status: "completed", fields: duration ? { contactName: "Sam" } : {} });
            } else {
              await finalizeCall(t.db, { callSid: sid, callStatus: "completed" });
            }
          }
          const snap = await snapshot(t, sid);
          expect(snap.lead_id).not.toBeNull();
          expect(snap.state).toBe(duration >= 1 ? "message_captured" : "abandoned");
          expect(snap.lead_source).toBe(duration >= 1 ? "call_recovery" : "abandoned_call");
          expect(await count(t.db, "select count(*) as n from public.lead where contact_phone = (select from_e164 from public.call where twilio_call_sid = $1)", [sid])).toBe(1);
        },
      ),
      { numRuns: 40 },
    );
  });

  it("repeat callers within 7 days stay one lead with several calls", async () => {
    const from = uniqueCaller();
    const first = newCallSid();
    await ingestInboundCall(t.db, { callSid: first, from, to: NUMBERS.tv, afterHours: false });
    await finalizeCall(t.db, { callSid: first, callStatus: "completed" }); // abandoned

    const second = newCallSid();
    await ingestInboundCall(t.db, { callSid: second, from, to: NUMBERS.web, afterHours: false });
    await resolveDial(t.db, { callSid: second, dialCallStatus: "completed", dialBridged: true }); // Amy answered

    const a = await snapshot(t, first);
    const b = await snapshot(t, second);
    expect(b.lead_id).toBe(a.lead_id);
    expect(b.lead_state).toBe("connected"); // the answered call advanced the shared lead
    expect(await count(t.db, "select count(*) as n from public.event where aggregate_id = $1 and type = 'lead.repeat_contact'", [a.lead_id])).toBe(1);
  });

  it("an unknown tracking number is refused rather than silently recorded", async () => {
    await expect(
      ingestInboundCall(t.db, { callSid: newCallSid(), from: CALLER, to: "+15125550999", afterHours: false }),
    ).rejects.toThrow(/unknown tracking number/);
  });

  it("web-form leads carry their attribution and alert Amy", async () => {
    const id = await createWebLead(t.db, {
      campaignId: t.seed.campaignIds.web,
      name: "Jordan",
      phone: uniqueCaller(),
      address: "77 Elm Street",
      smsConsent: true,
      attribution: { utm_source: "qr", cohort: "postcard-a" },
    });
    const { rows } = await t.db.query<{ source: string; contact_name: string; sms_consent: boolean; attribution: Record<string, string> }>(
      "select source, contact_name, sms_consent, attribution from public.lead where id = $1",
      [id],
    );
    expect(rows[0]).toEqual({ source: "web_form", contact_name: "Jordan", sms_consent: true, attribution: { utm_source: "qr", cohort: "postcard-a" } });
    expect(await count(t.db, "select count(*) as n from public.outbox where lead_id = $1 and kind = 'web_form'", [id])).toBe(2);
  });
});

describe("I6 lead funnel", () => {
  let t: TestDb;
  beforeAll(async () => {
    t = await freshDb();
  });

  const ALL: LeadState[] = ["new", "attempted", "connected", "qualified", "quoted", "booked", "won", "lost", "spam", "duplicate"];
  const RANK: Partial<Record<LeadState, number>> = { new: 0, attempted: 1, connected: 2, qualified: 3, quoted: 4, booked: 5, won: 6 };
  const TERMINAL = new Set<LeadState>(["won", "lost", "spam", "duplicate"]);

  it("(property) states only move forward, terminal states never change, and won needs an amount", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.constantFrom(...ALL), { minLength: 1, maxLength: 8 }), fc.boolean(), async (targets, withAmount) => {
        const lead = (
          await t.db.query<{ id: string }>(
            "insert into public.lead (tenant_id, business_id, source) values ($1, $2, 'web_form') returning id",
            [t.seed.tenantId, t.seed.businessId],
          )
        ).rows[0]!.id;
        let state: LeadState = "new";
        for (const to of targets) {
          const allowed =
            !TERMINAL.has(state) &&
            (to === "lost" || to === "spam" || to === "duplicate" || (RANK[to] !== undefined && RANK[to]! > RANK[state]!));
          const needsAmount = to === "won" && !withAmount;
          const attempt = transitionLead(t.db, { leadId: lead, to, actorType: "system", actorId: "test", amountCents: withAmount ? 125_000 : null });
          if (allowed && !needsAmount) {
            await expect(attempt).resolves.toBe(to);
            state = to;
          } else {
            await expect(attempt).rejects.toThrow();
          }
          const { rows } = await t.db.query<{ state: LeadState }>("select state from public.lead where id = $1", [lead]);
          expect(rows[0]!.state).toBe(state);
        }
      }),
      { numRuns: 60 },
    );
  });
});
