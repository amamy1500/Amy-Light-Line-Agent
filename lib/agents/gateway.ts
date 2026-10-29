import { createHash } from "node:crypto";
import { z } from "zod";
import type { CompanyOption } from "@/lib/business-rules/company-resolution";
import type { BusinessConfig } from "@/lib/business-rules/config";
import { findToolCall, getCallContext, lineCompanies, saveToolCall } from "@/lib/db/agent";
import type { Queryable } from "@/lib/db/migrate";
import { redactDeep } from "./redact";
import { isToolName, TOOLS, type ToolDeps } from "./tools";

/**
 * The single entry point for agent tool calls. Order of checks:
 * known tool → envelope (our call SID) → live call → same request seen
 * before (replay) → input schema → tool's own policy. Every outcome,
 * including rejections, is stored and evented; nothing internal (stack
 * traces, SQL, other customers' data) is ever returned to the agent.
 */

const Envelope = z.looseObject({
  call_sid: z.string().regex(/^CA[0-9a-f]{32}$/i),
  conversation_id: z.string().min(1).max(200).optional(),
});
const ENVELOPE_KEYS = new Set(["call_sid", "conversation_id"]);

/** A conversation stuck in a tool loop is stopped well before it can do harm. */
export const MAX_TOOL_CALLS_PER_CALL = 40;

export interface GatewayDeps {
  db: Queryable;
  now: Date;
  loadConfig: (businessId: string) => Promise<BusinessConfig | null>;
  scheduleHandoff: ToolDeps["scheduleHandoff"];
  log?: (message: string, detail?: unknown) => void;
}

export interface GatewayResponse {
  status: number;
  body: Record<string, unknown>;
}

const SAFE_FAILURE = {
  ok: false,
  instruction:
    "Say you're having trouble saving that right now, that the details won't be lost, and offer to have Amy call back.",
};

/** Deterministic JSON so the same arguments always produce the same idempotency key. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

export async function runTool(name: string, raw: unknown, deps: GatewayDeps): Promise<GatewayResponse> {
  if (!isToolName(name)) return { status: 404, body: { ok: false, error: "unknown_tool" } };
  const tool = TOOLS[name];

  const envelope = Envelope.safeParse(raw);
  if (!envelope.success) return { status: 400, body: { ok: false, error: "missing_call_reference" } };
  // A card number read out to the agent never reaches a tool or the database.
  const args = redactDeep(Object.fromEntries(Object.entries(envelope.data).filter(([k]) => !ENVELOPE_KEYS.has(k))));

  const ctx = await getCallContext(deps.db, envelope.data.call_sid);
  if (!ctx) return { status: 404, body: { ok: false, error: "unknown_call" } };

  // The company is part of the key: after a caller switches company, the same
  // question must be answered for the new company, not replayed from the old one.
  const key = [
    envelope.data.conversation_id ?? ctx.callSid,
    ctx.businessId,
    name,
    createHash("sha256").update(canonicalJson(args)).digest("hex").slice(0, 32),
  ].join(":");
  const previous = await findToolCall(deps.db, key);
  if (previous) return { status: 200, body: { ok: previous.outcome === "ok", ...previous.output, replayed: true } };

  const started = Date.now();
  const store = async (outcome: "ok" | "rejected" | "error", output: Record<string, unknown>) => {
    const stored = await saveToolCall(deps.db, {
      context: ctx,
      tenantId: ctx.tenantId,
      businessId: ctx.businessId,
      toolName: name,
      // Errors are recorded under their own key so a retry of the same
      // request runs again instead of replaying a transient failure.
      idempotencyKey: outcome === "error" ? `${key}:error:${Date.now()}:${Math.random().toString(36).slice(2, 8)}` : key,
      input: args,
      output,
      outcome,
      latencyMs: Date.now() - started,
    });
    return { status: 200, body: { ok: stored.outcome === "ok", ...stored.output } };
  };

  const { rows } = await deps.db.query<{ n: number | string }>(
    "select count(*) as n from public.tool_call where call_id = $1",
    [ctx.callId],
  );
  if (Number(rows[0]?.n ?? 0) >= MAX_TOOL_CALLS_PER_CALL) {
    return store("rejected", {
      error: "tool_limit",
      instruction: "Wrap up now: confirm Amy will call back, call finish_call, and end the call politely.",
    });
  }

  if (ctx.completed || !tool.states.includes(ctx.state)) {
    return store("rejected", { error: "call_not_live", state: ctx.state });
  }

  const parsed = tool.input.safeParse(args);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((i) => i.path.join(".") || "(input)"))];
    return store("rejected", {
      error: "invalid_input",
      fields,
      instruction: "Some details were not in the expected form. Only pass what the caller actually said, in plain words.",
    });
  }

  const config = await deps.loadConfig(ctx.businessId);
  if (!config) {
    deps.log?.(`tool ${name}: no valid business config`);
    return store("error", { ...SAFE_FAILURE, error: "configuration_unavailable" });
  }

  try {
    // The schema was checked above; the tool's own type is the parsed value.
    const result = await (tool.run as (a: unknown, d: ToolDeps) => ReturnType<typeof tool.run>)(parsed.data, {
      db: deps.db,
      config,
      now: deps.now,
      ctx,
      scheduleHandoff: deps.scheduleHandoff,
      companies: async () => {
        const options: CompanyOption[] = [];
        for (const company of await lineCompanies(deps.db, ctx.callId)) {
          const companyConfig = await deps.loadConfig(company.businessId);
          if (companyConfig) options.push({ businessId: company.businessId, config: companyConfig });
        }
        return options;
      },
    });
    return store(result.outcome, result.body);
  } catch (error) {
    deps.log?.(`tool ${name} failed`, error instanceof Error ? error.message : "unknown error");
    return store("error", { ...SAFE_FAILURE, error: "internal" });
  }
}
