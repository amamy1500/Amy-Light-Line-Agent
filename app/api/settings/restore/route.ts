import { NextResponse } from "next/server";
import { isOperator } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { readEnv } from "@/lib/server/env";
import { UUID } from "@/lib/server/forms";
import { restoreConfigVersion } from "@/lib/settings/office-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Puts an earlier version's settings back, as a new version. */
export async function POST(req: Request): Promise<Response> {
  if (!(await isOperator())) return new Response("Unauthorized", { status: 401 });
  const env = readEnv();
  const form = await req.formData();
  const company = String(form.get("company") ?? "");
  const version = Number(form.get("version"));
  const back = new URL("/settings", env.publicBaseUrl);
  back.hash = "history";
  if (!UUID.test(company) || !Number.isInteger(version) || version < 1) {
    back.searchParams.set("error", "Pick a version to restore.");
    return NextResponse.redirect(back, 303);
  }
  back.searchParams.set("company", company);
  const result = await restoreConfigVersion(await getDb(), { businessId: company, version, actor: "operator" });
  back.searchParams.set(result.ok ? "saved" : "error", result.ok ? "history" : result.errors.join(" "));
  return NextResponse.redirect(back, 303);
}
