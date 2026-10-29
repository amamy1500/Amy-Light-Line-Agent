import { isValidTwilioSignature } from "@/lib/telephony";
import type { AppEnv } from "./env";

export type TwilioParams = Record<string, string>;

export type TwilioRequestResult = { ok: true; params: TwilioParams } | { ok: false; response: Response };

/**
 * Reads a Twilio webhook and verifies its signature against the PUBLIC URL
 * (PUBLIC_BASE_URL + path + query), never the Host header, so a proxy or a
 * spoofed Host cannot change what is verified.
 */
export async function readTwilioRequest(req: Request, env: AppEnv): Promise<TwilioRequestResult> {
  const form = await req.formData();
  const params: TwilioParams = {};
  form.forEach((value, key) => {
    if (typeof value === "string") params[key] = value;
  });

  const requested = new URL(req.url);
  const publicUrl = new URL(requested.pathname + requested.search, env.publicBaseUrl).toString();
  const signature = req.headers.get("x-twilio-signature");

  if (!isValidTwilioSignature({ authToken: env.twilioAuthToken, signature, url: publicUrl, params })) {
    return { ok: false, response: new Response("Forbidden", { status: 403 }) };
  }
  return { ok: true, params };
}

export function twimlResponse(xml: string): Response {
  return new Response(xml, { status: 200, headers: { "content-type": "text/xml; charset=utf-8" } });
}
