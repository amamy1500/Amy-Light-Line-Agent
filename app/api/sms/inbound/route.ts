import { saveInboundSms } from "@/lib/db/screening";
import { getDb } from "@/lib/server/db";
import { readEnv } from "@/lib/server/env";
import { readTwilioRequest, twimlResponse } from "@/lib/server/twilio-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A text sent to one of our numbers (Twilio-signed). Kept so nothing is lost,
 * above all a verification code: Google may text one when the new number goes
 * on the listing (docs/research/new-number-rollout.md). No reply is sent.
 */
export async function POST(req: Request): Promise<Response> {
  const parsed = await readTwilioRequest(req, readEnv());
  if (!parsed.ok) return parsed.response;
  const p = parsed.params;
  await saveInboundSms(await getDb(), {
    twilioSid: p.MessageSid ?? p.SmsSid ?? "",
    to: p.To ?? "",
    from: p.From ?? null,
    body: p.Body ?? "",
  });
  return twimlResponse('<?xml version="1.0" encoding="UTF-8"?><Response/>');
}
