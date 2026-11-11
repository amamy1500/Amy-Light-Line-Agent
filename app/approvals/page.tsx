import Link from "next/link";
import { redirect } from "next/navigation";
import { SearchHotkey } from "@/app/_components/client";
import { Shell } from "@/app/_components/shell";
import { Icon, Notice } from "@/app/_components/ui";
import { consoleChrome } from "@/lib/server/console";
import { listKnowledge, type StoredKnowledgeItem } from "@/lib/db/knowledge";
import { productionAction, queueCategory, type Brand, type QueueCategory } from "@/lib/knowledge/model";
import { isOperator } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { UUID } from "@/lib/server/forms";

export const dynamic = "force-dynamic";

const BRAND: Record<Brand, string> = {
  clg: "Christmas Light Guys site",
  tlg: "The Light Guys site",
  sp: "Sublime Patio site",
  tf: "The Fridge site",
  policy: "Proposed by Lightline",
};

const SECTION: Record<QueueCategory, { title: string; lead: string }> = {
  conflict: { title: "The sites disagree", lead: "The assistant says neither version. Tell it what is true." },
  exact_words: { title: "Needs your exact words", lead: "Only one source says it, or it touches money, dates or coverage." },
  quick_confirm: { title: "Both sites agree", lead: "Low risk. Still held until you confirm the words." },
  question_bank: {
    title: "Questions customers ask, answer once",
    lead: "When you have a minute. Fill in or strike the [brackets] in your own words; until then the assistant says you'll cover it on the callback.",
  },
};

function ItemCard({ item, error }: { item: StoredKnowledgeItem; error?: string }) {
  const decided = item.status !== "pending";
  return (
    <article className={`card ${queueCategory(item) === "conflict" && !decided ? "hot" : ""}`} id={`item-${item.key}`}>
      <div className="card-head">
        <span className="who">{item.title}</span>
        {decided && <span className={`badge ${item.status === "approved" ? "" : "review"}`}>{item.status === "approved" ? "Approved" : "Never say"}</span>}
      </div>
      {error && <Notice tone="bad">{error} Nothing was changed.</Notice>}
      <table className="facts">
        <tbody>
          {item.claims.map((c, i) => (
            <tr key={i}>
              <th scope="row">{BRAND[c.brand]}</th>
              <td>
                “{c.quote}”
                {c.sourceUrl && (
                  <small>
                    <a href={c.sourceUrl} target="_blank" rel="noreferrer">
                      source
                    </a>
                    {c.siteFactId ? ` · ${c.siteFactId}` : ""}
                  </small>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="lines">
        <div>
          <span>If asked</span> “{item.callerQuestion}”
        </div>
        <div>
          <span>Assistant now</span> {productionAction(item)}
        </div>
        {item.status === "approved" && (
          <div>
            <span>Your words</span> “{item.approvedText ?? item.approvedValue?.cities?.join(", ")}”
            <small className="meta"> · {item.decidedBy}</small>
          </div>
        )}
      </div>
      {decided ? (
        <form method="post" action={`/api/approvals/${item.id}`} className="actions">
          <input type="hidden" name="status" value="pending" />
          <button className="btn" type="submit">
            Undo
          </button>
        </form>
      ) : (
        <form method="post" action={`/api/approvals/${item.id}`} style={{ display: "grid", gap: 8 }}>
          {item.kind === "service_area" ? (
            <>
              <label className="meta" htmlFor={`cities-${item.key}`}>
                Cities you serve, comma-separated
              </label>
              <input id={`cities-${item.key}`} name="cities" className="field" placeholder="Austin, Round Rock, …" />
              <label className="meta" htmlFor={`zips-${item.key}`}>
                ZIP codes (optional)
              </label>
              <input id={`zips-${item.key}`} name="zips" className="field" placeholder="78701, 78734, …" />
            </>
          ) : (
            <>
              <label className="meta" htmlFor={`text-${item.key}`}>
                What the assistant may say, word for word
              </label>
              <textarea id={`text-${item.key}`} name="text" rows={2} className="field" defaultValue={item.suggestedText ?? ""} placeholder="Your exact words…" maxLength={400} />
            </>
          )}
          <div className="actions">
            <button className="btn primary" type="submit" name="status" value="approved">
              {item.kind === "service_area" ? "Approve this area" : "Approve these words"}
            </button>
            <button className="btn" type="submit" name="status" value="rejected">
              Never say this
            </button>
          </div>
        </form>
      )}
    </article>
  );
}

type Tab = "needs" | "questions" | "decided";
const TAB_LABEL: Record<Tab, string> = { needs: "Needs you", questions: "Common questions", decided: "Decided" };

/** Words a search can match on a card: its title, what callers ask, and the words on file or suggested. */
function matches(item: StoredKnowledgeItem, q: string): boolean {
  if (!q) return true;
  return [item.title, item.callerQuestion, item.suggestedText, item.approvedText].some((t) => t?.toLowerCase().includes(q));
}

export default async function Approvals({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; business?: string; failed?: string; tab?: string; q?: string }>;
}) {
  if (!(await isOperator())) redirect("/login");
  const { error, business: requested, failed, tab: askedTab, q: rawQ } = await searchParams;
  const errorFor = (key: string) => (failed === key ? error : undefined);
  const db = await getDb();
  // Each company has its own facts; the shared line has none to approve.
  const chrome = await consoleChrome(db);
  if (!chrome) redirect("/dashboard");
  const companies = chrome.companies.filter((c) => c.kind === "company");
  const business =
    (requested && UUID.test(requested) ? companies.find((c) => c.businessId === requested) : undefined) ?? companies[0];
  if (!business) redirect("/dashboard");
  const counts = await Promise.all(
    companies.map(async (c) => (await listKnowledge(db, c.businessId)).filter((i) => i.status === "pending" && queueCategory(i) !== "question_bank").length),
  );
  const items = await listKnowledge(db, business.businessId);
  const q = (rawQ ?? "").trim().toLowerCase().slice(0, 100);
  const pending = items.filter((i) => i.status === "pending");
  const byTab: Record<Tab, StoredKnowledgeItem[]> = {
    needs: pending.filter((i) => queueCategory(i) !== "question_bank"),
    questions: pending.filter((i) => queueCategory(i) === "question_bank"),
    decided: items.filter((i) => i.status !== "pending"),
  };
  // A card that just failed to save is shown on its own tab; otherwise open where the work is.
  const failedTab = failed ? (Object.keys(byTab) as Tab[]).find((t) => byTab[t].some((i) => i.key === failed)) : undefined;
  const tab: Tab =
    askedTab === "needs" || askedTab === "questions" || askedTab === "decided" ? askedTab : (failedTab ?? (byTab.needs.length ? "needs" : "questions"));
  const shown = byTab[tab].filter((i) => matches(i, q));
  const link = (change: { tab?: Tab; q?: string }) => {
    const qs = new URLSearchParams();
    if (companies.length > 1) qs.set("business", business.businessId);
    qs.set("tab", change.tab ?? tab);
    const nextQ = change.q ?? rawQ ?? "";
    if (nextQ) qs.set("q", nextQ);
    return `/approvals?${qs.toString()}`;
  };

  return (
    <Shell active="approvals" chrome={chrome}>
      {error && !failed && <Notice tone="bad">{error}</Notice>}
      {companies.length > 1 && (
        <nav className="seg" aria-label="Company" style={{ marginBottom: 18 }}>
          {companies.map((c, i) => (
            <Link key={c.businessId} href={`/approvals?business=${c.businessId}`} aria-current={c.businessId === business.businessId ? "page" : undefined}>
              {c.name}
              {counts[i]! > 0 && <b>{counts[i]}</b>}
            </Link>
          ))}
        </nav>
      )}
      <div className="page-head">
        <div className="grow">
          <h1>What the assistant may say</h1>
          <p className="sub">
            About {business.name}. It says nothing here until you approve the exact words, and approvals reach the next call right away.
          </p>
        </div>
      </div>

      <section className="inbox" style={{ marginBottom: 16 }}>
        <nav className="tabs" aria-label="Which answers">
          {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
            <Link key={t} href={link({ tab: t })} className={`tab${t === "needs" && byTab.needs.length > 0 ? " urgent" : ""}`} aria-current={tab === t ? "page" : undefined}>
              {TAB_LABEL[t]}
              <span className="n">{byTab[t].length}</span>
            </Link>
          ))}
        </nav>
        <div className="toolbar" style={{ borderBottom: 0 }}>
          <form className="search" role="search" action="/approvals" method="get">
            <Icon name="search" size={16} />
            <label className="sr-only" htmlFor="answers-search">
              Search answers
            </label>
            <input id="answers-search" type="search" name="q" defaultValue={rawQ ?? ""} placeholder="Search, e.g. price, storage, permanent…" autoComplete="off" />
            <input type="hidden" name="tab" value={tab} />
            {companies.length > 1 && <input type="hidden" name="business" value={business.businessId} />}
            {q ? (
              <Link className="clear" href={link({ q: "" })} aria-label="Clear search">
                Clear
              </Link>
            ) : (
              <kbd aria-hidden="true">/</kbd>
            )}
          </form>
          <span className="meta">
            {tab === "needs" ? "Facts from your websites that need your OK." : tab === "questions" ? SECTION.question_bank.lead : "Approved words and things the assistant never says. Undo puts one back."}
          </span>
        </div>
      </section>
      <SearchHotkey inputId="answers-search" />

      {shown.length === 0 ? (
        <div className="empty">
          <Icon name={q ? "search" : "check"} size={28} />
          <b>{q ? "Nothing matches" : tab === "needs" ? "Nothing needs you" : tab === "questions" ? "Every common question is answered" : "Nothing decided yet"}</b>
          {q ? (
            <>
              No answers about “{rawQ}” here. <Link href={link({ q: "" })}>Clear the search</Link>.
            </>
          ) : tab === "needs" ? (
            "Every fact from your websites has your OK or a “never say”."
          ) : (
            ""
          )}
        </div>
      ) : tab === "needs" ? (
        (["conflict", "exact_words", "quick_confirm"] as const).map((category) => {
          const list = shown.filter((i) => queueCategory(i) === category);
          if (!list.length) return null;
          return (
            <section key={category} aria-labelledby={`h-${category}`}>
              <h2 id={`h-${category}`}>
                {SECTION[category].title} · {list.length}
              </h2>
              <p className="sub" style={{ marginBottom: 12 }}>
                {SECTION[category].lead}
              </p>
              <div className="queue">
                {list.map((item) => (
                  <ItemCard key={item.id} item={item} error={errorFor(item.key)} />
                ))}
              </div>
            </section>
          );
        })
      ) : (
        <div className="queue">
          {shown.map((item) => (
            <ItemCard key={item.id} item={item} error={errorFor(item.key)} />
          ))}
        </div>
      )}
    </Shell>
  );
}
