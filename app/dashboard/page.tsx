import Link from "next/link";
import { redirect } from "next/navigation";
import { LeadCardView } from "@/app/_components/lead-card";
import { orbState, Shell } from "@/app/_components/shell";
import { Icon, Notice, Orb, StatTile } from "@/app/_components/ui";
import { parseBusinessConfig } from "@/lib/business-rules/config";
import { callbackWindow } from "@/lib/business-rules/quiet-hours";
import { closureOn, isRingHours } from "@/lib/business-rules/routing";
import { leadQueue, primaryBusiness, quietLeads, todaySummary } from "@/lib/db/dashboard";
import { recentInboundSms } from "@/lib/db/screening";
import { isOperator } from "@/lib/server/auth";
import { AI_MODE_COPY, AI_MODES, consoleChrome } from "@/lib/server/console";
import { getDb } from "@/lib/server/db";
import { UUID } from "@/lib/server/forms";
import { formatUsPhone } from "@/lib/telephony/phone";

export const dynamic = "force-dynamic";

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; company?: string; view?: string }>;
}) {
  if (!(await isOperator())) redirect("/login");
  const params = await searchParams;
  const db = await getDb();
  const [business, chrome] = await Promise.all([primaryBusiness(db), consoleChrome(db)]);
  if (!business || !chrome) {
    return (
      <main className="wrap">
        <p className="empty">No business is configured yet. Run the seed or the setup wizard.</p>
      </main>
    );
  }
  const config = parseBusinessConfig(business.config);
  const now = new Date();
  const { companies } = chrome;
  const selected = params.company && UUID.test(params.company) ? companies.find((c) => c.businessId === params.company) : undefined;
  const [today, queue, quiet, texts] = await Promise.all([
    todaySummary(db, config.timezone, now),
    leadQueue(db, { businessId: selected?.businessId ?? null }),
    quietLeads(db),
    recentInboundSms(db),
  ]);
  const showQuiet = params.view === "quiet";
  const window = callbackWindow(now, config.timezone);
  const waiting = queue.filter((c) => c.openTaskId);
  const rest = queue.filter((c) => !c.openTaskId);
  const mode = AI_MODE_COPY[config.ai.mode];
  const closed = closureOn(config, now);
  const ringing = isRingHours(config, now);
  const owner = config.brand.ownerFirstName;
  const rightNow =
    config.ai.mode === "off"
      ? ringing
        ? `Calls ring ${owner}'s phone; missed callers leave a voicemail.`
        : "Callers leave a voicemail until the assistant is back on."
      : config.ai.mode === "always"
        ? `Every call is answered right away${ringing ? `, and callers can be put through to ${owner}` : ""}.`
        : ringing
          ? `${owner}'s phone rings first; the assistant catches what's missed.`
          : `Outside ${owner}'s hours: the assistant is answering.`;

  return (
    <Shell active="calls" chrome={chrome}>
      {params.error && <Notice tone="bad">{params.error}</Notice>}

      <section className="panel-card hero" aria-label="Phone assistant">
        <Orb state={orbState(config.ai.mode)} size="lg" />
        <div className="what">
          <b>
            {config.ai.mode === "off" ? null : <span className="live-dot" style={{ marginRight: 8, verticalAlign: 2 }} />}
            {mode.title}
          </b>
          <span>
            {closed ? `Closed today (${closed.label}). ` : ""}
            {rightNow}
          </span>
        </div>
        <form method="post" action="/api/admin/ai-mode" aria-label="Change who answers">
          <div className="seg" role="group" aria-label="Who answers">
            {AI_MODES.map((m) => (
              <button key={m} type="submit" name="mode" value={m} aria-pressed={config.ai.mode === m} title={AI_MODE_COPY[m].detail}>
                {AI_MODE_COPY[m].title}
              </button>
            ))}
          </div>
        </form>
      </section>

      <div className="page-head">
        <div className="grow">
          <h1>Who needs you now</h1>
          <p className="sub" style={{ margin: 0 }}>
            {waiting.length === 0
              ? "No one is waiting for a callback."
              : `${waiting.length} ${waiting.length === 1 ? "caller is" : "callers are"} waiting for a callback.`}{" "}
            <span className={`window ${window.ok ? "" : "closed"}`}>{window.label}.</span>
          </p>
        </div>
        <a className="btn" href="/api/leads/export" download>
          <Icon name="download" size={16} /> Download all calls
        </a>
      </div>

      {companies.length > 1 && (
        <nav className="seg" aria-label="Company" style={{ marginBottom: 16 }}>
          <Link href="/dashboard" aria-current={selected ? undefined : "page"}>
            All
          </Link>
          {companies.map((c) => (
            <Link key={c.businessId} href={`/dashboard?company=${c.businessId}`} aria-current={selected?.businessId === c.businessId ? "page" : undefined}>
              {c.kind === "front_desk" ? "Company not given" : c.name}
              {c.waiting > 0 && <b>{c.waiting}</b>}
            </Link>
          ))}
        </nav>
      )}

      <section className="today" aria-label="Today">
        <StatTile value={today.newLeads} label="New leads today" />
        <StatTile value={today.needCallback} label="Need a callback" />
        <StatTile value={today.hot} label="Ready to talk" tone="hot" />
        <StatTile value={today.transferred} label="Put through to you" />
        <StatTile value={today.ownerAnswered} label="You answered" />
        <StatTile value={today.notALead} label="Not a customer?" />
      </section>

      <h2>Waiting for you</h2>
      <section className="queue">
        {waiting.length === 0 ? (
          <p className="empty">
            <b>All caught up</b>
            New calls show up here within seconds of hanging up.
          </p>
        ) : (
          waiting.map((card) => <LeadCardView key={card.id} card={card} callWindow={window} href={`/leads/${card.id}`} />)
        )}
      </section>

      {quiet.length > 0 && (
        <>
          <h2 id="quiet">Looked like spam or left no details · last 7 days · {quiet.length}</h2>
          <p className="sub">
            These didn&apos;t text you; they&apos;re counted in your daily summary instead. A quick look catches anyone the assistant
            misjudged.{" "}
            {!showQuiet && <Link href="/dashboard?view=quiet#quiet">Show them</Link>}
          </p>
          {showQuiet && (
            <section className="queue">
              {quiet.map((card) => (
                <LeadCardView key={card.id} card={card} callWindow={window} href={`/leads/${card.id}`} />
              ))}
            </section>
          )}
        </>
      )}

      {texts.length > 0 && (
        <>
          <h2>Texts to your numbers</h2>
          <p className="sub">Kept so a verification code (e.g. from Google) is never lost. Nobody replies to these.</p>
          <ul className="texts">
            {texts.map((t) => (
              <li key={t.id}>
                <span>{t.body || "(empty)"}</span>
                <small>
                  from {formatUsPhone(t.fromE164)} · to {formatUsPhone(t.lineE164)} ·{" "}
                  {new Date(t.receivedAt).toLocaleString("en-US", { timeZone: config.timezone })}
                </small>
              </li>
            ))}
          </ul>
        </>
      )}

      {rest.length > 0 && (
        <>
          <h2>Recent</h2>
          <section className="queue">
            {rest.slice(0, 20).map((card) => (
              <LeadCardView key={card.id} card={card} callWindow={window} href={`/leads/${card.id}`} />
            ))}
          </section>
        </>
      )}
      {today.needsReview > 0 && (
        <p className="sub" style={{ marginTop: 20 }}>
          {today.needsReview} {today.needsReview === 1 ? "call needs" : "calls need"} a review of what the assistant said.
        </p>
      )}
    </Shell>
  );
}
