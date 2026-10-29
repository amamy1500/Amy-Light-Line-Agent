import { exportLeads, leadsCsv } from "@/lib/db/export";
import { isOperator } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Every call's lead as a spreadsheet (opens in Excel or Google Sheets, or
 * File → Import in Sheets). Signed-in operators only; nothing in the URL.
 */
export async function GET(): Promise<Response> {
  if (!(await isOperator())) return new Response("Unauthorized", { status: 401 });
  const rows = await exportLeads(await getDb());
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(leadsCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="lightline-calls-${stamp}.csv"`,
      "cache-control": "no-store",
    },
  });
}
