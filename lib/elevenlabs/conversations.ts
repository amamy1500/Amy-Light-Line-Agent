/**
 * Conversation reads and deletes on the ElevenLabs API, over plain fetch so
 * the payloads keep the same snake_case shape as the post-call webhook and go
 * through the same parser (lib/elevenlabs/post-call.ts).
 * https://elevenlabs.io/docs/api-reference/conversations/list ·
 * https://elevenlabs.io/docs/api-reference/conversations/get ·
 * https://elevenlabs.io/docs/api-reference/conversations/delete
 */

const API = "https://api.elevenlabs.io";

interface Options {
  apiKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  baseUrl?: string;
}

async function call(options: Options, path: string, init: RequestInit = {}): Promise<Response> {
  const doFetch = options.fetchImpl ?? fetch;
  return doFetch(new URL(path, options.baseUrl ?? API), {
    ...init,
    headers: { "xi-api-key": options.apiKey, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
  });
}

export async function deleteConversation(input: Options & { conversationId: string }): Promise<"deleted" | "not_found"> {
  const res = await call(input, `/v1/convai/conversations/${encodeURIComponent(input.conversationId)}`, { method: "DELETE" });
  if (res.status === 404) return "not_found";
  if (!res.ok) throw new Error(`delete conversation responded ${res.status}`);
  return "deleted";
}

/** One conversation as the API returns it (snake_case, like the webhook's `data`). */
export async function getConversation(input: Options & { conversationId: string }): Promise<Record<string, unknown>> {
  const res = await call(input, `/v1/convai/conversations/${encodeURIComponent(input.conversationId)}`);
  if (!res.ok) throw new Error(`get conversation responded ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

function callSidIn(conversation: Record<string, unknown>): string | null {
  const vars = (conversation.conversation_initiation_client_data as { dynamic_variables?: Record<string, unknown> } | undefined)
    ?.dynamic_variables;
  const fromVars = vars?.call_sid;
  if (typeof fromVars === "string") return fromVars;
  const phone = (conversation.metadata as { phone_call?: { call_sid?: unknown } } | undefined)?.phone_call;
  return typeof phone?.call_sid === "string" ? phone.call_sid : null;
}

/**
 * The finished conversations of one agent for one Twilio call — the fallback
 * when the post-call webhook never arrives (its retries are off by default).
 * A missed hand-off can give a call two conversations; both are returned.
 */
export async function findConversationsForCall(
  input: Options & { agentId: string; callSid: string; startedAfterUnix: number },
): Promise<Array<Record<string, unknown>>> {
  const query = new URLSearchParams({
    agent_id: input.agentId,
    call_start_after_unix: String(Math.max(0, input.startedAfterUnix - 60)),
    page_size: "30",
  });
  const res = await call(input, `/v1/convai/conversations?${query}`);
  if (!res.ok) throw new Error(`list conversations responded ${res.status}`);
  const page = (await res.json()) as { conversations?: Array<{ conversation_id?: string; status?: string }> };
  const found: Array<Record<string, unknown>> = [];
  for (const summary of page.conversations ?? []) {
    // Still running or still being analysed: the webhook (or the next sweep) will bring it.
    if (!summary.conversation_id || !["done", "failed"].includes(summary.status ?? "")) continue;
    const full = await getConversation({ ...input, conversationId: summary.conversation_id });
    if (callSidIn(full) === input.callSid) found.push(full);
  }
  return found;
}
