import type { DynamicVariables } from "./dynamic-variables";

/**
 * ElevenLabs "register call": our server keeps the Twilio number and its
 * webhooks, asks ElevenLabs for TwiML that streams this live call to the
 * agent, and returns that TwiML to Twilio. ElevenLabs gets no Twilio
 * credentials, so it cannot transfer the call; our own TwiML does that.
 * https://elevenlabs.io/docs/api-reference/integrations/twilio/register-call
 */
export interface RegisterCallInput {
  apiKey: string;
  agentId: string;
  from: string;
  to: string;
  dynamicVariables: DynamicVariables;
  /** Twilio gives our webhook 15 s in total; the agent hand-off gets a small share of it. */
  timeoutMs: number;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

export class RegisterCallError extends Error {
  constructor(
    message: string,
    readonly kind: "timeout" | "http" | "malformed",
    readonly status?: number,
  ) {
    super(message);
    this.name = "RegisterCallError";
  }
}

export async function registerCall(input: RegisterCallInput): Promise<string> {
  const doFetch = input.fetchImpl ?? fetch;
  const url = new URL("/v1/convai/twilio/register-call", input.baseUrl ?? "https://api.elevenlabs.io");
  let res: Response;
  try {
    res = await doFetch(url, {
      method: "POST",
      headers: { "xi-api-key": input.apiKey, "content-type": "application/json" },
      body: JSON.stringify({
        agent_id: input.agentId,
        from_number: input.from,
        to_number: input.to,
        direction: "inbound",
        conversation_initiation_client_data: { dynamic_variables: input.dynamicVariables },
      }),
      signal: AbortSignal.timeout(input.timeoutMs),
    });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    throw new RegisterCallError(timedOut ? "register-call timed out" : "register-call request failed", timedOut ? "timeout" : "http");
  }
  if (!res.ok) {
    // The body may echo request data; keep only the status in logs.
    throw new RegisterCallError(`register-call responded ${res.status}`, "http", res.status);
  }
  return extractTwiml(await res.text());
}

/** Accepts raw TwiML, or a JSON body carrying it, and checks it is TwiML at all. */
export function extractTwiml(body: string): string {
  let text = body.trim();
  if (text.startsWith("{") || text.startsWith('"')) {
    try {
      const parsed: unknown = JSON.parse(text);
      if (typeof parsed === "string") text = parsed;
      else if (parsed && typeof parsed === "object") {
        const candidate = Object.values(parsed).find((v): v is string => typeof v === "string" && v.includes("<Response"));
        if (candidate) text = candidate;
      }
    } catch {
      throw new RegisterCallError("register-call returned unparseable JSON", "malformed");
    }
  }
  if (!/<Response[\s>]/.test(text) || !/<Connect[\s>/]/.test(text)) {
    throw new RegisterCallError("register-call did not return a <Connect> TwiML response", "malformed");
  }
  return text;
}

const CONNECT_OPEN = /<Connect(\s[^>]*)?>/;

/**
 * Makes the agent leg hand control back to us. When the agent's stream ends
 * (agent hangs up, vendor drops), Twilio requests `actionUrl` instead of
 * hanging up, so we can still capture the caller. Any action the vendor set
 * is replaced: the decision about what happens next is ours.
 */
export function withConnectAction(twiml: string, actionUrl: string): string {
  const match = CONNECT_OPEN.exec(twiml);
  if (!match) throw new RegisterCallError("no <Connect> element to attach an action to", "malformed");
  const attrs = (match[1] ?? "").replace(/\s(action|method)="[^"]*"/g, "");
  const escaped = actionUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  return twiml.replace(CONNECT_OPEN, `<Connect${attrs} action="${escaped}" method="POST">`);
}
