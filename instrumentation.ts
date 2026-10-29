/**
 * Runs once when the server process starts. With JOB_SWEEP_SECONDS set (Render,
 * where one server keeps running), the server sweeps due jobs and alerts
 * itself; unset, nothing starts here.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const seconds = Number(process.env.JOB_SWEEP_SECONDS ?? "");
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  const { getDb } = await import("@/lib/server/db");
  const { readEnv } = await import("@/lib/server/env");
  const { startJobSweep, sweep } = await import("@/lib/server/job-sweep");
  startJobSweep(seconds, async () => sweep(await getDb(), readEnv()));
  console.log(`job sweep: every ${seconds} s`);
}
