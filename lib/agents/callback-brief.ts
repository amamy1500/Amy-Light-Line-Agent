import type { FactField } from "@/lib/db/agent";
import type { LeadDetail } from "@/lib/db/dashboard";
import type { UrgentKind } from "@/lib/db/repo";
import { FIELD_LABEL } from "@/lib/server/labels";
import { formatUsPhone } from "@/lib/telephony/phone";

/**
 * What Amy (or whoever calls back) reads in the ten seconds before calling back: the lead
 * sheet, how to open, what the caller wants in their own words, the questions
 * they asked that only the business can answer, and what to be careful with
 * (nothing was quoted or promised). Built from what was stored, never
 * generated: every line traces to a fact, a flag or an event on the lead.
 */
export interface CallbackBrief {
  /** Amy's lead sheet (2026-10-29), in her order, with "Unknown" where nothing was said. */
  sheet: Array<{ label: string; value: string }>;
  /** True when the caller asked not to be contacted: the brief says so and offers no opener. */
  doNotContact: boolean;
  /** A first sentence for the callback, or null when there should be no call. */
  opener: string | null;
  /** What they told us, labeled, in the order Amy needs it. */
  told: Array<{ label: string; value: string }>;
  /** Questions they asked that the assistant left for Amy. */
  asked: string[];
  /** Heads-ups, most important first. */
  careful: string[];
  /** Details still worth asking for. */
  missing: string[];
}

const URGENT_LABEL: Record<UrgentKind, string> = {
  safety: "Safety",
  service_issue: "Problem with an installed job",
  complaint: "Complaint or claim",
  threat: "Threat or abuse",
  official: "Media, police, city or HOA",
};

/** Details beyond the lead sheet, in the order they are listed. */
const TOLD: readonly FactField[] = [
  "zip",
  "desired_timing",
  "outdoor_plugs",
  "site_visit_window",
  "caller_email",
  "lead_source",
];

const MAPS_ANSWER: Record<string, string> = { yes: "Yes", no: "No", unsure: "Not sure" };

/** Things the assistant must never commit to; any of them on a call means "check the transcript". */
const PROMISES: Record<string, string> = {
  price_stated: "a price",
  discount_offered: "a discount",
  availability_promised: "a date",
  booking_claimed: "a booking",
  warranty_claimed: "a warranty",
  remote_quote_promised: "a remote quote",
  site_visit_offered: "a site visit",
};

/** What the Google Maps answer means for the callback (Amy, 2026-10-29). */
const VISIT_LINE: Record<string, string> = {
  no: "Yes: set up a time on the callback (hard to see on Google Maps)",
  unsure: "Maybe: check Google Maps first",
  yes: "Probably not: visible on Google Maps",
};

export interface BriefPeople {
  /** The person who dials the callback (e.g. Amy, or Josh). Absent: the owner. */
  callback?: string;
  /** The business asks whether the home shows on Google Maps, so the sheet has the property lines. */
  propertyLines?: boolean;
}

const DO_NOT_CONTACT = /\b(do not contact|don'?t (call|contact)|take (me|us) off|remove (me|us))\b/i;

export function callbackBrief(detail: LeadDetail, owner: string, company: string, people: BriefPeople = {}): CallbackBrief {
  const { card } = detail;
  const callback = people.callback ?? owner;
  const current = new Map(detail.facts.filter((f) => f.current).map((f) => [f.field, f.value]));
  const notes = detail.facts.filter((f) => f.field === "notes").map((f) => f.value);
  const doNotContact = notes.some((n) => DO_NOT_CONTACT.test(n));

  const told = TOLD.flatMap((field) => {
    const value = current.get(field);
    return value ? [{ label: FIELD_LABEL[field], value }] : [];
  });

  // "Asked: …" notes are questions the assistant could not answer; the newest wording of each, at most six.
  const seen = new Set<string>();
  const asked: string[] = [];
  for (const note of [...notes].reverse()) {
    const question = /^Asked:\s*(.+)$/i.exec(note)?.[1]?.trim();
    if (!question || seen.has(question.toLowerCase())) continue;
    seen.add(question.toLowerCase());
    asked.push(question);
  }
  asked.splice(6);

  const urgent = detail.timeline
    .filter((e) => e.type === "call.flagged_urgent")
    .map((e) => e.payload as { kind?: UrgentKind; summary?: string })
    .filter((p) => p.kind);
  const summary = card.compliance.summary;
  const careful = [
    doNotContact ? "They asked not to be contacted. Don't call unless they reach out again." : null,
    ...urgent.map((u) => `Urgent (${URGENT_LABEL[u.kind!]}): ${u.summary ?? ""}`.trim()),
    card.needsReview ? "Flagged for review: check what the assistant said before you call." : null,
    summary?.priceAsked ? "They asked about price. Nothing was quoted, so they're expecting you to walk them through it." : null,
    summary?.dateRequested || card.timing
      ? `They'd like it ${card.timing ?? "by a certain date"}. Nothing was promised: check the schedule before you commit.`
      : null,
    summary?.humanRequested ? `They asked to talk with ${owner} directly.` : null,
    card.compliance.recordingDeclined ? "They asked not to be recorded, so there's no transcript." : null,
    card.customerType === "returning" ? "Returning customer." : null,
  ].filter((line): line is string => Boolean(line));

  const missing = (card.compliance.missing ?? []).filter((f) => !current.has(f)).map((f) => FIELD_LABEL[f]);

  const promised = [...new Set((card.compliance.violations ?? []).flatMap((v) => (PROMISES[v.code] ? [PROMISES[v.code]!] : [])))];
  const unknown = "Unknown";
  const sheet = [
    { label: "Name", value: card.contactName ?? current.get("caller_name") ?? unknown },
    { label: "Phone", value: formatUsPhone(current.get("callback_phone") ?? card.contactPhone) },
    { label: "Property address", value: card.address ?? unknown },
    { label: "Customer type", value: { residential: "Residential", commercial: "Commercial" }[card.propertyType ?? ""] ?? unknown },
    { label: "Interest", value: card.serviceWanted ?? unknown },
    ...(people.propertyLines
      ? [
          { label: "Home visible on Google Maps", value: MAPS_ANSWER[current.get("maps_visible") ?? ""] ?? "Not asked" },
          { label: "Square footage", value: current.get("home_size") ?? unknown },
        ]
      : []),
    { label: "Preferred callback", value: card.callbackWindow ?? "Not given" },
    ...(people.propertyLines ? [{ label: "Site visit", value: VISIT_LINE[current.get("maps_visible") ?? ""] ?? "Not asked" }] : []),
    {
      label: "Pricing discussed",
      value: summary?.priceStated ? "Yes: check the transcript" : summary?.priceAsked ? "They asked; no price given" : "No",
    },
    { label: "Promises made", value: promised.length ? `Check the transcript: ${promised.join(", ")}` : "None" },
    ...(card.summary ? [{ label: "Summary", value: card.summary }] : []),
    {
      label: "Next action",
      value: doNotContact
        ? "Don't call"
        : urgent.length
          ? `${owner} callback (urgent)`
          : current.get("maps_visible") === "no"
            ? "Call to set up the site visit"
            : `${callback} callback`,
    },
  ];

  return {
    sheet,
    doNotContact,
    opener: doNotContact ? null : opener(detail, urgent.length ? owner : callback, company, urgent.length > 0),
    told,
    asked,
    careful,
    missing,
  };
}

/** `who` is the person calling back: the owner for urgent reports, else the callback person. */
function opener(detail: LeadDetail, who: string, company: string, urgent: boolean): string {
  const { card } = detail;
  const first = card.contactName?.split(/\s+/)[0];
  const hello = `Hi${first ? ` ${first}` : ""}, it's ${who} with ${company}`;
  if (urgent) return `${hello}, calling you right back about what you reported. Is everyone okay?`;
  const how =
    card.source === "web_form"
      ? "You asked for a quote on our website"
      : card.source === "agent_call"
        ? "You talked with our assistant"
        : card.source === "call_recovery"
          ? "You left us a message"
          : "You called us";
  if (!card.serviceWanted) return `${hello}, returning your call. How can I help?`;
  const place = card.address ? ` at ${card.address.split(",")[0]}` : "";
  return `${hello}. ${how} about ${card.serviceWanted}${place}. Is now still a good time?`;
}
