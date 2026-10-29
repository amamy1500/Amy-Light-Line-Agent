import { enqueueJob, type ClaimedJob } from "@/lib/db/agent";
import { DEFAULT_ALERTS } from "@/lib/business-rules/config";
import { loadActiveConfig } from "@/lib/db/config";
import type { Queryable } from "@/lib/db/migrate";

/**
 * The daily summary. Calls that looked like spam or left no details don't
 * text Amy one by one (her line is full of them); they are counted here and
 * sent as ONE text a day, so a real caller the assistant misjudged is still
 * in front of her by morning (docs/research/spam-screening.md).
 */


/** The UTC instant of a local wall-clock time on a local date, in a time zone. */
export function localTimeToUtc(date: string, time: string, timeZone: string): Date {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const [hh, mm] = time.split(":").map(Number) as [number, number];
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  // The zone's offset at that moment, from the wall-clock time it shows.
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(new Date(guess))
      .map((p) => [p.type, p.value]),
  );
  const shown = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
  return new Date(guess - (shown - guess));
}

/** The next summary time after `now`: today at `time` local (8:00 unless Amy changed it), or tomorrow if that has passed. */
export function nextDigestAt(now: Date, timeZone: string, time = DEFAULT_ALERTS.dailySummaryTime): { at: Date; date: string } {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const at = localTimeToUtc(today, time, timeZone);
  if (at > now) return { at, date: today };
  const tomorrow = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(now.getTime() + 24 * 3600 * 1000),
  );
  return { at: localTimeToUtc(tomorrow, time, timeZone), date: tomorrow };
}

/**
 * Makes sure each business with alert contacts and the summary turned on has
 * its next one scheduled (idempotent per day). A summary already queued for
 * an old time still goes out once; the new time applies from the next day.
 */
export async function ensureDigestJobs(db: Queryable, now: Date = new Date()): Promise<void> {
  const { rows } = await db.query<{ tenant_id: string; business_id: string }>(
    `select distinct b.tenant_id, b.id as business_id
       from public.business b join public.alert_contact ac on ac.business_id = b.id and ac.active`,
  );
  for (const row of rows) {
    const config = (await loadActiveConfig(db, row.business_id).catch(() => null))?.config;
    const alerts = config?.alerts ?? DEFAULT_ALERTS;
    if (!alerts.dailySummary) continue;
    const next = nextDigestAt(now, config?.timezone ?? "America/Chicago", alerts.dailySummaryTime);
    await enqueueJob(db, {
      tenantId: row.tenant_id,
      businessId: row.business_id,
      kind: "daily_digest",
      subjectId: row.business_id,
      dedupeKey: `daily_digest:${row.business_id}:${next.date}`,
      runAfterSeconds: Math.max(0, Math.round((next.at.getTime() - now.getTime()) / 1000)),
    });
  }
}

/** Counts the last day's held calls and queues one summary per alert contact, if there were any. */
export async function processDigest(db: Queryable, job: ClaimedJob, now: Date = new Date()): Promise<number> {
  const { rows } = await db.query<{ n: number | string }>(
    `select count(*) as n from public.event
      where business_id = $1 and type = 'alert.held' and occurred_at > $2::timestamptz - interval '24 hours'`,
    [job.businessId, now.toISOString()],
  );
  const held = Number(rows[0]?.n ?? 0);
  if (held === 0) return 0;
  await db.query(
    `insert into public.outbox (tenant_id, business_id, lead_id, call_id, kind, channel, to_address, dedupe_key, detail)
     select $1, $2, null, null, 'digest', ac.channel, ac.address, $3 || ':' || ac.id::text, $4::jsonb
       from public.alert_contact ac where ac.business_id = $2 and ac.active
     on conflict (dedupe_key) do nothing`,
    [job.tenantId, job.businessId, `digest:${job.id}`, JSON.stringify({ held, hours: 24 })],
  );
  return held;
}
