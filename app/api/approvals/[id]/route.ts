import { NextResponse } from "next/server";
import { businessById } from "@/lib/db/dashboard";
import { decideKnowledge, listKnowledge, syncConfigFromKnowledge } from "@/lib/db/knowledge";
import { isOperator } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { readEnv } from "@/lib/server/env";
import { UUID } from "@/lib/server/forms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const list = (value: FormDataEntryValue | null, max: number) =>
  typeof value === "string"
    ? value.split(",").map((s) => s.trim()).filter(Boolean).slice(0, max)
    : [];

/**
 * Amy decides a knowledge item. The decision is audited (who, when, previous
 * words), and the agent's facts are regenerated at once: the next call's
 * answers use her words, without re-publishing the agent.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await isOperator())) return new Response("Unauthorized", { status: 401 });
  const env = readEnv();
  const { id } = await ctx.params;
  if (!UUID.test(id)) return new Response("Not found", { status: 404 });
  const page = new URL("/approvals", env.publicBaseUrl);
  const form = await req.formData();
  const status = form.get("status");
  if (status !== "approved" && status !== "rejected" && status !== "pending") {
    page.searchParams.set("error", "Unknown decision.");
    return NextResponse.redirect(page, 303);
  }

  const db = await getDb();
  // The item names its own company; the decision syncs that company's config only.
  const { rows } = await db.query<{ business_id: string }>("select business_id from public.knowledge_item where id = $1", [id]);
  const business = rows[0] ? await businessById(db, rows[0].business_id) : null;
  const item = business ? (await listKnowledge(db, business.businessId)).find((i) => i.id === id) : undefined;
  if (!business || !item) return new Response("Not found", { status: 404 });
  page.searchParams.set("business", business.businessId);
  page.hash = `item-${item.key}`;

  const text = typeof form.get("text") === "string" ? String(form.get("text")).trim().slice(0, 400) : "";
  const cities = list(form.get("cities"), 60);
  const zips = list(form.get("zips"), 200).filter((z) => /^\d{5}$/.test(z));
  if (status === "approved") {
    if (item.kind === "service_area" && cities.length === 0 && zips.length === 0) {
      page.searchParams.set("error", "Add at least one city or ZIP you serve.");
      page.searchParams.set("failed", item.key);
      return NextResponse.redirect(page, 303);
    }
    if (item.kind !== "service_area" && !text) {
      page.searchParams.set("error", "Write the exact words the assistant may say.");
      page.searchParams.set("failed", item.key);
      return NextResponse.redirect(page, 303);
    }
    // Suggested answers carry [blanks] only Amy can fill; a blank must never reach a caller.
    if (/\[[^\]]*\]/.test(text)) {
      page.searchParams.set("error", "Fill in the [bracketed] parts with your own words first.");
      page.searchParams.set("failed", item.key);
      return NextResponse.redirect(page, 303);
    }
  }

  await decideKnowledge(db, {
    itemId: id,
    status,
    text: item.kind === "service_area" ? (cities.length ? cities.join(", ") : null) : text || null,
    value: status === "approved" && item.kind === "service_area" ? { cities, zips } : null,
    by: "operator",
  });
  await syncConfigFromKnowledge(db, { tenantId: business.tenantId, businessId: business.businessId, by: `approval:${item.key}` });
  return NextResponse.redirect(page, 303);
}
