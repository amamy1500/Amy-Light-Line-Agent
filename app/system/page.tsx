import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Shell } from "@/app/_components/shell";
import { Notice, Section, StatTile } from "@/app/_components/ui";
import { parseBusinessConfig } from "@/lib/business-rules/config";
import { primaryBusiness } from "@/lib/db/dashboard";
import {
  alertRecipients,
  openIncidents,
  recentEvents,
  stuckAlerts,
  stuckJobs,
  systemLines,
  toolErrors,
  traffic,
  unansweredQuestions,
  type Traffic,
} from "@/lib/db/system";
import { isOperator } from "@/lib/server/auth";
import { consoleChrome } from "@/lib/server/console";
import { getDb } from "@/lib/server/db";
import { readEnv } from "@/lib/server/env";
import { isPlaceholderNumber, readinessChecks, type CheckState } from "@/lib/server/readiness";
import { formatUsPhone } from "@/lib/telephony/phone";

export const dynamic = "force-dynamic";

const STATE_BADGE: Record<CheckState, { className: string; label: string }> = {
  ok: { className: "badge ok", label: "Ready" },
  warn: { className: "badge warm", label: "Check" },
  missing: { className: "badge review", label: "Missing" },
};

const SOURCE: Record<string, string> = {
  tv: "TV ad",
  web: "Website",
  print: "Print",
  postcard: "Postcard",
  referral: "Referral",
  other: "Other",
  main_line: "Main line",
};

const INCIDENT: Record<string, string> = {
  agent_connect_failed: "The assistant couldn't connect, so the caller got the message line",
  agent_stream_dropped: "The assistant's call dropped part-way; the caller was offered a message",
};

/** `npm run live` in a fix becomes code. */
function withCode(text: string): ReactNode {
  return text.split("`").map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part));
}

/** "call.owner_answered" → "Call owner answered". */
function eventLabel(type: string): string {
  const words = type.replace(/[._]/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function TrafficTiles({ label, t, owner }: { label: string; t: Traffic; owner: string }) {
  return (
    <>
      <h4 style={{ margin: "4px 0 10px" }}>{label}</h4>
      <section className="today" aria-label={label}>
        <StatTile value={t.total} label="Calls" />
        <StatTile value={t.ownerAnswered} label={`${owner} took`} />
        <StatTile value={t.assistant} label="Assistant answered" />
        <StatTile value={t.whileOwnerBusy} label={`…while ${owner} was busy`} />
        <StatTile value={t.transferred} label={`Put through to ${owner}`} />
        <StatTile value={t.messages} label="Left a message" />
        <StatTile value={t.hungUp} label="Hung up early" tone="hot" />
        <StatTile value={t.open} label="Not finished" tone="hot" />
      </section>
    </>
  );
}

export default async function SystemPage() {
  if (!(await isOperator())) redirect("/login");
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
  const [lines, recipients, day, week, incidents, alerts, jobs, tools, questions, events] = await Promise.all([
    systemLines(db),
    alertRecipients(db),
    traffic(db, 24),
    traffic(db, 24 * 7),
    openIncidents(db),
    stuckAlerts(db),
    stuckJobs(db),
    toolErrors(db),
    unansweredQuestions(db),
    recentEvents(db),
  ]);
  const env = readEnv();
  const checks = readinessChecks({
    env,
    twilioFallbackUrl: process.env.TWILIO_FALLBACK_URL?.trim() || undefined,
    lines: lines.map((l) => ({ e164: l.e164, ownerRingE164: l.ownerRingE164, ringOwner: l.ringOwner })),
    aiMode: config.ai.mode,
    agentId: config.ai.agentId,
    alertContacts: {
      sms: [...new Set(recipients.filter((r) => r.channel === "sms").map((r) => r.address))],
      email: [...new Set(recipients.filter((r) => r.channel === "email").map((r) => r.address))],
    },
  });
  const missing = checks.filter((c) => c.state === "missing").length;
  const toCheck = checks.filter((c) => c.state === "warn").length;
  const problems = incidents.length + alerts.length + jobs.length + tools.length;
  const when = (d: Date) =>
    new Date(d).toLocaleString("en-US", { timeZone: config.timezone, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  return (
    <Shell active="system" chrome={chrome}>
      <div className="page-head">
        <div className="grow">
          <h1>System health</h1>
          <p className="sub" style={{ margin: 0 }}>
            Is everything ready for real callers, and is anything going wrong? Nothing here changes a setting.
          </p>
        </div>
      </div>

      {missing > 0 ? (
        <Notice tone="bad">
          {missing} {missing === 1 ? "thing blocks" : "things block"} real calls{toCheck ? `, and ${toCheck} more to check` : ""}. See the list below.
        </Notice>
      ) : (
        <Notice tone="ok">{toCheck ? `Ready for calls; ${toCheck} ${toCheck === 1 ? "thing" : "things"} worth checking.` : "Ready for real calls."}</Notice>
      )}

      <Section id="ready" icon="check" title="Ready for real callers" lead="Each part a call needs, from the number to the alert in the inbox. Secrets are never shown, only whether they're set.">
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Part</th>
                <th>Now</th>
                <th>What to do</th>
              </tr>
            </thead>
            <tbody>
              {checks.map((c) => (
                <tr key={c.id}>
                  <td>
                    <span className={STATE_BADGE[c.state].className}>{STATE_BADGE[c.state].label}</span>
                  </td>
                  <td>
                    <b>{c.label}</b>
                  </td>
                  <td>{c.detail}</td>
                  <td>{c.fix ? withCode(c.fix) : <span className="sub">Nothing</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="routing" icon="phone" title="Where calls and alerts go" lead="The numbers callers dial, whose phone rings first, and the inboxes that get each call's summary.">
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Number callers dial</th>
                <th>Company</th>
                <th>Source</th>
                <th>Rings first</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.e164}>
                  <td className="num">
                    {formatUsPhone(l.e164)} {isPlaceholderNumber(l.e164) && <span className="badge">test only</span>}
                  </td>
                  <td>{l.company}</td>
                  <td>{SOURCE[l.channel] ?? l.channel}</td>
                  <td>{l.ringOwner ? `${formatUsPhone(l.ownerRingE164)} for ${l.ringTimeoutS} s, then the assistant` : "The assistant answers (the carrier already rang)"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="sub" style={{ marginTop: 12 }}>
          Alerts:{" "}
          {recipients.length === 0
            ? "nobody yet."
            : recipients.map((r) => `${r.channel === "email" ? r.address : formatUsPhone(r.address)} (${r.channel}, ${r.company})`).join(" · ")}{" "}
          {env.alertMode === "live" ? "Sent for real." : "Simulate mode: recorded here, not sent."} Change them in <Link href="/settings#alerts">Settings → Alerts</Link>.
        </p>
      </Section>

      <Section id="traffic" icon="calls" title="Traffic" lead="Every call, by how it ended. A number in red is worth a look.">
        <TrafficTiles label="Last 24 hours" t={day} owner={config.brand.ownerFirstName} />
        <TrafficTiles label="Last 7 days" t={week} owner={config.brand.ownerFirstName} />
      </Section>

      <Section id="problems" icon="shield" title="Problems" lead="Anything that failed in the last 7 days: the assistant, alerts, or background work.">
        {problems === 0 ? (
          <p className="empty">
            <b>Nothing wrong</b>
            No failures in the last 7 days.
          </p>
        ) : (
          <div className="rows">
            {incidents.map((i) => (
              <div key={i.id} className="row">
                <span className="label">
                  <span className={i.severity === "critical" ? "badge review" : "badge warm"}>{i.severity}</span> {when(i.createdAt)}
                </span>
                <span>
                  {INCIDENT[i.kind] ?? i.kind}
                  {i.fromE164 ? ` (caller ${formatUsPhone(i.fromE164)})` : ""}. {i.leadId && <Link href={`/leads/${i.leadId}`}>Open the lead</Link>}
                </span>
              </div>
            ))}
            {alerts.map((a) => (
              <div key={a.id} className="row">
                <span className="label">
                  <span className="badge review">{a.status === "failed" ? "alert failed" : "alert waiting"}</span> {when(a.createdAt)}
                </span>
                <span>
                  {a.channel === "email" ? "Email" : "Text"} to {a.channel === "email" ? a.toAddress : formatUsPhone(a.toAddress)} ({a.kind}), {a.attempts}{" "}
                  {a.attempts === 1 ? "try" : "tries"}
                  {a.lastError ? `: ${a.lastError}` : ""}. {a.leadId && <Link href={`/leads/${a.leadId}`}>Open the lead</Link>}
                </span>
              </div>
            ))}
            {jobs.map((j) => (
              <div key={`${j.kind}-${j.status}`} className="row">
                <span className="label">
                  <span className="badge review">{j.status === "failed" ? "job failed" : "job overdue"}</span> {when(j.updatedAt)}
                </span>
                <span>
                  {j.count} × {j.kind.replace(/_/g, " ")}
                  {j.status === "pending" ? " waiting to run: the job sweep isn't running (npm run live or the hosting's schedule runs it)" : ""}
                  {j.lastError ? `. Last error: ${j.lastError}` : ""}.
                </span>
              </div>
            ))}
            {tools.map((t) => (
              <div key={t.toolName} className="row">
                <span className="label">
                  <span className="badge warm">tool errors</span>
                </span>
                <span>
                  {t.toolName.replace(/_/g, " ")} failed {t.count} {t.count === 1 ? "time" : "times"}; the assistant told the caller it would pass details on.
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section id="questions" icon="message" title="Questions it couldn't answer" lead={`Callers asked these and no approved answer existed, so the assistant said ${config.brand.ownerFirstName} would cover it. Approving an answer fixes it for the next caller.`}>
        {questions.length === 0 ? (
          <p className="empty">
            <b>None in the last 30 days</b>
            Every question had an approved answer.
          </p>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Question</th>
                    <th>Topic</th>
                    <th>Asked</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q, n) => (
                    <tr key={n}>
                      <td>{q.question}</td>
                      <td>{q.topic}</td>
                      <td className="num">{when(q.askedAt)}</td>
                      <td>{q.leadId && <Link href={`/leads/${q.leadId}`}>Lead</Link>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="sub" style={{ marginTop: 12 }}>
              To answer one next time, approve the wording in <Link href="/approvals">Answers to approve</Link>.
            </p>
          </>
        )}
      </Section>

      <Section id="activity" icon="history" title="Recent activity" lead="The latest recorded events, newest first.">
        {events.length === 0 ? (
          <p className="empty">Nothing yet.</p>
        ) : (
          <ul className="texts">
            {events.map((e, n) => (
              <li key={n}>
                <span>{eventLabel(e.type)}</span>
                <small>
                  {when(e.occurredAt)} · by {e.actorType}
                </small>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </Shell>
  );
}
