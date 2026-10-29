import { NextResponse } from "next/server";
import { blockNumber, unblockNumber } from "@/lib/db/screening";
import { isOperator } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { readEnv } from "@/lib/server/env";
import { UUID } from "@/lib/server/forms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Amy blocks (or unblocks) this caller's number. Her block is refused before
 * anyone answers and lasts until she lifts it; it also replaces any automatic
 * spam flag on the number.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await isOperator())) return new Response("Unauthorized", { status: 401 });
  const env = readEnv();
  const { id } = await ctx.params;
  if (!UUID.test(id)) return new Response("Not found", { status: 404 });
  const action = (await req.formData()).get("action");
  const page = new URL(`/leads/${id}`, env.publicBaseUrl);

  const db = await getDb();
  const { rows } = await db.query<{ tenant_id: string; contact_phone: string | null }>(
    "select tenant_id, contact_phone from public.lead where id = $1",
    [id],
  );
  const lead = rows[0];
  if (!lead) return new Response("Not found", { status: 404 });
  if (!lead.contact_phone) {
    page.searchParams.set("error", "This caller's number is hidden, so it can't be blocked.");
    return NextResponse.redirect(page, 303);
  }
  if (action === "unblock") {
    await unblockNumber(db, lead.tenant_id, lead.contact_phone);
    page.searchParams.set("notice", "Unblocked. Their calls come through again.");
  } else {
    await blockNumber(db, { tenantId: lead.tenant_id, e164: lead.contact_phone, kind: "manual", reason: "blocked by Amy", days: null, by: "operator" });
    page.searchParams.set("notice", "Blocked. Calls from this number are refused before anyone answers.");
  }
  return NextResponse.redirect(page, 303);
}
