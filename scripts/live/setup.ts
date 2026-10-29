/**
 * Provisions the live test stack from .env.local, idempotently:
 *
 *   Twilio      checks the account, then points the test number's voice and
 *               status webhooks at PUBLIC_BASE_URL. Only that number changes.
 *   ElevenLabs  the tool key as a workspace secret, our 7 webhook tools, a
 *               post-call webhook (HMAC, retries on) attached to this agent
 *               only, and the agent itself, all generated from code.
 *
 * Ids are kept in .data/live-state.json so re-runs update rather than
 * duplicate. AGENT_ID and ELEVENLABS_WEBHOOK_SECRET are written to
 * .env.local. Secret values are never printed. Re-run whenever
 * PUBLIC_BASE_URL changes (scripts/live/up.ts does this for you).
 *
 * Usage: npx tsx scripts/live/setup.ts
 */
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ElevenLabsClient, ElevenLabsError, type ElevenLabs } from "@elevenlabs/elevenlabs-js";
import twilio from "twilio";
import { seedConfig } from "@/lib/db";
import { buildAgentRequest, buildToolRequests } from "@/lib/elevenlabs/agent-spec";
import { developmentSeedOptions } from "@/lib/server/db";
import { readEnvFile, upsertEnvFile } from "./env-file";

export const ENV_PATH = resolve(".env.local");
export const STATE_PATH = resolve(".data/live-state.json");
const SECRET_NAME = "lightline_tool_key";
const WEBHOOK_NAME = "lightline post-call";
/**
 * Stock voices tried in order; any premade voice is the fallback. ELEVENLABS_VOICE_ID overrides.
 * Amy wants mature, warm and calm, never bubbly or shrill (2026-10-29): Sarah ("mature,
 * reassuring, confident") and Matilda ("knowledgeable, professional") by ElevenLabs' own labels.
 */
const PREFERRED_VOICES = ["Sarah", "Matilda"];
const DEFAULT_LLM: ElevenLabs.Llm = "claude-haiku-5-5";

export interface LiveState {
  toolSecretId?: string;
  toolIds?: Record<string, string>;
  voiceId?: string;
  webhook?: { id: string; url: string };
  agentId?: string;
  /** The Render URL the agent and numbers serve, once scripts/deploy/render.ts ran. */
  production?: string;
}

type Log = (message: string) => void;

const REQUIRED = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "ELEVENLABS_API_KEY", "AGENT_TOOL_SECRET", "PUBLIC_BASE_URL"];

/**
 * Every number we own that should answer calls. Callers never see the two
 * Bestline ones: 512-339-9313 forwards to them.
 */
export const LINE_KEYS = [
  "BESTLINE_MISSED_NUMBER",
  "SHARED_LINE_NUMBER",
  "CLG_MAIN_NUMBER",
  "CLG_TV_NUMBER",
  "SUBLIME_PATIO_NUMBER",
  "THE_FRIDGE_NUMBER",
] as const;

export function missingKeys(env: Record<string, string>): string[] {
  const missing = REQUIRED.filter((key) => !env[key]);
  if (!LINE_KEYS.some((key) => env[key])) missing.push(`one of ${LINE_KEYS.join("/")}`);
  return missing;
}

export function readState(path: string = STATE_PATH): LiveState {
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as LiveState) : {};
}

export function writeState(path: string, state: LiveState): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`);
}

/** Generated once and kept in .env.local; the human never needs to see them. */
export function ensureGeneratedSecrets(env: Record<string, string>, log: Log): void {
  const generated: Record<string, string> = {};
  for (const key of ["AGENT_TOOL_SECRET", "CRON_SECRET", "OPERATOR_TOKEN"]) {
    if (!env[key] || env[key] === "dev" || env[key].startsWith("dev-")) generated[key] = randomBytes(24).toString("base64url");
  }
  if (Object.keys(generated).length > 0) {
    upsertEnvFile(ENV_PATH, generated);
    Object.assign(env, generated);
    log(`generated ${Object.keys(generated).join(", ")} → .env.local`);
  }
}

const notFound = (error: unknown) => error instanceof ElevenLabsError && error.statusCode === 404;

/** Vendor validation errors carry the field at fault in their body; show it (it holds no secrets). */
export function describeError(error: unknown): string {
  if (error instanceof ElevenLabsError) {
    return `ElevenLabs ${error.statusCode ?? "?"}: ${JSON.stringify(error.body ?? error.message).slice(0, 1500)}`;
  }
  const status = (error as { status?: number }).status;
  const message = error instanceof Error ? error.message : String(error);
  return status ? `Twilio ${status}: ${message}` : message;
}

/** Update the resource we created last time; create it if it is gone or was never made. */
async function upsert<T>(id: string | undefined, update: (id: string) => Promise<T>, create: () => Promise<T>): Promise<T> {
  if (id) {
    try {
      return await update(id);
    } catch (error) {
      if (!notFound(error)) throw error;
    }
  }
  return create();
}

export async function configureTwilio(env: Record<string, string>, log: Log): Promise<void> {
  const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  const account = await client.api.v2010.accounts(env.TWILIO_ACCOUNT_SID!).fetch();
  log(`Twilio account ${account.friendlyName} (${account.type}, ${account.status})`);
  if (account.type === "Trial") {
    // Twilio strips <Dial><Number>, <Stream> and <Record> on trial accounts
    // (twilio.com/docs/usage/trials/try-out-voice): Amy's ring, the agent and
    // the message fallback would all be replaced by a spoken notice.
    throw new Error(
      "this Twilio account is still a trial. Trials block ringing Amy, the AI stream and voicemail. Upgrade it in the Twilio Console (Upgrade account), buy a number, then run again.",
    );
  }

  const base = env.PUBLIC_BASE_URL!;
  for (const key of LINE_KEYS) {
    const e164 = env[key];
    if (!e164) continue;
    const [number] = await client.incomingPhoneNumbers.list({ phoneNumber: e164, limit: 1 });
    if (!number) throw new Error(`${e164} (${key}) is not a number on this Twilio account`);
    await client.incomingPhoneNumbers(number.sid).update({
      voiceUrl: new URL("/api/voice/inbound", base).toString(),
      voiceMethod: "POST",
      statusCallback: new URL("/api/voice/status", base).toString(),
      statusCallbackMethod: "POST",
      // If our app can't answer, Twilio runs this instead (a TwiML Bin that rings Amy's cell, then takes a message).
      ...(env.TWILIO_FALLBACK_URL ? { voiceFallbackUrl: env.TWILIO_FALLBACK_URL, voiceFallbackMethod: "POST" as const } : {}),
      // Texts to the number are kept (e.g. Google's verification code), never answered.
      smsUrl: new URL("/api/sms/inbound", base).toString(),
      smsMethod: "POST",
    });
    log(`Twilio ${key} ${number.phoneNumber} → ${base}/api/voice/inbound${env.TWILIO_FALLBACK_URL ? " (fallback: rings Amy)" : ""}`);
  }
  if (!env.TWILIO_FALLBACK_URL) {
    log("WARNING: no TWILIO_FALLBACK_URL. If this app is down, forwarded callers get Twilio's error message instead of Amy's phone.");
  }
}

async function pickVoice(client: ElevenLabsClient, env: Record<string, string>, state: LiveState, log: Log): Promise<string> {
  if (env.ELEVENLABS_VOICE_ID) return env.ELEVENLABS_VOICE_ID;
  if (env.AI_VOICE === "owner_clone") {
    // The greeting would claim Amy's voice while a stock voice speaks.
    throw new Error("AI_VOICE=owner_clone but ELEVENLABS_VOICE_ID is empty; run scripts/live/clone-voice.ts first");
  }
  if (state.voiceId) return state.voiceId;
  const { voices } = await client.voices.search({ category: "premade", pageSize: 100 });
  const voice = PREFERRED_VOICES.map((name) => voices.find((v) => v.name?.startsWith(name))).find(Boolean) ?? voices[0];
  if (!voice) throw new Error("no premade voices on this ElevenLabs account; set ELEVENLABS_VOICE_ID");
  log(`voice: ${voice.name ?? voice.voiceId} (stock; set ELEVENLABS_VOICE_ID to change)`);
  return voice.voiceId;
}

async function storeToolSecret(client: ElevenLabsClient, env: Record<string, string>, state: LiveState): Promise<string> {
  const request = { name: SECRET_NAME, value: env.AGENT_TOOL_SECRET! };
  const known = state.toolSecretId ?? (await client.conversationalAi.secrets.list()).secrets.find((s) => s.name === SECRET_NAME)?.secretId;
  const stored = await upsert(
    known,
    (id) => client.conversationalAi.secrets.update(id, request),
    () => client.conversationalAi.secrets.create(request),
  );
  return stored.secretId;
}

/**
 * Webhook URLs cannot be edited, so a new tunnel URL means a new webhook
 * (and a new signing secret); the previous one we made is deleted.
 */
async function postCallWebhook(
  client: ElevenLabsClient,
  url: string,
  state: LiveState,
  env: Record<string, string>,
): Promise<{ id: string; secret: string | null }> {
  if (state.webhook?.url === url && env.ELEVENLABS_WEBHOOK_SECRET) return { id: state.webhook.id, secret: null };
  if (state.webhook) {
    await client.webhooks.delete(state.webhook.id).catch((error: unknown) => {
      if (!notFound(error)) throw error;
    });
  }
  const created = await client.webhooks.create({ settings: { authType: "hmac", name: WEBHOOK_NAME, webhookUrl: url } });
  if (!created.webhookSecret) throw new Error("ElevenLabs did not return a webhook signing secret");
  // Retries are off by default; a lost webhook would otherwise wait for the reconcile sweep.
  await client.webhooks.update(created.webhookId, { isDisabled: false, name: WEBHOOK_NAME, retryEnabled: true });
  return { id: created.webhookId, secret: created.webhookSecret };
}

export interface ProvisionResult {
  agentId: string;
  envUpdates: Record<string, string>;
}

export interface ProvisionOptions {
  /** Where resource ids are kept between runs. */
  statePath?: string;
  /** Replaces the Twilio step (tests). */
  configureTwilio?: (env: Record<string, string>, log: Log) => Promise<void>;
}

export async function provision(
  env: Record<string, string>,
  log: Log = console.log,
  opts: ProvisionOptions = {},
): Promise<ProvisionResult> {
  const missing = missingKeys(env);
  if (missing.length > 0) throw new Error(`missing in .env.local: ${missing.join(", ")} (run scripts/live/wizard.sh)`);
  const base = env.PUBLIC_BASE_URL!;
  if (!base.startsWith("https://")) throw new Error(`PUBLIC_BASE_URL must be a public https URL, got ${base}`);

  await (opts.configureTwilio ?? configureTwilio)(env, log);

  const client = new ElevenLabsClient({ apiKey: env.ELEVENLABS_API_KEY!, ...(env.ELEVENLABS_API_BASE ? { baseUrl: env.ELEVENLABS_API_BASE } : {}) });
  const statePath = opts.statePath ?? STATE_PATH;
  const state = readState(statePath);

  state.toolSecretId = await storeToolSecret(client, env, state);
  state.voiceId = await pickVoice(client, env, state, log);
  writeState(statePath, state);

  const options = {
    publicBaseUrl: base,
    // select_business only when a number answers for several companies.
    sharedLine: Boolean(env.SHARED_LINE_NUMBER || env.BESTLINE_MISSED_NUMBER),
    toolSecretId: state.toolSecretId,
    voiceId: state.voiceId,
    llm: (env.ELEVENLABS_LLM as ElevenLabs.Llm | undefined) ?? DEFAULT_LLM,
  };
  state.toolIds ??= {};
  const requests = buildToolRequests(options);
  for (const { name, request } of requests) {
    const tool = await upsert(
      state.toolIds[name],
      (id) => client.conversationalAi.tools.update(id, request),
      () => client.conversationalAi.tools.create(request),
    );
    state.toolIds[name] = tool.id;
  }
  writeState(statePath, state);
  log(`tools: ${Object.keys(state.toolIds).length} webhook tools → ${base}/api/agent/tools/*`);

  const webhookUrl = new URL("/api/webhooks/elevenlabs", base).toString();
  const webhook = await postCallWebhook(client, webhookUrl, state, env);
  state.webhook = { id: webhook.id, url: webhookUrl };
  writeState(statePath, state);

  // The prompt is generated from the same config the database is seeded with.
  const config = seedConfig(developmentSeedOptions(env));
  // Only this agent's tools: one made on an earlier run for a shared line stays unattached.
  const spec = buildAgentRequest(config, options, requests.map(({ name }) => state.toolIds![name]!));
  const request = {
    ...spec,
    platformSettings: {
      ...spec.platformSettings,
      // This agent's transcripts only; other agents in the workspace keep their settings.
      workspaceOverrides: { webhooks: { postCallWebhookId: webhook.id, events: ["transcript" as const] } },
    },
  };
  const agentId = await upsert(
    state.agentId,
    async (id) => {
      await client.conversationalAi.agents.update(id, request);
      return id;
    },
    async () => (await client.conversationalAi.agents.create(request)).agentId,
  );
  state.agentId = agentId;
  writeState(statePath, state);
  log(`agent: ${agentId} (${options.llm}) with post-call webhook → ${webhookUrl}`);

  const envUpdates: Record<string, string> = { AGENT_ID: agentId, AGENT_PROVIDER: "elevenlabs" };
  if (webhook.secret) envUpdates.ELEVENLABS_WEBHOOK_SECRET = webhook.secret;
  return { agentId, envUpdates };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  provision(readEnvFile(ENV_PATH))
    .then(({ envUpdates }) => {
      upsertEnvFile(ENV_PATH, envUpdates);
      console.log(`wrote ${Object.keys(envUpdates).join(", ")} → .env.local`);
    })
    .catch((error: unknown) => {
      console.error(`setup failed: ${describeError(error)}`);
      process.exit(1);
    });
}
