import Link from "next/link";
import { redirect } from "next/navigation";
import { LiveRefresh, SearchHotkey } from "@/app/_components/client";
import { LeadRow } from "@/app/_components/lead-row";
import { orbState, Shell } from "@/app/_components/shell";
import { Icon, Notice, Orb } from "@/app/_components/ui";
import { parseBusinessConfig } from "@/lib/business-rules/config";
import { callbackWindow } from "@/lib/business-rules/quiet-hours";
import { closureOn } from "@/lib/business-rules/routing";
import {
  inbox,
  INBOX_FILTERS,
  INBOX_SORTS,
  INBOX_VIEWS,
  primaryBusiness,
  todaySummary,
  type InboxFilter,
  type InboxSort,
  type InboxView,
  type LeadCard,
} from "@/lib/db/dashboard";
import { recentInboundSms } from "@/lib/db/screening";
import { isOperator } from "@/lib/server/auth";
import { AI_MODE_COPY, consoleChrome } from "@/lib/server/console";
import { getDb } from "@/lib/server/db";
import { UUID } from "@/lib/server/forms";
import { dayLabel } from "@/lib/server/inbox-labels";
import { formatUsPhone } from "@/lib/telephony/phone";

export const dynamic = "force-dynamic";

const VIEW_LABEL: Record<InboxView, string> = {
  waiting: "Waiting for a callback",
  followed_up: "Followed up",
  won: "Won",
  lost: "Not going ahead",
  noise: "Spam & hang-ups",
  all: "All calls",
};

const FILTER_LABEL: Record<InboxFilter, string> = {
  hot: "Ready to talk",
  site_visit: "Site visit",
  price: "Asked about price",
  business: "Business",
  returning: "Returning",
};

const SORT_LABEL: Record<InboxSort, string> = { priority: "Priority", newest: "Newest", oldest: "Oldest" };

const EMPTY: Record<InboxView, { title: string; text: string }> = {
  waiting: { title: "All caught up", text: "Nobody is waiting for a callback. New calls show up here about a minute after they hang up." },
  followed_up: { title: "Nothing here yet", text: "Callers you've called back show up here once you log what happened on their page." },
  won: { title: "No wins logged yet", text: "Mark a lead Won on its page, with the job amount, and it shows up here." },
  lost: { title: "Nothing here", text: "Leads marked “Not going ahead” show up here." },
  noise: { title: "No spam or hang-ups", text: "Robocalls and callers who hung up before saying anything land here, so a real customer is never lost in the list." },
  all: { title: "No calls yet", text: "Every call to your numbers shows up here." },
};

interface InboxParams {
  view: InboxView;
  q: string;
  f: InboxFilter[];
  sort: InboxSort;
  company: string | null;
}

/** The inbox's state lives in the address, so a filtered list can be bookmarked, shared, or reloaded. */
function readParams(raw: Record<string, string | undefined>, companyIds: string[]): InboxParams {
  // "quiet" is the old name for the spam tab, still linked from daily-summary emails.
  const asked = raw.view === "quiet" ? "noise" : raw.view;
  const view = INBOX_VIEWS.includes(asked as InboxView) ? (asked as InboxView) : "waiting";
  const f = (raw.f ?? "").split(",").filter((x): x is InboxFilter => INBOX_FILTERS.includes(x as InboxFilter));
  const sort = INBOX_SORTS.includes(raw.sort as InboxSort) ? (raw.sort as InboxSort) : view === "waiting" ? "priority" : "newest";
  const company = raw.company && UUID.test(raw.company) && companyIds.includes(raw.company) ? raw.company : null;
  return { view, q: (raw.q ?? "").slice(0, 100), f: [...new Set(f)], sort, company };
}

function href(p: InboxParams, change: Partial<InboxParams>): string {
  const next = { ...p, ...change };
  const qs = new URLSearchParams();
  if (next.view !== "waiting") qs.set("view", next.view);
  if (next.q) qs.set("q", next.q);
  if (next.f.length) qs.set("f", next.f.join(","));
  const defaultSort = next.view === "waiting" ? "priority" : "newest";
  if (next.sort !== defaultSort) qs.set("sort", next.sort);
  if (next.company) qs.set("company", next.company);
  const s = qs.toString();
  return s ? `/dashboard?${s}` : "/dashboard";
}

/** Consecutive leads under one day heading, when the list is in time order. */
function byDay(leads: LeadCard[], now: Date, timeZone: string): Array<{ label: string; leads: LeadCard[] }> {
  const groups: Array<{ label: string; leads: LeadCard[] }> = [];
  for (const lead of leads) {
    const label = dayLabel(new Date(lead.createdAt), now, timeZone);
    const last = groups.at(-1);
    if (last && last.label === label) last.leads.push(lead);
    else groups.push({ label, leads: [lead] });
  }
  return groups;
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!(await isOperator())) redirect("/login");
  const raw = await searchParams;
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
  const p = readParams(raw, companies.map((c) => c.businessId));
  const [today, list, texts] = await Promise.all([
    todaySummary(db, config.timezone, now),
    inbox(db, { view: p.view, filters: p.f, search: p.q, sort: p.sort, businessId: p.company }),
    recentInboundSms(db),
  ]);
  const window = callbackWindow(now, config.timezone);
  const closed = closureOn(config, now);
  const mode = AI_MODE_COPY[config.ai.mode];
  const showCompany = companies.length > 1 && !p.company;
  const narrowed = Boolean(p.q || p.f.length);
  const groups = p.sort === "priority" ? [{ label: "", leads: list.leads }] : byDay(list.leads, now, config.timezone);

  const kpis = [
    { label: "Waiting for a callback", value: today.needCallback, to: href(p, { view: "waiting", f: [], q: "" }), tone: "hot", current: p.view === "waiting" && !narrowed },
    { label: "New leads today", value: today.newLeads, to: href(p, { view: "all", sort: "newest", f: [], q: "" }), tone: "", current: false },
    { label: "Ready to talk today", value: today.hot, to: href(p, { view: "all", sort: "newest", f: ["hot"], q: "" }), tone: "hot", current: false },
    { label: "Spam & hang-ups today", value: today.notALead, to: href(p, { view: "noise", f: [], q: "" }), tone: "", current: p.view === "noise" && !narrowed },
  ];

  return (
    <Shell active="calls" chrome={chrome}>
      <LiveRefresh seconds={30} />
      <SearchHotkey inputId="inbox-search" />
      {raw.error && <Notice tone="bad">{raw.error}</Notice>}
      {raw.notice && <Notice tone="ok">{raw.notice}</Notice>}

      <div className="page-head">
        <div className="grow">
          <h1>Calls</h1>
          <p className="sub" style={{ marginTop: 6 }}>
            <span className="assistant-line">
              <Orb state={orbState(config.ai.mode)} size="sm" />
              <span>
                {mode.title}
                {config.ai.mode !== "off" ? (config.transfer.enabled ? " · callers can ask to be put through" : " · callbacks only, no transfers") : ""}
              </span>
              <span className="sep">·</span>
              <span className={`window ${window.ok ? "" : "closed"}`}>
                {closed ? `Closed today (${closed.label}). ` : ""}
                {window.label}
              </span>
              <span className="sep">·</span>
              <Link href="/settings#answering">Change</Link>
            </span>
          </p>
        </div>
        <a className="btn" href="/api/leads/export" download aria-label="Export all calls" title="Download all calls as a spreadsheet">
          <Icon name="download" size={16} /> <span className="hide-sm">Export</span>
        </a>
      </div>

      <section className="kpis" aria-label="Today">
        {kpis.map((k) => (
          <Link key={k.label} href={k.to} className={`kpi${k.value === 0 ? " zero" : k.tone ? ` ${k.tone}` : ""}`} aria-current={k.current ? "true" : undefined}>
            <span>{k.label}</span>
            <b>{k.value}</b>
          </Link>
        ))}
      </section>

      <section className="inbox" aria-label="Calls">
        <nav className="tabs" aria-label="Which calls">
          {INBOX_VIEWS.map((v) => (
            <Link key={v} href={href(p, { view: v, sort: v === "waiting" ? "priority" : "newest" })} className={`tab${v === "waiting" && list.counts.waiting > 0 ? " urgent" : ""}`} aria-current={p.view === v ? "page" : undefined}>
              {VIEW_LABEL[v]}
              <span className="n">{list.counts[v]}</span>
            </Link>
          ))}
        </nav>

        <div className="toolbar">
          <form className="search" role="search" action="/dashboard" method="get">
            <Icon name="search" size={16} />
            <label className="sr-only" htmlFor="inbox-search">
              Search calls
            </label>
            <input id="inbox-search" type="search" name="q" defaultValue={p.q} placeholder="Search name, phone, address…" autoComplete="off" />
            {p.view !== "waiting" && <input type="hidden" name="view" value={p.view} />}
            {p.f.length > 0 && <input type="hidden" name="f" value={p.f.join(",")} />}
            {p.company && <input type="hidden" name="company" value={p.company} />}
            {p.q ? (
              <Link className="clear" href={href(p, { q: "" })} aria-label="Clear search">
                Clear
              </Link>
            ) : (
              <kbd aria-hidden="true">/</kbd>
            )}
          </form>

          <div className="chips" role="group" aria-label="Filters">
            {INBOX_FILTERS.map((f) => {
              const on = p.f.includes(f);
              return (
                <Link key={f} className="chip" aria-pressed={on} href={href(p, { f: on ? p.f.filter((x) => x !== f) : [...p.f, f] })}>
                  {FILTER_LABEL[f]}
                </Link>
              );
            })}
            {companies.length > 1 &&
              companies.map((c) => (
                <Link key={c.businessId} className="chip" aria-pressed={p.company === c.businessId} href={href(p, { company: p.company === c.businessId ? null : c.businessId })}>
                  {c.kind === "front_desk" ? "Company not given" : c.name}
                </Link>
              ))}
          </div>

          <div className="sort">
            <span>Sort</span>
            <nav className="seg" aria-label="Sort">
              {INBOX_SORTS.map((s) => (
                <Link key={s} href={href(p, { sort: s })} aria-current={p.sort === s ? "true" : undefined}>
                  {SORT_LABEL[s]}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        {list.leads.length === 0 ? (
          <div className="empty">
            <Icon name={narrowed ? "search" : "inbox"} size={28} />
            {narrowed ? (
              <>
                <b>No calls match</b>
                {p.q ? `Nothing for “${p.q}”` : "Nothing with those filters"} in {VIEW_LABEL[p.view].toLowerCase()}.{" "}
                <Link href={href(p, { q: "", f: [] })}>Clear search and filters</Link>
                {p.view !== "all" && (
                  <>
                    {" "}
                    or <Link href={href(p, { view: "all", sort: "newest" })}>look in all calls</Link>
                  </>
                )}
                .
              </>
            ) : (
              <>
                <b>{EMPTY[p.view].title}</b>
                {EMPTY[p.view].text}
              </>
            )}
          </div>
        ) : (
          groups.map((g) => (
            <div key={g.label || "all"}>
              {g.label && (
                <div className="group-head">
                  {g.label} <span className="n">{g.leads.length}</span>
                </div>
              )}
              <ul className="lead-list">
                {g.leads.map((card) => (
                  <LeadRow key={card.id} card={card} now={now} timeZone={config.timezone} showCompany={showCompany} />
                ))}
              </ul>
            </div>
          ))
        )}
        {list.truncated && <p className="list-foot">Showing the first {list.leads.length}. Search or filter to find someone further back.</p>}
      </section>

      {texts.length > 0 && (
        <details className="panel" style={{ marginTop: 20 }}>
          <summary>
            <Icon name="message" size={16} /> Texts to your numbers ({texts.length})
          </summary>
          <p className="sub">Kept so a verification code (e.g. from Google) is never lost. Nobody replies to these.</p>
          <ul className="texts">
            {texts.map((t) => (
              <li key={t.id}>
                <span>{t.body || "(empty)"}</span>
                <small>
                  from {formatUsPhone(t.fromE164)} · to {formatUsPhone(t.lineE164)} · {new Date(t.receivedAt).toLocaleString("en-US", { timeZone: config.timezone })}
                </small>
              </li>
            ))}
          </ul>
        </details>
      )}
      {today.needsReview > 0 && (
        <p className="sub" style={{ marginTop: 16 }}>
          {today.needsReview} {today.needsReview === 1 ? "call needs" : "calls need"} a look at what the assistant said: they're tagged “Check what was said”.
        </p>
      )}
    </Shell>
  );
}
