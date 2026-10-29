/**
 * Puts the live stack on the Render service, from this computer:
 *
 *   Render      finds the "lightline" web service (made from render.yaml) and
 *               checks its first deploy answers.
 *   ElevenLabs  the tool key, webhook tools, post-call webhook and agent, all
 *               aimed at the service's URL (scripts/live/setup.ts).
 *   Render      the keys the app needs, from .env.local, then a deploy; its
 *               pre-deploy step gives the database the agent id.
 *   Twilio      last, once the service has every key: the numbers → Render.
 *
 * Safe to re-run (after a key changes, or to take back from a local test).
 * Needs RENDER_API_KEY in .env.local. Secret values are never printed.
 *
 * Usage: npm run deploy:render
 */
import { pathToFileURL } from "node:url";
import { readEnvFile, upsertEnvFile } from "../live/env-file";
import {
  configureTwilio,
  describeError,
  ENV_PATH,
  ensureGeneratedSecrets,
  LINE_KEYS,
  missingKeys,
  provision,
  readState,
  STATE_PATH,
  writeState,
} from "../live/setup";

const API = "https://api.render.com/v1";
export const SERVICE_NAME = "lightline";

/** What the server takes from .env.local. DATABASE_URL was given when the Blueprint was made. */
export const RENDER_KEYS = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "ELEVENLABS_API_KEY",
  "AGENT_TOOL_SECRET",
  "AGENT_ID",
  "ELEVENLABS_WEBHOOK_SECRET",
  "PUBLIC_BASE_URL",
] as const;
/** Sent only once set: the alert senders, after A2P and Resend are approved. */
export const OPTIONAL_RENDER_KEYS = ["TWILIO_ALERT_FROM", "RESEND_API_KEY", "ALERT_EMAIL_FROM"] as const;

const FAILED = new Set(["build_failed", "update_failed", "canceled", "pre_deploy_failed", "deactivated"]);
const DEPLOY_TIMEOUT_MS = 20 * 60_000;

type Log = (message: string) => void;

interface Service {
  id: string;
  name: string;
  type: string;
  suspended?: string;
  serviceDetails?: { url?: string };
}

interface Deploy {
  id: string;
  status: string;
}

export interface RenderApi {
  request<T>(method: "GET" | "POST" | "PUT", path: string, body?: unknown): Promise<T>;
}

export function renderApi(apiKey: string, fetchImpl: typeof fetch = fetch): RenderApi {
  return {
    async request<T>(method: string, path: string, body?: unknown): Promise<T> {
      const res = await fetchImpl(`${API}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${apiKey}`,
          accept: "application/json",
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (!res.ok) {
        // Render's error bodies carry a message, never the values we sent.
        const detail = await res
          .json()
          .then((b: { message?: string }) => b.message)
          .catch(() => undefined);
        throw new Error(`Render ${res.status} on ${method} ${path}${detail ? `: ${detail}` : ""}`);
      }
      const text = await res.text();
      return (text ? JSON.parse(text) : undefined) as T;
    },
  };
}

/** The service render.yaml made, with its https://….onrender.com URL. */
export async function findService(api: RenderApi): Promise<Service & { url: string }> {
  const list = await api.request<Array<{ service: Service }>>("GET", `/services?name=${SERVICE_NAME}&limit=20`);
  const service = list.map((s) => s.service).find((s) => s.name === SERVICE_NAME && s.type === "web_service");
  if (!service) {
    throw new Error(`no Render web service named "${SERVICE_NAME}" yet. Create it first: Render → New → Blueprint → this repo (docs/render-setup.md)`);
  }
  if (service.suspended === "suspended") throw new Error(`the Render service "${SERVICE_NAME}" is suspended; resume it in Render first`);
  const url = service.serviceDetails?.url;
  if (!url?.startsWith("https://")) throw new Error(`Render gave no https URL for "${SERVICE_NAME}"`);
  return { ...service, url };
}

async function startDeploy(api: RenderApi, serviceId: string): Promise<string> {
  const created = await api.request<Deploy | undefined>("POST", `/services/${serviceId}/deploys`, { clearCache: "do_not_clear" });
  if (created?.id) return created.id;
  // Queued behind a deploy already running: Render answers without a body.
  const [latest] = await api.request<Array<{ deploy: Deploy }>>("GET", `/services/${serviceId}/deploys?limit=1`);
  if (!latest) throw new Error("Render accepted the deploy but lists none");
  return latest.deploy.id;
}

async function waitForDeploy(
  api: RenderApi,
  serviceId: string,
  deployId: string,
  log: Log,
  sleep: (ms: number) => Promise<void>,
): Promise<void> {
  let last = "";
  const end = Date.now() + DEPLOY_TIMEOUT_MS;
  while (Date.now() < end) {
    const { status } = await api.request<Deploy>("GET", `/services/${serviceId}/deploys/${deployId}`);
    if (status !== last) log(`deploy: ${(last = status)}`);
    if (status === "live") return;
    if (FAILED.has(status)) {
      throw new Error(`the deploy ended "${status}". Render → ${SERVICE_NAME} → Events shows why; the running version keeps answering.`);
    }
    await sleep(10_000);
  }
  throw new Error("the deploy did not finish within 20 minutes");
}

export interface DeployDeps {
  api: RenderApi;
  log?: Log;
  /** For the health checks. */
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  /** Called as soon as provisioning returns new values (agent id, webhook secret), before anything can fail. */
  save?: (updates: Record<string, string>) => void;
  provision?: typeof provision;
  configureTwilio?: typeof configureTwilio;
  statePath?: string;
}

export async function deployToRender(env: Record<string, string>, deps: DeployDeps): Promise<{ url: string }> {
  const log = deps.log ?? console.log;
  const fetchImpl = deps.fetch ?? fetch;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const healthy = async (url: string) => {
    try {
      return (await fetchImpl(`${url}/api/health`, { signal: AbortSignal.timeout(15_000) })).ok;
    } catch {
      return false;
    }
  };

  const service = await findService(deps.api);
  const { url } = service;
  log(`Render service ${service.name}: ${url}`);
  if (!(await healthy(url))) {
    throw new Error(`${url}/api/health does not answer yet. Check the first deploy in Render (Events); a wrong DATABASE_URL is the usual cause.`);
  }

  env.PUBLIC_BASE_URL = url;
  const { envUpdates } = await (deps.provision ?? provision)(env, log, {
    ...(deps.statePath ? { statePath: deps.statePath } : {}),
    // The numbers move only once the service has every key (below).
    configureTwilio: async () => {},
  });
  Object.assign(env, envUpdates);
  deps.save?.(envUpdates);

  const keys = [...RENDER_KEYS, ...OPTIONAL_RENDER_KEYS.filter((key) => env[key])];
  for (const key of keys) {
    if (!env[key]) throw new Error(`${key} is empty`);
    await deps.api.request("PUT", `/services/${service.id}/env-vars/${key}`, { value: env[key] });
  }
  log(`Render: ${keys.length} keys set (${keys.join(", ")})`);

  const deployId = await startDeploy(deps.api, service.id);
  await waitForDeploy(deps.api, service.id, deployId, log, sleep);
  if (!(await healthy(url))) throw new Error(`the deploy is live but ${url}/api/health does not answer`);

  await (deps.configureTwilio ?? configureTwilio)(env, log);
  const statePath = deps.statePath ?? STATE_PATH;
  writeState(statePath, { ...readState(statePath), production: url });
  return { url };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const log = (message: string) => console.log(`[render] ${message}`);
  const env = readEnvFile(ENV_PATH);
  try {
    if (!env.RENDER_API_KEY) throw new Error("RENDER_API_KEY is empty in .env.local (Render → Account settings → API keys)");
    const missing = missingKeys({ ...env, PUBLIC_BASE_URL: "set-below", AGENT_TOOL_SECRET: "generated-below" });
    if (missing.length > 0) throw new Error(`missing in .env.local: ${missing.join(", ")}`);
    ensureGeneratedSecrets(env, log);
    const { url } = await deployToRender(env, {
      api: renderApi(env.RENDER_API_KEY),
      log,
      save: (updates) => upsertEnvFile(ENV_PATH, updates),
    });
    const numbers = LINE_KEYS.map((key) => env[key]).filter(Boolean).join(", ");
    console.log(`
  ──────────────────────────────────────────────────────────────
   LIVE on Render. Call ${numbers} to test.
   Inbox:  ${url}/dashboard
           (access code: Render → ${SERVICE_NAME} → Environment → OPERATOR_TOKEN)
   Your computer can be off; Render answers.
  ──────────────────────────────────────────────────────────────
`);
  } catch (error) {
    console.error(`[render] failed: ${describeError(error)}`);
    process.exitCode = 1;
  }
}
