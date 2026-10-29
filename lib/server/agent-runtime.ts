import { after } from "next/server";
import { timingSafeEqual } from "node:crypto";
import type { GatewayDeps } from "@/lib/agents/gateway";
import { loadActiveConfig } from "@/lib/db/config";
import type { Queryable } from "@/lib/db/migrate";
import { voiceUrls } from "@/lib/telephony";
import { redirectLiveCall } from "@/lib/telephony/rest";
import type { AppEnv } from "./env";

/** Gives the agent time to say "one moment while I try Amy" before the call moves. */
export const HANDOFF_DELAY_MS = 2500;

export function secretMatches(expected: string | undefined, given: string | null): boolean {
  if (!expected || !given) return false; // fail closed when unconfigured
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Moves the live call to Amy's screened ring after a short delay, unless the
 * hand-off already started another way (the agent closed its stream first).
 * Without Twilio credentials (development) the redirect is recorded, not sent.
 */
export function handoffScheduler(db: Queryable, env: AppEnv, log: (m: string, d?: unknown) => void) {
  return async (callSid: string): Promise<void> => {
    const run = async () => {
      await new Promise((resolve) => setTimeout(resolve, HANDOFF_DELAY_MS));
      const { rows } = await db.query<{ id: string; tenant_id: string; business_id: string; state: string; started: boolean }>(
        `select c.id, c.tenant_id, c.business_id, c.state,
                exists (select 1 from public.event e where e.aggregate_id = c.id and e.type = 'transfer.dial_started'
                          and e.occurred_at > now() - interval '2 minutes') as started
           from public.call c where c.twilio_call_sid = $1`,
        [callSid],
      );
      const call = rows[0];
      if (!call || call.state !== "transfer_ringing" || call.started) return;
      if (!env.twilioAccountSid || !env.twilioAuthToken) {
        await db.query("select app.emit($1, $2, 'call', $3, 'transfer.redirect_simulated', '{}'::jsonb, 'system', null)", [
          call.tenant_id,
          call.business_id,
          call.id,
        ]);
        return;
      }
      try {
        await redirectLiveCall({
          accountSid: env.twilioAccountSid,
          authToken: env.twilioAuthToken,
          callSid,
          url: voiceUrls(env.publicBaseUrl).handoff,
        });
      } catch (error) {
        // The caller is still with the agent; the agent-ended handler sees
        // transfer_ringing and rings Amy when the stream closes.
        log("handoff redirect failed", error instanceof Error ? error.message : error);
      }
    };
    try {
      after(run);
    } catch {
      void run();
    }
  };
}

export function gatewayDeps(db: Queryable, env: AppEnv): GatewayDeps {
  const log = (message: string, detail?: unknown) => console.error(`[tools] ${message}`, detail);
  return {
    db,
    now: new Date(),
    loadConfig: async (businessId) => (await loadActiveConfig(db, businessId, log))?.config ?? null,
    scheduleHandoff: handoffScheduler(db, env, log),
    log,
  };
}
