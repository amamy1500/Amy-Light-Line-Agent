import type { AiMode } from "@/lib/business-rules/config";
import { formatUsPhone } from "@/lib/telephony/phone";
import type { AppEnv } from "./env";

/**
 * "Is this ready for real callers?" as a list of checks the System page
 * shows. Pure: it reads settings and rows, never calls Twilio or ElevenLabs,
 * and never prints a secret (only whether it is set).
 */
export type CheckState = "ok" | "warn" | "missing";

export interface ReadinessCheck {
  id: string;
  label: string;
  state: CheckState;
  /** What is true now, in plain words. */
  detail: string;
  /** What to do about it; empty when nothing is needed. */
  fix: string;
}

export interface ReadinessInput {
  env: Pick<
    AppEnv,
    | "publicBaseUrl"
    | "twilioAccountSid"
    | "twilioAuthToken"
    | "twilioAlertFrom"
    | "databaseUrl"
    | "operatorToken"
    | "alertMode"
    | "resendApiKey"
    | "alertEmailFrom"
    | "agentProvider"
    | "elevenLabsApiKey"
    | "elevenLabsWebhookSecret"
    | "agentToolSecret"
    | "cronSecret"
  >;
  /** Twilio's own fallback (a TwiML Bin) that rings the owner if this app is down. */
  twilioFallbackUrl: string | undefined;
  /** Every number callers dial, and whose phone it rings. */
  lines: Array<{ e164: string; ownerRingE164: string; ringOwner: boolean }>;
  aiMode: AiMode;
  agentId: string | undefined;
  alertContacts: { sms: string[]; email: string[] };
}

/** 555-01xx numbers are fictional: the development seed uses them so nothing real rings. */
export function isPlaceholderNumber(e164: string): boolean {
  return /^\+1\d{3}555\d{4}$/.test(e164);
}

const check = (id: string, label: string, state: CheckState, detail: string, fix = ""): ReadinessCheck => ({ id, label, state, detail, fix });

export function readinessChecks(input: ReadinessInput): ReadinessCheck[] {
  const { env } = input;
  const realLines = input.lines.filter((l) => !isPlaceholderNumber(l.e164));
  const ringPhones = [...new Set(input.lines.filter((l) => l.ringOwner).map((l) => l.ownerRingE164))];
  const localOnly = /^http:\/\/(localhost|127\.0\.0\.1)/.test(env.publicBaseUrl);

  return [
    localOnly
      ? check("public_url", "Reachable by Twilio", "warn", `The app's address is ${env.publicBaseUrl}: only this computer can reach it.`, "For a test, run `npm run live` (it opens a public tunnel). For real customers, deploy to always-on hosting.")
      : check("public_url", "Reachable by Twilio", "ok", `Twilio calls ${env.publicBaseUrl}.`),

    env.twilioAccountSid && env.twilioAuthToken
      ? check("twilio_keys", "Twilio keys", "ok", "Account ID and secret are set.")
      : check("twilio_keys", "Twilio keys", "missing", "Twilio's account ID or secret isn't set, so calls can't be checked or redirected.", "Run scripts/live/wizard.sh and type them at its hidden prompts."),

    realLines.length
      ? check("line", "Phone number", "ok", `Callers dial ${realLines.map((l) => formatUsPhone(l.e164)).join(", ")}.`)
      : check("line", "Phone number", "missing", "Only test numbers (555) are set up; no real number points here.", "Put the Christmas number in CLG_MAIN_NUMBER (the wizard does this), then run setup."),

    ringPhones.length === 0
      ? check("owner_phone", "Phone that rings first", "ok", "No line rings a person first: the assistant answers.")
      : ringPhones.some(isPlaceholderNumber)
        ? check("owner_phone", "Phone that rings first", "missing", "The line rings a placeholder (555) number, so nobody's phone would ring.", "Set the owner's cell in Settings → Owner & ring phone.")
        : check("owner_phone", "Phone that rings first", "ok", `Rings ${ringPhones.map(formatUsPhone).join(", ")} first.`),

    input.aiMode === "off"
      ? check("assistant", "AI assistant", "warn", "Switched off: missed callers leave a recorded message.", "Turn it on in Calls → Who answers when you're ready.")
      : !input.agentId
        ? check("assistant", "AI assistant", "missing", "No ElevenLabs agent is connected, so missed callers get the recorded message.", "Run `npm run live` with the ElevenLabs key; it builds the agent.")
        : env.agentProvider !== "elevenlabs"
          ? check("assistant", "AI assistant", "warn", `Connected to the ${env.agentProvider === "simulator" ? "simulator (test only)" : "no voice service"}, not ElevenLabs.`, "Set AGENT_PROVIDER=elevenlabs and the ElevenLabs key.")
          : check("assistant", "AI assistant", "ok", "ElevenLabs agent connected."),

    env.elevenLabsWebhookSecret && env.agentToolSecret
      ? check("agent_secrets", "Assistant's saving and summaries", "ok", "Tool and post-call secrets are set.")
      : check("agent_secrets", "Assistant's saving and summaries", "missing", "Without these the assistant can't save details or send call summaries.", "Run `npm run live`; it creates and stores both."),

    input.alertContacts.email.length === 0
      ? check("alerts_email", "Email alerts", "missing", "No email address gets call alerts.", "Add the inbox Amy actually reads in Settings → Alerts.")
      : env.alertMode !== "live"
        ? check("alerts_email", "Email alerts", "warn", `Recorded but not sent (simulate mode). Would go to ${input.alertContacts.email.join(", ")}.`, "Set ALERT_MODE=live with RESEND_API_KEY and ALERT_EMAIL_FROM.")
        : !env.resendApiKey || !env.alertEmailFrom
          ? check("alerts_email", "Email alerts", "missing", "Live mode is on but the email sender isn't set up.", "Set RESEND_API_KEY and ALERT_EMAIL_FROM.")
          : check("alerts_email", "Email alerts", "ok", `Sent to ${input.alertContacts.email.join(", ")}.`),

    input.alertContacts.sms.length === 0
      ? check("alerts_sms", "Text alerts", "warn", "No phone gets text alerts; email still does.", "Optional: add a cell in Settings → Alerts after the texting registration.")
      : env.alertMode === "live" && env.twilioAlertFrom
        ? check("alerts_sms", "Text alerts", "ok", `Texted to ${input.alertContacts.sms.map(formatUsPhone).join(", ")}.`)
        : check("alerts_sms", "Text alerts", "warn", "Texts aren't sent yet: they need Twilio's texting (A2P) registration and TWILIO_ALERT_FROM. Email still goes out.", "Register texting in Twilio, then set TWILIO_ALERT_FROM."),

    input.twilioFallbackUrl
      ? check("fallback", "Backup if this app is down", "ok", "Twilio has a backup script that rings the owner and takes a message.")
      : check("fallback", "Backup if this app is down", "warn", "If this app is down, callers hear Twilio's error message.", "Create the TwiML Bin (docs/prior-work/fallback-twiml-bin.xml) and set TWILIO_FALLBACK_URL."),

    env.databaseUrl
      ? check("database", "Database", "ok", "Hosted Postgres.")
      : check("database", "Database", "warn", "Embedded database on this computer: fine for testing, gone if the computer is.", "Use hosted Postgres (DATABASE_URL) for real customers."),

    env.cronSecret
      ? check("jobs", "Follow-ups and daily summary", "ok", "Scheduled job sweep is protected and can run.")
      : check("jobs", "Follow-ups and daily summary", "warn", "No CRON_SECRET: summaries and callback reminders run only while `npm run live` is running.", "Set CRON_SECRET and the hosting's scheduled job."),

    env.operatorToken
      ? check("console_login", "Console password", "ok", "The console needs a sign-in.")
      : check("console_login", "Console password", "warn", "The console has no access code.", "Set OPERATOR_TOKEN before the console is on the internet."),
  ];
}
