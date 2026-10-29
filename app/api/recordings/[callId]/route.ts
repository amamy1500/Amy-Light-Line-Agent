import { getRecordingUrl } from "@/lib/db";
import { isOperator } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { readEnv } from "@/lib/server/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Streams a call recording to a signed-in operator. Twilio media is fetched
 * with account credentials (HTTP auth on media URLs stays enabled), so a
 * recording link is never usable by anyone who merely sees it.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ callId: string }> }): Promise<Response> {
  if (!(await isOperator())) return new Response("Unauthorized", { status: 401 });
  const { callId } = await ctx.params;
  if (!UUID.test(callId)) return new Response("Not found", { status: 404 });

  const url = await getRecordingUrl(await getDb(), callId);
  if (!url) return new Response("Not found", { status: 404 });

  const env = readEnv();
  if (!env.twilioAccountSid || !env.twilioAuthToken) {
    return new Response("Recording playback needs TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN", { status: 503 });
  }
  if (!/^https:\/\/api\.twilio\.com\//.test(url)) return new Response("Not found", { status: 404 });

  const upstream = await fetch(`${url}.mp3`, {
    headers: {
      authorization: `Basic ${Buffer.from(`${env.twilioAccountSid}:${env.twilioAuthToken}`).toString("base64")}`,
    },
  });
  if (!upstream.ok || !upstream.body) return new Response("Recording unavailable", { status: 502 });
  return new Response(upstream.body, {
    headers: { "content-type": "audio/mpeg", "cache-control": "private, no-store" },
  });
}
