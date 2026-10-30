import type { Queryable } from "./migrate";

// Typed wrappers over the agent-layer SQL functions in
// supabase/migrations/0002_agent.sql. Each state change is one SQL function
// call, so it runs in one transaction together with its event.

export type FactField =
  | "caller_name"
  | "customer_type"
  | "property_type"
  | "property_address"
  | "zip"
  | "service_requested"
  | "job_type"
  | "desired_timing"
  | "callback_window"
  | "lead_source"
  | "notes"
  | "callback_phone"
  | "caller_email"
  | "home_size"
  | "outdoor_plugs"
  | "site_visit_window"
  | "maps_visible";

export type FactSource = "human" | "caller_via_agent" | "web_form" | "post_call_extraction" | "caller_id";

/** How long an "active" session counts against capacity before it is presumed dead. */
export const SESSION_STALE_AFTER = "20 minutes";

export async function startAgentSession(
  db: Queryable,
  input: {
    callSid: string;
    provider: "elevenlabs" | "simulator";
    agentId: string | null;
    agentVersion: string | null;
    routeReason: string;
    maxSessions: number;
  },
): Promise<string | null> {
  const { rows } = await db.query<{ id: string | null }>(
    "select app.start_agent_session($1, $2, $3, $4, $5, $6, $7::interval) as id",
    [input.callSid, input.provider, input.agentId, input.agentVersion, input.routeReason, input.maxSessions, SESSION_STALE_AFTER],
  );
  return rows[0]?.id ?? null;
}

export async function activeAgentSessions(db: Queryable, businessId: string): Promise<number> {
  const { rows } = await db.query<{ n: number }>("select app.active_agent_sessions($1, $2::interval) as n", [
    businessId,
    SESSION_STALE_AFTER,
  ]);
  return Number(rows[0]?.n ?? 0);
}

/** Everything a tool or webhook needs to act on a live call. */
export interface CallContext {
  callId: string;
  callSid: string;
  tenantId: string;
  businessId: string;
  /** "front_desk" while a shared line's caller hasn't said which company they want. */
  businessKind: BusinessKind;
  businessName: string;
  leadId: string | null;
  sessionId: string | null;
  from: string | null;
  state: string;
  transferAttempts: number;
  completed: boolean;
}

export type BusinessKind = "company" | "front_desk";

export async function getCallContext(db: Queryable, callSid: string): Promise<CallContext | null> {
  const { rows } = await db.query<CallContext>(
    `select c.id as "callId", c.twilio_call_sid as "callSid", c.tenant_id as "tenantId",
            c.business_id as "businessId", b.kind as "businessKind", b.name as "businessName", c.lead_id as "leadId",
            (select s.id from public.agent_session s where s.call_id = c.id
              order by s.started_at desc limit 1) as "sessionId",
            c.from_e164 as "from", c.state, c.transfer_attempts as "transferAttempts", c.completed
       from public.call c join public.business b on b.id = c.business_id
      where c.twilio_call_sid = $1`,
    [callSid],
  );
  return rows[0] ?? null;
}

/** The companies a call's line answers for, in the order the agent offers them. */
export async function lineCompanies(db: Queryable, callId: string): Promise<Array<{ businessId: string; name: string }>> {
  const { rows } = await db.query<{ businessId: string; name: string }>(
    `select lb.business_id as "businessId", b.name
       from public.call c
       join public.line_business lb on lb.tracking_number_id = c.tracking_number_id
       join public.business b on b.id = lb.business_id
      where c.id = $1 and b.kind = 'company'
      order by lb.position, b.name`,
    [callId],
  );
  return rows;
}

export type AssignOutcome = "unchanged" | "assigned" | "switched" | "merged";

/** Moves a call and its lead to the company the caller wants (app.assign_business). */
export async function assignBusiness(
  db: Queryable,
  input: { callSid: string; businessId: string; how: "line" | "caller_said" | "amy_assigned"; actor: string },
): Promise<{ status: AssignOutcome; leadId: string | null }> {
  const { rows } = await db.query<{ result: { status: AssignOutcome; lead_id: string | null } }>(
    "select app.assign_business($1, $2, $3, $4) as result",
    [input.callSid, input.businessId, input.how, input.actor],
  );
  const result = rows[0]!.result;
  return { status: result.status, leadId: result.lead_id };
}

export interface StoredToolCall {
  output: Record<string, unknown>;
  outcome: "ok" | "rejected" | "error";
  replayed: boolean;
}

/**
 * Stores a tool call once per idempotency key (A2). When the key exists the
 * stored output is returned and `replayed` is true, so the caller can skip
 * the side effect.
 */
export async function findToolCall(db: Queryable, idempotencyKey: string): Promise<StoredToolCall | null> {
  const { rows } = await db.query<{ output: Record<string, unknown>; outcome: StoredToolCall["outcome"] }>(
    "select output, outcome from public.tool_call where idempotency_key = $1",
    [idempotencyKey],
  );
  const row = rows[0];
  return row ? { output: row.output, outcome: row.outcome, replayed: true } : null;
}

export async function saveToolCall(
  db: Queryable,
  input: {
    context: CallContext | null;
    businessId: string;
    tenantId: string;
    toolName: string;
    idempotencyKey: string;
    input: unknown;
    output: Record<string, unknown>;
    outcome: StoredToolCall["outcome"];
    latencyMs: number;
  },
): Promise<StoredToolCall> {
  const { rows } = await db.query<{ output: Record<string, unknown>; outcome: StoredToolCall["outcome"]; inserted: boolean }>(
    `with ins as (
       insert into public.tool_call (tenant_id, business_id, agent_session_id, call_id, lead_id, tool_name,
                                     idempotency_key, input, output, outcome, latency_ms)
       values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11)
       on conflict (idempotency_key) do nothing
       returning output, outcome, true as inserted)
     select output, outcome, inserted from ins
     union all
     select output, outcome, false from public.tool_call
      where idempotency_key = $7 and not exists (select 1 from ins)`,
    [
      input.tenantId,
      input.businessId,
      input.context?.sessionId ?? null,
      input.context?.callId ?? null,
      input.context?.leadId ?? null,
      input.toolName,
      input.idempotencyKey,
      JSON.stringify(input.input ?? null),
      JSON.stringify(input.output),
      input.outcome,
      input.latencyMs,
    ],
  );
  let row = rows[0];
  if (!row) {
    // A concurrent request with the same key won the insert after this
    // statement's snapshot was taken, so the statement above could not see
    // its row. A new statement (READ COMMITTED) sees it. Found by the
    // real-Postgres race test; PGlite's single connection cannot race.
    const winner = await findToolCall(db, input.idempotencyKey);
    if (!winner) throw new Error(`tool call ${input.idempotencyKey} was neither stored nor found`);
    row = { output: winner.output, outcome: winner.outcome, inserted: false };
  }
  if (row.inserted) {
    await db.query(
      "select app.emit($1, $2, 'call', $3, 'tool.called', $4::jsonb, 'agent', $5)",
      [
        input.tenantId,
        input.businessId,
        input.context?.callId ?? input.businessId,
        JSON.stringify({ tool: input.toolName, outcome: input.outcome, latency_ms: input.latencyMs }),
        input.toolName,
      ],
    );
  }
  return { output: row.output, outcome: row.outcome, replayed: !row.inserted };
}

export async function recordLeadFact(
  db: Queryable,
  input: {
    leadId: string;
    callId: string | null;
    field: FactField;
    value: string;
    source: FactSource;
    confidence: number | null;
    evidence: string | null;
  },
): Promise<boolean> {
  const { rows } = await db.query<{ won: boolean }>(
    "select app.record_lead_fact($1, $2, $3, $4, $5, $6, $7) as won",
    [input.leadId, input.callId, input.field, input.value, input.source, input.confidence, input.evidence],
  );
  return rows[0]?.won === true;
}

export async function requestCallback(
  db: Queryable,
  input: { leadId: string; callId: string | null; window: string | null; reason: string | null; priority: "high" | "normal" },
): Promise<string> {
  const { rows } = await db.query<{ id: string }>("select app.request_callback($1, $2, $3, $4, $5) as id", [
    input.leadId,
    input.callId,
    input.window,
    input.reason,
    input.priority,
  ]);
  return rows[0]!.id;
}

export async function completeTask(db: Queryable, taskId: string, by: string): Promise<boolean> {
  const { rows } = await db.query<{ ok: boolean }>("select app.complete_task($1, $2) as ok", [taskId, by]);
  return rows[0]?.ok === true;
}

export async function beginTransfer(
  db: Queryable,
  input: { callSid: string; maxAttempts: number; note: string | null },
): Promise<boolean> {
  const { rows } = await db.query<{ ok: boolean }>("select app.begin_transfer($1, $2, $3) as ok", [
    input.callSid,
    input.maxAttempts,
    input.note,
  ]);
  return rows[0]?.ok === true;
}

export async function handoffNote(db: Queryable, callSid: string): Promise<string | null> {
  const { rows } = await db.query<{ note: string | null }>(
    "select handoff_note as note from public.call where twilio_call_sid = $1",
    [callSid],
  );
  return rows[0]?.note ?? null;
}

export type WrapUpOutcome =
  | "callback_requested"
  | "transfer_attempted"
  | "info_only"
  | "caller_declined"
  | "not_a_lead"
  | "wrong_number"
  | "spam"
  /** Threats or abuse after one warning. Not spam: never counts toward a spam flag. */
  | "abusive";

export async function wrapUpSession(
  db: Queryable,
  input: { callSid: string; outcome: WrapUpOutcome; summary: string },
): Promise<boolean> {
  const { rows } = await db.query<{ ok: boolean }>("select app.wrap_up_session($1, $2, $3) as ok", [
    input.callSid,
    input.outcome,
    input.summary,
  ]);
  return rows[0]?.ok === true;
}

export async function markRecordingDeclined(db: Queryable, callSid: string): Promise<boolean> {
  const { rows } = await db.query<{ ok: boolean }>("select app.mark_recording_declined($1) as ok", [callSid]);
  return rows[0]?.ok === true;
}

/** True once the caller declined recording on this call (the consent event exists). */
export async function recordingDeclined(db: Queryable, callSid: string): Promise<boolean> {
  const { rows } = await db.query<{ declined: boolean }>(
    `select exists (select 1 from public.event e join public.call c on c.id = e.aggregate_id
                     where c.twilio_call_sid = $1 and e.type = 'consent.recording_declined') as declined`,
    [callSid],
  );
  return rows[0]?.declined === true;
}

export async function sessionWrappedUp(db: Queryable, callSid: string): Promise<boolean> {
  const { rows } = await db.query<{ ok: boolean | null }>("select app.session_wrapped_up($1) as ok", [callSid]);
  return rows[0]?.ok === true;
}

/**
 * What the agent may know about a caller who has contacted us before: that
 * they have, when (month), and what they were interested in. Never an
 * address, an amount or anything from another phone number. Caller ID can
 * be shared or spoofed, so the agent only acknowledges, never recites.
 */
export async function returningCallerSummary(
  db: Queryable,
  input: { businessId: string; phone: string | null; excludeCallId: string },
): Promise<string | null> {
  if (!input.phone) return null;
  // Earlier calls or web leads from this number, not counting the current call.
  const { rows } = await db.query<{ last: Date; service: string | null; customer: boolean }>(
    `with history as (
       select c.started_at as at, l.service_wanted, l.state
         from public.call c left join public.lead l on l.id = c.lead_id
        where c.business_id = $1 and c.from_e164 = $2 and c.id <> $3
       union all
       select l.created_at, l.service_wanted, l.state
         from public.lead l
        where l.business_id = $1 and l.contact_phone = $2 and l.source = 'web_form')
     select max(at) as last,
            (array_agg(service_wanted order by at desc) filter (where service_wanted is not null))[1] as service,
            coalesce(bool_or(state in ('booked', 'won')), false) as customer
       from history
     having count(*) > 0`,
    [input.businessId, input.phone, input.excludeCallId],
  );
  const row = rows[0];
  if (!row) return null;
  // A redial within minutes of a call that dropped part-way (details saved, never
  // wrapped up) picks up where it left off instead of starting over
  // (docs/research/voice-agent-edge-cases.md F1). A call that ended properly, or
  // hung up before saying anything, isn't one: "we got cut off" would be wrong.
  const { rows: dropped } = await db.query(
    `select 1 from public.call c
      where c.business_id = $1 and c.from_e164 = $2 and c.id <> $3
        and c.started_at > now() - interval '15 minutes'
        and exists (select 1 from public.lead_fact f where f.call_id = c.id and f.source = 'caller_via_agent')
        and not exists (select 1 from public.agent_session s
                         where s.call_id = c.id and coalesce((s.metadata ->> 'wrapped_up')::boolean, false))
      limit 1`,
    [input.businessId, input.phone, input.excludeCallId],
  );
  if (dropped.length > 0) {
    return `This number called a few minutes ago and the call dropped part-way. Say "Looks like we got cut off. Where were we?" and don't ask again for anything save_lead_details says you already have.`;
  }
  const month = new Date(row.last).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "America/Chicago" });
  const parts = [`This number has contacted us before (most recently ${month})`];
  if (row.customer) parts.push("and has been a customer");
  if (row.service) parts.push(`; earlier interest: ${row.service.slice(0, 80)}`);
  return `${parts.join(" ")}. Acknowledge warmly without reciting details, and ask what they need this time.`;
}

/** Fields that already have a value on the lead, from any source. */
export async function capturedFields(db: Queryable, leadId: string): Promise<Set<FactField>> {
  const { rows } = await db.query<{ field: FactField }>(
    "select distinct field from public.lead_fact where lead_id = $1",
    [leadId],
  );
  return new Set(rows.map((r) => r.field));
}

export async function resolveTransfer(
  db: Queryable,
  input: { callSid: string; dialCallStatus: string | null; dialBridged: boolean | null },
): Promise<"transferred" | "returned"> {
  const { rows } = await db.query<{ result: "transferred" | "returned" }>(
    "select app.resolve_transfer($1, $2, $3) as result",
    [input.callSid, input.dialCallStatus, input.dialBridged],
  );
  return rows[0]!.result;
}

export async function endAgentSession(
  db: Queryable,
  input: { callSid: string; reason: string; failed: boolean },
): Promise<string> {
  const { rows } = await db.query<{ state: string }>("select app.end_agent_session($1, $2, $3) as state", [
    input.callSid,
    input.reason,
    input.failed,
  ]);
  return rows[0]!.state;
}

export async function attachConversation(
  db: Queryable,
  input: {
    callSid: string;
    /** Our agent_session id, passed to the vendor as a dynamic variable. */
    sessionId: string | null;
    conversationId: string;
    transcript: unknown;
    summary: string | null;
    dataCollection: Record<string, unknown>;
    evaluation: Record<string, unknown>;
    metadata: Record<string, unknown>;
  },
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    "select app.attach_conversation($1, $2, $3, $4::jsonb, $5, $6::jsonb, $7::jsonb, $8::jsonb) as id",
    [
      input.callSid,
      input.sessionId,
      input.conversationId,
      JSON.stringify(input.transcript ?? null),
      input.summary,
      JSON.stringify(input.dataCollection),
      JSON.stringify(input.evaluation),
      JSON.stringify(input.metadata),
    ],
  );
  return rows[0]!.id;
}

export async function raiseIncident(
  db: Queryable,
  input: {
    tenantId: string;
    businessId: string;
    callId: string | null;
    leadId: string | null;
    kind: string;
    severity: "critical" | "warning";
    detail: Record<string, unknown>;
    dedupeKey: string;
  },
): Promise<void> {
  await db.query(
    `insert into public.incident (tenant_id, business_id, call_id, lead_id, kind, severity, detail, dedupe_key)
     values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
     on conflict (dedupe_key) do nothing`,
    [
      input.tenantId,
      input.businessId,
      input.callId,
      input.leadId,
      input.kind,
      input.severity,
      JSON.stringify(input.detail),
      input.dedupeKey,
    ],
  );
}

// ---------------------------------------------------------------- jobs

export interface ClaimedJob {
  id: string;
  kind: "post_call" | "callback_escalation" | "vendor_purge" | "daily_digest";
  subjectId: string;
  tenantId: string;
  businessId: string;
  attempts: number;
}

/** Claims due jobs with a lease so two workers never run the same job at once. */
export async function claimJobs(db: Queryable, limit = 10, maxAttempts = 6): Promise<ClaimedJob[]> {
  const { rows } = await db.query<ClaimedJob>(
    `update public.job j
        set attempts = j.attempts + 1, claimed_until = now() + interval '2 minutes', updated_at = now()
      where j.id in (
        select id from public.job
         where status = 'pending' and run_after <= now() and attempts < $2
           and (claimed_until is null or claimed_until < now())
         order by run_after
         limit $1
         for update skip locked)
      returning j.id, j.kind, j.subject_id as "subjectId", j.tenant_id as "tenantId",
                j.business_id as "businessId", j.attempts`,
    [limit, maxAttempts],
  );
  return rows;
}

export async function settleJob(
  db: Queryable,
  input: { id: string; status: "done" | "pending" | "failed"; error?: string | null; result?: unknown; retryInSeconds?: number },
): Promise<void> {
  await db.query(
    `update public.job
        set status = $2, last_error = $3, result = coalesce($4::jsonb, result), claimed_until = null,
            run_after = case when $2 = 'pending' then now() + make_interval(secs => $5) else run_after end,
            updated_at = now()
      where id = $1`,
    [input.id, input.status, input.error ?? null, input.result === undefined ? null : JSON.stringify(input.result), input.retryInSeconds ?? 30],
  );
}

/** Schedules a job once per dedupe key (replays and duplicates are no-ops). */
export async function enqueueJob(
  db: Queryable,
  input: { tenantId: string; businessId: string; kind: ClaimedJob["kind"]; subjectId: string; dedupeKey: string; runAfterSeconds?: number },
): Promise<void> {
  await db.query(
    `insert into public.job (tenant_id, business_id, kind, subject_id, dedupe_key, run_after)
     values ($1, $2, $3, $4, $5, now() + make_interval(secs => $6))
     on conflict (dedupe_key) do nothing`,
    [input.tenantId, input.businessId, input.kind, input.subjectId, input.dedupeKey, input.runAfterSeconds ?? 0],
  );
}
