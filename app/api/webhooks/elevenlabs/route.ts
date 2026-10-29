import { handlePostCallWebhook } from "@/lib/server/post-call-webhook";
import { getDb } from "@/lib/server/db";
import { readEnv } from "@/lib/server/env";
import { scheduleBackgroundWork } from "@/lib/server/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ElevenLabs post-call webhook (HMAC-signed). Raw body is read once and verified before parsing. */
export async function POST(req: Request): Promise<Response> {
  const rawBody = await req.text();
  const result = await handlePostCallWebhook({
    db: await getDb(),
    secret: readEnv().elevenLabsWebhookSecret,
    signature: req.headers.get("elevenlabs-signature"),
    rawBody,
    nowSeconds: Math.floor(Date.now() / 1000),
  });
  if (result.status === 200) scheduleBackgroundWork();
  return Response.json(result.body, { status: result.status });
}
