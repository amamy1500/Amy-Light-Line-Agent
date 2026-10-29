import Link from "next/link";
import type { CallWindow } from "@/lib/business-rules/quiet-hours";
import type { LeadCard } from "@/lib/db/dashboard";
import { CHANNEL_LABEL, INTENT_LABEL } from "@/lib/server/labels";
import { formatUsPhone } from "@/lib/telephony/phone";

/** What we can honestly say about the call, from the stored compliance scan. */
export function Flags({ card }: { card: LeadCard }) {
  const s = card.compliance.summary;
  const flags: Array<{ text: string; tone: "ok" | "bad" | "neutral" }> = [];
  if (card.compliance.transcript === false && !card.compliance.recordingDeclined && card.source === "agent_call") {
    flags.push({ text: "Transcript not received yet", tone: "neutral" });
  }
  if (card.compliance.recordingDeclined) flags.push({ text: "Caller declined recording", tone: "neutral" });
  if (s) {
    if (s.priceStated) flags.push({ text: "Price was stated: review", tone: "bad" });
    else if (s.priceAsked) flags.push({ text: "Asked about price · none given", tone: "ok" });
    if (s.availabilityPromised) flags.push({ text: "Date was promised: review", tone: "bad" });
    else if (s.dateRequested) flags.push({ text: "Asked for a date · not promised", tone: "ok" });
    if (s.humanRequested) flags.push({ text: "Asked for you", tone: "neutral" });
  }
  if (!flags.length) return null;
  return (
    <div className="flags">
      {flags.map((f) => (
        <span key={f.text} className={`flag ${f.tone === "ok" ? "" : f.tone}`}>
          {f.text}
        </span>
      ))}
    </div>
  );
}

export function displayName(card: LeadCard): string {
  return card.contactName ?? formatUsPhone(card.contactPhone);
}

function place(card: LeadCard): string | null {
  const parts = [card.address, card.zip && !card.address?.includes(card.zip) ? card.zip : null].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

export function LeadCardView({ card, callWindow, href }: { card: LeadCard; callWindow: CallWindow; href?: string }) {
  const intentClass = card.intent === "hot" ? "hot" : card.intent === "warm" ? "warm" : "";
  const source = [card.channel ? CHANNEL_LABEL[card.channel] : null, card.statedSource ? `“${card.statedSource}”` : null]
    .filter(Boolean)
    .join(" · ");
  const firstName = card.contactName?.split(/\s+/)[0];
  const captured = card.compliance.captured?.length;
  const total = captured !== undefined ? captured + (card.compliance.missing?.length ?? 0) : undefined;

  return (
    <article className={`card ${intentClass}`} id={`lead-${card.id}`} aria-labelledby={`lead-${card.id}-name`}>
      <div className="card-head">
        <span className={`badge company ${card.businessKind === "front_desk" ? "review" : ""}`}>
          {card.businessKind === "front_desk" ? "Company not given" : card.businessName}
        </span>
        <span className={`badge ${intentClass}`}>{INTENT_LABEL[card.intent]}</span>
        {card.needsReview && <span className="badge review">Needs review</span>}
        <span className="who" id={`lead-${card.id}-name`}>
          {displayName(card)}
        </span>
        {place(card) && <span className="where">{place(card)}</span>}
        {source && <span className="meta">{source}</span>}
      </div>
      <div className="lines">
        {card.serviceWanted && (
          <div>
            <span>Wants</span> {card.serviceWanted}
            {card.propertyType && card.propertyType !== "unknown" ? ` (${card.propertyType})` : ""}
          </div>
        )}
        {card.timing && (
          <div>
            <span>Timing</span> {card.timing} <small className="meta">(requested, not promised)</small>
          </div>
        )}
        {(card.taskWindow ?? card.callbackWindow) && (
          <div>
            <span>Call back</span> {card.taskWindow ?? card.callbackWindow}
          </div>
        )}
        {card.summary && (
          <div>
            <span>Summary</span> {card.summary}
          </div>
        )}
      </div>
      <Flags card={card} />
      <div className="actions">
        {card.contactPhone && (
          <a className="btn primary" href={`tel:${card.contactPhone}`}>
            Call {firstName ?? formatUsPhone(card.contactPhone)}
          </a>
        )}
        {href && (
          <Link className="btn" href={href}>
            Details
          </Link>
        )}
        <span className={`window ${callWindow.ok ? "" : "closed"}`}>{callWindow.label}</span>
        {total !== undefined && total > 0 && (
          <span className="meta">
            {captured} of {total} details
          </span>
        )}
      </div>
    </article>
  );
}
