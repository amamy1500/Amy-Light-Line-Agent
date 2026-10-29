/**
 * Every custom dynamic variable the agent's prompt and tools reference.
 * ElevenLabs fails the whole call with "Missing required dynamic variables"
 * when one is absent, so the set is fixed here and always sent complete.
 */
export const DYNAMIC_VARIABLE_KEYS = [
  "call_sid",
  "session_id",
  "caller_number",
  "entry",
  "returning_context",
  "handoff_note",
  "ring_hours_note",
  "opening",
  "company_name",
  "company_context",
  "owner_name",
  "callback_name",
  "assistant_role",
  "today",
] as const;

export type DynamicVariableKey = (typeof DYNAMIC_VARIABLE_KEYS)[number];
export type DynamicVariables = Record<DynamicVariableKey, string>;

/**
 * Why the agent is on the line. It changes the greeting:
 *  - owner_unavailable: Amy's phone rang and she could not take it.
 *  - owner_busy: Amy is already on another of our calls, so her phone didn't ring.
 *  - after_hours: outside Amy's ring hours.
 *  - handoff_failed: the caller asked for Amy, she did not pick up, the
 *    caller is back with the assistant and must not repeat themselves.
 */
export type Entry = "owner_unavailable" | "owner_busy" | "after_hours" | "handoff_failed" | "ai_first";

export function buildDynamicVariables(input: {
  callSid: string;
  /** Our agent_session id; comes back in the post-call webhook to match the conversation. */
  sessionId: string;
  callerNumber: string | null;
  entry: Entry;
  /** Safe minimal summary of a returning caller, or null. Never addresses or prices. */
  returningContext: string | null;
  handoffNote: string | null;
  ringHoursNote: string;
  /** The agent's first line (first_message is "{{opening}}"), with the required disclosures. */
  opening: string;
  /** The company this call is for, or null while a shared line's caller hasn't said. */
  companyName: string | null;
  /** How to handle this company's callers (lib/agents/policy.ts companyNotes), or the shared-line rule. */
  companyContext: string;
  /** Who answers the phones (Settings → Owner); a new hire needs no agent re-publish. */
  ownerName: string;
  /** Who calls sales leads back and talks pricing (e.g. Josh); the owner when nobody else is set. */
  callbackName: string;
  /** How the assistant introduces itself, e.g. "Amy's AI assistant". */
  assistantRole: string;
  /** Local date and time, e.g. "Thursday, November 26, 2026 at 2:15 PM (America/Chicago)". */
  today: string;
}): DynamicVariables {
  return {
    call_sid: input.callSid,
    session_id: input.sessionId,
    caller_number: input.callerNumber ?? "unknown",
    entry: input.entry,
    returning_context: input.returningContext ?? "none",
    handoff_note: input.handoffNote ?? "none",
    ring_hours_note: input.ringHoursNote,
    opening: input.opening,
    company_name: input.companyName ?? "not known yet",
    company_context: input.companyContext,
    owner_name: input.ownerName,
    callback_name: input.callbackName,
    assistant_role: input.assistantRole,
    today: input.today,
  };
}
