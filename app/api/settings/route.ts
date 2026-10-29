import { NextResponse } from "next/server";
import { isOperator } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { readEnv } from "@/lib/server/env";
import { UUID } from "@/lib/server/forms";
import { saveSettings } from "@/lib/settings/office-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Saves one settings section; the next call uses it. Back to the page with what happened. */
export async function POST(req: Request): Promise<Response> {
  if (!(await isOperator())) return new Response("Unauthorized", { status: 401 });
  const env = readEnv();
  const form = await req.formData();
  const section = String(form.get("section") ?? "");
  const company = String(form.get("company") ?? "");
  const back = new URL("/settings", env.publicBaseUrl);
  if (UUID.test(company)) back.searchParams.set("company", company);

  const result = await saveSettings(await getDb(), {
    section,
    businessId: UUID.test(company) ? company : null,
    form,
    actor: "operator",
  });
  if (result.ok) back.searchParams.set("saved", section);
  else {
    back.searchParams.set("error", result.errors.slice(0, 4).join(" "));
    back.searchParams.set("failed", section);
  }
  back.hash = section;
  return NextResponse.redirect(back, 303);
}
