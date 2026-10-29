import { NextResponse } from "next/server";
import { primaryBusiness } from "@/lib/db/dashboard";
import { unblockNumber } from "@/lib/db/screening";
import { isOperator } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { readEnv } from "@/lib/server/env";
import { normalizeUsPhone } from "@/lib/telephony/phone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lifts a block or a spam flag from the Settings list. */
export async function POST(req: Request): Promise<Response> {
  if (!(await isOperator())) return new Response("Unauthorized", { status: 401 });
  const env = readEnv();
  const back = new URL("/settings", env.publicBaseUrl);
  back.hash = "spam";
  const raw = String((await req.formData()).get("e164") ?? "");
  const e164 = normalizeUsPhone(raw) ?? (/^\+[1-9]\d{7,14}$/.test(raw) ? raw : null);
  const db = await getDb();
  const business = await primaryBusiness(db);
  if (!e164 || !business) {
    back.searchParams.set("error", "That number couldn't be unblocked.");
    return NextResponse.redirect(back, 303);
  }
  await unblockNumber(db, business.tenantId, e164);
  back.searchParams.set("saved", "spam");
  return NextResponse.redirect(back, 303);
}
