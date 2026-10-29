import type { Queryable } from "./migrate";

export type BlockKind = "manual" | "auto";

export interface ActiveBlock {
  id: string;
  kind: BlockKind;
  reason: string | null;
  blockedUntil: Date | null;
}

/** An active block for this caller, if any (an expired one counts as none). */
export async function findBlock(db: Queryable, tenantId: string, e164: string | null): Promise<ActiveBlock | null> {
  if (!e164) return null;
  const { rows } = await db.query<ActiveBlock>(
    `select id, kind, reason, blocked_until as "blockedUntil" from public.blocked_number
      where tenant_id = $1 and e164 = $2 and (blocked_until is null or blocked_until > now())`,
    [tenantId, e164],
  );
  return rows[0] ?? null;
}

export async function recordBlockHit(db: Queryable, blockId: string): Promise<void> {
  await db.query("update public.blocked_number set hits = hits + 1, last_hit_at = now() where id = $1", [blockId]);
}

/**
 * Blocks a number. Amy's own (manual) block wins over the assistant's (auto)
 * one and is never shortened by it; an auto block only ever extends an auto block.
 */
export async function blockNumber(
  db: Queryable,
  input: { tenantId: string; e164: string; kind: BlockKind; reason: string; days: number | null; by: string },
): Promise<void> {
  await db.query(
    `insert into public.blocked_number (tenant_id, e164, kind, reason, blocked_until, created_by)
     values ($1, $2, $3, $4, case when $5::int is null then null else now() + make_interval(days => $5::int) end, $6)
     on conflict (tenant_id, e164) do update set
       kind = case when public.blocked_number.kind = 'manual' and excluded.kind = 'auto' then 'manual' else excluded.kind end,
       reason = case when public.blocked_number.kind = 'manual' and excluded.kind = 'auto' then public.blocked_number.reason else excluded.reason end,
       blocked_until = case when public.blocked_number.kind = 'manual' and excluded.kind = 'auto' then public.blocked_number.blocked_until
                            else excluded.blocked_until end,
       created_by = case when public.blocked_number.kind = 'manual' and excluded.kind = 'auto' then public.blocked_number.created_by
                         else excluded.created_by end`,
    [input.tenantId, input.e164, input.kind, input.reason, input.days, input.by],
  );
}

export async function unblockNumber(db: Queryable, tenantId: string, e164: string): Promise<void> {
  await db.query("delete from public.blocked_number where tenant_id = $1 and e164 = $2", [tenantId, e164]);
}

/** What the screen saw on this call: the carrier's caller-ID check and the gate's result. */
export async function recordCallerCheck(
  db: Queryable,
  input: { callSid: string; stirVerstat: string | null; screened: "passed" | "no_response" | null },
): Promise<void> {
  await db.query(
    `update public.call set stir_verstat = coalesce(stir_verstat, $2), screened = coalesce($3, screened)
      where twilio_call_sid = $1`,
    [input.callSid, input.stirVerstat, input.screened],
  );
}

export interface InboundSms {
  id: string;
  fromE164: string | null;
  body: string;
  receivedAt: Date;
  lineE164: string;
}

/** Stores a text sent to one of our numbers; replays of the same message are ignored. Returns false for an unknown number. */
export async function saveInboundSms(
  db: Queryable,
  input: { twilioSid: string; to: string; from: string | null; body: string },
): Promise<boolean> {
  const { rows } = await db.query<{ id: string }>(
    `insert into public.inbound_sms (tenant_id, business_id, tracking_number_id, twilio_sid, from_e164, body)
     select tn.tenant_id, tn.business_id, tn.id, $1, $3, left($4, 1600)
       from public.tracking_number tn where tn.e164 = $2
     on conflict (twilio_sid) do nothing
     returning id`,
    [input.twilioSid, input.to, input.from, input.body],
  );
  if (rows[0]) return true;
  const known = await db.query<{ n: number | string }>("select count(*) as n from public.tracking_number where e164 = $1", [input.to]);
  return Number(known.rows[0]?.n ?? 0) > 0;
}

export async function recentInboundSms(db: Queryable, limit = 5): Promise<InboundSms[]> {
  const { rows } = await db.query<InboundSms>(
    `select s.id, s.from_e164 as "fromE164", s.body, s.received_at as "receivedAt", tn.e164 as "lineE164"
       from public.inbound_sms s join public.tracking_number tn on tn.id = s.tracking_number_id
      order by s.received_at desc limit $1`,
    [limit],
  );
  return rows;
}
