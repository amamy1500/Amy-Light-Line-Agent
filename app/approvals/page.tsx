import Link from "next/link";
import { redirect } from "next/navigation";
import { Shell } from "@/app/_components/shell";
import { Notice } from "@/app/_components/ui";
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

export default async function Approvals({ searchParams }: { searchParams: Promise<{ error?: string; business?: string; failed?: string }> }) {
  if (!(await isOperator())) redirect("/login");
  const { error, business: requested, failed } = await searchParams;
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
  const pending = items.filter((i) => i.status === "pending");
  const decided = items.filter((i) => i.status !== "pending");

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
      <h1>What the assistant may say about {business.name}</h1>
      <p className="sub">
        It says nothing below until you approve the exact words. {pending.length} waiting, {decided.length} decided. Approvals reach the
        next call immediately.
      </p>
      {(["conflict", "exact_words", "quick_confirm", "question_bank"] as const).map((category) => {
        const list = pending.filter((i) => queueCategory(i) === category);
        if (!list.length) return null;
        return (
          <section key={category} aria-labelledby={`h-${category}`}>
            <h2 id={`h-${category}`}>
              {SECTION[category].title} · {list.length}
            </h2>
            <p className="sub">{SECTION[category].lead}</p>
            <div className="queue">
              {list.map((item) => (
                <ItemCard key={item.id} item={item} error={errorFor(item.key)} />
              ))}
            </div>
          </section>
        );
      })}
      {decided.length > 0 && (
        <section aria-labelledby="h-decided">
          <h2 id="h-decided">Decided · {decided.length}</h2>
          <div className="queue">
            {decided.map((item) => (
              <ItemCard key={item.id} item={item} error={errorFor(item.key)} />
            ))}
          </div>
        </section>
      )}
    </Shell>
  );
}
