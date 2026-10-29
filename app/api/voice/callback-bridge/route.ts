import { callbackTarget } from "@/lib/db/callback";
import { twimlRoute } from "@/lib/server/route";
import { UUID } from "@/lib/server/forms";
import { callbackBridgeTwiml, hangupTwiml } from "@/lib/telephony";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Amy answered her callback ring (Twilio-signed): connect her to the customer from the business number. */
export const POST = twimlRoute(async (_p, deps, query) => {
  const leadId = query.get("lead") ?? "";
  if (!UUID.test(leadId)) return hangupTwiml();
  const target = await callbackTarget(deps.db, leadId);
  if (!target) return hangupTwiml();
  return callbackBridgeTwiml({ customerName: target.customerName, customerPhone: target.customerPhone, lineE164: target.lineE164 });
});
