import { NextResponse } from "next/server";
import { assignBusiness } from "@/lib/db/agent";
import { isOperator } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { readEnv } from "@/lib/server/env";
import { UUID } from "@/lib/server/forms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Amy says which company a shared-line caller wanted (they never said). The
 * lead's latest call is assigned the same way the agent's select_business
 * does it, so facts, tasks and history move together and the change is
 * evented as amy_assigned.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await isOperator())) return new Response("Unauthorized", { status: 401 });
  const env = readEnv();
  const { id } = await ctx.params;
  if (!UUID.test(id)) return new Response("Not found", { status: 404 });
  const business = (await req.formData()).get("business");
  const page = new URL(`/leads/${id}`, env.publicBaseUrl);
  if (typeof business !== "string" || !UUID.test(business)) {
    page.searchParams.set("error", "Pick a company.");
    return NextResponse.redirect(page, 303);
  }

  const db = await getDb();
  const { rows } = await db.query<{ sid: string }>(
    "select twilio_call_sid as sid from public.call where lead_id = $1 order by started_at desc limit 1",
    [id],
  );
  if (!rows[0]) {
    page.searchParams.set("error", "This lead has no call to assign.");
    return NextResponse.redirect(page, 303);
  }
  try {
    const result = await assignBusiness(db, { callSid: rows[0].sid, businessId: business, how: "amy_assigned", actor: "operator" });
    // A merge moves the call to the caller's existing lead in that company: show that one.
    if (result.leadId && result.leadId !== id) return NextResponse.redirect(new URL(`/leads/${result.leadId}`, env.publicBaseUrl), 303);
  } catch {
    page.searchParams.set("error", "That company isn't answered on this line.");
  }
  return NextResponse.redirect(page, 303);
}
