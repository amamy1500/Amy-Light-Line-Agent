import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { deployToRender, OPTIONAL_RENDER_KEYS, RENDER_KEYS, renderApi, type RenderApi } from "@/scripts/deploy/render";

// The Render deploy's order is the point: keys before the deploy, and the
// numbers move to Render only once that deploy is live.

const dir = mkdtempSync(join(tmpdir(), "lightline-render-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const SERVICE = { id: "srv-1", name: "lightline", type: "web_service", serviceDetails: { url: "https://lightline-x.onrender.com" } };

function fakeApi(statuses: string[], services: unknown[] = [{ service: SERVICE, cursor: "c" }]) {
  const calls: Array<{ method: string; path: string; body?: unknown }> = [];
  const api: RenderApi = {
    async request<T>(method: string, path: string, body?: unknown): Promise<T> {
      calls.push({ method, path, body });
      if (method === "GET" && path.startsWith("/services?")) return services as T;
      if (method === "POST") return { id: "dep-1", status: "created" } as T;
      if (method === "GET" && path === "/services/srv-1/deploys/dep-1") return { id: "dep-1", status: statuses.shift() ?? "live" } as T;
      return { key: "x", value: "y" } as T;
    },
  };
  return { api, calls };
}

function run(statuses: string[], events: string[], services?: unknown[]) {
  const { api, calls } = fakeApi(statuses, services);
  const env: Record<string, string> = {
    TWILIO_ACCOUNT_SID: "AC1",
    TWILIO_AUTH_TOKEN: "t",
    ELEVENLABS_API_KEY: "k",
    AGENT_TOOL_SECRET: "s",
    CLG_MAIN_NUMBER: "+15125550160",
    RESEND_API_KEY: "re_1",
  };
  const statePath = join(dir, `state-${Math.random()}.json`);
  const result = deployToRender(env, {
    api,
    log: () => {},
    sleep: async () => {},
    fetch: (async () => new Response("{}", { status: 200 })) as typeof fetch,
    save: () => events.push("saved"),
    statePath,
    provision: async (e, _log, opts) => {
      events.push(`provision ${e.PUBLIC_BASE_URL}`);
      await opts?.configureTwilio?.(e, () => {});
      return { agentId: "agent_1", envUpdates: { AGENT_ID: "agent_1", ELEVENLABS_WEBHOOK_SECRET: "wh" } };
    },
    configureTwilio: async (e) => {
      events.push(`twilio ${e.PUBLIC_BASE_URL}`);
    },
  });
  return { result, calls, statePath };
}

describe("npm run deploy:render", () => {
  it("aims the agent at Render, sets the keys, deploys, and only then moves the numbers", async () => {
    const events: string[] = [];
    const { result, calls, statePath } = run(["build_in_progress", "pre_deploy_in_progress", "live"], events);
    await expect(result).resolves.toEqual({ url: "https://lightline-x.onrender.com" });
    expect(events).toEqual(["provision https://lightline-x.onrender.com", "saved", "twilio https://lightline-x.onrender.com"]);

    const puts = calls.filter((c) => c.method === "PUT");
    expect(puts.map((c) => c.path.split("/").pop())).toEqual([...RENDER_KEYS, "RESEND_API_KEY"]);
    expect(puts.find((c) => c.path.endsWith("/AGENT_ID"))?.body).toEqual({ value: "agent_1" });
    expect(puts.find((c) => c.path.endsWith("/PUBLIC_BASE_URL"))?.body).toEqual({ value: "https://lightline-x.onrender.com" });
    // Every key is set before the deploy starts.
    const deployAt = calls.findIndex((c) => c.method === "POST");
    expect(calls.findLastIndex((c) => c.method === "PUT")).toBeLessThan(deployAt);
    expect(JSON.parse(readFileSync(statePath, "utf8")).production).toBe("https://lightline-x.onrender.com");
    expect(OPTIONAL_RENDER_KEYS).not.toContain("DATABASE_URL");
  });

  it("leaves the numbers where they are when the deploy fails", async () => {
    const events: string[] = [];
    const { result } = run(["build_in_progress", "pre_deploy_failed"], events);
    await expect(result).rejects.toThrow(/pre_deploy_failed/);
    expect(events.some((e) => e.startsWith("twilio"))).toBe(false);
  });

  it("says what to do when the Blueprint has not been created yet", async () => {
    const { result } = run([], [], []);
    await expect(result).rejects.toThrow(/New → Blueprint/);
  });

  it("sends the API key as a bearer token and never puts values in an error", async () => {
    let auth = "";
    const api = renderApi("rnd_secret", (async (_url: string, init: RequestInit) => {
      auth = (init.headers as Record<string, string>).authorization!;
      return new Response(JSON.stringify({ message: "invalid value" }), { status: 400 });
    }) as unknown as typeof fetch);
    const error = await api.request("PUT", "/services/srv-1/env-vars/AGENT_TOOL_SECRET", { value: "hunter2" }).catch((e: Error) => e);
    expect(auth).toBe("Bearer rnd_secret");
    expect(String(error)).toMatch(/Render 400 on PUT .*AGENT_TOOL_SECRET: invalid value/);
    expect(String(error)).not.toMatch(/hunter2|rnd_secret/);
  });
});
