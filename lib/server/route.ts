import { after } from "next/server";
import { VendorCircuit } from "@/lib/agents/circuit";
import { elevenLabsConnector, simulatorConnector, type AgentConnector } from "@/lib/agents/connector";
import { runDueJobs } from "@/workflows/post-call/runner";
import { drainAlerts, senderFromEnv } from "./alerts";
import { getDb } from "./db";
import { readEnv, type AppEnv } from "./env";
import { readTwilioRequest, twimlResponse, type TwilioParams } from "./twilio-request";
import type { VoiceDeps } from "./voice";

const globalForAgent = globalThis as typeof globalThis & { __lightlineCircuit?: VendorCircuit };

export function agentConnector(env: AppEnv): AgentConnector | undefined {
  switch (env.agentProvider) {
    case "elevenlabs":
      return env.elevenLabsApiKey ? elevenLabsConnector(env.elevenLabsApiKey, 4000, env.elevenLabsApiBase) : undefined;
    case "simulator":
      return simulatorConnector();
    case "none":
      return undefined;
  }
}

async function voiceDeps(): Promise<VoiceDeps> {
  const env = readEnv();
  globalForAgent.__lightlineCircuit ??= new VendorCircuit();
  const agent = agentConnector(env);
  return {
    db: await getDb(),
    now: () => new Date(),
    baseUrl: env.publicBaseUrl,
    circuit: globalForAgent.__lightlineCircuit,
    ...(agent ? { agent } : {}),
    log: (message, detail) => console.error(`[voice] ${message}`, detail),
  };
}

/**
 * Sends pending alerts and runs due post-call jobs after the response is
 * returned, so Twilio is never kept waiting on email, SMS or analysis.
 * Outside a request (tests, scripts) it runs immediately in the background.
 */
export function scheduleBackgroundWork(): void {
  const run = async () => {
    try {
      const env = readEnv();
      const db = await getDb();
      await runDueJobs(db, { env });
      await drainAlerts(db, senderFromEnv(env), env.publicBaseUrl);
    } catch (error) {
      console.error("[background] run failed", error);
    }
  };
  try {
    after(run);
  } catch {
    void run();
  }
}

/** Kept for the web-form route: same background run. */
export const scheduleAlertDrain = scheduleBackgroundWork;

/** A Twilio webhook that answers with TwiML. */
export function twimlRoute(handler: (p: TwilioParams, deps: VoiceDeps, query: URLSearchParams) => Promise<string>) {
  return async (req: Request): Promise<Response> => {
    const parsed = await readTwilioRequest(req, readEnv());
    if (!parsed.ok) return parsed.response;
    const xml = await handler(parsed.params, await voiceDeps(), new URL(req.url).searchParams);
    scheduleBackgroundWork();
    return twimlResponse(xml);
  };
}

/** A Twilio status/recording/transcription callback (no TwiML expected). */
export function callbackRoute(handler: (p: TwilioParams, deps: VoiceDeps) => Promise<void>) {
  return async (req: Request): Promise<Response> => {
    const parsed = await readTwilioRequest(req, readEnv());
    if (!parsed.ok) return parsed.response;
    await handler(parsed.params, await voiceDeps());
    scheduleBackgroundWork();
    return new Response(null, { status: 204 });
  };
}
