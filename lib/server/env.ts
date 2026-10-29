/**
 * Server-only configuration. Every secret comes from the environment (the
 * host's secret settings in production, an untracked .env.local in
 * development); nothing secret is ever committed. See .env.example.
 */
export interface AppEnv {
  /** Public origin Twilio calls, e.g. https://clg.example.com. Signatures are checked against it. */
  publicBaseUrl: string;
  twilioAuthToken: string | undefined;
  twilioAccountSid: string | undefined;
  /** Registered (A2P 10DLC) number that sends alert texts to the owner. */
  twilioAlertFrom: string | undefined;
  /** Server-only Postgres URL (Supabase). Absent in development → embedded database. */
  databaseUrl: string | undefined;
  pgliteDir: string | undefined;
  /** Shared secret for the operator dashboard until per-user sign-in lands. */
  operatorToken: string | undefined;
  /** "live" sends real texts/emails; anything else records them as simulated. */
  alertMode: "live" | "simulate";
  resendApiKey: string | undefined;
  alertEmailFrom: string | undefined;
  /**
   * Which voice agent takes calls: "elevenlabs" (needs ELEVENLABS_API_KEY),
   * "simulator" (development; nothing leaves the machine) or "none".
   */
  agentProvider: "elevenlabs" | "simulator" | "none";
  elevenLabsApiKey: string | undefined;
  /** API origin; overridden only to point at a local stub in load tests. */
  elevenLabsApiBase: string;
  /** HMAC secret ElevenLabs signs post-call webhooks with. */
  elevenLabsWebhookSecret: string | undefined;
  /** Header secret the agent's tools send to our gateway. */
  agentToolSecret: string | undefined;
  /** Bearer secret for the scheduled job sweeper. */
  cronSecret: string | undefined;
  isProduction: boolean;
}

const blank = (value: string | undefined) => (value && value.trim() ? value.trim() : undefined);

export function readEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const isProduction = source.NODE_ENV === "production";
  // Render sets RENDER_EXTERNAL_URL (https://<service>.onrender.com) at build and run time.
  const publicBaseUrl =
    blank(source.PUBLIC_BASE_URL) ?? blank(source.RENDER_EXTERNAL_URL) ?? (isProduction ? undefined : "http://localhost:3000");
  if (!publicBaseUrl) throw new Error("PUBLIC_BASE_URL is required in production");
  const requested = blank(source.AGENT_PROVIDER);
  const agentProvider =
    requested === "elevenlabs" || requested === "simulator" || requested === "none"
      ? requested
      : blank(source.ELEVENLABS_API_KEY)
        ? "elevenlabs"
        : "none";
  if (isProduction && agentProvider === "simulator") {
    throw new Error("AGENT_PROVIDER=simulator is not allowed in production");
  }
  return {
    publicBaseUrl,
    twilioAuthToken: blank(source.TWILIO_AUTH_TOKEN),
    twilioAccountSid: blank(source.TWILIO_ACCOUNT_SID),
    twilioAlertFrom: blank(source.TWILIO_ALERT_FROM),
    databaseUrl: blank(source.DATABASE_URL),
    pgliteDir: blank(source.PGLITE_DIR),
    operatorToken: blank(source.OPERATOR_TOKEN),
    alertMode: source.ALERT_MODE === "live" ? "live" : "simulate",
    resendApiKey: blank(source.RESEND_API_KEY),
    alertEmailFrom: blank(source.ALERT_EMAIL_FROM),
    agentProvider,
    elevenLabsApiKey: blank(source.ELEVENLABS_API_KEY),
    elevenLabsApiBase: blank(source.ELEVENLABS_API_BASE) ?? "https://api.elevenlabs.io",
    elevenLabsWebhookSecret: blank(source.ELEVENLABS_WEBHOOK_SECRET),
    agentToolSecret: blank(source.AGENT_TOOL_SECRET),
    cronSecret: blank(source.CRON_SECRET),
    isProduction,
  };
}
