import type { Queryable } from "@/lib/db";
import { drainAlerts, senderFromEnv } from "@/lib/server/alerts";
import type { AppEnv } from "@/lib/server/env";
import { runDueJobs } from "@/workflows/post-call/runner";

/**
 * One sweep: runs due post-call jobs and escalations, then drains alerts.
 * Requests already do this after each webhook; the sweep covers timers and
 * anything a crashed request left.
 */
export async function sweep(db: Queryable, env: AppEnv) {
  const jobs = await runDueJobs(db, { env });
  const alerts = await drainAlerts(db, senderFromEnv(env), env.publicBaseUrl);
  return { jobs, alerts };
}

/**
 * Sweeps every `seconds` inside this server process, for a host that keeps
 * one running (Render). A sweep still running when the next is due is not
 * doubled. Serverless hosts call GET /api/jobs/run on a cron instead, and
 * scripts/live/up.ts drives it for local phone tests.
 */
export function startJobSweep(seconds: number, run: () => Promise<unknown>): () => void {
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    run()
      .catch((error: unknown) => console.error(`job sweep failed: ${error instanceof Error ? error.message : String(error)}`))
      .finally(() => {
        running = false;
      });
  }, seconds * 1000);
  timer.unref();
  return () => clearInterval(timer);
}
