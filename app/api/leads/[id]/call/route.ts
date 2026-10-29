import { NextResponse } from "next/server";
import { callbackTarget } from "@/lib/db/callback";
import { startCallbackCall } from "@/lib/telephony/rest";
import { isOperator } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { readEnv } from "@/lib/server/env";
import { UUID } from "@/lib/server/forms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Amy taps "Call back": Twilio rings her phone from the business number, then
 * connects her to the customer showing that same number, so the customer sees
 * the number they called rather than an unknown cell. Without Twilio
 * credentials (development) the call is recorded as simulated, not placed.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await isOperator())) return new Response("Unauthorized", { status: 401 });
  const env = readEnv();
  const { id } = await ctx.params;
  if (!UUID.test(id)) return new Response("Not found", { status: 404 });
  const page = new URL(`/leads/${id}`, env.publicBaseUrl);

  const db = await getDb();
  const target = await callbackTarget(db, id);
  if (!target) return new Response("Not found", { status: 404 });
  if (!target.customerPhone) {
    page.searchParams.set("error", "There's no phone number on file for this caller.");
    return NextResponse.redirect(page, 303);
  }

  const bridge = new URL("/api/voice/callback-bridge", env.publicBaseUrl);
  bridge.searchParams.set("lead", id);
  const live = Boolean(env.twilioAccountSid && env.twilioAuthToken);
  try {
    const callSid = live
      ? await startCallbackCall({
          accountSid: env.twilioAccountSid!,
          authToken: env.twilioAuthToken!,
          ownerPhone: target.ownerPhone,
          lineE164: target.lineE164,
          url: bridge.toString(),
        })
      : null;
    await db.query("select app.emit($1, $2, 'lead', $3, $4, $5::jsonb, 'user', 'operator')", [
      target.tenantId,
      target.businessId,
      id,
      live ? "callback.dialed" : "callback.simulated",
      JSON.stringify({ call_sid: callSid, from: target.lineE164 }),
    ]);
    page.searchParams.set("notice", live ? "Your phone will ring in a moment. Answer it to be connected." : "Simulated: no Twilio account is set up here.");
  } catch {
    page.searchParams.set("error", "The call couldn't be started. Try again in a minute.");
  }
  return NextResponse.redirect(page, 303);
}
