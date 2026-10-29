import type { Queryable } from "./migrate";

/**
 * Who a callback connects: Amy's phone, the customer, and the business number
 * the customer sees. People rarely answer unknown numbers, so Amy calls back
 * from the number they called (docs/research/ai-first-vs-ring-first.md).
 */
export interface CallbackTarget {
  tenantId: string;
  businessId: string;
  /** The customer's best number: a callback number they gave, else their caller ID. */
  customerPhone: string | null;
  customerName: string | null;
  /** The business number shown to the customer (the line they called). */
  lineE164: string;
  /** The phone that rings first: Amy's. */
  ownerPhone: string;
}

export async function callbackTarget(db: Queryable, leadId: string): Promise<CallbackTarget | null> {
  const { rows } = await db.query<CallbackTarget>(
    `select l.tenant_id as "tenantId", l.business_id as "businessId",
            coalesce((select f.value from public.lead_fact_current f where f.lead_id = l.id and f.field = 'callback_phone'),
                     l.contact_phone) as "customerPhone",
            l.contact_name as "customerName",
            tn.e164 as "lineE164", tn.owner_ring_e164 as "ownerPhone"
       from public.lead l
       -- The line of the caller's latest call; a web lead uses the company's first line.
       join lateral (
         select t.e164, t.owner_ring_e164 from public.tracking_number t
          where t.id = coalesce(
            (select c.tracking_number_id from public.call c where c.lead_id = l.id order by c.started_at desc limit 1),
            (select t2.id from public.tracking_number t2 where t2.business_id = l.business_id order by t2.e164 limit 1))
       ) tn on true
      where l.id = $1`,
    [leadId],
  );
  return rows[0] ?? null;
}
