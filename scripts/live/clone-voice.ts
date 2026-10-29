/**
 * Gives the phone agent Amy's own voice: creates an Instant Voice Clone on
 * ElevenLabs from her recordings and points the agent at it. It refuses to
 * run without her signed consent (docs/research/amy-voice-clone.md §5.5),
 * and keeps the consent file's SHA-256 with the voice id in
 * .data/live-state.json as the record of what was used.
 *
 * Before running:
 *   - Amy has signed the consent (counsel-approved wording), freely, not as a
 *     condition of her job.
 *   - ElevenLabs: Settings → Privacy → training opt-out is ON (it only
 *     applies to audio uploaded after it is turned on).
 *   - 1–2 minutes of clean speech in total: quiet room, phone-call distance,
 *     the script in amy-voice-clone.md §6.3.
 *
 * Usage:
 *   npx tsx scripts/live/clone-voice.ts --consent <signed-consent.pdf> <recording.mp3> [more …]
 *   npx tsx scripts/live/clone-voice.ts --revoke      (Amy withdrew: delete the voice, back to stock)
 * Then run `npm run live` so the agent is re-provisioned with the voice.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, resolve } from "node:path";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { readEnvFile, upsertEnvFile } from "./env-file";
import { describeError, ENV_PATH } from "./setup";

const STATE_PATH = resolve(".data/live-state.json");
const AUDIO = new Set([".mp3", ".wav", ".m4a", ".flac", ".ogg", ".webm"]);
/** Below this a file is almost certainly too short to clone from (~10 s of compressed speech). */
const MIN_BYTES = 100_000;

interface VoiceCloneRecord {
  voiceId: string;
  consentFile: string;
  consentSha256: string;
  recordings: string[];
  createdAt: string;
}

function readState(): Record<string, unknown> {
  return existsSync(STATE_PATH) ? (JSON.parse(readFileSync(STATE_PATH, "utf8")) as Record<string, unknown>) : {};
}

function writeState(state: Record<string, unknown>): void {
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`);
}

function fail(message: string): never {
  console.error(`[voice] ${message}`);
  process.exit(1);
}

function clientFrom(env: Record<string, string>): ElevenLabsClient {
  if (!env.ELEVENLABS_API_KEY) fail("ELEVENLABS_API_KEY is missing in .env.local (run scripts/live/wizard.sh)");
  return new ElevenLabsClient({ apiKey: env.ELEVENLABS_API_KEY, ...(env.ELEVENLABS_API_BASE ? { baseUrl: env.ELEVENLABS_API_BASE } : {}) });
}

async function revoke(env: Record<string, string>): Promise<void> {
  const state = readState();
  const clone = state.voiceClone as VoiceCloneRecord | undefined;
  const voiceId = clone?.voiceId ?? env.ELEVENLABS_VOICE_ID;
  if (voiceId) {
    await clientFrom(env).voices.delete(voiceId);
    console.log(`[voice] deleted voice ${voiceId} at ElevenLabs`);
  }
  delete state.voiceClone;
  delete state.voiceId; // setup picks a stock voice again
  writeState(state);
  upsertEnvFile(ENV_PATH, { ELEVENLABS_VOICE_ID: "", AI_VOICE: "stock" });
  console.log("[voice] back to a stock voice. Run `npm run live` to re-provision the agent.");
}

async function create(env: Record<string, string>, consentPath: string, recordings: string[]): Promise<void> {
  if (!existsSync(consentPath)) fail(`consent file not found: ${consentPath}`);
  if (recordings.length === 0) fail("give at least one recording of Amy");
  for (const file of recordings) {
    if (!existsSync(file)) fail(`recording not found: ${file}`);
    if (!AUDIO.has(extname(file).toLowerCase())) fail(`not an audio file ElevenLabs takes: ${file}`);
    if (statSync(file).size < MIN_BYTES) fail(`${basename(file)} is too short to clone from; record 1–2 minutes in total`);
  }
  const consentSha256 = createHash("sha256").update(readFileSync(consentPath)).digest("hex");
  const owner = env.OWNER_NAME || "Amy";
  const today = new Date().toISOString().slice(0, 10);

  const created = await clientFrom(env).voices.ivc.create({
    name: `${owner} (Lightline, consent ${today})`,
    description: `${owner}'s own voice for her AI phone assistant, used with her signed consent (sha256 ${consentSha256.slice(0, 12)}).`,
    files: recordings.map((path) => ({ path })),
    removeBackgroundNoise: true,
  });

  const record: VoiceCloneRecord = {
    voiceId: created.voiceId,
    consentFile: basename(consentPath),
    consentSha256,
    recordings: recordings.map((r) => basename(r)),
    createdAt: new Date().toISOString(),
  };
  writeState({ ...readState(), voiceClone: record, voiceId: created.voiceId });
  // The greeting then says "I sound like Amy, but I'm an automated system, not Amy and not a person."
  upsertEnvFile(ENV_PATH, { ELEVENLABS_VOICE_ID: created.voiceId, AI_VOICE: "owner_clone" });
  console.log(`[voice] created ${owner}'s voice ${created.voiceId}; consent sha256 ${consentSha256}`);
  if (created.requiresVerification) {
    console.log("[voice] ElevenLabs asks for verification: open Voices in the ElevenLabs app and follow its prompt.");
  }
  console.log("[voice] next: `npm run live -- --fresh` (the greeting changes, so start from a clean database).");
}

const args = process.argv.slice(2);
const env = readEnvFile(ENV_PATH);
const run = args.includes("--revoke")
  ? revoke(env)
  : (() => {
      const at = args.indexOf("--consent");
      if (at < 0 || !args[at + 1]) fail("pass --consent <Amy's signed consent file>; the voice is never cloned without it");
      const consent = args[at + 1]!;
      return create(env, consent, args.filter((_, i) => i !== at && i !== at + 1));
    })();
run.catch((error: unknown) => fail(describeError(error)));
