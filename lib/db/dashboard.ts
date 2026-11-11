import type { FactField, FactSource } from "./agent";
import type { Queryable } from "./migrate";
import type { CallState, Channel, LeadState } from "./repo";

// Read models for Amy's console. Every number and card on screen comes from
// one of these queries; nothing is computed or invented in the browser.

export type Intent = "hot" | "warm" | "cold" | "not_a_lead" | "unknown";

export interface TodaySummary {
  newLeads: number;
  needCallback: number;
  hot: number;
  transferred: number;
  notALead: number;
  needsReview: number;
  aiCalls: number;
  ownerAnswered: number;
}

/** Counts for "today" in the business's time zone. */
export async function todaySummary(db: Queryable, timezone: string, now = new Date()): Promise<TodaySummary> {
  const { rows } = await db.query<Record<keyof TodaySummary, string | number>>(
    `with bounds as (
       select (date_trunc('day', $2::timestamptz at time zone $1) at time zone $1) as start_at
     )
     select
       (select count(*) from public.lead l, bounds b where l.created_at >= b.start_at and l.intent <> 'not_a_lead') as "newLeads",
       (select count(*) from public.task t where t.kind = 'callback' and t.status = 'open') as "needCallback",
       (select count(*) from public.lead l, bounds b where l.created_at >= b.start_at and l.intent = 'hot') as "hot",
       (select count(*) from public.call c, bounds b where c.started_at >= b.start_at and c.state = 'transferred') as "transferred",
       (select count(*) from public.lead l, bounds b where l.created_at >= b.start_at and l.intent = 'not_a_lead') as "notALead",
       (select count(*) from public.lead l where l.needs_review) as "needsReview",
       (select count(*) from public.agent_session s, bounds b where s.started_at >= b.start_at) as "aiCalls",
       (select count(*) from public.call c, bounds b where c.started_at >= b.start_at and c.state = 'owner_answered') as "ownerAnswered"`,
    [timezone, now.toISOString()],
  );
  const r = rows[0]!;
  return Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Number(v)])) as unknown as TodaySummary;
}

export interface LeadCard {
  id: string;
  businessId: string;
  /** The company the lead is for ("Sublime Patio"), or the office line while unknown. */
  businessName: string;
  businessKind: "company" | "front_desk";
  intent: Intent;
  state: LeadState;
  source: string;
  campaignName: string | null;
  channel: Channel | null;
  contactName: string | null;
  contactPhone: string | null;
  address: string | null;
  zip: string | null;
  serviceWanted: string | null;
  timing: string | null;
  callbackWindow: string | null;
  /** yes / no / unsure: "no" means a site visit to set up on the callback (Amy, 2026-10-29). */
  mapsVisible: string | null;
  propertyType: string | null;
  customerType: string | null;
  statedSource: string | null;
  summary: string | null;
  needsReview: boolean;
  compliance: {
    summary?: { priceAsked: boolean; priceStated: boolean; dateRequested: boolean; availabilityPromised: boolean; humanRequested: boolean };
    captured?: FactField[];
    missing?: FactField[];
    intentReasons?: string[];
    violations?: Array<{ code: string }>;
    transcript?: boolean;
    recordingDeclined?: boolean;
  };
  openTaskId: string | null;
  taskPriority: "high" | "normal" | null;
  taskWindow: string | null;
  lastCallState: CallState | null;
  /** When the caller last called (null for a web form with no call), and how many calls the lead has. */
  lastCallAt: Date | null;
  callCount: number;
  transferred: boolean;
  createdAt: Date;
}

const CARD_SELECT = `
  select l.id, l.business_id as "businessId", bz.name as "businessName", bz.kind as "businessKind",
         l.intent, l.state, l.source, c.name as "campaignName", c.channel,
         l.contact_name as "contactName", l.contact_phone as "contactPhone", l.address, l.zip,
         l.service_wanted as "serviceWanted", l.timing, l.callback_window as "callbackWindow",
         (select f.value from public.lead_fact_current f where f.lead_id = l.id and f.field = 'maps_visible') as "mapsVisible",
         l.property_type as "propertyType", l.customer_type as "customerType", l.stated_source as "statedSource",
         l.summary, l.needs_review as "needsReview", l.compliance,
         t.id as "openTaskId", t.priority as "taskPriority", t.due_window as "taskWindow",
         lc.state as "lastCallState", lc.started_at as "lastCallAt",
         (select count(*)::int from public.call x where x.lead_id = l.id) as "callCount",
         exists (select 1 from public.call x where x.lead_id = l.id and x.state = 'transferred') as transferred,
         l.created_at as "createdAt"
    from public.lead l
    join public.business bz on bz.id = l.business_id
    left join public.campaign c on c.id = l.campaign_id
    left join public.task t on t.lead_id = l.id and t.kind = 'callback' and t.status = 'open'
    left join lateral (select x.state, x.started_at from public.call x where x.lead_id = l.id order by x.started_at desc limit 1) lc on true`;

// ---------------------------------------------------------------- the calls inbox

/** The inbox tabs: who's waiting, who's been followed up, the outcomes, and the noise. */
export type InboxView = "waiting" | "followed_up" | "won" | "lost" | "noise" | "all";
export const INBOX_VIEWS: InboxView[] = ["waiting", "followed_up", "won", "lost", "noise", "all"];

/** Quick filters that narrow any view. */
export type InboxFilter = "hot" | "site_visit" | "price" | "business" | "returning";
export const INBOX_FILTERS: InboxFilter[] = ["hot", "site_visit", "price", "business", "returning"];

export type InboxSort = "priority" | "newest" | "oldest";
export const INBOX_SORTS: InboxSort[] = ["priority", "newest", "oldest"];

/** Which leads each tab holds. `l` is the lead, `t` its open callback (if any). Fixed SQL, never user text. */
const VIEW_WHERE: Record<InboxView, string> = {
  waiting: "t.id is not null",
  followed_up: "t.id is null and l.state in ('attempted', 'connected', 'qualified', 'quoted', 'booked')",
  won: "l.state = 'won'",
  lost: "l.state = 'lost'",
  // Spam, duplicates, and calls that left nothing a customer would say (held for the daily summary).
  noise: "(l.state in ('spam', 'duplicate') or (t.id is null and l.state = 'new' and l.intent in ('not_a_lead', 'unknown')))",
  all: "true",
};

const FILTER_WHERE: Record<InboxFilter, string> = {
  hot: "l.intent = 'hot'",
  site_visit: "exists (select 1 from public.lead_fact_current f where f.lead_id = l.id and f.field = 'maps_visible' and f.value = 'no')",
  price: "coalesce((l.compliance -> 'summary' ->> 'priceAsked')::boolean, false)",
  business: "l.property_type = 'commercial'",
  returning: "l.customer_type = 'returning'",
};

const SORT_ORDER: Record<InboxSort, string> = {
  // Open callbacks first, hottest first, then high priority, then newest: the order Amy works them in.
  priority: `(t.id is not null) desc,
             case l.intent when 'hot' then 0 when 'warm' then 1 when 'unknown' then 2 when 'cold' then 3 else 4 end,
             (t.priority = 'high') desc nulls last, l.created_at desc`,
  newest: "l.created_at desc",
  oldest: "l.created_at asc",
};

export interface InboxQuery {
  view: InboxView;
  filters: InboxFilter[];
  /** Matches name, address, what they want, the summary, or any 3+ digits of the phone number. */
  search: string;
  sort: InboxSort;
  businessId: string | null;
  limit?: number;
}

export interface Inbox {
  leads: LeadCard[];
  /** How many leads each tab holds under the same search and filters. */
  counts: Record<InboxView, number>;
  /** True when the view holds more than `limit` leads. */
  truncated: boolean;
}

/** The calls inbox: one tab, narrowed by search and filters, in the chosen order, with every tab's count. */
export async function inbox(db: Queryable, q: InboxQuery): Promise<Inbox> {
  const limit = q.limit ?? 200;
  const params: unknown[] = [q.businessId];
  const where = ["($1::uuid is null or l.business_id = $1::uuid)"];
  const search = q.search.trim().slice(0, 100);
  if (search) {
    params.push(`%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    const text = `$${params.length}`;
    const digits = search.replace(/\D/g, "");
    let phone = "";
    if (digits.length >= 3) {
      params.push(`%${digits}%`);
      phone = ` or regexp_replace(coalesce(l.contact_phone, ''), '[^0-9]', '', 'g') like $${params.length}`;
    }
    where.push(
      `(l.contact_name ilike ${text} or l.address ilike ${text} or l.service_wanted ilike ${text} or l.summary ilike ${text}${phone})`,
    );
  }
  for (const f of new Set(q.filters)) where.push(FILTER_WHERE[f]);
  const base = where.join(" and ");

  const [{ rows: leads }, { rows: countRows }] = await Promise.all([
    db.query<LeadCard>(`${CARD_SELECT} where ${base} and ${VIEW_WHERE[q.view]} order by ${SORT_ORDER[q.sort]} limit ${limit + 1}`, params),
    db.query<Record<InboxView, number | string>>(
      `select ${INBOX_VIEWS.map((v) => `count(*) filter (where ${VIEW_WHERE[v]}) as "${v}"`).join(", ")}
         from public.lead l
         left join public.task t on t.lead_id = l.id and t.kind = 'callback' and t.status = 'open'
        where ${base}`,
      params,
    ),
  ]);
  const counts = Object.fromEntries(INBOX_VIEWS.map((v) => [v, Number(countRows[0]?.[v] ?? 0)])) as Record<InboxView, number>;
  return { leads: leads.slice(0, limit), counts, truncated: leads.length > limit };
}

/**
 * Who needs Amy now: open callbacks first (hot, then high priority), then
 * the rest by recency. Terminal leads (won, lost, spam, duplicate) drop off.
 */
export async function leadQueue(db: Queryable, opts: { businessId?: string | null; limit?: number } = {}): Promise<LeadCard[]> {
  const { rows } = await db.query<LeadCard>(
    `${CARD_SELECT}
     where l.state not in ('won', 'lost', 'spam', 'duplicate')
       and ($2::uuid is null or l.business_id = $2::uuid)
     order by (t.id is not null) desc,
              case l.intent when 'hot' then 0 when 'warm' then 1 when 'unknown' then 2 when 'cold' then 3 else 4 end,
              (t.priority = 'high') desc nulls last,
              l.created_at desc
     limit $1`,
    [opts.limit ?? 50, opts.businessId ?? null],
  );
  return rows;
}

/**
 * Calls held back from texting Amy (looked like spam, or hung up with no
 * details) in the last `days`: the list behind the daily summary, so she can
 * spot a real customer the assistant misjudged.
 */
export async function quietLeads(db: Queryable, days = 7, limit = 50): Promise<LeadCard[]> {
  const { rows } = await db.query<LeadCard>(
    `${CARD_SELECT}
     where exists (select 1 from public.event e
                    where e.aggregate_type = 'lead' and e.aggregate_id = l.id and e.type = 'alert.held'
                      and e.occurred_at > now() - make_interval(days => $1::int))
       and l.state not in ('won', 'lost', 'duplicate')
     order by l.created_at desc
     limit $2`,
    [days, limit],
  );
  return rows;
}

export async function leadCard(db: Queryable, id: string): Promise<LeadCard | null> {
  const { rows } = await db.query<LeadCard>(`${CARD_SELECT} where l.id = $1`, [id]);
  return rows[0] ?? null;
}

export interface FactRow {
  field: FactField;
  value: string;
  source: FactSource;
  createdAt: Date;
  current: boolean;
}

export interface TimelineRow {
  id: number;
  type: string;
  actorType: string;
  payload: Record<string, unknown>;
  occurredAt: Date;
}

export interface CallRow {
  id: string;
  state: CallState;
  startedAt: Date;
  fromE164: string | null;
  routeReason: string | null;
  transferAttempts: number;
  hasRecording: boolean;
}

export interface SessionRow {
  id: string;
  callId: string;
  status: string;
  routeReason: string;
  endReason: string | null;
  startedAt: Date;
  transcript: Array<{ role: string; message: string | null }> | null;
  summary: string | null;
  metadata: Record<string, unknown>;
}

export interface ToolRow {
  toolName: string;
  outcome: string;
  latencyMs: number | null;
  input: unknown;
  output: unknown;
  createdAt: Date;
}

export interface IncidentRow {
  kind: string;
  severity: string;
  createdAt: Date;
  detail: Record<string, unknown>;
}

export interface LeadDetail {
  card: LeadCard;
  facts: FactRow[];
  calls: CallRow[];
  sessions: SessionRow[];
  tools: ToolRow[];
  timeline: TimelineRow[];
  incidents: IncidentRow[];
}

export async function leadDetail(db: Queryable, id: string): Promise<LeadDetail | null> {
  const card = await leadCard(db, id);
  if (!card) return null;
  const [facts, calls, sessions, tools, timeline, incidents] = await Promise.all([
    db.query<FactRow>(
      `select f.field, f.value, f.source, f.created_at as "createdAt",
              (cur.id = f.id) as current
         from public.lead_fact f
         left join public.lead_fact_current cur on cur.lead_id = f.lead_id and cur.field = f.field
        where f.lead_id = $1 order by f.id`,
      [id],
    ),
    db.query<CallRow>(
      `select id, state, started_at as "startedAt", from_e164 as "fromE164", route_reason as "routeReason",
              transfer_attempts as "transferAttempts", recording_url is not null as "hasRecording"
         from public.call where lead_id = $1 order by started_at`,
      [id],
    ),
    db.query<SessionRow>(
      `select s.id, s.call_id as "callId", s.status, s.route_reason as "routeReason", s.end_reason as "endReason",
              s.started_at as "startedAt", s.transcript, s.summary, s.metadata
         from public.agent_session s where s.lead_id = $1 order by s.started_at`,
      [id],
    ),
    db.query<ToolRow>(
      `select tool_name as "toolName", outcome, latency_ms as "latencyMs", input, output, created_at as "createdAt"
         from public.tool_call where lead_id = $1 order by created_at`,
      [id],
    ),
    db.query<TimelineRow>(
      `select e.id, e.type, e.actor_type as "actorType", e.payload, e.occurred_at as "occurredAt"
         from public.event e
        where (e.aggregate_type = 'lead' and e.aggregate_id = $1)
           or (e.aggregate_type = 'call' and e.aggregate_id in (select id from public.call where lead_id = $1))
        order by e.id`,
      [id],
    ),
    db.query<IncidentRow>(
      `select kind, severity, created_at as "createdAt", detail from public.incident where lead_id = $1 order by created_at`,
      [id],
    ),
  ]);
  return {
    card,
    facts: facts.rows,
    calls: calls.rows,
    sessions: sessions.rows,
    tools: tools.rows,
    timeline: timeline.rows,
    incidents: incidents.rows,
  };
}

export interface BusinessRow {
  tenantId: string;
  businessId: string;
  name: string;
  config: unknown;
  version: number;
}

/**
 * The first company this console serves (the office's own settings, time
 * zone and owner name, come from it). Per-user sign-in will choose by
 * membership instead.
 */
export async function primaryBusiness(db: Queryable): Promise<BusinessRow | null> {
  const { rows } = await db.query<BusinessRow>(
    `select b.tenant_id as "tenantId", b.id as "businessId", b.name, bc.config, bc.version
       from public.business b join public.business_config bc on bc.business_id = b.id and bc.active
      order by (b.kind = 'front_desk'), b.created_at limit 1`,
  );
  return rows[0] ?? null;
}

/** One business with its active config (the lead page uses the lead's own company). */
export async function businessById(db: Queryable, businessId: string): Promise<BusinessRow | null> {
  const { rows } = await db.query<BusinessRow>(
    `select b.tenant_id as "tenantId", b.id as "businessId", b.name, bc.config, bc.version
       from public.business b join public.business_config bc on bc.business_id = b.id and bc.active
      where b.id = $1`,
    [businessId],
  );
  return rows[0] ?? null;
}

export interface OfficeBusiness extends BusinessRow {
  kind: "company" | "front_desk";
  /** Open callbacks waiting for Amy. */
  waiting: number;
}

/** Every business the office answers for (companies first, then any shared-line front desk). */
export async function officeBusinesses(db: Queryable): Promise<OfficeBusiness[]> {
  const { rows } = await db.query<OfficeBusiness & { waiting: string | number }>(
    `select b.tenant_id as "tenantId", b.id as "businessId", b.name, b.kind, bc.config, bc.version,
            (select count(*) from public.task t where t.business_id = b.id and t.kind = 'callback' and t.status = 'open') as waiting
       from public.business b join public.business_config bc on bc.business_id = b.id and bc.active
      order by (b.kind = 'front_desk'), b.created_at`,
  );
  return rows.map((r) => ({ ...r, waiting: Number(r.waiting) }));
}

/** Amy logged a call attempt or outcome: the open callback is done. */
export async function completeOpenCallback(db: Queryable, leadId: string, by: string): Promise<boolean> {
  const { rows } = await db.query<{ id: string }>(
    "select id from public.task where lead_id = $1 and kind = 'callback' and status = 'open'",
    [leadId],
  );
  const task = rows[0];
  if (!task) return false;
  const done = await db.query<{ ok: boolean }>("select app.complete_task($1, $2) as ok", [task.id, by]);
  return done.rows[0]?.ok === true;
}
