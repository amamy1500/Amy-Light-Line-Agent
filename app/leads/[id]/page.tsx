import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CopyButton } from "@/app/_components/client";
import { displayName } from "@/app/_components/lead-card";
import { Shell } from "@/app/_components/shell";
import { Icon, Notice } from "@/app/_components/ui";
import { callbackBrief } from "@/lib/agents/callback-brief";
import { callbackCaller, parseBusinessConfig } from "@/lib/business-rules/config";
import { callbackWindow } from "@/lib/business-rules/quiet-hours";
import { callbackTarget } from "@/lib/db/callback";
import { businessById, leadDetail, officeBusinesses, primaryBusiness } from "@/lib/db/dashboard";
import { findBlock } from "@/lib/db/screening";
import { isOperator } from "@/lib/server/auth";
import { consoleChrome } from "@/lib/server/console";
import { getDb } from "@/lib/server/db";
import { UUID } from "@/lib/server/forms";
import { CHANNEL_LABEL, EVENT_LABEL, FIELD_LABEL, INTENT_LABEL, SOURCE_LABEL } from "@/lib/server/labels";
import { isPlaceholderNumber } from "@/lib/server/readiness";
import { formatUsPhone } from "@/lib/telephony/phone";

export const dynamic = "force-dynamic";

const time = (d: Date, tz: string) =>
  new Date(d).toLocaleString("en-US", { timeZone: tz, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const OUTCOMES = [
  ["attempted", "Left a voicemail"],
  ["connected", "Talked"],
  ["quoted", "Quoted"],
  ["booked", "Booked"],
  ["lost", "Not going ahead"],
  ["spam", "Not a customer"],
] as const;

/** Where the lead stands, as the header's status badge says it. */
const STATE_LABEL: Record<string, string> = {
  attempted: "Left a voicemail",
  connected: "Talked",
  qualified: "Talked",
  quoted: "Quoted",
  booked: "Booked",
  won: "Won",
  lost: "Not going ahead",
  spam: "Not a customer",
  duplicate: "Duplicate",
};

export default async function LeadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ eng?: string; error?: string; notice?: string }>;
}) {
  if (!(await isOperator())) redirect("/login");
  const { id } = await params;
  const { eng, error, notice } = await searchParams;
  if (!UUID.test(id)) notFound();
  const db = await getDb();
  const detail = await leadDetail(db, id);
  if (!detail) notFound();
  // The lead's own company decides the labels and time zone; the office's first company is the fallback.
  const business = (await businessById(db, detail.card.businessId)) ?? (await primaryBusiness(db));
  if (!business) notFound();
  const config = parseBusinessConfig(business.config);
  const companies =
    detail.card.businessKind === "front_desk" ? (await officeBusinesses(db)).filter((c) => c.kind === "company") : [];
  const tz = config.timezone;
  const engineering = eng === "1";
  const { card } = detail;
  const currentFacts = detail.facts.filter((f) => f.current);
  const olderFacts = detail.facts.filter((f) => !f.current);
  const [block, chrome, target] = await Promise.all([findBlock(db, business.tenantId, card.contactPhone), consoleChrome(db), callbackTarget(db, id)]);
  if (!chrome) notFound();
  const brief = callbackBrief(detail, config.brand.ownerFirstName, config.brand.spokenName, {
    callback: callbackCaller(config),
    propertyLines: config.intake.includes("maps_visible"),
  });
  const name = displayName(card);
  const firstName = card.contactName?.split(/\s+/)[0];
  const phone = target?.customerPhone ?? card.contactPhone;
  const window = callbackWindow(new Date(), tz);
  // Never dial a stand-in number: until the owner's real cell is in Settings, the business-number callback is off.
  const ownerConnected = Boolean(target && !isPlaceholderNumber(target.ownerPhone));
  const status = STATE_LABEL[card.state] ?? INTENT_LABEL[card.intent];
  const statusTone = card.state === "won" ? "ok" : card.state === "new" ? (card.intent === "hot" ? "hot" : card.intent === "warm" ? "warm" : "") : "";
  const mapsLink = card.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(card.address)}` : null;
  const sessions = detail.sessions.filter((s) => s.transcript?.length);

  return (
    <Shell active="calls" chrome={chrome} className="has-call-bar">
      <header className="lead-head">
        <Link href="/dashboard" className="eyebrow">
          <Icon name="back" size={15} /> Calls
        </Link>
        <div className="lead-title">
          <h1>{name}</h1>
          <span className={`badge ${statusTone}`}>{status}</span>
          {card.needsReview && <span className="badge bad">Check what was said</span>}
          {card.mapsVisible === "no" && <span className="badge info">Site visit to set up</span>}
          {card.openTaskId && <span className="badge">Callback due: {card.taskWindow ?? card.callbackWindow ?? "any time"}</span>}
        </div>
        <div className="lead-meta">
          {phone && (
            <span className="num">
              <Icon name="phone" size={14} /> {formatUsPhone(phone)}
            </span>
          )}
          {card.address && (
            <span>
              <Icon name="pin" size={14} /> {card.address}
            </span>
          )}
          <span>
            {card.businessKind === "front_desk" ? "Company not given" : card.businessName}
            {card.channel ? ` · ${CHANNEL_LABEL[card.channel]}` : ""}
          </span>
          <span>
            First call {time(card.createdAt, tz)}
            {card.callCount > 1 ? ` · ${card.callCount} calls` : ""}
          </span>
        </div>
        <div className="lead-actions">
          {phone && (
            <a className="btn primary" href={`tel:${phone}`}>
              <Icon name="phone" size={16} /> Call {firstName ?? formatUsPhone(phone)}
            </a>
          )}
          {phone && <CopyButton text={formatUsPhone(phone)} label="Copy number" />}
          {mapsLink && (
            <a className="btn" href={mapsLink} target="_blank" rel="noreferrer">
              <Icon name="pin" size={16} /> Open in Google Maps
            </a>
          )}
          {ownerConnected ? (
            <form method="post" action={`/api/leads/${id}/call`}>
              {/* Rings Amy first, then the customer, showing the number they called. */}
              <button className="btn" type="submit" title="Your phone rings first, then we connect the customer showing the business number">
                <Icon name="outgoing" size={16} /> Call from the business number
              </button>
            </form>
          ) : (
            <span className="btn" aria-disabled="true" style={{ opacity: 0.55, cursor: "not-allowed" }} title="Add your cell under Settings → Owner & ring phone to use this">
              <Icon name="outgoing" size={16} /> Call from the business number
            </span>
          )}
          <span className="grow" />
          <Link className="btn ghost sm" href={engineering ? `/leads/${id}` : `/leads/${id}?eng=1`}>
            {engineering ? "Hide technical detail" : "Technical detail"}
          </Link>
        </div>
        <span className={`window ${window.ok ? "" : "closed"}`}>{window.label}</span>
      </header>

      {error && <Notice tone="bad">{error}</Notice>}
      {notice && <Notice tone="ok">{notice}</Notice>}

      {companies.length > 0 && (
        <section className="block" style={{ marginBottom: 16 }}>
          <h2>Which company is this for?</h2>
          <p className="sub" style={{ marginBottom: 12 }}>
            The caller didn&apos;t say. Pick one and the lead moves there, with everything on it.
          </p>
          <form className="outcomes" method="post" action={`/api/leads/${id}/company`}>
            {companies.map((c) => (
              <button key={c.businessId} type="submit" name="business" value={c.businessId}>
                {c.name}
              </button>
            ))}
          </form>
        </section>
      )}

      <div className="lead-grid">
        <div className="col">
          <section className="block brief" aria-labelledby="h-brief">
            <h3 id="h-brief">
              <Icon name="sparkle" size={16} /> Before you call
            </h3>
            {brief.opener && (
              <p className="bubble agent opener">
                <small>Try opening with</small>
                {brief.opener}
              </p>
            )}
            <dl className="lead-sheet">
              {brief.sheet.map((line) => (
                <div key={line.label}>
                  <dt>{line.label}</dt>
                  <dd>{line.value}</dd>
                </div>
              ))}
            </dl>
            <div className="brief-grid">
              {brief.careful.length > 0 && (
                <div>
                  <h4>Heads-up</h4>
                  <ul>
                    {brief.careful.map((line) => (
                      <li key={line} className={brief.doNotContact && line === brief.careful[0] ? "stop" : undefined}>
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {brief.asked.length > 0 && (
                <div>
                  <h4>They asked you</h4>
                  <ul>
                    {brief.asked.map((q) => (
                      <li key={q}>“{q}”</li>
                    ))}
                  </ul>
                </div>
              )}
              {brief.told.length > 0 && (
                <div>
                  <h4>They also told us</h4>
                  <dl>
                    {brief.told.map((t) => (
                      <div key={t.label}>
                        <dt>{t.label}</dt>
                        <dd>{t.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
              {brief.missing.length > 0 && (
                <div>
                  <h4>Still worth asking</h4>
                  <p className="meta" style={{ margin: 0 }}>
                    {brief.missing.join(" · ")}
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="block" aria-labelledby="h-conversation">
            <h2 id="h-conversation">
              <Icon name="message" size={15} /> Conversation
            </h2>
            {sessions.length === 0 ? (
              <p className="meta" style={{ margin: 0 }}>
                {card.compliance.recordingDeclined ? "The caller asked not to be recorded, so there's no transcript." : "No conversation saved for this lead."}
              </p>
            ) : (
              sessions.map((s, n) => (
                <details key={s.id} className="panel" open={n === sessions.length - 1}>
                  <summary>
                    Assistant · {time(s.startedAt, tz)} · {s.transcript!.length} turns
                  </summary>
                  <div className="chat">
                    {s.transcript!
                      .filter((t) => t.message)
                      .map((t, i) => (
                        <p key={i} className={`bubble ${t.role === "agent" ? "agent" : "caller"}`}>
                          <small>{t.role === "agent" ? "Assistant" : "Caller"}</small>
                          {t.message}
                        </p>
                      ))}
                  </div>
                </details>
              ))
            )}
          </section>

          <section className="block" aria-labelledby="h-history">
            <h2 id="h-history">
              <Icon name="history" size={15} /> What happened
            </h2>
            <ol className="timeline">
              {detail.timeline
                .filter((e) => engineering || EVENT_LABEL[e.type])
                .map((e) => (
                  <li key={e.id}>
                    <time dateTime={new Date(e.occurredAt).toISOString()}>{time(e.occurredAt, tz)}</time>
                    {EVENT_LABEL[e.type] ?? e.type}
                    {engineering && <small className="meta"> · {e.actorType}</small>}
                  </li>
                ))}
            </ol>
          </section>

          {engineering && (
            <section className="block">
              <h2>Tool calls</h2>
              {detail.tools.length === 0 ? (
                <p className="meta">No tool calls.</p>
              ) : (
                detail.tools.map((t, i) => (
                  <div key={i} className="turn">
                    <b>
                      {t.toolName} · {t.outcome}
                      {t.latencyMs !== null ? ` · ${t.latencyMs} ms` : ""}
                    </b>
                    <pre className="raw">{JSON.stringify({ input: t.input, output: t.output }, null, 2)}</pre>
                  </div>
                ))
              )}
              <h2>Incidents</h2>
              {detail.incidents.length === 0 ? (
                <p className="meta">None.</p>
              ) : (
                <ul>
                  {detail.incidents.map((inc, i) => (
                    <li key={i}>
                      {inc.severity} · {inc.kind} · {time(inc.createdAt, tz)}
                    </li>
                  ))}
                </ul>
              )}
              <h2>Calls</h2>
              <pre className="raw">{JSON.stringify(detail.calls, null, 2)}</pre>
            </section>
          )}
        </div>

        <aside className="col side">
          <section className="block" aria-labelledby="h-outcome">
            <h2 id="h-outcome">Log what happened</h2>
            <form method="post" action={`/api/leads/${id}/outcome`}>
              <div className="outcome-grid">
                {OUTCOMES.map(([value, label]) => (
                  <button key={value} type="submit" name="to" value={value}>
                    {label}
                  </button>
                ))}
              </div>
            </form>
            <form method="post" action={`/api/leads/${id}/outcome`} className="won-row">
              <input type="hidden" name="to" value="won" />
              <input className="field" type="text" name="amount" inputMode="decimal" placeholder="$ job amount" aria-label="Job amount in dollars" />
              <button className="btn" type="submit">
                Won
              </button>
            </form>
            <p className="meta" style={{ margin: "10px 0 0" }}>
              Logging an outcome closes the callback, so the lead leaves “Waiting”.
            </p>
          </section>

          <section className="block" aria-labelledby="h-facts">
            <h2 id="h-facts">What we know</h2>
            {currentFacts.length === 0 ? (
              <p className="meta" style={{ margin: 0 }}>
                The caller didn&apos;t share details yet.
              </p>
            ) : (
              <table className="facts">
                <tbody>
                  {currentFacts.map((f) => (
                    <tr key={`${f.field}-${f.value}`}>
                      <th scope="row">{FIELD_LABEL[f.field]}</th>
                      <td>
                        {f.value}
                        <small>{SOURCE_LABEL[f.source]}</small>
                      </td>
                    </tr>
                  ))}
                  {engineering &&
                    olderFacts.map((f, i) => (
                      <tr key={`old-${i}`} className="old">
                        <th scope="row">{FIELD_LABEL[f.field]}</th>
                        <td>
                          {f.value}
                          <small>{SOURCE_LABEL[f.source]} · replaced</small>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </section>

          {card.contactPhone && (
            <section className="block" aria-labelledby="h-block">
              <h2 id="h-block">Spam</h2>
              <form method="post" action={`/api/leads/${id}/block`}>
                <button className={`btn block ${block?.kind === "manual" ? "" : "ghost danger"}`} type="submit" name="action" value={block?.kind === "manual" ? "unblock" : "block"}>
                  <Icon name="ban" size={16} /> {block?.kind === "manual" ? "Unblock this number" : "Block this number"}
                </button>
              </form>
              {block?.kind === "auto" && (
                <form method="post" action={`/api/leads/${id}/block`} className="sub">
                  The assistant flagged this number as spam, so for now it has to press 1 before reaching the assistant.{" "}
                  <button className="btn sm" type="submit" name="action" value="unblock">
                    Not spam: clear the flag
                  </button>
                </form>
              )}
            </section>
          )}
        </aside>
      </div>

      {phone && (
        <div className="call-bar">
          <a className="btn primary" href={`tel:${phone}`}>
            <Icon name="phone" size={16} /> Call {firstName ?? formatUsPhone(phone)}
          </a>
          {mapsLink && (
            <a className="btn" href={mapsLink} target="_blank" rel="noreferrer" aria-label="Open the address in Google Maps">
              <Icon name="pin" size={16} />
            </a>
          )}
        </div>
      )}
    </Shell>
  );
}
