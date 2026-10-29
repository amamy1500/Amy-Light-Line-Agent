/**
 * One command for a real phone test on this machine:
 *
 *   public tunnel (cloudflared quick tunnel, or --url) → PUBLIC_BASE_URL
 *   → provision Twilio + ElevenLabs (scripts/live/setup.ts)
 *   → seed or sync the live database (.data/live) → next dev on :3000
 *   → warm every call route (Twilio allows 15 s per webhook; a cold dev
 *     compile can take longer) → job sweep every 30 s → wait for calls.
 *
 * Ctrl+C stops the server and the tunnel. Secrets are never printed.
 *
 * Usage:
 *   npm run live                         quick tunnel, keep existing test data
 *   npm run live -- --fresh              start from a clean database (the old one is kept aside)
 *   npm run live -- --url https://x.y    use your own tunnel/domain instead of cloudflared
 *   npm run live -- --take-over          test locally even though Render serves the numbers
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, renameSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { parseBusinessConfig } from "@/lib/business-rules/config";
import { seedOffice } from "@/lib/db";
import { activateConfig } from "@/lib/db/config";
import { applyOwnerDecisions } from "@/lib/db/knowledge";
import { officeBusinesses, primaryBusiness } from "@/lib/db/dashboard";
import { openPglite } from "@/lib/db/pglite";
import { developmentSeedOptions } from "@/lib/server/db";
import { readEnvFile, upsertEnvFile } from "./env-file";
import { describeError, ENV_PATH, ensureGeneratedSecrets, LINE_KEYS, missingKeys, provision, readState, STATE_PATH, writeState } from "./setup";

const PORT = 3000;
const LOCAL = `http://localhost:${PORT}`;
const LIVE_DB = ".data/live";
const children: ChildProcess[] = [];

const args = process.argv.slice(2);
const fresh = args.includes("--fresh");
const takeOver = args.includes("--take-over");
const urlFlag = args.indexOf("--url");
const ownUrl = urlFlag >= 0 ? args[urlFlag + 1] : undefined;

const log = (message: string) => console.log(`[live] ${message}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function stopAll(code = 0): never {
  for (const child of children) {
    if (child.pid === undefined || child.exitCode !== null) continue;
    // Windows: kill the whole tree (next dev spawns workers).
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    else child.kill("SIGTERM");
  }
  process.exit(code);
}

function fail(message: string): never {
  console.error(`[live] ${message}`);
  stopAll(1);
}

function findCloudflared(): string | null {
  const which = spawnSync(process.platform === "win32" ? "where" : "which", ["cloudflared"], { encoding: "utf8" });
  if (which.status === 0 && which.stdout.trim()) return which.stdout.trim().split(/\r?\n/)[0]!;
  const candidates = [
    "C:\\Program Files (x86)\\cloudflared\\cloudflared.exe",
    "C:\\Program Files\\cloudflared\\cloudflared.exe",
    join(process.env.LOCALAPPDATA ?? "", "Microsoft", "WinGet", "Links", "cloudflared.exe"),
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}

async function startTunnel(): Promise<string> {
  const bin = findCloudflared();
  if (!bin) fail("cloudflared not found. Install it (the wizard offers to), or pass --url https://your-tunnel");
  log("starting cloudflared quick tunnel…");
  const tunnel = spawn(bin, ["tunnel", "--no-autoupdate", "--url", LOCAL], { stdio: ["ignore", "pipe", "pipe"] });
  children.push(tunnel);
  return new Promise((resolveUrl, reject) => {
    const timer = setTimeout(() => reject(new Error("cloudflared gave no URL within 45 s")), 45_000);
    const scan = (chunk: Buffer) => {
      const match = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/.exec(chunk.toString());
      if (match) {
        clearTimeout(timer);
        resolveUrl(match[0]);
      }
    };
    tunnel.stdout?.on("data", scan);
    tunnel.stderr?.on("data", scan);
    tunnel.on("exit", (code) => reject(new Error(`cloudflared exited (${code})`)));
  });
}

/**
 * Seeds the live database on first run (every company whose number is set,
 * and the shared line); afterwards keeps each company's active config in step
 * with the agent id, AI mode and voice from .env.local. Numbers and Amy's
 * phone are fixed at seed time: changing them needs --fresh.
 */
async function syncDatabase(env: Record<string, string>): Promise<void> {
  const dir = resolve(env.PGLITE_DIR ?? LIVE_DB);
  if (fresh && existsSync(dir)) {
    const aside = `${dir}-${new Date().toISOString().replace(/[:.]/g, "-")}`;
    renameSync(dir, aside);
    log(`previous test data kept at ${aside}`);
  }
  const db = await openPglite(dir);
  try {
    const options = developmentSeedOptions(env);
    if (!(await primaryBusiness(db))) {
      const seeded = await seedOffice(db, options);
      const extra = [seeded.sublimePatioId && "Sublime Patio", seeded.theFridgeId && "The Fridge", seeded.frontDeskId && "the shared line"].filter(Boolean);
      log(`seeded ${dir}: Christmas Light Guys${extra.length ? `, ${extra.join(", ")}` : ""} (AI mode ${options.aiMode}, Amy's ring ${options.ownerRingE164})`);
      return;
    }
    const { rows } = await db.query<{ e164: string; owner_ring_e164: string }>("select e164, owner_ring_e164 from public.tracking_number");
    const wanted = LINE_KEYS.map((k) => env[k]).filter((n): n is string => Boolean(n));
    const missing = wanted.filter((n) => !rows.some((r) => r.e164 === n));
    if (missing.length > 0 || rows.some((r) => wanted.includes(r.e164) && r.owner_ring_e164 !== options.ownerRingE164)) {
      log("WARNING: a number or Amy's phone changed since this database was seeded; run with --fresh to use the new ones.");
    }
    // Decisions Amy sent since this database was seeded (only items still pending change).
    const clg = await primaryBusiness(db);
    if (clg && options.ownerDecisions) {
      const applied = await applyOwnerDecisions(db, { tenantId: clg.tenantId, businessId: clg.businessId, ...options.ownerDecisions });
      if (applied > 0) log(`applied ${applied} of Amy's decisions`);
    }
    for (const business of await officeBusinesses(db)) {
      const config = parseBusinessConfig(business.config);
      const ai = { ...config.ai, mode: options.aiMode ?? "off", voice: options.voice ?? "stock", agentId: options.agentId ?? config.ai.agentId };
      if (config.ai.agentId === ai.agentId && config.ai.mode === ai.mode && config.ai.voice === ai.voice) continue;
      await activateConfig(db, { tenantId: business.tenantId, businessId: business.businessId, config: { ...config, ai }, createdBy: "scripts/live/up.ts" });
      log(`${business.name}: AI mode ${ai.mode}, voice ${ai.voice}, agent ${ai.agentId}`);
    }
  } finally {
    await db.close();
  }
}

async function waitFor(url: string, ok: (res: Response) => boolean, seconds: number): Promise<boolean> {
  for (let i = 0; i < seconds; i++) {
    try {
      if (ok(await fetch(url, { signal: AbortSignal.timeout(5000) }))) return true;
    } catch {
      // not up yet
    }
    await sleep(1000);
  }
  return false;
}

/** First request to each route compiles it in dev; do that now, not on a live call. */
async function warmRoutes(): Promise<void> {
  const posts = [
    "voice/inbound", "voice/screen", "voice/screen-accept", "voice/dial-result", "voice/agent-ended", "voice/handoff",
    "voice/handoff-result", "voice/record-done", "voice/recording", "voice/transcript", "voice/status",
    "agent/tools/save_lead_details", "webhooks/elevenlabs", "leads/web",
  ];
  await Promise.all(posts.map((p) => fetch(`${LOCAL}/api/${p}`, { method: "POST", body: "" }).catch(() => null)));
  await Promise.all(["/login", "/dashboard", "/approvals"].map((p) => fetch(`${LOCAL}${p}`).catch(() => null)));
}

async function main(): Promise<void> {
  process.on("SIGINT", () => stopAll(0));
  process.on("SIGTERM", () => stopAll(0));

  const env = readEnvFile(ENV_PATH);
  // Check the human-supplied keys before changing anything in .env.local.
  const missing = missingKeys({ ...env, PUBLIC_BASE_URL: "set-below", AGENT_TOOL_SECRET: "generated-below" });
  if (missing.length > 0) fail(`missing in .env.local: ${missing.join(", ")}. Run: bash scripts/live/wizard.sh`);
  const production = readState().production;
  if (production && !takeOver) {
    fail(
      `the agent and the numbers serve ${production} now. A local test would point them at this computer instead. ` +
        "To do that anyway: npm run live -- --take-over (afterwards, npm run deploy:render points them back).",
    );
  }
  ensureGeneratedSecrets(env, log);
  if (await waitFor(`${LOCAL}/api/health`, () => true, 1)) {
    fail(`something is already serving ${LOCAL}. Stop it first: calls must reach this server, with these settings.`);
  }

  const base = ownUrl ?? (await startTunnel());
  if (!base.startsWith("https://")) fail(`--url must be https, got ${base}`);
  upsertEnvFile(ENV_PATH, { PUBLIC_BASE_URL: base, PGLITE_DIR: env.PGLITE_DIR ?? LIVE_DB });
  Object.assign(env, { PUBLIC_BASE_URL: base, PGLITE_DIR: env.PGLITE_DIR ?? LIVE_DB });
  log(`public URL ${base}`);

  const { envUpdates } = await provision(env, (m) => log(m));
  upsertEnvFile(ENV_PATH, envUpdates);
  Object.assign(env, envUpdates);
  if (production) {
    // The agent and the numbers now point here, not at Render.
    const state = readState();
    delete state.production;
    writeState(STATE_PATH, state);
    log(`taken over from ${production}; npm run deploy:render points everything back`);
  }

  await syncDatabase(env);

  log("starting the app (next dev)…");
  const nextBin = createRequire(import.meta.url).resolve("next/dist/bin/next");
  const app = spawn(process.execPath, [nextBin, "dev", "--port", String(PORT)], { stdio: "inherit" });
  children.push(app);
  app.on("exit", (code) => fail(`the app stopped (${code})`));
  if (!(await waitFor(`${LOCAL}/api/health`, (r) => r.ok, 180))) fail("the app did not become healthy within 3 minutes");
  await warmRoutes();
  if (!(await waitFor(`${base}/api/health`, (r) => r.ok, 60))) fail(`the tunnel ${base} does not reach the app`);

  setInterval(() => {
    void fetch(`${LOCAL}/api/jobs/run`, { headers: { authorization: `Bearer ${env.CRON_SECRET}` } }).catch(() => null);
  }, 30_000);

  const mode = env.AI_MODE ?? "off";
  const firstRing =
    mode === "always" ? "the AI assistant answers straight away" : `${env.OWNER_RING_E164} rings first (press any key to take it); if not, the AI answers`;
  const lines = [
    ["Bestline 'no answer / busy' target (AI answers at once)", env.BESTLINE_MISSED_NUMBER],
    ["Bestline 'forward all / unavailable' target (rings Amy first)", env.SHARED_LINE_NUMBER],
    ["Christmas Light Guys", env.CLG_MAIN_NUMBER ?? env.CLG_TV_NUMBER],
    ["Sublime Patio", env.SUBLIME_PATIO_NUMBER],
    ["The Fridge", env.THE_FRIDGE_NUMBER],
  ]
    .filter(([, n]) => n)
    .map(([name, n]) => `   ${name}: ${n}`)
    .join("\n");
  // What Bestline sets on 512-339-9313 (docs/bestline-setup.md); each number is tested by calling it directly first.
  const bestline = env.SHARED_LINE_NUMBER || env.BESTLINE_MISSED_NUMBER
    ? `
   Bestline, on 512-339-9313 (after you've tested by calling the numbers above directly):
     Recommended: forward all calls to ${env.SHARED_LINE_NUMBER ?? "(set SHARED_LINE_NUMBER)"}
       (Amy's cell rings first, press any key to take it; otherwise the assistant answers)
     Alternative, if Amy uses the MaX UC app: forward-all off; no answer (20 s) and busy
       to ${env.BESTLINE_MISSED_NUMBER ?? "(set BESTLINE_MISSED_NUMBER)"}; unavailable to ${env.SHARED_LINE_NUMBER ?? "(set SHARED_LINE_NUMBER)"}
   Undo at any time: forward all calls back to Amy's cell. Sheet: docs/bestline-setup.md`
    : "";
  console.log(`
  ──────────────────────────────────────────────────────────────
   LIVE. These numbers now answer (call them to test):
${lines}
   ${firstRing}.
   Voice: ${env.AI_VOICE === "owner_clone" ? "Amy's own (cloned, with consent)" : "stock ElevenLabs voice"}.
${bestline}

   Inbox:      ${LOCAL}/dashboard   (access code: OPERATOR_TOKEN in .env.local)
   Approvals:  ${LOCAL}/approvals
   Ctrl+C stops the app and the tunnel.
  ──────────────────────────────────────────────────────────────
`);
}

main().catch((error: unknown) => fail(describeError(error)));
