import { getDb } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Uptime check: proves the app can reach its database. Reveals nothing else. */
export async function GET(): Promise<Response> {
  try {
    await (await getDb()).query("select 1");
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
