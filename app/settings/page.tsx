import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Shell } from "@/app/_components/shell";
import { Icon, Notice, Section, Switch } from "@/app/_components/ui";
import { IntakeField, parseBusinessConfig } from "@/lib/business-rules/config";
import { isOperator } from "@/lib/server/auth";
import { AI_MODE_COPY, AI_MODES, consoleChrome } from "@/lib/server/console";
import { getDb } from "@/lib/server/db";
import { readEnv } from "@/lib/server/env";
import { UUID } from "@/lib/server/forms";
import { FIELD_LABEL } from "@/lib/server/labels";
import {
  activeBlocks,
  alertContacts,
  configHistory,
  LOCKED_RULES,
  officeLines,
  US_TIMEZONES,
  type SettingsSection,
} from "@/lib/settings/office-settings";
import { formatUsPhone } from "@/lib/telephony/phone";
import { SAFETY_LINE, SPANISH_OPENING } from "@/lib/agents/lines";

export const dynamic = "force-dynamic";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SECTION_LABEL: Record<SettingsSection, string> = {
  answering: "Who answers",
  owner: "Owner & ring phone",
  hours: "Hours & closed days",
  callbacks: "Callback hours",
  spam: "Spam screening",
  alerts: "Alerts",
  callers: "Safety & languages",
  company: "Company details",
};

/** One section's form: posts to /api/settings, shows "Saved" (or what was wrong) right where Amy pressed Save. */
function SectionForm(props: { section: SettingsSection; company?: string; saved: boolean; error?: string; children: ReactNode }) {
  const { section, company, saved, error, children } = props;
  return (
    <form method="post" action="/api/settings">
      {error && <Notice tone="bad">{error} Nothing was changed.</Notice>}
      <input type="hidden" name="section" value={section} />
      {company && <input type="hidden" name="company" value={company} />}
      <div className="rows">{children}</div>
      <div className="form-foot">
        {saved && (
          <span className="saved" role="status">
            <Icon name="check" size={15} /> Saved. The next call uses it.
          </span>
        )}
        <button className="btn primary" type="submit">
          Save {SECTION_LABEL[section].toLowerCase()}
        </button>
      </div>
    </form>
  );
}

function Row({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="row">
      {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : <span className="label">{label}</span>}
      <div>
        {children}
        {hint && <div className="hint">{hint}</div>}
      </div>
    </div>
  );
}

const KEYS: Array<{ env: string; what: string }> = [
  { env: "TWILIO_ACCOUNT_SID", what: "Phone numbers (Twilio account)" },
  { env: "TWILIO_AUTH_TOKEN", what: "Phone numbers (Twilio auth token)" },
  { env: "TWILIO_ALERT_FROM", what: "Number that texts you alerts" },
  { env: "ELEVENLABS_API_KEY", what: "Assistant voice (ElevenLabs)" },
  { env: "ELEVENLABS_WEBHOOK_SECRET", what: "Call transcripts (webhook secret)" },
  { env: "AGENT_TOOL_SECRET", what: "Assistant ↔ app tool key" },
  { env: "RESEND_API_KEY", what: "Alert emails (Resend)" },
];

export default async function Settings({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; saved?: string; error?: string; failed?: string }>;
}) {
  if (!(await isOperator())) redirect("/login");
  const params = await searchParams;
  const db = await getDb();
  const chrome = await consoleChrome(db);
  if (!chrome) redirect("/dashboard");
  const companies = chrome.companies.filter((c) => c.kind === "company");
  const office = chrome.companies[0]!;
  const config = parseBusinessConfig(office.config);
  const picked =
    (params.company && UUID.test(params.company) ? companies.find((c) => c.businessId === params.company) : undefined) ?? companies[0]!;
  const pickedConfig = parseBusinessConfig(picked.config);
  const [lines, contacts, blocks, history] = await Promise.all([
    officeLines(db, office.tenantId),
    alertContacts(db, office.businessId),
    activeBlocks(db, office.tenantId),
    configHistory(db, picked.businessId),
  ]);
  const saved = (s: string) => params.saved === s;
  const failed = (s: string) => (params.failed === s ? params.error : undefined);
  // Hours are office-wide: say so when a company has different hours today, before a save evens them out.
  const hoursDiffer = chrome.companies
    .filter((c) => JSON.stringify(parseBusinessConfig(c.config).ringHours) !== JSON.stringify(config.ringHours))
    .map((c) => (c.kind === "front_desk" ? "the shared line" : c.name));
  const env = readEnv();
  const tz = config.timezone;

  return (
    <Shell active="settings" chrome={chrome}>
      <div className="page-head">
        <div className="grow">
          <h1>Settings</h1>
          <p className="sub" style={{ margin: 0 }}>
            Everything here takes effect on the next call. Every save is kept, and you can put any earlier version back.
          </p>
        </div>
      </div>
      {params.error && !params.failed && <Notice tone="bad">{params.error}</Notice>}

      <div className="settings">
        <nav className="subnav" aria-label="Settings sections">
          <a href="#answering"><Icon name="phone" size={15} /> Who answers</a>
          <a href="#owner"><Icon name="user" size={15} /> Owner & ring phone</a>
          <a href="#hours"><Icon name="clock" size={15} /> Hours & closed days</a>
          <a href="#spam"><Icon name="shield" size={15} /> Spam screening</a>
          <a href="#alerts"><Icon name="bell" size={15} /> Alerts</a>
          <a href="#callers"><Icon name="sparkle" size={15} /> Safety & languages</a>
          <a href="#company"><Icon name="building" size={15} /> Company details</a>
          <a href="#always"><Icon name="lock" size={15} /> Always on</a>
          <a href="#history"><Icon name="history" size={15} /> History</a>
          <a href="#keys"><Icon name="key" size={15} /> Accounts & keys</a>
        </nav>

        <div>
          <Section id="answering" icon="phone" title="Who answers" lead="Who picks up first, and whether callers can be put through to you." scope="All companies">
            <SectionForm section="answering" saved={saved("answering")} error={failed("answering")}>
              <div className="choices" role="radiogroup" aria-label="Who answers">
                {AI_MODES.map((m) => (
                  <label key={m} className="choice">
                    <input type="radio" name="mode" value={m} defaultChecked={config.ai.mode === m} />
                    <b>
                      {AI_MODE_COPY[m].title}
                      {m === "always" && <span className="tag">Recommended</span>}
                    </b>
                    <span>{AI_MODE_COPY[m].detail}</span>
                  </label>
                ))}
              </div>
              <Switch
                name="transfer_enabled"
                defaultChecked={config.transfer.enabled}
                label="Offer to put callers through to you"
                hint="Your phone rings with a short whisper first; press any key to take the call."
              />
              <Switch
                name="transfer_only_in_hours"
                defaultChecked={config.transfer.onlyDuringRingHours}
                label="Only during your hours"
                hint="Outside them, the assistant sets a callback instead."
              />
              <Row label="Tries to reach you per call" htmlFor="transfer_max_attempts" hint="If you don't pick up, the caller goes back to the assistant with nothing lost.">
                <select id="transfer_max_attempts" name="transfer_max_attempts" className="field" defaultValue={String(config.transfer.maxAttempts)} style={{ width: 120 }}>
                  <option value="0">None</option>
                  <option value="1">One</option>
                  <option value="2">Two</option>
                </select>
              </Row>
            </SectionForm>
          </Section>

          <Section id="owner" icon="user" title="Owner & ring phone" lead="Who the assistant works for and whose phone rings. When someone new takes over the phones, change it here." scope="All companies">
            <SectionForm section="owner" saved={saved("owner")} error={failed("owner")}>
              <Row label="First name" htmlFor="owner_first_name" hint="Callers hear it: “I'll make sure Amy calls you back.”">
                <input id="owner_first_name" name="owner_first_name" className="field" defaultValue={config.brand.ownerFirstName} maxLength={30} required />
              </Row>
              <Row label="How the assistant introduces itself" htmlFor="assistant_role" hint="Must say it's an AI. Leave empty for “<name>'s AI assistant”.">
                <input id="assistant_role" name="assistant_role" className="field" defaultValue={config.brand.assistantRole} maxLength={60} />
              </Row>
              <Row label="Phone to ring" htmlFor="ring_phone" hint={`Rings for calls and transfers, showing the business number. ${lines ? `${lines.numbers.length} number${lines.numbers.length === 1 ? "" : "s"}: ${lines.numbers.map(formatUsPhone).join(", ")}.` : ""}`}>
                <input id="ring_phone" name="ring_phone" className="field" inputMode="tel" defaultValue={lines ? formatUsPhone(lines.ringPhone) : ""} required style={{ maxWidth: 220 }} />
              </Row>
              <Row label="Seconds to ring" htmlFor="ring_seconds" hint="About 5 seconds per ring. 18–25 is usual.">
                <input id="ring_seconds" name="ring_seconds" type="number" min={10} max={45} className="field" defaultValue={lines?.ringSeconds ?? 20} />
              </Row>
            </SectionForm>
          </Section>

          <Section id="hours" icon="clock" title="Hours & closed days" lead="When your phone rings. On a closed day it doesn't, and the assistant tells callers the office is closed." scope="All companies">
            {hoursDiffer.length > 0 && (
              <Notice tone="bad">
                {hoursDiffer.join(", ")} {hoursDiffer.length === 1 ? "has" : "have"} different hours today. Saving puts every company on these.
              </Notice>
            )}
            <SectionForm section="hours" saved={saved("hours")} error={failed("hours")}>
              <div className="hours" role="group" aria-label="Weekly hours">
                {[1, 2, 3, 4, 5, 6, 0].map((day) => {
                  const w = config.ringHours.find((h) => h.day === day);
                  return (
                    <div key={day} className="day">
                      <Switch name={`day_${day}`} defaultChecked={Boolean(w)} label={DAYS[day]!} />
                      <input type="time" name={`open_${day}`} className="field" defaultValue={w?.open ?? "09:00"} aria-label={`${DAYS[day]} opens`} />
                      <span className="to">to</span>
                      <input type="time" name={`close_${day}`} className="field" defaultValue={w?.close ?? "18:00"} aria-label={`${DAYS[day]} closes`} />
                    </div>
                  );
                })}
              </div>
              <p className="meta" style={{ margin: 0 }}>00:00 to 00:00 rings all day. A day switched off doesn&apos;t ring.</p>
              <Row label="Time zone" htmlFor="timezone">
                <select id="timezone" name="timezone" className="field" defaultValue={tz} style={{ maxWidth: 260 }}>
                  {US_TIMEZONES.map((z) => (
                    <option key={z} value={z}>
                      {z.replace("America/", "").replace("Pacific/", "").replace("_", " ")}
                    </option>
                  ))}
                </select>
              </Row>
              <Row label="Closed days" htmlFor="closures" hint="One per line: a date and a name, e.g. 2026-11-26 Thanksgiving. The assistant mentions any in the next three weeks.">
                <textarea
                  id="closures"
                  name="closures"
                  rows={4}
                  className="field"
                  defaultValue={config.closures.map((c) => `${c.date} ${c.label}`).join("\n")}
                  placeholder={"2026-11-26 Thanksgiving\n2026-12-25 Christmas Day"}
                />
              </Row>
            </SectionForm>
          </Section>

          <Section id="callbacks" icon="phone" title="Callback hours" lead="When callers get called back. The assistant tells callers these hours, and offers the next weekday to anyone who asks for a weekend or an evening." scope="All companies">
            <SectionForm section="callbacks" saved={saved("callbacks")} error={failed("callbacks")}>
              <div className="hours" role="group" aria-label="Callback hours">
                {[1, 2, 3, 4, 5, 6, 0].map((day) => {
                  const w = config.callbackHours?.find((h) => h.day === day);
                  return (
                    <div key={day} className="day">
                      <Switch name={`cb_day_${day}`} defaultChecked={Boolean(w)} label={DAYS[day]!} />
                      <input type="time" name={`cb_open_${day}`} className="field" defaultValue={w?.open ?? "09:00"} aria-label={`${DAYS[day]} callbacks start`} />
                      <span className="to">to</span>
                      <input type="time" name={`cb_close_${day}`} className="field" defaultValue={w?.close ?? "17:00"} aria-label={`${DAYS[day]} callbacks end`} />
                    </div>
                  );
                })}
              </div>
              <p className="meta" style={{ margin: 0 }}>
                {config.callbackHours?.length ? "" : "Not set: callers can pick any time. "}A day switched off gets no callbacks.
              </p>
            </SectionForm>
          </Section>

          <Section id="spam" icon="shield" title="Spam screening" lead="Who must press 1 or say “yes” before reaching anyone. Silence still gets voicemail, so a real caller is never hung up on." scope="All companies">
            <SectionForm section="spam" saved={saved("spam")} error={failed("spam")}>
              <Switch name="gate_hidden" defaultChecked={config.screening.gateHiddenNumbers} label="Hidden numbers press 1 first" hint="“No caller ID”, “anonymous”, “restricted”." />
              <Switch name="gate_failed_caller_id" defaultChecked={config.screening.gateFailedCallerId} label="Numbers that fail the carrier's caller-ID check press 1 first" hint="Unverified numbers are NOT screened: about 45% of real callers arrive that way." />
              <Row label="Spam calls before a number must press 1" htmlFor="auto_flag_after" hint="Counted over 90 days. 0 turns this off.">
                <input id="auto_flag_after" name="auto_flag_after" type="number" min={0} max={10} className="field" defaultValue={config.screening.autoFlagAfter} />
              </Row>
              <Row label="For how many days" htmlFor="auto_flag_days">
                <input id="auto_flag_days" name="auto_flag_days" type="number" min={1} max={365} className="field" defaultValue={config.screening.autoFlagDays} />
              </Row>
            </SectionForm>
            <h2 style={{ marginTop: 24 }}>Blocked and flagged numbers · {blocks.length}</h2>
            {blocks.length === 0 ? (
              <p className="meta">None. Block a number from a call&apos;s page.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Number</th>
                    <th>Why</th>
                    <th>Until</th>
                    <th>Tried since</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {blocks.map((b) => (
                    <tr key={b.e164}>
                      <td className="num">{formatUsPhone(b.e164)}</td>
                      <td>
                        <span className={`badge ${b.kind === "manual" ? "review" : "warm"}`}>{b.kind === "manual" ? "Blocked by you" : "Flagged as spam"}</span>
                      </td>
                      <td className="num">{b.blockedUntil ? b.blockedUntil.toLocaleDateString("en-US", { timeZone: tz, month: "short", day: "numeric" }) : "Until you lift it"}</td>
                      <td className="num">{b.hits}</td>
                      <td style={{ textAlign: "right" }}>
                        <form method="post" action="/api/settings/unblock">
                          <input type="hidden" name="e164" value={b.e164} />
                          <button className="btn sm" type="submit">
                            {b.kind === "manual" ? "Unblock" : "Not spam"}
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          <Section id="alerts" icon="bell" title="Alerts" lead="Who hears about calls. At least one phone or email stays on, so no caller goes unseen." scope="All companies">
            <SectionForm section="alerts" saved={saved("alerts")} error={failed("alerts")}>
              <Row label="Text these phones" htmlFor="sms" hint="One per line. Texts need the business texting registration (A2P 10DLC) first.">
                <textarea id="sms" name="sms" rows={2} className="field" defaultValue={contacts.sms.map(formatUsPhone).join("\n")} />
              </Row>
              <Row label="Email these addresses" htmlFor="email" hint="One per line.">
                <textarea id="email" name="email" rows={2} className="field" defaultValue={contacts.email.join("\n")} />
              </Row>
              <Switch
                name="hold_likely_spam"
                defaultChecked={config.alerts.holdLikelySpam}
                label="Don't text me about likely spam"
                hint="Only when the call looked like spam AND left nothing a customer would say. Anything else still texts you."
              />
              <Switch name="daily_summary" defaultChecked={config.alerts.dailySummary} label="Send a daily summary of those calls" hint="One text a day with a count and a link, so a misjudged caller is still in front of you." />
              <Row label="Summary time" htmlFor="daily_summary_time">
                <input id="daily_summary_time" name="daily_summary_time" type="time" className="field" defaultValue={config.alerts.dailySummaryTime} />
              </Row>
            </SectionForm>
          </Section>

          <Section id="callers" icon="sparkle" title="Safety & languages" lead="What the assistant says when someone reports danger, and whether it answers in Spanish." scope="All companies">
            <SectionForm section="callers" saved={saved("callers")} error={failed("callers")}>
              <Row label="It always says first" hint="Word for word, before anything else, when a caller mentions sparking, smoke, fire or someone hurt. Then you get an URGENT text.">
                <p className="bubble agent" style={{ margin: 0, maxWidth: "100%" }}>
                  {SAFETY_LINE}
                </p>
              </Row>
              <Row label="Electric company" htmlFor="utility_name" hint="For a downed power line. Suburbs may be served by another utility; the assistant says so.">
                <input id="utility_name" name="utility_name" className="field" defaultValue={config.safety.utilityName} maxLength={60} required style={{ maxWidth: 260 }} />
              </Row>
              <Row label="Its outage line" htmlFor="utility_phone">
                <input id="utility_phone" name="utility_phone" className="field" inputMode="tel" defaultValue={formatUsPhone(config.safety.utilityPhone)} required style={{ maxWidth: 220 }} />
              </Row>
              <Switch
                name="spanish"
                defaultChecked={config.ai.spanish}
                label="Answer Spanish-speaking callers in Spanish"
                hint="Turn on after a Spanish speaker has checked the greeting below. Applies when the assistant is next published (npm run live)."
              />
              <p className="bubble caller" style={{ margin: 0, maxWidth: "100%" }} lang="es">
                <small>Spanish greeting</small>
                {SPANISH_OPENING}
              </p>
            </SectionForm>
          </Section>

          <Section id="company" icon="building" title="Company details" lead="How the assistant describes a company and what it asks. Facts about the company stay in Answers to approve." scope="One company">
            {companies.length > 1 && (
              <nav className="seg" aria-label="Company" style={{ marginBottom: 16 }}>
                {companies.map((c) => (
                  <Link key={c.businessId} href={`/settings?company=${c.businessId}#company`} aria-current={c.businessId === picked.businessId ? "page" : undefined}>
                    {c.name}
                  </Link>
                ))}
              </nav>
            )}
            <SectionForm section="company" company={picked.businessId} saved={saved("company")} error={failed("company")}>
              <Row label="Name callers hear" htmlFor="spoken_name">
                <input id="spoken_name" name="spoken_name" className="field" defaultValue={pickedConfig.brand.spokenName} maxLength={60} required />
              </Row>
              <Row label="What the company is" htmlFor="description" hint="One phrase, e.g. “a holiday lighting company in Austin, Texas”.">
                <input id="description" name="description" className="field" defaultValue={pickedConfig.profile.description} maxLength={200} required />
              </Row>
              <Row label="What callers usually want" htmlFor="caller_focus">
                <textarea id="caller_focus" name="caller_focus" rows={2} className="field" defaultValue={pickedConfig.profile.callerFocus} maxLength={600} required />
              </Row>
              <Row label="What to ask, in order" htmlFor="collect" hint="Plain words; the assistant asks only what the caller hasn't said.">
                <textarea id="collect" name="collect" rows={4} className="field" defaultValue={pickedConfig.profile.collect} maxLength={600} required />
              </Row>
              <Row label="Details to capture" hint="Ticked details are saved on the lead and counted as “x of y details”.">
                <div className="pills">
                  {IntakeField.options.map((f) => (
                    <label key={f} className="pill">
                      <input type="checkbox" name="intake" value={f} defaultChecked={pickedConfig.intake.includes(f)} />
                      {FIELD_LABEL[f]}
                    </label>
                  ))}
                </div>
              </Row>
              <Row label="Other names callers use" htmlFor="aliases" hint="Names only, comma-separated.">
                <input id="aliases" name="aliases" className="field" defaultValue={pickedConfig.profile.aliases.join(", ")} />
              </Row>
              <Row label="Words that point to this company" htmlFor="signals" hint="Used on a shared line to tell companies apart.">
                <input id="signals" name="signals" className="field" defaultValue={pickedConfig.profile.signals.join(", ")} />
              </Row>
              <Row label="Always hand to you" htmlFor="escalate_topics" hint="Topics the assistant never handles itself, comma-separated.">
                <input id="escalate_topics" name="escalate_topics" className="field" defaultValue={pickedConfig.escalateTopics.join(", ")} />
              </Row>
            </SectionForm>
          </Section>

          <Section id="always" icon="lock" title="Always on" lead="Rules no setting can turn off. They keep callers, and you, safe.">
            <ul className="locks">
              {LOCKED_RULES.map((rule) => (
                <li key={rule}>
                  <Icon name="lock" size={16} />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section id="history" icon="history" title="History" lead={`Every saved version of ${picked.name}'s settings. Restoring keeps answers you approved since.`}>
            {saved("history") && <Notice tone="ok">Restored. The next call uses it.</Notice>}
            <table className="table">
              <thead>
                <tr>
                  <th>Version</th>
                  <th>When</th>
                  <th>By</th>
                  <th>What changed</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.version}>
                    <td className="num">
                      v{h.version} {h.active && <span className="badge ok">Live</span>}
                    </td>
                    <td className="num">{h.createdAt.toLocaleString("en-US", { timeZone: tz, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                    <td>{h.createdBy ?? "setup"}</td>
                    <td>{h.changes.length ? h.changes.join(", ") : <span className="meta">First version</span>}</td>
                    <td style={{ textAlign: "right" }}>
                      {!h.active && (
                        <form method="post" action="/api/settings/restore">
                          <input type="hidden" name="company" value={picked.businessId} />
                          <input type="hidden" name="version" value={h.version} />
                          <button className="btn sm" type="submit">
                            Restore
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section id="keys" icon="key" title="Accounts & keys" lead="Set on the server, never in this page. Added last, when the phone numbers go live (scripts/live/wizard.sh).">
            <div className="keys">
              <div>
                <Icon name="sparkle" size={16} />
                <span>Assistant</span>
                <code>{env.agentProvider}</code>
                <span className={`badge ${env.agentProvider === "elevenlabs" ? "ok" : "warm"}`}>
                  {env.agentProvider === "elevenlabs" ? "Live voice" : env.agentProvider === "simulator" ? "Simulator" : "Off"}
                </span>
              </div>
              <div>
                <Icon name="bell" size={16} />
                <span>Alerts</span>
                <code>ALERT_MODE</code>
                <span className={`badge ${env.alertMode === "live" ? "ok" : "warm"}`}>{env.alertMode === "live" ? "Sending" : "Simulated"}</span>
              </div>
              {KEYS.map((k) => {
                const set = Boolean(process.env[k.env]?.trim());
                return (
                  <div key={k.env}>
                    <Icon name="key" size={16} />
                    <span>{k.what}</span>
                    <code>{k.env}</code>
                    <span className={`badge ${set ? "ok" : ""}`}>{set ? "Set" : "Not set yet"}</span>
                  </div>
                );
              })}
            </div>
          </Section>
        </div>
      </div>
    </Shell>
  );
}
