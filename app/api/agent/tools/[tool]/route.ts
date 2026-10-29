import { runTool } from "@/lib/agents/gateway";
import { gatewayDeps, secretMatches } from "@/lib/server/agent-runtime";
import { getDb } from "@/lib/server/db";
import { readEnv } from "@/lib/server/env";
import { scheduleBackgroundWork } from "@/lib/server/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Tool calls from the voice agent. Authenticated by a header secret held in the vendor's secret store. */
export async function POST(req: Request, ctx: { params: Promise<{ tool: string }> }): Promise<Response> {
  const env = readEnv();
  if (!secretMatches(env.agentToolSecret, req.headers.get("x-lightline-tool-key"))) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const { tool } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const db = await getDb();
  const result = await runTool(tool, body, gatewayDeps(db, env));
  scheduleBackgroundWork();
  return Response.json(result.body, { status: result.status, headers: { "cache-control": "no-store" } });
}
