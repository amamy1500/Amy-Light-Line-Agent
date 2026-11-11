import { claimPendingAlerts, settleAlert, type AlertKind, type PendingAlert, type Queryable } from "@/lib/db";
import type { UrgentKind } from "@/lib/db/repo";
import { getConversationAudio } from "@/lib/elevenlabs/conversations";
import { formatUsPhone } from "@/lib/telephony";
import nodemailer from "nodemailer";
import twilio from "twilio";
import type { AppEnv } from "./env";
import { sourceLabel } from "./voice";

export interface RenderedAlert {
  subject: string;
  body: string;
  /** Emails only: the same content laid out for Gmail, with tap-to-call and map links. */
  html?: string;
}

/** Whether the call's recording went out with the email. Unset when nobody tried (simulated alerts, texts). */
export type RecordingState = "attached" | "unavailable";

const SMS_LIMIT = 320;

const HEADLINE: Record<AlertKind, (who: string) => string> = {
  message: (who) => `New voicemail from ${who}`,
  abandoned: (who) => `Missed call from ${who} (no message left)`,
  answered: (who) => `You took a call from ${who}`,
  web_form: (who) => `Quote request from ${who}`,
  agent_lead: (who) => `New customer call from ${who}`,
  callback: (who) => `Still waiting for your callback: ${who}`,
  transfer_missed: (who) => `${who} asked for you and you couldn't pick up`,
  review: (who) => `Check what the assistant said to ${who}`,
  digest: () => "Daily summary",
  urgent: (who) => `URGENT call from ${who}`,
};

/** What an urgent alert is about, first thing in the text. */
export const URGENT_LABEL: Record<UrgentKind, string> = {
  safety: "Safety",
  service_issue: "Problem with an installed job",
  complaint: "Complaint or claim",
  threat: "Threat or abuse",
  official: "Media, police, city or HOA",
};

/** What the Google Maps answer means for the callback (Amy, 2026-10-29); null when there's nothing to do. */
function mapsNote(mapsVisible: string | null): string | null {
  if (mapsVisible === "no") return "site visit to schedule: hard to see on Google Maps";
  if (mapsVisible === "unsure") return "check Google Maps first: the caller wasn't sure it shows";
  return null;
}

/** The Google Maps answer as the email's line says it. */
const MAPS_LINE: Record<string, string> = {
  yes: "Easy to see",
  no: "Hard to see: set up a site visit on the callback",
  unsure: "Not sure: check Google Maps first",
};

export function renderAlert(alert: PendingAlert, baseUrl: string, recording?: RecordingState): RenderedAlert {
  if (alert.kind === "digest") return renderDigest(alert, baseUrl);
  const link = new URL(`/leads/${alert.leadId}`, baseUrl).toString();
  const who = alert.contactName
    ? `${alert.contactName}, ${formatUsPhone(alert.contactPhone)}`
    : formatUsPhone(alert.contactPhone);
  // The company first: one office answers for several, and Amy must know which one is calling.
  const company = alert.companyKind === "front_desk" ? "Company not given" : alert.companyName;
  const line = `${company} · ${sourceLabel(alert.channelLabel)}`;
  const urgent = alert.kind === "urgent" && alert.detail?.urgent ? `${URGENT_LABEL[alert.detail.urgent]}: ${alert.detail.summary ?? ""}`.trim() : null;
  const visit = mapsNote(alert.mapsVisible);
  const details = [urgent, alert.address, alert.serviceWanted, alert.timing, alert.callbackWindow && `call ${alert.callbackWindow}`, visit]
    .filter(Boolean)
    .join("; ");
  const action = alert.kind === "answered" ? "Log the outcome" : alert.kind === "review" ? "Review" : "Call back";
  const subject = `${line}: ${HEADLINE[alert.kind](who)}${alert.mapsVisible === "no" ? " (site visit to schedule)" : ""}`;

  if (alert.channel === "email") return renderEmail(alert, { subject, company, urgent, action, link, recording });

  let body = `${subject}.${details ? ` ${details}.` : ""} ${action}: ${link}`;
  if (body.length > SMS_LIMIT) {
    const room = SMS_LIMIT - (` ${action}: ${link}`.length + 1);
    body = `${`${subject}.${details ? ` ${details}.` : ""}`.slice(0, Math.max(0, room - 1))}… ${action}: ${link}`;
  }
  return { subject, body };
}

// ---------------------------------------------------------------- email

interface EmailParts {
  subject: string;
  company: string;
  urgent: string | null;
  action: string;
  link: string;
  recording: RecordingState | undefined;
}

type Row = { label: string; text: string; html?: string };

/** The line under the subject that says what to do, for the alerts that ask Amy to call someone back. */
function introLine(alert: PendingAlert, company: string): string | null {
  const when = alert.callbackWindow ? ` ${alert.callbackWindow}` : " soon";
  if (alert.kind === "agent_lead") return `A new customer called ${company}, and the assistant took their details. Please give them a call back${when}.`;
  if (alert.kind === "message") return `A customer left a voicemail for ${company}. Please give them a call back${when}.`;
  return null;
}

/** The call's own audio exists somewhere we can fetch it: a voicemail, or the assistant's conversation. */
export function hasCallRecording(alert: PendingAlert): boolean {
  if (alert.recordingDeclined) return false;
  return Boolean(alert.recordingUrl) || (alert.agentProvider === "elevenlabs" && Boolean(alert.conversationId));
}

function recordingLine(alert: PendingAlert, recording: RecordingState | undefined): string | null {
  if (alert.recordingDeclined) return "The caller asked not to be recorded, so there's no recording or transcript.";
  if (!hasCallRecording(alert)) return null;
  if (recording === "attached") return "The call recording is attached (MP3), so you can listen before you call back.";
  if (recording === "unavailable") return "The recording couldn't be attached this time. The conversation is on the lead page.";
  return "The call was recorded.";
}

function calledAtText(alert: PendingAlert): string | null {
  if (!alert.calledAt) return null;
  const format = (timeZone: string) =>
    new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
      .format(new Date(alert.calledAt!));
  try {
    return format(alert.timezone ?? "America/Chicago");
  } catch {
    return format("America/Chicago"); // a time zone the runtime doesn't know
  }
}

const SPEAKER: Record<string, string> = { agent: "Assistant", user: "Caller" };

function conversation(alert: PendingAlert): Array<{ who: string; said: string }> {
  return (alert.transcript ?? [])
    .filter((t) => SPEAKER[t.role] && t.message?.trim())
    .map((t) => ({ who: SPEAKER[t.role]!, said: t.message!.trim() }));
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/**
 * The call's record in Amy's inbox (Pavan, 2026-11-09): who to call back and when on top,
 * then the job, what happened, the recording, and the whole conversation at the bottom.
 */
function renderEmail(alert: PendingAlert, parts: EmailParts): RenderedAlert {
  const phone = formatUsPhone(alert.contactPhone);
  const callBack: Row[] = [
    ...(alert.contactName ? [{ label: "Name", text: alert.contactName }] : []),
    {
      label: "Phone",
      text: phone,
      html: alert.contactPhone ? `<a href="tel:${escapeHtml(alert.contactPhone)}" style="color:#0b57d0">${escapeHtml(phone)}</a>` : escapeHtml(phone),
    },
    { label: "Best time to call", text: alert.callbackWindow ?? "Not given" },
  ];
  const mapsSearch = alert.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(alert.address)}` : null;
  const job: Row[] = [
    ...(alert.address
      ? [{ label: "Address", text: alert.address, html: `${escapeHtml(alert.address)} · <a href="${escapeHtml(mapsSearch!)}" style="color:#0b57d0">Open in Google Maps</a>` }]
      : []),
    ...(alert.serviceWanted ? [{ label: "Wants", text: alert.serviceWanted }] : []),
    ...(alert.mapsVisible && MAPS_LINE[alert.mapsVisible] ? [{ label: "Google Maps", text: MAPS_LINE[alert.mapsVisible]! }] : []),
    ...(alert.siteVisit ? [{ label: "Site visit could be", text: alert.siteVisit }] : []),
    ...(alert.timing ? [{ label: "Timing", text: alert.timing }] : []),
    ...(alert.email ? [{ label: "Email", text: alert.email }] : []),
  ];
  const intro = introLine(alert, parts.company);
  const called = calledAtText(alert);
  const recording = recordingLine(alert, parts.recording);
  const turns = conversation(alert);

  const rowsText = (rows: Row[]) => rows.map((r) => `${r.label}: ${r.text}`);
  const body = [
    `${parts.subject}.`,
    ...(intro ? ["", intro] : []),
    ...(parts.urgent ? ["", `Why it's urgent: ${parts.urgent}`] : []),
    "",
    "CALL BACK",
    ...rowsText(callBack),
    ...(job.length ? ["", "THE JOB", ...rowsText(job)] : []),
    ...(alert.summary || called ? ["", "WHAT HAPPENED", ...(alert.summary ? [alert.summary] : []), ...(called ? [`Called: ${called}`] : [])] : []),
    ...(recording ? ["", recording] : []),
    "",
    `${parts.action}: ${parts.link}`,
    ...(turns.length ? ["", "THE CONVERSATION", ...turns.map((t) => `${t.who}: ${t.said}`)] : []),
  ].join("\n");

  const heading = (text: string) =>
    `<h3 style="margin:22px 0 8px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#5f6368">${escapeHtml(text)}</h3>`;
  const table = (rows: Row[]) =>
    `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">${rows
      .map(
        (r) =>
          `<tr><td style="padding:6px 12px 6px 0;color:#5f6368;width:150px;vertical-align:top">${escapeHtml(r.label)}</td>` +
          `<td style="padding:6px 0;font-weight:600;vertical-align:top">${r.html ?? escapeHtml(r.text)}</td></tr>`,
      )
      .join("")}</table>`;
  const html = [
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.45;color:#202124;max-width:640px">`,
    `<p style="margin:0 0 4px;font-size:18px;font-weight:700">${escapeHtml(parts.subject)}</p>`,
    ...(intro ? [`<p style="margin:8px 0 0">${escapeHtml(intro)}</p>`] : []),
    ...(parts.urgent
      ? [`<p style="margin:12px 0;padding:10px 14px;background:#fce8e6;border-radius:8px;color:#a50e0e;font-weight:700">Why it's urgent: ${escapeHtml(parts.urgent)}</p>`]
      : []),
    `<div style="margin-top:14px;padding:6px 16px 12px;background:#e6f4ea;border-radius:10px">${heading("Call back")}${table(callBack)}</div>`,
    ...(job.length ? [heading("The job"), table(job)] : []),
    ...(alert.summary || called
      ? [
          heading("What happened"),
          ...(alert.summary ? [`<p style="margin:0 0 6px">${escapeHtml(alert.summary)}</p>`] : []),
          ...(called ? [`<p style="margin:0;color:#5f6368">Called: ${escapeHtml(called)}</p>`] : []),
        ]
      : []),
    ...(recording ? [`<p style="margin:18px 0 0;padding:10px 14px;background:#f1f3f4;border-radius:8px">${escapeHtml(recording)}</p>`] : []),
    `<p style="margin:22px 0"><a href="${escapeHtml(parts.link)}" style="background:#0b57d0;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:700">${escapeHtml(parts.action)}: open the lead</a></p>`,
    ...(turns.length
      ? [
          heading("The conversation"),
          turns
            .map((t) => `<p style="margin:0 0 8px"><span style="color:#5f6368;font-weight:700">${escapeHtml(t.who)}:</span> ${escapeHtml(t.said)}</p>`)
            .join(""),
        ]
      : []),
    `</div>`,
  ].join("");

  return { subject: parts.subject, body, html };
}

/**
 * One text a day for calls held back from texting (looked like spam, or hung
 * up with no details), so a misjudged customer is still seen by morning.
 */
function renderDigest(alert: PendingAlert, baseUrl: string): RenderedAlert {
  const held = alert.detail?.held ?? 0;
  const link = new URL("/dashboard?view=quiet", baseUrl).toString();
  const company = alert.companyKind === "front_desk" ? "Office line" : alert.companyName;
  const subject = `${company}: ${held} call${held === 1 ? "" : "s"} in the last day looked like spam or left no details`;
  return { subject, body: `${subject}. Take a quick look in case one was a customer: ${link}` };
}

// ---------------------------------------------------------------- sending

export interface AlertSender {
  send(alert: PendingAlert, rendered: RenderedAlert): Promise<"sent" | "simulated">;
}

/** Records alerts without contacting anyone. The default until ALERT_MODE=live. */
export const simulatedSender: AlertSender = {
  async send(alert, rendered) {
    console.info(`[alert simulated] ${alert.channel} → ${alert.toAddress}: ${rendered.body}`);
    return "simulated";
  },
};

/** A 20-minute call is about 20 MB; anything larger goes without the audio rather than fail the email. */
const AUDIO_LIMIT_BYTES = 20 * 1024 * 1024;
/** The vendor finishes a conversation's audio shortly after the call; until this attempt, the email waits for it. */
const RECORDING_WAIT_ATTEMPTS = 3;

/** The call's audio, or null when it can't be had (not ready, deleted, too large, no credentials). */
async function fetchRecording(alert: PendingAlert, env: AppEnv, fetchImpl: typeof fetch): Promise<Uint8Array | null> {
  try {
    let audio: Uint8Array | null = null;
    if (alert.agentProvider === "elevenlabs" && alert.conversationId && env.elevenLabsApiKey) {
      audio = await getConversationAudio({ apiKey: env.elevenLabsApiKey, conversationId: alert.conversationId, fetchImpl, timeoutMs: 20_000 });
    } else if (alert.recordingUrl && /^https:\/\/api\.twilio\.com\//.test(alert.recordingUrl) && env.twilioAccountSid && env.twilioAuthToken) {
      // Twilio media keeps HTTP auth on, so the recording is fetched with the account's credentials.
      const res = await fetchImpl(`${alert.recordingUrl}.mp3`, {
        headers: { authorization: `Basic ${Buffer.from(`${env.twilioAccountSid}:${env.twilioAuthToken}`).toString("base64")}` },
        signal: AbortSignal.timeout(20_000),
      });
      audio = res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
    }
    return audio && audio.byteLength > 0 && audio.byteLength <= AUDIO_LIMIT_BYTES ? audio : null;
  } catch {
    return null;
  }
}

/** call-2026-11-09-sam-patel.mp3: sorts by date in a download folder and says who it was. */
function recordingFilename(alert: PendingAlert): string {
  const day = alert.calledAt
    ? new Intl.DateTimeFormat("en-CA", { timeZone: alert.timezone ?? "America/Chicago" }).format(new Date(alert.calledAt))
    : "call";
  const who = (alert.contactName ?? `caller-${(alert.contactPhone ?? "").replace(/\D/g, "").slice(-4)}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `call-${day}-${who || "caller"}.mp3`;
}

interface MailMessage {
  /** Display name for the From line; the address is the sending account's own. */
  fromName: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments: Array<{ filename: string; content: Uint8Array }>;
}

/** The slice of a nodemailer transport the Gmail path uses; tests pass a fake. */
export interface SmtpTransport {
  sendMail(message: Record<string, unknown>): Promise<unknown>;
}

/**
 * How email leaves: the business Gmail when its app password is set (free, from Amy's own
 * address, so it lands in her inbox), else Resend. Null when neither is set up.
 */
function mailerFromEnv(env: AppEnv, fetchImpl: typeof fetch, smtp?: SmtpTransport): ((message: MailMessage) => Promise<void>) | null {
  if (env.gmailUser && env.gmailAppPassword) {
    const gmail = env.gmailUser;
    const transport =
      smtp ??
      nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: gmail, pass: env.gmailAppPassword } });
    return async (m) => {
      await transport.sendMail({
        from: { name: m.fromName, address: gmail },
        to: m.to,
        subject: m.subject,
        text: m.text,
        ...(m.html ? { html: m.html } : {}),
        attachments: m.attachments.map((a) => ({ filename: a.filename, content: Buffer.from(a.content), contentType: "audio/mpeg" })),
      });
    };
  }
  if (env.resendApiKey && env.alertEmailFrom) {
    const { resendApiKey, alertEmailFrom } = env;
    return async (m) => {
      const res = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${resendApiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          from: alertEmailFrom,
          to: [m.to],
          subject: m.subject,
          text: m.text,
          ...(m.html ? { html: m.html } : {}),
          ...(m.attachments.length
            ? { attachments: m.attachments.map((a) => ({ filename: a.filename, content: Buffer.from(a.content).toString("base64") })) }
            : {}),
        }),
      });
      if (!res.ok) throw new Error(`Resend responded ${res.status}`);
    };
  }
  return null;
}

export function senderFromEnv(env: AppEnv, deps: { fetchImpl?: typeof fetch; smtp?: SmtpTransport } = {}): AlertSender {
  if (env.alertMode !== "live") return simulatedSender;
  const fetchImpl = deps.fetchImpl ?? fetch;
  const mail = mailerFromEnv(env, fetchImpl, deps.smtp);
  return {
    async send(alert, rendered) {
      if (alert.channel === "sms") {
        if (!env.twilioAccountSid || !env.twilioAuthToken || !env.twilioAlertFrom) {
          throw new Error("SMS alerts need TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_ALERT_FROM");
        }
        await twilio(env.twilioAccountSid, env.twilioAuthToken).messages.create({
          from: env.twilioAlertFrom,
          to: alert.toAddress,
          body: rendered.body,
        });
        return "sent";
      }
      if (!mail) {
        throw new Error("Email alerts need GMAIL_USER and GMAIL_APP_PASSWORD (or RESEND_API_KEY and ALERT_EMAIL_FROM)");
      }
      let email = rendered;
      const attachments: MailMessage["attachments"] = [];
      if (alert.kind !== "digest" && hasCallRecording(alert)) {
        const audio = await fetchRecording(alert, env, fetchImpl);
        // Retried by the next sweep (about a minute), so the audio usually makes it; after that, the email goes without.
        if (!audio && alert.attempts < RECORDING_WAIT_ATTEMPTS) throw new Error("call recording not ready yet; will retry");
        if (audio) attachments.push({ filename: recordingFilename(alert), content: audio });
        email = renderAlert(alert, env.publicBaseUrl, audio ? "attached" : "unavailable");
      }
      await mail({
        fromName: `${alert.companyKind === "front_desk" ? "Office line" : alert.companyName} (Lightline)`,
        to: alert.toAddress,
        subject: email.subject,
        text: email.body,
        ...(email.html ? { html: email.html } : {}),
        attachments,
      });
      return "sent";
    },
  };
}

const MAX_ATTEMPTS = 5;

/** Sends pending alerts. Failures go back to pending until MAX_ATTEMPTS, then stay failed for review. */
export async function drainAlerts(
  db: Queryable,
  sender: AlertSender,
  baseUrl: string,
): Promise<{ delivered: number; failed: number }> {
  let delivered = 0;
  let failed = 0;
  for (;;) {
    const batch = await claimPendingAlerts(db, 20, MAX_ATTEMPTS);
    if (batch.length === 0) break;
    for (const alert of batch) {
      try {
        const status = await sender.send(alert, renderAlert(alert, baseUrl));
        await settleAlert(db, { id: alert.id, status });
        delivered += 1;
      } catch (error) {
        const finalAttempt = alert.attempts >= MAX_ATTEMPTS;
        await settleAlert(db, {
          id: alert.id,
          status: finalAttempt ? "failed" : "pending",
          error: (error as Error).message.slice(0, 500),
        });
        failed += 1;
      }
    }
    if (failed > 0) break; // do not spin on a failing provider; the next request retries
  }
  return { delivered, failed };
}
