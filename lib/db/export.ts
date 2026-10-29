import { formatUsPhone } from "@/lib/telephony/phone";
import type { Queryable } from "./migrate";

/** One row per lead, newest first: what Amy needs to work the list in a spreadsheet. */
export interface ExportRow {
  createdAt: Date;
  company: string;
  status: string;
  intent: string;
  name: string | null;
  phone: string | null;
  callbackPhone: string | null;
  email: string | null;
  address: string | null;
  homeSize: string | null;
  outdoorPlugs: string | null;
  siteVisit: string | null;
  wants: string | null;
  timing: string | null;
  callbackWindow: string | null;
  heardAbout: string | null;
  summary: string | null;
  callbackOpen: boolean;
  needsReview: boolean;
  leadId: string;
}

export async function exportLeads(db: Queryable, limit = 5000): Promise<ExportRow[]> {
  const { rows } = await db.query<ExportRow>(
    `select l.created_at as "createdAt",
            case when b.kind = 'front_desk' then 'Company not given' else b.name end as company,
            l.state as status, l.intent, l.contact_name as name, l.contact_phone as phone,
            (select f.value from public.lead_fact_current f where f.lead_id = l.id and f.field = 'callback_phone') as "callbackPhone",
            (select f.value from public.lead_fact_current f where f.lead_id = l.id and f.field = 'caller_email') as email,
            (select f.value from public.lead_fact_current f where f.lead_id = l.id and f.field = 'home_size') as "homeSize",
            (select f.value from public.lead_fact_current f where f.lead_id = l.id and f.field = 'outdoor_plugs') as "outdoorPlugs",
            (select f.value from public.lead_fact_current f where f.lead_id = l.id and f.field = 'site_visit_window') as "siteVisit",
            l.address, l.service_wanted as wants, l.timing, l.callback_window as "callbackWindow",
            l.stated_source as "heardAbout", l.summary,
            exists (select 1 from public.task t where t.lead_id = l.id and t.kind = 'callback' and t.status = 'open') as "callbackOpen",
            l.needs_review as "needsReview", l.id as "leadId"
       from public.lead l join public.business b on b.id = l.business_id
      where l.state <> 'duplicate'
      order by l.created_at desc
      limit $1`,
    [limit],
  );
  // "(512) 555-0147" reads as a phone number in a sheet; "+1512…" would be taken for a formula.
  return rows.map((r) => ({
    ...r,
    phone: r.phone ? formatUsPhone(r.phone) : null,
    callbackPhone: r.callbackPhone ? formatUsPhone(r.callbackPhone) : null,
  }));
}

const HEADER = [
  "Date", "Company", "Status", "Intent", "Name", "Phone", "Callback phone", "Email", "Address", "Wants",
  "Home size (sq ft)", "Outdoor plugs", "Timing", "Best time to call", "Site visit could be", "Heard about us",
  "Summary", "Callback open", "Needs review", "Lead id",
];

/**
 * RFC 4180 CSV. Cells that a spreadsheet would run as a formula (=, +, -, @)
 * are prefixed with an apostrophe: caller words must never execute (CSV injection).
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = value instanceof Date ? value.toISOString() : typeof value === "boolean" ? (value ? "yes" : "no") : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function leadsCsv(rows: ExportRow[]): string {
  const lines = rows.map((r) =>
    [
      r.createdAt, r.company, r.status, r.intent, r.name, r.phone, r.callbackPhone, r.email, r.address, r.wants,
      r.homeSize, r.outdoorPlugs, r.timing, r.callbackWindow, r.siteVisit, r.heardAbout,
      r.summary, r.callbackOpen, r.needsReview, r.leadId,
    ]
      .map(csvCell)
      .join(","),
  );
  // A byte-order mark so Excel reads UTF-8 names correctly.
  return `﻿${[HEADER.join(","), ...lines].join("\r\n")}\r\n`;
}
