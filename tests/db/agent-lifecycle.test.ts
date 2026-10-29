import fc from "fast-check";
import { beforeAll, describe, expect, it } from "vitest";
import {
  activeAgentSessions,
  attachConversation,
  beginTransfer,
  claimJobs,
  endAgentSession,
  getCallContext,
  recordLeadFact,
  requestCallback,
  resolveTransfer,
  saveToolCall,
  startAgentSession,
} from "@/lib/db/agent";
import { finalizeCall, ingestInboundCall, resolveDial } from "@/lib/db/repo";
import { NUMBERS, count, freshDb, newCallSid, type TestDb } from "./helpers";

let callerSeq = 400;
const uniqueCaller = () => `+1512555${String(++callerSeq).padStart(4, "0")}`;

/** A call that rang Amy, was not bridged, and was handed to the agent. */
async function agentCall(t: TestDb, maxSessions = 10_000): Promise<{ sid: string; session: string | null }> {
  const sid = newCallSid();
  await ingestInboundCall(t.db, { callSid: sid, from: uniqueCaller(), to: NUMBERS.tv, afterHours: false });
  await resolveDial(t.db, { callSid: sid, dialCallStatus: "no-answer", dialBridged: false });
  const session = await startAgentSession(t.db, {
    callSid: sid,
    provider: "simulator",
    agentId: "agent_test",
    agentVersion: "v1",
    routeReason: "owner_unavailable",
    maxSessions,
  });
  return { sid, session };
}

describe("agent lifecycle", () => {
  let t: TestDb;
  beforeAll(async () => {
    t = await freshDb();
  });

  it("A4: handing a call to the agent opens its lead immediately", async () => {
    const { sid, session } = await agentCall(t);
    expect(session).not.toBeNull();
    const ctx = await getCallContext(t.db, sid);
    expect(ctx?.state).toBe("agent_active");
    expect(ctx?.leadId).not.toBeNull();
    expect(ctx?.sessionId).toBe(session);
  });

  it("A1: a replayed hand-off returns the same session instead of a second one", async () => {
    const { sid, session } = await agentCall(t);
    const again = await startAgentSession(t.db, {
      callSid: sid, provider: "simulator", agentId: "agent_test", agentVersion: "v1",
      routeReason: "owner_unavailable", maxSessions: 10_000,
    });
    expect(again).toBe(session);
    const ctx = await getCallContext(t.db, sid);
    expect(await count(t.db, "select count(*) as n from public.agent_session where call_id = $1", [ctx!.callId])).toBe(1);
  });

  it("A6: admission stops at the configured limit and frees the slot when a session ends", async () => {
    const fresh = await freshDb();
    const limit = 2;
    const a = await agentCall(fresh, limit);
    const b = await agentCall(fresh, limit);
    const c = await agentCall(fresh, limit);
    expect([a.session, b.session].every(Boolean)).toBe(true);
    expect(c.session).toBeNull();
    expect(await activeAgentSessions(fresh.db, fresh.seed.businessId)).toBe(2);
    // The refused call is still a ringing/recovery call with no agent: capture takes it.
    expect((await getCallContext(fresh.db, c.sid))?.state).toBe("recovery");

    await endAgentSession(fresh.db, { callSid: a.sid, reason: "agent_hung_up", failed: false });
    expect(await activeAgentSessions(fresh.db, fresh.seed.businessId)).toBe(1);
  });

  it("A2: a retried tool call returns the stored result and runs no side effect twice", async () => {
    const { sid } = await agentCall(t);
    const ctx = (await getCallContext(t.db, sid))!;
    const base = {
      context: ctx, tenantId: ctx.tenantId, businessId: ctx.businessId, toolName: "request_callback",
      idempotencyKey: `conv-1:tool-7`, input: { window: "after 4" }, outcome: "ok" as const, latencyMs: 12,
    };
    const first = await saveToolCall(t.db, { ...base, output: { task_id: "first" } });
    const second = await saveToolCall(t.db, { ...base, output: { task_id: "second" } });
    expect(first).toEqual({ output: { task_id: "first" }, outcome: "ok", replayed: false });
    expect(second).toEqual({ output: { task_id: "first" }, outcome: "ok", replayed: true });
    expect(await count(t.db, "select count(*) as n from public.event where type = 'tool.called' and aggregate_id = $1", [ctx.callId])).toBe(1);
  });

  it("A3: a lower-trust source never overwrites a higher-trust fact; a human correction always wins", async () => {
    const { sid } = await agentCall(t);
    const ctx = (await getCallContext(t.db, sid))!;
    const fact = (value: string, source: "human" | "caller_via_agent" | "post_call_extraction") =>
      recordLeadFact(t.db, { leadId: ctx.leadId!, callId: ctx.callId, field: "property_address", value, source, confidence: 0.9, evidence: null });

    expect(await fact("12 Elm Street", "caller_via_agent")).toBe(true);
    expect(await fact("21 Elm Street", "post_call_extraction")).toBe(false);
    expect(await fact("12 Elm St, Lakeway", "human")).toBe(true);
    expect(await fact("99 Oak Lane", "caller_via_agent")).toBe(false);

    const { rows } = await t.db.query<{ address: string }>("select address from public.lead where id = $1", [ctx.leadId]);
    expect(rows[0]!.address).toBe("12 Elm St, Lakeway");
    // Every attempt is kept as history.
    expect(await count(t.db, "select count(*) as n from public.lead_fact where lead_id = $1", [ctx.leadId])).toBe(4);
  });

  it("A3 property: the shown value is always the newest fact from the most trusted source", async () => {
    const sources = ["human", "caller_via_agent", "web_form", "post_call_extraction", "caller_id"] as const;
    const rank = { human: 5, caller_via_agent: 4, web_form: 3, post_call_extraction: 2, caller_id: 1 };
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.tuple(fc.constantFrom(...sources), fc.constantFrom("a", "b", "c", "d")), { minLength: 1, maxLength: 8 }),
        async (writes) => {
          const { sid } = await agentCall(t, 1000);
          const ctx = (await getCallContext(t.db, sid))!;
          for (const [source, value] of writes) {
            await recordLeadFact(t.db, { leadId: ctx.leadId!, callId: ctx.callId, field: "zip", value: `7873${value}`, source, confidence: null, evidence: null });
          }
          const best = Math.max(...writes.map(([s]) => rank[s]));
          const expected = [...writes].reverse().find(([s]) => rank[s] === best)!;
          const { rows } = await t.db.query<{ zip: string }>("select zip from public.lead where id = $1", [ctx.leadId]);
          expect(rows[0]!.zip).toBe(`7873${expected[1]}`);
        },
      ),
      { numRuns: 25 },
    );
  });

  it("A5: one open callback task per lead; a second request updates it", async () => {
    const { sid } = await agentCall(t);
    const ctx = (await getCallContext(t.db, sid))!;
    const first = await requestCallback(t.db, { leadId: ctx.leadId!, callId: ctx.callId, window: "after 4 PM", reason: "wants quote", priority: "normal" });
    const second = await requestCallback(t.db, { leadId: ctx.leadId!, callId: ctx.callId, window: "tomorrow morning", reason: null, priority: "high" });
    expect(second).toBe(first);
    const { rows } = await t.db.query<{ due_window: string; priority: string; reason: string }>(
      "select due_window, priority, reason from public.task where id = $1", [first]);
    expect(rows[0]).toEqual({ due_window: "tomorrow morning", priority: "high", reason: "wants quote" });
  });

  it("A7: a transfer counts as transferred only when bridged; otherwise the caller returns to the agent", async () => {
    const { sid } = await agentCall(t);
    expect(await beginTransfer(t.db, { callSid: sid, maxAttempts: 1, note: null })).toBe(true);
    expect(await beginTransfer(t.db, { callSid: sid, maxAttempts: 1, note: null })).toBe(true); // replay while ringing
    // Amy's voicemail picked up: the screen hung up, Twilio says completed but not bridged.
    expect(await resolveTransfer(t.db, { callSid: sid, dialCallStatus: "completed", dialBridged: false })).toBe("returned");
    const missed = (await getCallContext(t.db, sid))!;
    // Neither with Amy nor an agent until the handler decides; a high-priority callback already exists.
    expect(missed.state).toBe("recovery");
    expect(await count(t.db, "select count(*) as n from public.task where lead_id = $1 and priority = 'high' and status = 'open'", [missed.leadId])).toBe(1);
    // The caller goes back to a fresh agent conversation for the same call.
    const back = await startAgentSession(t.db, {
      callSid: sid, provider: "simulator", agentId: "agent_test", agentVersion: "v1",
      routeReason: "handoff_failed", maxSessions: 10_000,
    });
    expect(back).not.toBeNull();
    expect(back).not.toBe(missed.sessionId); // the pre-handoff conversation stays ended
    expect((await getCallContext(t.db, sid))?.state).toBe("agent_active");
    expect(await beginTransfer(t.db, { callSid: sid, maxAttempts: 1, note: null })).toBe(false); // attempt limit reached
    // Caller hangs up on the second agent: still one lead, agent call completed.
    expect(await finalizeCall(t.db, { callSid: sid, callStatus: "completed" })).toBe("agent_completed");

    const ok = await agentCall(t);
    await beginTransfer(t.db, { callSid: ok.sid, maxAttempts: 1, note: "Jane, Round Rock, roofline" });
    expect(await resolveTransfer(t.db, { callSid: ok.sid, dialCallStatus: "completed", dialBridged: true })).toBe("transferred");
    expect(await resolveTransfer(t.db, { callSid: ok.sid, dialCallStatus: "completed", dialBridged: true })).toBe("transferred");
    const ctx = (await getCallContext(t.db, ok.sid))!;
    expect(await count(t.db, "select count(*) as n from public.agent_session where call_id = $1 and status = 'active'", [ctx.callId])).toBe(0);
  });

  it("a vendor failure mid-call moves the caller to capture, a normal end completes the agent call", async () => {
    const failed = await agentCall(t);
    expect(await endAgentSession(t.db, { callSid: failed.sid, reason: "stream_closed", failed: true })).toBe("recovery");
    const ok = await agentCall(t);
    expect(await endAgentSession(t.db, { callSid: ok.sid, reason: "agent_hung_up", failed: false })).toBe("agent_completed");
    expect(await endAgentSession(t.db, { callSid: ok.sid, reason: "agent_hung_up", failed: false })).toBe("agent_completed");
  });

  it("A4: a caller who hangs up mid-agent still ends with one lead and a post-call job", async () => {
    const { sid } = await agentCall(t);
    expect(await finalizeCall(t.db, { callSid: sid, callStatus: "completed" })).toBe("agent_completed");
    expect(await finalizeCall(t.db, { callSid: sid, callStatus: "completed" })).toBe("agent_completed");
    const ctx = (await getCallContext(t.db, sid))!;
    expect(ctx.leadId).not.toBeNull();
    expect(await count(t.db, "select count(*) as n from public.job where subject_id = $1 and kind = 'post_call'", [ctx.callId])).toBe(1);
    const jobs = await claimJobs(t.db, 100);
    expect(jobs.some((j) => j.subjectId === ctx.callId)).toBe(true);
  });

  it("A1: post-call data attaches once per conversation id, whatever the delivery order", async () => {
    const { sid, session } = await agentCall(t);
    const payload = {
      callSid: sid, sessionId: session, conversationId: `conv_${sid}`, transcript: [{ role: "agent", message: "Hi" }],
      summary: "Wants roofline lights", dataCollection: {}, evaluation: {}, metadata: {},
    };
    await finalizeCall(t.db, { callSid: sid, callStatus: "completed" });
    expect(await attachConversation(t.db, payload)).toBe(session);
    expect(await attachConversation(t.db, { ...payload, summary: "changed" })).toBe(session);
    const { rows } = await t.db.query<{ summary: string }>("select summary from public.agent_session where id = $1", [session]);
    expect(rows[0]!.summary).toBe("Wants roofline lights");
  });
});
