import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { displayName, LeadCardView } from "@/app/_components/lead-card";
import { Shell } from "@/app/_components/shell";
import { callbackBrief } from "@/lib/agents/callback-brief";
import { Icon, Notice } from "@/app/_components/ui";
import { callbackName, parseBusinessConfig } from "@/lib/business-rules/config";
import { callbackWindow } from "@/lib/business-rules/quiet-hours";
import { businessById, leadDetail, officeBusinesses, primaryBusiness } from "@/lib/db/dashboard";
import { findBlock } from "@/lib/db/screening";
import { isOperator } from "@/lib/server/auth";
import { consoleChrome } from "@/lib/server/console";
import { getDb } from "@/lib/server/db";
import { UUID } from "@/lib/server/forms";
import { EVENT_LABEL, FIELD_LABEL, SOURCE_LABEL } from "@/lib/server/labels";

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
  const block = await findBlock(db, business.tenantId, card.contactPhone);
  const chrome = await consoleChrome(db);
  if (!chrome) notFound();
  const brief = callbackBrief(detail, config.brand.ownerFirstName, config.brand.spokenName, {
    callback: callbackName(config),
    propertyLines: config.intake.includes("maps_visible"),
  });

  return (
    <Shell active="calls" chrome={chrome}>
      <div className="page-head">
        <div className="grow">
          <Link href="/dashboard" className="eyebrow">
            <Icon name="back" size={15} /> All calls
          </Link>
          <h1>{displayName(card)}</h1>
          <p className="sub" style={{ margin: 0 }}>
            {config.brand.spokenName} · first contact {time(card.createdAt, tz)} · status {card.state}
          </p>
        </div>
        <Link className="btn ghost sm" href={engineering ? `/leads/${id}` : `/leads/${id}?eng=1`}>
          {engineering ? "Hide technical detail" : "Technical detail"}
        </Link>
      </div>

      {error && <Notice tone="bad">{error}</Notice>}
      {notice && <Notice tone="ok">{notice}</Notice>}

      <LeadCardView card={card} callWindow={callbackWindow(new Date(), tz)} />

      {companies.length > 0 && (
        <>
          <h2>Which company is this for?</h2>
          <p className="sub">The caller didn&apos;t say. Pick one and the lead moves there, with everything on it.</p>
          <form className="outcomes" method="post" action={`/api/leads/${id}/company`}>
            {companies.map((c) => (
              <button key={c.businessId} type="submit" name="business" value={c.businessId}>
                {c.name}
              </button>
            ))}
          </form>
        </>
      )}

      <section className="panel-card brief" aria-labelledby="h-brief">
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
              <p className="meta" style={{ margin: 0 }}>{brief.missing.join(" · ")}</p>
            </div>
          )}
        </div>
      </section>

      <div className="actions" style={{ margin: "14px 0" }}>
        <form method="post" action={`/api/leads/${id}/call`}>
          {/* Rings Amy first, then the customer, showing the number they called. */}
          <button className="btn primary" type="submit">
            <Icon name="outgoing" size={16} /> Call back from the business number
          </button>
        </form>
        {card.contactPhone && (
          <form method="post" action={`/api/leads/${id}/block`}>
            <button className={`btn ${block?.kind === "manual" ? "" : "ghost danger"}`} type="submit" name="action" value={block?.kind === "manual" ? "unblock" : "block"}>
              <Icon name="ban" size={16} /> {block?.kind === "manual" ? "Unblock this number" : "Block this number"}
            </button>
          </form>
        )}
      </div>
      {block?.kind === "auto" && (
        <form method="post" action={`/api/leads/${id}/block`} className="sub">
          The assistant flagged this number as spam, so for now it has to press 1 before reaching the assistant.{" "}
          <button className="btn" type="submit" name="action" value="unblock">
            Not spam: clear the flag
          </button>
        </form>
      )}

      <h2>Log what happened</h2>
      <form className="outcomes" method="post" action={`/api/leads/${id}/outcome`}>
        {OUTCOMES.map(([value, label]) => (
          <button key={value} type="submit" name="to" value={value}>
            {label}
          </button>
        ))}
        <input type="text" name="amount" inputMode="decimal" placeholder="$ amount" aria-label="Job amount in dollars" />
        <button type="submit" name="to" value="won">
          Won
        </button>
      </form>

      <h2>What we know</h2>
      {currentFacts.length === 0 ? (
        <p className="empty">The caller didn't share details yet.</p>
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

      <h2>What happened</h2>
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

      {detail.sessions.some((s) => s.transcript?.length) && (
        <>
          <h2>Conversation</h2>
          {detail.sessions.map((s) =>
            s.transcript?.length ? (
              <details key={s.id} className="panel" open={s.id === detail.sessions[detail.sessions.length - 1]?.id}>
                <summary>
                  <Icon name="message" size={16} /> Assistant · {time(s.startedAt, tz)} · {s.transcript.length} turns
                </summary>
                <div className="chat">
                  {s.transcript
                    .filter((t) => t.message)
                    .map((t, i) => (
                      <p key={i} className={`bubble ${t.role === "agent" ? "agent" : "caller"}`}>
                        <small>{t.role === "agent" ? "Assistant" : "Caller"}</small>
                        {t.message}
                      </p>
                    ))}
                </div>
              </details>
            ) : null,
          )}
        </>
      )}

      {engineering && (
        <>
          <h2>Tool calls</h2>
          {detail.tools.length === 0 ? (
            <p className="empty">No tool calls.</p>
          ) : (
            <details className="panel" open>
              <summary>{detail.tools.length} calls</summary>
              {detail.tools.map((t, i) => (
                <div key={i} className="turn">
                  <b>
                    {t.toolName} · {t.outcome}
                    {t.latencyMs !== null ? ` · ${t.latencyMs} ms` : ""}
                  </b>
                  <pre className="raw">{JSON.stringify({ input: t.input, output: t.output }, null, 2)}</pre>
                </div>
              ))}
            </details>
          )}
          <h2>Incidents</h2>
          {detail.incidents.length === 0 ? (
            <p className="empty">None.</p>
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
        </>
      )}
    </Shell>
  );
}
