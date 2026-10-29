import { NextResponse } from "next/server";
import { createWebLead, recordLeadFact, requestCallback, type FactField } from "@/lib/db";
import { normalizeUsPhone } from "@/lib/telephony";
import { getDb } from "@/lib/server/db";
import { readEnv } from "@/lib/server/env";
import { classifyIntent } from "@/lib/agents/lead-card";
import { checkStamp, SPAM_THRESHOLD, spamScore } from "@/lib/server/form-guard";
import { formSecret } from "@/lib/server/form-secret";
import { scheduleBackgroundWork } from "@/lib/server/route";
import { allowRequest, clientIp } from "@/lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ATTRIBUTION_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "cohort", "qr"] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const text = (value: FormDataEntryValue | null, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

/**
 * Web quote requests enter the same lead model as phone calls: same lead
 * table, same facts with provenance (source "web_form"), same alerts, same
 * console. Rejected (spam) posts get the same thank-you page as real ones.
 */
export async function POST(req: Request): Promise<Response> {
  const env = readEnv();
  const form = await req.formData();
  const thanks = NextResponse.redirect(new URL("/thanks", env.publicBaseUrl), 303);
  const back = (error: string) => {
    const url = new URL("/christmas-lights-austin", env.publicBaseUrl);
    url.searchParams.set("error", error);
    url.hash = "quote";
    return NextResponse.redirect(url, 303);
  };

  if (!allowRequest(`web-lead:${clientIp(req)}`, 5, 10 * 60 * 1000)) return thanks;
  if (text(form.get("company"), 200)) return thanks; // honeypot
  if (checkStamp(formSecret(env), text(form.get("stamp"), 100)) !== "ok") return thanks;

  const fields = {
    name: text(form.get("name"), 80),
    address: text(form.get("address"), 200),
    service: text(form.get("service"), 200),
    timing: text(form.get("timing"), 120),
  };
  if (spamScore(fields) >= SPAM_THRESHOLD) return thanks;

  const campaignId = text(form.get("campaign"), 64);
  const phone = normalizeUsPhone(text(form.get("phone"), 32));
  if (!UUID.test(campaignId)) return back("Something went wrong. Please call us instead.");
  if (!fields.name) return back("Please add your name.");
  if (!phone) return back("Please add a 10-digit phone number.");
  if (fields.address.length < 5) return back("Please add the address you'd like lit.");

  const attribution: Record<string, string> = {};
  for (const key of ATTRIBUTION_KEYS) {
    const value = text(form.get(key), 100);
    if (value) attribution[key] = value;
  }

  const db = await getDb();
  const leadId = await createWebLead(db, {
    campaignId,
    name: fields.name,
    phone,
    address: fields.address,
    smsConsent: form.get("sms_consent") === "yes",
    attribution,
  });
  const facts: Array<[FactField, string]> = [
    ["caller_name", fields.name],
    ["property_address", fields.address],
    ["service_requested", fields.service],
    ["desired_timing", fields.timing],
  ];
  for (const [field, value] of facts) {
    if (value) await recordLeadFact(db, { leadId, callId: null, field, value, source: "web_form", confidence: 1, evidence: null });
  }
  // Same intent rules as a phone lead, from what the visitor typed.
  const intent = classifyIntent({
    facts: Object.fromEntries(facts.filter(([, v]) => v)),
    compliance: null,
    wrapUpOutcome: null,
    transferred: false,
  });
  await db.query("select app.apply_post_call($1, null, $2, null, $3::jsonb, false)", [
    leadId,
    intent.intent,
    JSON.stringify({ intentReasons: intent.reasons, captured: intent.captured, missing: intent.missing }),
  ]);
  // Web requests wait in the same "callback" queue as recovered calls.
  await requestCallback(db, {
    leadId,
    callId: null,
    window: null,
    reason: "Web quote request",
    priority: intent.intent === "hot" ? "high" : "normal",
  });
  scheduleBackgroundWork();
  return thanks;
}
