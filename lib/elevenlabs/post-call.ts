import { z } from "zod";
import type { Turn } from "@/lib/agents/compliance";

/**
 * The parts of ElevenLabs' `post_call_transcription` webhook we rely on.
 * Unknown fields are kept (loose objects) because the vendor adds fields
 * over time; fields we need are validated, never assumed.
 * https://elevenlabs.io/docs/eleven-agents/workflows/post-call-webhooks
 */
const TranscriptTurn = z.looseObject({
  role: z.enum(["agent", "user"]),
  message: z.string().nullable().optional(),
  time_in_call_secs: z.number().optional(),
  tool_calls: z.array(z.looseObject({ tool_name: z.string().optional() })).nullable().optional(),
  tool_results: z
    .array(z.looseObject({ tool_name: z.string().optional(), is_error: z.boolean().optional() }))
    .nullable()
    .optional(),
});

const AnalysisValue = z.looseObject({
  value: z.unknown().optional(),
  result: z.string().optional(),
  rationale: z.string().nullable().optional(),
});

export const PostCallTranscription = z.looseObject({
  type: z.literal("post_call_transcription"),
  event_timestamp: z.number().optional(),
  data: z.looseObject({
    agent_id: z.string(),
    conversation_id: z.string().min(1),
    status: z.string().optional(),
    transcript: z.array(TranscriptTurn).default([]),
    metadata: z
      .looseObject({
        call_duration_secs: z.number().optional(),
        phone_call: z.looseObject({ call_sid: z.string().optional() }).nullable().optional(),
      })
      .default({}),
    analysis: z
      .looseObject({
        transcript_summary: z.string().nullable().optional(),
        call_successful: z.string().optional(),
        data_collection_results: z.record(z.string(), AnalysisValue).nullable().optional(),
        evaluation_criteria_results: z.record(z.string(), AnalysisValue).nullable().optional(),
      })
      .nullable()
      .optional(),
    conversation_initiation_client_data: z
      .looseObject({ dynamic_variables: z.record(z.string(), z.unknown()).nullable().optional() })
      .nullable()
      .optional(),
  }),
});
export type PostCallTranscription = z.infer<typeof PostCallTranscription>;

/** Our call SID for this conversation: the variable we passed in, else the vendor's phone metadata. */
export function callSidOf(payload: PostCallTranscription): string | null {
  const vars = payload.data.conversation_initiation_client_data?.dynamic_variables ?? {};
  const fromVars = vars["call_sid"];
  if (typeof fromVars === "string" && /^CA[0-9a-f]{32}$/i.test(fromVars)) return fromVars;
  const fromMeta = payload.data.metadata.phone_call?.call_sid;
  return fromMeta && /^CA[0-9a-f]{32}$/i.test(fromMeta) ? fromMeta : null;
}

/** Our agent_session id, echoed back from the dynamic variables we sent. */
export function sessionIdOf(payload: PostCallTranscription): string | null {
  const value = payload.data.conversation_initiation_client_data?.dynamic_variables?.["session_id"];
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value : null;
}

/** Vendor transcript → the compliance scanner's turn shape. */
export function toTurns(payload: PostCallTranscription): Turn[] {
  return payload.data.transcript
    .filter((t) => typeof t.message === "string" && t.message.trim() !== "")
    .map((t) => ({ role: t.role === "agent" ? "agent" : "caller", text: t.message ?? "" }));
}

/** Data-collection results as plain strings (empty and non-string values dropped). */
export function collectedValues(payload: PostCallTranscription): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(payload.data.analysis?.data_collection_results ?? {})) {
    const value = entry.value;
    if (typeof value === "string" && value.trim()) out[key] = value.trim();
    else if (typeof value === "number" || typeof value === "boolean") out[key] = String(value);
  }
  return out;
}
