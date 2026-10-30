import { claimPendingAlerts, settleAlert, type AlertKind, type PendingAlert, type Queryable } from "@/lib/db";
import type { UrgentKind } from "@/lib/db/repo";
import { formatUsPhone } from "@/lib/telephony";
import twilio from "twilio";
import type { AppEnv } from "./env";
import { sourceLabel } from "./voice";

export interface RenderedAlert {
  subject: string;
  body: string;
}

const SMS_LIMIT = 320;

const HEADLINE: Record<AlertKind, (who: string) => string> = {
  message: (who) => `New voicemail from ${who}`,
  abandoned: (who) => `Missed call from ${who} (no message left)`,
  answered: (who) => `You took a call from ${who}`,
  web_form: (who) => `Quote request from ${who}`,
  agent_lead: (who) => `Your assistant took a call from ${who}`,
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

export function renderAlert(alert: PendingAlert, baseUrl: string): RenderedAlert {
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

  if (alert.channel === "email") {
    // The email is the call's record in Amy's inbox: everything at a glance.
    const body = [
      `${subject}.`,
      "",
      urgent ? `Why it's urgent: ${urgent}` : null,
      alert.summary ? `What happened: ${alert.summary}` : null,
      alert.contactName ? `Name: ${alert.contactName}` : null,
      `Phone: ${formatUsPhone(alert.contactPhone)}`,
      alert.email ? `Email: ${alert.email}` : null,
      alert.address ? `Address: ${alert.address}` : null,
      alert.serviceWanted ? `Wants: ${alert.serviceWanted}` : null,
      alert.timing ? `Timing: ${alert.timing}` : null,
      alert.callbackWindow ? `Best time to call: ${alert.callbackWindow}` : null,
      visit ? `Google Maps: ${visit}` : null,
      alert.siteVisit ? `Site visit could be: ${alert.siteVisit}` : null,
      "",
      `${action}: ${link}`,
    ]
      .filter((l) => l !== null)
      .join("\n");
    return { subject, body };
  }

  let body = `${subject}.${details ? ` ${details}.` : ""} ${action}: ${link}`;
  if (body.length > SMS_LIMIT) {
    const room = SMS_LIMIT - (` ${action}: ${link}`.length + 1);
    body = `${`${subject}.${details ? ` ${details}.` : ""}`.slice(0, Math.max(0, room - 1))}… ${action}: ${link}`;
  }
  return { subject, body };
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

export function senderFromEnv(env: AppEnv): AlertSender {
  if (env.alertMode !== "live") return simulatedSender;
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
      if (!env.resendApiKey || !env.alertEmailFrom) {
        throw new Error("Email alerts need RESEND_API_KEY and ALERT_EMAIL_FROM");
      }
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${env.resendApiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ from: env.alertEmailFrom, to: [alert.toAddress], subject: rendered.subject, text: rendered.body }),
      });
      if (!res.ok) throw new Error(`Resend responded ${res.status}`);
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
