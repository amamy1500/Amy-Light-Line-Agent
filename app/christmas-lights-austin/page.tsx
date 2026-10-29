import type { Metadata } from "next";
import { approvedFacts, approvedServices, parseBusinessConfig } from "@/lib/business-rules/config";
import { findWebLine } from "@/lib/db";
import { primaryBusiness } from "@/lib/db/dashboard";
import { formatUsPhone } from "@/lib/telephony";
import { getDb } from "@/lib/server/db";
import { readEnv } from "@/lib/server/env";
import { formStamp } from "@/lib/server/form-guard";
import { formSecret } from "@/lib/server/form-secret";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Christmas lights in Austin · The Christmas Light Guys",
  description: "Holiday lighting design, installation and takedown in the Austin area. Request a quote.",
  robots: { index: false, follow: false }, // campaign page; the main site keeps its SEO
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const ATTRIBUTION_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "cohort", "qr"] as const;

/**
 * Campaign landing page. It states only facts Amy approved — the same
 * truth layer the phone agent uses — so the site and the phone can never
 * disagree. Until Amy approves facts, it shows the request form only.
 */
export default async function Landing({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const env = readEnv();
  const db = await getDb();
  const [line, business] = await Promise.all([findWebLine(db), primaryBusiness(db)]);
  const config = business ? parseBusinessConfig(business.config) : null;
  const facts = config ? approvedFacts(config) : [];
  const services = config ? approvedServices(config) : [];
  const pick = (key: string) => (typeof params[key] === "string" ? (params[key] as string).slice(0, 100) : "");
  const error = pick("error");
  const phone = line?.phoneE164 ?? null;
  const owner = config?.brand.ownerFirstName ?? "Amy";

  return (
    <main className="wrap" style={{ paddingTop: 32 }}>
      <p className="meta">{line?.brandName ?? "The Christmas Light Guys"} · Austin, Texas</p>
      <h1 style={{ fontSize: 30 }}>Christmas lights, installed for you.</h1>
      <p className="sub">Tell us about the property and {owner} will call you back to plan it and quote it.</p>
      <div className="actions" style={{ marginBottom: 24 }}>
        <a className="btn primary" href="#quote">Request a quote</a>
        {phone && (
          <a className="btn" href={`tel:${phone}`}>
            Call {formatUsPhone(phone)}
          </a>
        )}
      </div>

      {(facts.length > 0 || services.length > 0) && (
        <section className="queue" aria-label="What we do">
          {facts.map((f) => (
            <div className="card" key={f.id}>
              {f.text}
            </div>
          ))}
          {services.length > 0 && <div className="card">{services.map((s) => s.label).join(" · ")}</div>}
        </section>
      )}

      <section id="quote" className="card" style={{ marginTop: 24 }} aria-labelledby="quote-title">
        <h2 id="quote-title" style={{ marginTop: 0 }}>Request a quote</h2>
        {error && (
          <p className="notice" role="alert">
            {error}
          </p>
        )}
        {line ? (
          <form method="post" action="/api/leads/web" style={{ display: "grid", gap: 12 }}>
            <input type="hidden" name="campaign" value={line.campaignId} />
            <input type="hidden" name="stamp" value={formStamp(formSecret(env))} />
            {ATTRIBUTION_KEYS.map((key) => (pick(key) ? <input key={key} type="hidden" name={key} value={pick(key)} /> : null))}
            <div style={{ position: "absolute", left: "-10000px" }} aria-hidden="true">
              <label>
                Company
                <input type="text" name="company" tabIndex={-1} autoComplete="off" />
              </label>
            </div>
            <Field id="name" label="Your name" autoComplete="name" required max={80} />
            <Field id="phone" label="Phone" type="tel" autoComplete="tel" required max={32} />
            <Field id="address" label="Address to light" autoComplete="street-address" required max={200} />
            <Field id="service" label="What would you like lit? (optional)" max={200} />
            <Field id="timing" label="When would you like it up? (optional)" max={120} />
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 14 }}>
              <input type="checkbox" name="sms_consent" value="yes" />
              <span>It&apos;s OK to text me about my quote. Message and data rates may apply. Reply STOP to opt out.</span>
            </label>
            <button className="btn primary" type="submit">
              Send my request
            </button>
            <p className="meta" style={{ margin: 0 }}>
              We use your details only to reply to this request. Calls to our number may be answered by {owner}&apos;s AI
              assistant and are recorded.
            </p>
          </form>
        ) : (
          <p>Online requests aren&apos;t set up yet. Please call us.</p>
        )}
      </section>
    </main>
  );
}

function Field(props: { id: string; label: string; type?: string; autoComplete?: string; required?: boolean; max: number }) {
  return (
    <label htmlFor={props.id} style={{ display: "grid", gap: 4, fontSize: 14 }}>
      {props.label}
      <input
        id={props.id}
        name={props.id}
        type={props.type ?? "text"}
        autoComplete={props.autoComplete}
        required={props.required}
        maxLength={props.max}
        style={{ font: "inherit", padding: "9px 10px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)" }}
      />
    </label>
  );
}
