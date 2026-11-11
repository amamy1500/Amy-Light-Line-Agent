import Link from "next/link";
import type { LeadCard } from "@/lib/db/dashboard";
import { cityOf, initials, relativeWhen } from "@/lib/server/inbox-labels";
import { CHANNEL_LABEL, INTENT_LABEL } from "@/lib/server/labels";
import { formatUsPhone } from "@/lib/telephony/phone";
import { Icon } from "./ui";
import { displayName } from "./lead-card";

/** Where the lead stands once someone has acted on it; null while it's still new. */
const STATE_TAG: Partial<Record<LeadCard["state"], { text: string; tone: string }>> = {
  attempted: { text: "Left a voicemail", tone: "" },
  connected: { text: "Talked", tone: "ok" },
  qualified: { text: "Talked", tone: "ok" },
  quoted: { text: "Quoted", tone: "ok" },
  booked: { text: "Booked", tone: "ok" },
  won: { text: "Won", tone: "ok" },
  lost: { text: "Not going ahead", tone: "" },
  spam: { text: "Not a customer", tone: "" },
  duplicate: { text: "Duplicate", tone: "" },
};

const INTENT_TONE: Record<LeadCard["intent"], string> = { hot: "hot", warm: "warm", cold: "", not_a_lead: "", unknown: "" };

/** The few tags that change what Amy does on the callback, in the order she'd want them. */
function tags(card: LeadCard): Array<{ text: string; tone: string }> {
  const out: Array<{ text: string; tone: string }> = [];
  const state = STATE_TAG[card.state];
  out.push(state ?? { text: INTENT_LABEL[card.intent], tone: INTENT_TONE[card.intent] });
  if (card.needsReview) out.push({ text: "Check what was said", tone: "bad" });
  if (card.mapsVisible === "no") out.push({ text: "Site visit", tone: "info" });
  if (card.mapsVisible === "unsure") out.push({ text: "Check Maps", tone: "info" });
  if (card.compliance.summary?.priceAsked) out.push({ text: "Asked price", tone: "" });
  if (card.customerType === "returning") out.push({ text: "Returning", tone: "" });
  if (card.propertyType === "commercial") out.push({ text: "Business", tone: "" });
  if (card.compliance.recordingDeclined) out.push({ text: "No recording", tone: "" });
  return out.slice(0, 4);
}

/** One caller in the inbox: who, what they want, when to call back, how long ago; the row opens the lead. */
export function LeadRow({ card, now, timeZone, showCompany }: { card: LeadCard; now: Date; timeZone: string; showCompany: boolean }) {
  const name = displayName(card);
  const tone = card.state === "new" ? INTENT_TONE[card.intent] : "";
  const city = cityOf(card.address);
  const second = [
    city,
    showCompany ? (card.businessKind === "front_desk" ? "Company not given" : card.businessName) : null,
    card.channel ? CHANNEL_LABEL[card.channel] : null,
    card.callCount > 1 ? `${card.callCount} calls` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const callback = card.taskWindow ?? card.callbackWindow;
  return (
    <li className={`lrow ${tone}`}>
      <Link href={`/leads/${card.id}`} className="lrow-main" aria-label={`Open ${name}`}>
        <span className="avatar" aria-hidden="true">
          {initials(card.contactName)}
        </span>
        <span className="cell who-cell">
          <b>{name}</b>
          <small className="num">{card.contactName ? formatUsPhone(card.contactPhone) : (card.address ?? "No name given")}</small>
        </span>
        <span className="cell what-cell">
          <span className="one">{card.serviceWanted ?? card.summary ?? "No details given"}</span>
          {second && <span className="two">{second}</span>}
          <span className="tags">
            {tags(card).map((t) => (
              <span key={t.text} className={`badge ${t.tone}`}>
                {t.text}
              </span>
            ))}
          </span>
        </span>
        <span className="cell callback-cell">
          {card.openTaskId ? (
            <span className="callback">
              <Icon name="clock" size={15} />
              <span>{callback ?? "Any time"}</span>
            </span>
          ) : (
            <span className="callback none">No callback due</span>
          )}
        </span>
        <time className="when" dateTime={new Date(card.createdAt).toISOString()}>
          {relativeWhen(new Date(card.createdAt), now, timeZone)}
        </time>
      </Link>
      <div className="lrow-actions">
        {card.contactPhone && (
          <a className="btn icon-only" href={`tel:${card.contactPhone}`} aria-label={`Call ${name}`} title={`Call ${formatUsPhone(card.contactPhone)}`}>
            <Icon name="phone" size={16} />
          </a>
        )}
      </div>
    </li>
  );
}
