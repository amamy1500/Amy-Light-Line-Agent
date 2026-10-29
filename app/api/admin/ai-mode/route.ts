import { NextResponse } from "next/server";
import { AiMode, parseBusinessConfig } from "@/lib/business-rules/config";
import { activateConfig } from "@/lib/db/config";
import { officeBusinesses } from "@/lib/db/dashboard";
import { isOperator } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { readEnv } from "@/lib/server/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The kill switch. Saves a new config version with the chosen AI mode for
 * every company the office answers for (and the shared line), so one switch
 * turns the assistant off everywhere; the next call routes by it. "off" sends
 * every unanswered call to message capture. Each change is an audited event
 * with the old version kept.
 */
export async function POST(req: Request): Promise<Response> {
  if (!(await isOperator())) return new Response("Unauthorized", { status: 401 });
  const env = readEnv();
  const back = new URL("/dashboard", env.publicBaseUrl);
  const mode = AiMode.safeParse((await req.formData()).get("mode"));
  if (!mode.success) {
    back.searchParams.set("error", "That mode isn't available.");
    return NextResponse.redirect(back, 303);
  }
  const db = await getDb();
  const businesses = await officeBusinesses(db);
  if (businesses.length === 0) return new Response("No business configured", { status: 409 });
  for (const business of businesses) {
    const current = parseBusinessConfig(business.config);
    if (current.ai.mode === mode.data) continue;
    await activateConfig(db, {
      tenantId: business.tenantId,
      businessId: business.businessId,
      config: { ...current, ai: { ...current.ai, mode: mode.data } },
      createdBy: "operator",
    });
  }
  return NextResponse.redirect(back, 303);
}
