import { secretMatches } from "@/lib/server/agent-runtime";
import { getDb } from "@/lib/server/db";
import { readEnv } from "@/lib/server/env";
import { sweep } from "@/lib/server/job-sweep";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Scheduled sweep for serverless hosts (a cron, every minute): runs due
 * post-call jobs and escalations and drains alerts. On Render the server
 * sweeps itself (instrumentation.ts); this route stays for manual runs.
 */
export async function GET(req: Request): Promise<Response> {
  const env = readEnv();
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!secretMatches(env.cronSecret, bearer)) return Response.json({ ok: false }, { status: 401 });
  const { jobs, alerts } = await sweep(await getDb(), env);
  return Response.json({ ok: true, jobs, alerts });
}
