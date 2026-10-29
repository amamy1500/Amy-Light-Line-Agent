import type { Queryable } from "./migrate";

/**
 * What the operator checks when something might be wrong: traffic, failures,
 * questions the assistant couldn't answer, and where calls and alerts go.
 * Read-only; every query is bounded by time or a limit.
 */

export interface Traffic {
  total: number;
  /** Amy pressed a key and talked to the caller. */
  ownerAnswered: number;
  /** Put through to Amy by the assistant. */
  transferred: number;
  /** The assistant talked to the caller (any reason). */
  assistant: number;
  /** ...of which while Amy was already on another of our calls. */
  whileOwnerBusy: number;
  /** Left a recorded message (no assistant). */
  messages: number;
  /** Hung up before anything was captured. */
  hungUp: number;
  /** Still in progress, or never finished (a status callback that didn't arrive). */
  open: number;
}

export async function traffic(db: Queryable, hours: number): Promise<Traffic> {
  const { rows } = await db.query<Traffic>(
    `select count(*)::int as total,
            (count(*) filter (where c.state = 'owner_answered'))::int as "ownerAnswered",
            (count(*) filter (where c.state = 'transferred'))::int as transferred,
            (count(*) filter (where exists (select 1 from public.agent_session s where s.call_id = c.id)))::int as assistant,
            (count(*) filter (where c.route_reason = 'owner_busy'))::int as "whileOwnerBusy",
            (count(*) filter (where c.state = 'message_captured'))::int as messages,
            (count(*) filter (where c.state = 'abandoned'))::int as "hungUp",
            (count(*) filter (where not c.completed))::int as open
       from public.call c
      where c.started_at > now() - make_interval(hours => $1)`,
    [hours],
  );
  return rows[0]!;
}

export interface IncidentItem {
  id: string;
  kind: string;
  severity: "critical" | "warning";
  createdAt: Date;
  leadId: string | null;
  fromE164: string | null;
}

/** Open incidents (dropped agent streams, failed connects…) from the last 7 days. */
export async function openIncidents(db: Queryable, limit = 20): Promise<IncidentItem[]> {
  const { rows } = await db.query<IncidentItem>(
    `select i.id, i.kind, i.severity, i.created_at as "createdAt", i.lead_id as "leadId", c.from_e164 as "fromE164"
       from public.incident i left join public.call c on c.id = i.call_id
      where i.resolved_at is null and i.created_at > now() - interval '7 days'
      order by i.created_at desc limit $1`,
    [limit],
  );
  return rows;
}

export interface StuckAlert {
  id: string;
  kind: string;
  channel: "sms" | "email";
  toAddress: string;
  status: "pending" | "failed";
  attempts: number;
  lastError: string | null;
  createdAt: Date;
  leadId: string | null;
}

/** Alerts that failed, or have waited more than 10 minutes to go out. */
export async function stuckAlerts(db: Queryable, limit = 20): Promise<StuckAlert[]> {
  const { rows } = await db.query<StuckAlert>(
    `select o.id, o.kind, o.channel, o.to_address as "toAddress", o.status, o.attempts, o.last_error as "lastError",
            o.created_at as "createdAt", o.lead_id as "leadId"
       from public.outbox o
      where o.status = 'failed'
         or (o.status = 'pending' and (o.attempts > 0 or o.created_at < now() - interval '10 minutes'))
      order by o.created_at desc limit $1`,
    [limit],
  );
  return rows;
}

export interface StuckJob {
  kind: string;
  status: "pending" | "failed";
  /** How many jobs of this kind are stuck this way. */
  count: number;
  attempts: number;
  lastError: string | null;
  updatedAt: Date;
}

/**
 * Background jobs (post-call processing, callback reminders, the daily
 * summary) that failed or are overdue by 15 minutes, one row per kind.
 */
export async function stuckJobs(db: Queryable, limit = 20): Promise<StuckJob[]> {
  const { rows } = await db.query<StuckJob>(
    `select kind, status, count(*)::int as count, max(attempts)::int as attempts,
            (array_agg(last_error order by updated_at desc))[1] as "lastError", max(updated_at) as "updatedAt"
       from public.job
      where status = 'failed' or (status = 'pending' and run_after < now() - interval '15 minutes')
      group by kind, status
      order by max(updated_at) desc limit $1`,
    [limit],
  );
  return rows;
}

/** Tool calls that errored in the last 7 days, per tool. */
export async function toolErrors(db: Queryable): Promise<Array<{ toolName: string; count: number }>> {
  const { rows } = await db.query<{ toolName: string; count: number }>(
    `select tool_name as "toolName", count(*)::int as count
       from public.tool_call
      where outcome = 'error' and created_at > now() - interval '7 days'
      group by tool_name order by count desc`,
  );
  return rows;
}

export interface UnansweredQuestion {
  question: string;
  topic: string;
  askedAt: Date;
  leadId: string | null;
}

/**
 * Questions the assistant looked up and found no approved answer for: each
 * one is a sentence Amy could approve so the next caller gets an answer.
 */
export async function unansweredQuestions(db: Queryable, days = 30, limit = 25): Promise<UnansweredQuestion[]> {
  const { rows } = await db.query<UnansweredQuestion>(
    `select t.input->>'question' as question, t.input->>'topic' as topic, t.created_at as "askedAt", t.lead_id as "leadId"
       from public.tool_call t
      where t.tool_name = 'get_approved_answer' and t.output->>'found' = 'false'
        and t.created_at > now() - make_interval(days => $1)
      order by t.created_at desc limit $2`,
    [days, limit],
  );
  return rows;
}

export interface LineRow {
  e164: string;
  company: string;
  channel: string;
  ownerRingE164: string;
  ringOwner: boolean;
  ringTimeoutS: number;
}

/** Every number callers can dial, which company it is, and whose phone it rings. */
export async function systemLines(db: Queryable): Promise<LineRow[]> {
  const { rows } = await db.query<LineRow>(
    `select tn.e164, b.name as company, c.channel, tn.owner_ring_e164 as "ownerRingE164",
            tn.ring_owner as "ringOwner", tn.ring_timeout_s as "ringTimeoutS"
       from public.tracking_number tn
       join public.campaign c on c.id = tn.campaign_id
       join public.business b on b.id = tn.business_id
      order by b.name, tn.e164`,
  );
  return rows;
}

/** Where call alerts go, for every company. */
export async function alertRecipients(db: Queryable): Promise<Array<{ company: string; channel: "sms" | "email"; address: string }>> {
  const { rows } = await db.query<{ company: string; channel: "sms" | "email"; address: string }>(
    `select b.name as company, ac.channel, ac.address
       from public.alert_contact ac join public.business b on b.id = ac.business_id
      where ac.active order by b.name, ac.channel, ac.address`,
  );
  return rows;
}

export interface EventRow {
  type: string;
  actorType: string;
  occurredAt: Date;
}

/** The latest things that happened, newest first. */
export async function recentEvents(db: Queryable, limit = 15): Promise<EventRow[]> {
  const { rows } = await db.query<EventRow>(
    `select type, actor_type as "actorType", occurred_at as "occurredAt" from public.event order by id desc limit $1`,
    [limit],
  );
  return rows;
}
