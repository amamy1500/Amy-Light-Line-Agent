import { NextResponse } from "next/server";
import { transitionLead, type LeadState } from "@/lib/db";
import { completeOpenCallback } from "@/lib/db/dashboard";
import { isOperator } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { readEnv } from "@/lib/server/env";
import { UUID } from "@/lib/server/forms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OUTCOMES = new Set<LeadState>(["attempted", "connected", "qualified", "quoted", "booked", "won", "lost", "spam", "duplicate"]);

/**
 * Amy logs what happened after she called back. Any logged outcome closes
 * the open callback; the lead's funnel state moves forward only.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await isOperator())) return new Response("Unauthorized", { status: 401 });

  const env = readEnv();
  const { id } = await ctx.params;
  if (!UUID.test(id)) return new Response("Not found", { status: 404 });
  const form = await req.formData();
  const to = form.get("to");
  const page = new URL(`/leads/${id}`, env.publicBaseUrl);

  if (typeof to !== "string" || !OUTCOMES.has(to as LeadState)) {
    page.searchParams.set("error", "Unknown outcome.");
    return NextResponse.redirect(page, 303);
  }

  const rawAmount = form.get("amount");
  const dollars = typeof rawAmount === "string" && rawAmount.trim() ? Number(rawAmount.replace(/[$,\s]/g, "")) : null;
  if (dollars !== null && (!Number.isFinite(dollars) || dollars < 0)) {
    page.searchParams.set("error", "Enter the job amount in dollars.");
    return NextResponse.redirect(page, 303);
  }

  const db = await getDb();
  try {
    await transitionLead(db, {
      leadId: id,
      to: to as LeadState,
      actorType: "user",
      actorId: "operator",
      amountCents: to === "won" && dollars !== null ? Math.round(dollars * 100) : null,
    });
    await completeOpenCallback(db, id, "operator");
  } catch (error) {
    const message = (error as Error).message;
    page.searchParams.set(
      "error",
      /won requires an amount/.test(message)
        ? "Add the job amount to mark it won."
        : /not allowed/.test(message)
          ? "That's an earlier step than where this lead already is."
          : "That outcome couldn't be saved. Try again.",
    );
  }
  return NextResponse.redirect(page, 303);
}
