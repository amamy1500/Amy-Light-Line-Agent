import type { Queryable } from "./migrate";

// Thin typed wrappers over the SQL functions in migrations/0001_core.sql.
// All state changes happen inside those functions so that each one is a
// single transaction that also writes its event.

export type CallState =
  | "ringing_owner"
  | "owner_answered"
  | "recovery"
  | "message_captured"
  | "abandoned"
  | "agent_active"
  | "transfer_ringing"
  | "transferred"
  | "agent_completed";
export type LeadState =
  | "new" | "attempted" | "connected" | "qualified" | "quoted"
  | "booked" | "won" | "lost" | "spam" | "duplicate";
export type Channel = "tv" | "web" | "print" | "postcard" | "referral" | "other" | "main_line";

export interface LineRow {
  trackingNumberId: string;
  tenantId: string;
  businessId: string;
  campaignId: string;
  campaignName: string;
  channel: Channel;
  brandName: string;
  recoveryAsk: string;
  ownerName: string;
  ownerRingE164: string;
  ringTimeoutS: number;
  /** The number itself (E.164). */
  e164: string;
  /** False when the carrier rang the owner before forwarding the call to us. */
  ringOwner: boolean;
}

const LINE_SELECT = `
  select tn.id              as "trackingNumberId",
         tn.tenant_id       as "tenantId",
         tn.business_id     as "businessId",
         tn.campaign_id     as "campaignId",
         c.name             as "campaignName",
         c.channel          as "channel",
         b.name             as "brandName",
         b.recovery_ask     as "recoveryAsk",
         tn.owner_name      as "ownerName",
         tn.owner_ring_e164 as "ownerRingE164",
         tn.ring_timeout_s  as "ringTimeoutS",
         tn.e164            as "e164",
         tn.ring_owner      as "ringOwner"
    from public.tracking_number tn
    join public.campaign c on c.id = tn.campaign_id
    join public.brand b on b.id = c.brand_id`;

export async function findLineByNumber(db: Queryable, e164: string): Promise<LineRow | null> {
  const { rows } = await db.query<LineRow>(`${LINE_SELECT} where tn.e164 = $1`, [e164]);
  return rows[0] ?? null;
}

export async function findLineByCallSid(db: Queryable, callSid: string): Promise<LineRow | null> {
  const { rows } = await db.query<LineRow>(
    `${LINE_SELECT} join public.call ca on ca.tracking_number_id = tn.id where ca.twilio_call_sid = $1`,
    [callSid],
  );
  return rows[0] ?? null;
}

/**
 * True while the owner's phone is connected to one of our calls (she took it,
 * or a hand-off reached her). The next caller then goes to the assistant
 * instead of ringing a phone that is already busy. Calls older than two hours
 * are ignored, so a status callback that never arrived can't keep her "busy".
 */
export async function ownerOnCall(db: Queryable, ownerE164: string): Promise<boolean> {
  const { rows } = await db.query<{ busy: boolean }>(
    `select exists (
       select 1
         from public.call ca
         join public.tracking_number tn on tn.id = ca.tracking_number_id
        where tn.owner_ring_e164 = $1
          and ca.state in ('owner_answered', 'transferred')
          and not ca.completed
          and ca.started_at > now() - interval '2 hours'
     ) as busy`,
    [ownerE164],
  );
  return rows[0]?.busy === true;
}

export interface CallRow {
  id: string;
  state: CallState;
  afterHours: boolean;
  ownerAccepted: boolean;
  leadId: string | null;
}

interface RawCall {
  id: string;
  state: CallState;
  after_hours: boolean;
  owner_accepted: boolean;
  lead_id: string | null;
}

export async function ingestInboundCall(
  db: Queryable,
  input: { callSid: string; from: string | null; to: string; afterHours: boolean },
): Promise<CallRow> {
  const { rows } = await db.query<RawCall>(
    "select id, state, after_hours, owner_accepted, lead_id from app.ingest_inbound_call($1, $2, $3, $4)",
    [input.callSid, input.from, input.to, input.afterHours],
  );
  const row = rows[0];
  if (!row) throw new Error(`ingest_inbound_call returned no row for ${input.callSid}`);
  return {
    id: row.id,
    state: row.state,
    afterHours: row.after_hours,
    ownerAccepted: row.owner_accepted,
    leadId: row.lead_id,
  };
}

export async function markOwnerAccepted(db: Queryable, parentCallSid: string): Promise<boolean> {
  const { rows } = await db.query<{ ok: boolean }>("select app.mark_owner_accepted($1) as ok", [parentCallSid]);
  return rows[0]?.ok === true;
}

export async function resolveDial(
  db: Queryable,
  input: { callSid: string; dialCallStatus: string | null; dialBridged: boolean | null },
): Promise<"owner_answered" | "recovery"> {
  const { rows } = await db.query<{ decision: "owner_answered" | "recovery" }>(
    "select app.resolve_dial($1, $2, $3) as decision",
    [input.callSid, input.dialCallStatus, input.dialBridged],
  );
  const decision = rows[0]?.decision;
  if (!decision) throw new Error(`resolve_dial returned nothing for ${input.callSid}`);
  return decision;
}

export async function captureRecording(
  db: Queryable,
  input: { callSid: string; recordingSid: string; recordingUrl: string | null; durationSeconds: number | null },
): Promise<CallState> {
  const { rows } = await db.query<{ state: CallState }>(
    "select app.capture_recording($1, $2, $3, $4) as state",
    [input.callSid, input.recordingSid, input.recordingUrl, input.durationSeconds],
  );
  return rows[0]!.state;
}

export async function attachTranscript(
  db: Queryable,
  input: { callSid: string; text: string | null; status: string | null; fields: Record<string, string> },
): Promise<void> {
  await db.query("select app.attach_transcript($1, $2, $3, $4::jsonb)", [
    input.callSid,
    input.text,
    input.status,
    JSON.stringify(input.fields),
  ]);
}

export async function finalizeCall(
  db: Queryable,
  input: { callSid: string; callStatus: string | null },
): Promise<CallState | null> {
  const { rows } = await db.query<{ state: CallState | null }>(
    "select app.finalize_call($1, $2) as state",
    [input.callSid, input.callStatus],
  );
  return rows[0]?.state ?? null;
}

export async function createWebLead(
  db: Queryable,
  input: {
    campaignId: string;
    name: string;
    phone: string;
    address: string;
    smsConsent: boolean;
    attribution: Record<string, string>;
  },
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    "select app.create_web_lead($1, $2, $3, $4, $5, $6::jsonb) as id",
    [input.campaignId, input.name, input.phone, input.address, input.smsConsent, JSON.stringify(input.attribution)],
  );
  return rows[0]!.id;
}

export async function transitionLead(
  db: Queryable,
  input: { leadId: string; to: LeadState; actorType: "user" | "system"; actorId: string | null; amountCents: number | null },
): Promise<LeadState> {
  const { rows } = await db.query<{ state: LeadState }>(
    "select app.transition_lead($1, $2, $3, $4, $5) as state",
    [input.leadId, input.to, input.actorType, input.actorId, input.amountCents],
  );
  return rows[0]!.state;
}

export interface InboxRow {
  id: string;
  state: LeadState;
  source: string;
  campaignName: string | null;
  channel: Channel | null;
  contactPhone: string | null;
  contactName: string | null;
  address: string | null;
  serviceWanted: string | null;
  timing: string | null;
  callbackWindow: string | null;
  amountCents: number | null;
  createdAt: Date;
  callCount: number;
  lastCallId: string | null;
  lastCallState: CallState | null;
  hasRecording: boolean;
  transcript: string | null;
}

export async function listInbox(db: Queryable, limit = 100): Promise<InboxRow[]> {
  const { rows } = await db.query<InboxRow & { amountCents: string | number | null; callCount: string | number }>(
    `select l.id,
            l.state,
            l.source,
            c.name             as "campaignName",
            c.channel          as "channel",
            l.contact_phone    as "contactPhone",
            l.contact_name     as "contactName",
            l.address,
            l.service_wanted   as "serviceWanted",
            l.timing,
            l.callback_window  as "callbackWindow",
            l.amount_cents     as "amountCents",
            l.created_at       as "createdAt",
            (select count(*) from public.call x where x.lead_id = l.id) as "callCount",
            lc.id              as "lastCallId",
            lc.state           as "lastCallState",
            coalesce(lc.recording_url is not null, false) as "hasRecording",
            lc.transcript
       from public.lead l
       left join public.campaign c on c.id = l.campaign_id
       left join lateral (
         select x.id, x.state, x.recording_url, x.transcript
           from public.call x
          where x.lead_id = l.id
          order by x.started_at desc
          limit 1
       ) lc on true
      order by l.created_at desc
      limit $1`,
    [limit],
  );
  return rows.map((r) => ({
    ...r,
    amountCents: r.amountCents === null ? null : Number(r.amountCents),
    callCount: Number(r.callCount),
  }));
}

export interface WebLine {
  campaignId: string;
  brandName: string;
  phoneE164: string | null;
}

/** The web campaign for the landing page and the tracking number shown on it. */
export async function findWebLine(db: Queryable): Promise<WebLine | null> {
  const { rows } = await db.query<WebLine>(
    `select c.id as "campaignId", b.name as "brandName", tn.e164 as "phoneE164"
       from public.campaign c
       join public.brand b on b.id = c.brand_id
       left join public.tracking_number tn on tn.campaign_id = c.id
      where c.channel = 'web'
      order by c.created_at
      limit 1`,
  );
  return rows[0] ?? null;
}

export async function getRecordingUrl(db: Queryable, callId: string): Promise<string | null> {
  const { rows } = await db.query<{ url: string | null }>(
    "select recording_url as url from public.call where id = $1",
    [callId],
  );
  return rows[0]?.url ?? null;
}

// ---------------------------------------------------------------- outbox

/** Every kind the outbox accepts (0002 outbox_kind_check); renderAlert covers each one. */
/** Why the assistant raised an urgent alert (lib/agents/tools.ts flag_urgent). */
export type UrgentKind = "safety" | "service_issue" | "complaint" | "threat" | "official";

export type AlertKind =
  | "message"
  | "abandoned"
  | "answered"
  | "web_form"
  | "agent_lead"
  | "callback"
  | "transfer_missed"
  | "review"
  | "digest"
  /** Raised by the assistant mid-call: danger, a problem job, a complaint, a threat, an official. */
  | "urgent";

export interface PendingAlert {
  id: string;
  kind: AlertKind;
  channel: "sms" | "email";
  toAddress: string;
  attempts: number;
  /** Null only for the daily summary, which covers several calls. */
  leadId: string | null;
  callId: string | null;
  /** The lead's company (follows a shared-line call to the company the caller chose). */
  companyName: string;
  companyKind: "company" | "front_desk";
  brandName: string | null;
  campaignName: string | null;
  channelLabel: Channel | null;
  contactPhone: string | null;
  contactName: string | null;
  address: string | null;
  serviceWanted: string | null;
  timing: string | null;
  callbackWindow: string | null;
  hasRecording: boolean;
  summary: string | null;
  intent: string;
  email: string | null;
  siteVisit: string | null;
  /** The daily summary's numbers, or what an urgent alert is about. */
  detail: { held?: number; hours?: number; urgent?: UrgentKind; summary?: string } | null;
}

/** Claims up to `limit` pending alerts (incrementing attempts) and returns them with render context. */
export async function claimPendingAlerts(db: Queryable, limit = 20, maxAttempts = 5): Promise<PendingAlert[]> {
  const { rows } = await db.query<PendingAlert>(
    `with claimed as (
       update public.outbox o
          set attempts = o.attempts + 1,
              claimed_until = now() + interval '2 minutes'
        where o.id in (
          select id from public.outbox
           where status = 'pending'
             and attempts < $2
             and (claimed_until is null or claimed_until < now())
           order by created_at
           limit $1
           for update skip locked)
       returning o.*)
     select cl.id, cl.kind, cl.channel, cl.to_address as "toAddress", cl.attempts,
            cl.lead_id as "leadId", cl.call_id as "callId",
            -- The public brand when the lead's campaign is its company's own; a lead moved off
            -- the shared line keeps that line's campaign, so it takes the company's name.
            case when c.business_id = l.business_id then coalesce(b.name, bz.name) else bz.name end as "companyName",
            bz.kind as "companyKind",
            b.name as "brandName", c.name as "campaignName", c.channel as "channelLabel",
            l.contact_phone as "contactPhone", l.contact_name as "contactName", l.address,
            l.service_wanted as "serviceWanted", l.timing, l.callback_window as "callbackWindow",
            coalesce(ca.recording_url is not null, false) as "hasRecording",
            l.summary, l.intent,
            (select f.value from public.lead_fact_current f where f.lead_id = l.id and f.field = 'caller_email') as email,
            (select f.value from public.lead_fact_current f where f.lead_id = l.id and f.field = 'site_visit_window') as "siteVisit",
            cl.detail
       from claimed cl
       left join public.lead l on l.id = cl.lead_id
       join public.business bz on bz.id = coalesce(l.business_id, cl.business_id)
       left join public.campaign c on c.id = l.campaign_id
       left join public.brand b on b.id = c.brand_id
       left join public.call ca on ca.id = cl.call_id
      order by cl.created_at`,
    [limit, maxAttempts],
  );
  return rows;
}

export async function settleAlert(
  db: Queryable,
  input: { id: string; status: "sent" | "simulated" | "failed" | "pending"; error?: string | null },
): Promise<void> {
  await db.query(
    `update public.outbox
        set status = $2,
            last_error = $3,
            claimed_until = null,
            sent_at = case when $2 in ('sent', 'simulated') then now() else sent_at end
      where id = $1`,
    [input.id, input.status, input.error ?? null],
  );
}
