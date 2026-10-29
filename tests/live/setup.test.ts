import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { agentToolNames } from "@/lib/elevenlabs/agent-spec";
import { provision } from "@/scripts/live/setup";

// Live provisioning against a local stand-in for the ElevenLabs API. The SDK
// silently strips request keys it does not know, so these tests read the
// bodies as they go over the wire: a misnamed field would vanish here.

interface Seen {
  method: string;
  path: string;
  body: Record<string, unknown> | null;
}

let server: Server;
let base: string;
const seen: Seen[] = [];
let ids = 0;
const dir = mkdtempSync(join(tmpdir(), "lightline-live-"));

// Responses carry the fields the SDK validates as required.
const toolResponse = (id: string) => ({
  id,
  tool_config: { type: "webhook", name: "x", description: "x", api_schema: { url: "https://x.test", method: "POST" } },
  access_info: { is_creator: true, creator_name: "t", creator_email: "t@example.test", role: "admin" },
  usage_stats: { avg_latency_secs: 0 },
});
const agentResponse = (id: string) => ({
  agent_id: id,
  name: "x",
  conversation_config: {},
  metadata: { created_at_unix_secs: 0, updated_at_unix_secs: 0 },
});

function reply(method: string, path: string): unknown {
  if (method === "GET" && path === "/v1/convai/secrets") return { secrets: [] };
  if (path.startsWith("/v1/convai/secrets")) return { type: "stored", secret_id: "sec_1", name: "lightline_tool_key" };
  if (method === "GET" && path === "/v2/voices") {
    return {
      voices: [
        { voice_id: "v_other", name: "Zed" },
        { voice_id: "v_jess", name: "Jessica - Playful" },
        { voice_id: "v_mat", name: "Matilda - Knowledgable, Professional" },
        { voice_id: "v_sarah", name: "Sarah - Mature, Reassuring, Confident" },
      ],
      has_more: false,
      total_count: 2,
    };
  }
  if (method === "POST" && path === "/v1/convai/tools") return toolResponse(`tool_${++ids}`);
  if (method === "PATCH" && path.startsWith("/v1/convai/tools/")) return toolResponse(path.split("/").pop()!);
  if (method === "POST" && path === "/v1/workspace/webhooks") return { webhook_id: `wh_${++ids}`, webhook_secret: `whsec_${ids}` };
  if (path.startsWith("/v1/workspace/webhooks/")) return { status: "ok" };
  if (method === "POST" && path === "/v1/convai/agents/create") return { agent_id: "agent_live_1" };
  if (method === "PATCH" && path.startsWith("/v1/convai/agents/")) return agentResponse(path.split("/").pop()!);
  return null;
}

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const path = new URL(req.url ?? "/", "http://x").pathname;
      seen.push({ method: req.method ?? "", path, body: raw ? (JSON.parse(raw) as Record<string, unknown>) : null });
      const body = reply(req.method ?? "", path);
      res.writeHead(body === null ? 404 : 200, { "content-type": "application/json" });
      res.end(JSON.stringify(body ?? { detail: "not found" }));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});

afterAll(() => {
  server.close();
  rmSync(dir, { recursive: true, force: true });
});

const env = (publicBaseUrl: string, extra: Record<string, string> = {}) => ({
  TWILIO_ACCOUNT_SID: `AC${"0".repeat(32)}`,
  TWILIO_AUTH_TOKEN: "t".repeat(32),
  CLG_TV_NUMBER: "+15125550101",
  ELEVENLABS_API_KEY: "sk_test",
  ELEVENLABS_API_BASE: base,
  AGENT_TOOL_SECRET: "tool-secret-value",
  PUBLIC_BASE_URL: publicBaseUrl,
  AI_MODE: "always",
  OWNER_NAME: "Amy",
  ...extra,
});

const twilioCalls: string[] = [];
const options = () => ({
  statePath: join(dir, "state.json"),
  configureTwilio: async (e: Record<string, string>) => {
    twilioCalls.push(e.PUBLIC_BASE_URL!);
  },
});
const quiet = () => {};
// Ids: the tools take 1…n, so the first webhook is n + 1.
/** No shared line in this env, so the agent gets every tool but select_business. */
const AGENT_TOOLS = agentToolNames({ sharedLine: false });
const HOOK = `wh_${AGENT_TOOLS.length + 1}`;
const HOOK_SECRET = `whsec_${AGENT_TOOLS.length + 1}`;

describe("live provisioning (scripts/live/setup.ts)", () => {
  it("first run creates the secret, every tool, a per-agent webhook and the agent, in wire format", async () => {
    const result = await provision(env("https://one.trycloudflare.com"), quiet, options());
    expect(result.agentId).toBe("agent_live_1");
    expect(result.envUpdates).toMatchObject({ AGENT_ID: "agent_live_1", AGENT_PROVIDER: "elevenlabs", ELEVENLABS_WEBHOOK_SECRET: expect.stringMatching(/^whsec_/) });
    expect(twilioCalls).toEqual(["https://one.trycloudflare.com"]);

    const secret = seen.find((s) => s.method === "POST" && s.path === "/v1/convai/secrets")!;
    expect(secret.body).toEqual({ type: "new", name: "lightline_tool_key", value: "tool-secret-value" });

    const tools = seen.filter((s) => s.method === "POST" && s.path === "/v1/convai/tools");
    expect(tools).toHaveLength(AGENT_TOOLS.length);
    for (const { body } of tools) {
      const config = body!.tool_config as Record<string, any>;
      expect(config.type).toBe("webhook");
      expect(config.response_timeout_secs).toBe(8);
      expect(config.api_schema.url).toMatch(/^https:\/\/one\.trycloudflare\.com\/api\/agent\/tools\/[a-z_]+$/);
      expect(config.api_schema.request_headers["x-lightline-tool-key"]).toEqual({ secret_id: "sec_1" });
      expect(config.api_schema.request_body_schema.properties.call_sid.dynamic_variable).toBe("call_sid");
      expect(JSON.stringify(body)).not.toContain("tool-secret-value"); // referenced, never inlined
    }

    const hook = seen.find((s) => s.method === "POST" && s.path === "/v1/workspace/webhooks")!;
    expect(hook.body).toEqual({
      settings: { auth_type: "hmac", name: "lightline post-call", webhook_url: "https://one.trycloudflare.com/api/webhooks/elevenlabs" },
    });
    const retries = seen.find((s) => s.method === "PATCH" && s.path.startsWith("/v1/workspace/webhooks/"))!;
    expect(retries.body).toMatchObject({ retry_enabled: true, is_disabled: false });

    const agent = seen.find((s) => s.path === "/v1/convai/agents/create")!.body as Record<string, any>;
    const conv = agent.conversation_config;
    expect(conv.agent.first_message).toBe("{{opening}}");
    expect(conv.agent.prompt.tool_ids).toHaveLength(AGENT_TOOLS.length);
    expect(conv.agent.prompt.llm).toBe("claude-haiku-5-5");
    // Who answers is a per-call variable, so a new owner needs no re-publish.
    expect(conv.agent.prompt.prompt).toContain("{{owner_name}}");
    expect(conv.agent.prompt.built_in_tools.end_call.params.system_tool_type).toBe("end_call");
    expect(conv.agent.prompt.built_in_tools.skip_turn.params.system_tool_type).toBe("skip_turn");
    expect(Object.keys(conv.agent.dynamic_variables.dynamic_variable_placeholders)).toEqual(expect.arrayContaining(["call_sid", "owner_name", "today"]));
    // The phone-line turn settings reach the wire in the vendor's names.
    expect(conv.turn).toMatchObject({ silence_end_call_timeout: 60, merge_with_default_ignore_terms: true, transcribe_on_disabled_interruptions: true });
    expect(conv.turn.interruption_ignore_terms).toContain("uh-huh");
    expect(conv.agent.max_conversation_duration_message).toMatch(/call you back/);
    // Amy wants calm and mature (2026-10-29): Sarah first, never the playful one.
    expect(conv.tts).toMatchObject({ voice_id: "v_sarah", model_id: "eleven_flash_v2", agent_output_audio_format: "ulaw_8000", stability: 0.6 });
    expect(conv.asr).toMatchObject({ user_input_audio_format: "ulaw_8000" });
    expect(agent.platform_settings.workspace_overrides.webhooks).toEqual({ post_call_webhook_id: HOOK, events: ["transcript"] });
    expect(agent.platform_settings.privacy).toMatchObject({ record_voice: true, retention_days: 30 });
    expect(Object.keys(agent.platform_settings.data_collection)).toContain("callback_window");
    // Five safety criteria plus Amy's six (2026-10-29).
    expect(agent.platform_settings.evaluation.criteria.map((c: { id: string }) => c.id)).toEqual(expect.arrayContaining(["no_price_given", "maps_asked", "no_reasking", "no_remote_quote_or_visit", "company_only"]));
    expect(agent.platform_settings.evaluation.criteria).toHaveLength(11);
  });

  it("a re-run with the same URL updates in place: no new tools, agent or webhook", async () => {
    seen.length = 0;
    const result = await provision(env("https://one.trycloudflare.com", { ELEVENLABS_WEBHOOK_SECRET: HOOK_SECRET }), quiet, options());
    expect(result.envUpdates.ELEVENLABS_WEBHOOK_SECRET).toBeUndefined();
    expect(seen.filter((s) => s.method === "POST" && s.path !== "/v1/convai/secrets")).toEqual([]);
    expect(seen.filter((s) => s.method === "PATCH" && s.path.startsWith("/v1/convai/tools/"))).toHaveLength(AGENT_TOOLS.length);
    expect(seen.some((s) => s.method === "PATCH" && s.path === "/v1/convai/agents/agent_live_1")).toBe(true);
  });

  it("a new tunnel URL replaces the webhook (URLs are immutable) and re-points every tool", async () => {
    seen.length = 0;
    const result = await provision(env("https://two.trycloudflare.com", { ELEVENLABS_WEBHOOK_SECRET: HOOK_SECRET }), quiet, options());
    expect(seen.some((s) => s.method === "DELETE" && s.path === `/v1/workspace/webhooks/${HOOK}`)).toBe(true);
    expect(result.envUpdates.ELEVENLABS_WEBHOOK_SECRET).toMatch(/^whsec_/);
    expect(result.envUpdates.ELEVENLABS_WEBHOOK_SECRET).not.toBe(HOOK_SECRET);
    const urls = seen
      .filter((s) => s.method === "PATCH" && s.path.startsWith("/v1/convai/tools/"))
      .map((s) => (s.body!.tool_config as { api_schema: { url: string } }).api_schema.url);
    expect(urls.every((u) => u.startsWith("https://two.trycloudflare.com/"))).toBe(true);
  });

  it("refuses to provision without the human-supplied keys or with a non-https URL", async () => {
    await expect(provision({ ...env("https://x.test"), ELEVENLABS_API_KEY: "" }, quiet, options())).rejects.toThrow(/ELEVENLABS_API_KEY/);
    await expect(provision(env("http://localhost:3000"), quiet, options())).rejects.toThrow(/https/);
  });
});
