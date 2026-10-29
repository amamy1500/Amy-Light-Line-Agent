import { scanConversation } from "@/lib/agents/compliance";
import { redactDeep } from "@/lib/agents/redact";
import { attachConversation, enqueueJob, recordingDeclined } from "@/lib/db/agent";
import { tenantScanOptions } from "@/lib/db/knowledge";
import type { Queryable } from "@/lib/db/migrate";
import { callSidOf, PostCallTranscription, sessionIdOf, toTurns } from "@/lib/elevenlabs/post-call";
import { verifyElevenLabsSignature } from "@/lib/elevenlabs/webhook-signature";

export interface WebhookResult {
  status: number;
  body: Record<string, unknown>;
}

/**
 * Verifies and parses a post-call webhook, then stores it (ingestPostCall)
 * and makes the call's post-call job due now. Idempotent: the vendor's retries are byte-identical
 * and attach_conversation ignores a conversation it already has.
 *
 * Status codes are chosen for the vendor's retry policy: 401 for a bad
 * signature (do not retry), 200 for events we deliberately ignore, 5xx only
 * for our own failures (retry).
 */
export async function handlePostCallWebhook(input: {
  db: Queryable;
  secret: string | undefined;
  signature: string | null;
  rawBody: string;
  nowSeconds: number;
}): Promise<WebhookResult> {
  const check = verifyElevenLabsSignature({
    secret: input.secret,
    header: input.signature,
    rawBody: input.rawBody,
    nowSeconds: input.nowSeconds,
  });
  if (!check.ok) return { status: 401, body: { ok: false, error: check.reason } };

  let json: unknown;
  try {
    json = JSON.parse(input.rawBody);
  } catch {
    return { status: 400, body: { ok: false, error: "invalid_json" } };
  }
  const type = (json as { type?: unknown })?.type;
  if (type !== "post_call_transcription") return { status: 200, body: { ok: true, ignored: String(type ?? "unknown") } };
  return ingestPostCall(input.db, json);
}

/**
 * Stores one finished conversation. Shared by the signed webhook and by the
 * reconciliation sweep, which fetches the same snake_case payload from the
 * vendor's API when a webhook never arrives (workflows/post-call/runner.ts).
 */
export async function ingestPostCall(db: Queryable, payload: unknown): Promise<WebhookResult> {
  const parsed = PostCallTranscription.safeParse(payload);
  if (!parsed.success) return { status: 400, body: { ok: false, error: "unexpected_payload" } };
  const callSid = callSidOf(parsed.data);
  if (!callSid) return { status: 200, body: { ok: true, ignored: "not_a_phone_call" } };

  const data = parsed.data.data;
  // A caller who declined recording (said so to the agent, or the transcript
  // shows it) leaves only metadata: no transcript, summary or extraction is
  // stored, and the vendor's copy is purged. The compliance result is kept
  // as codes and flags, without quotes.
  const turns = toTurns(parsed.data);
  const { rows: owners } = await db.query<{ tenant_id: string; business_id: string | null }>(
    "select tenant_id, business_id from public.call where twilio_call_sid = $1",
    [callSid],
  );
  const scanOptions = owners[0] ? await tenantScanOptions(db, owners[0].tenant_id, owners[0].business_id) : {};
  const scan = scanConversation(turns, [], scanOptions);
  const declined = (await recordingDeclined(db, callSid)) || scan.signals.some((s) => s.code === "recording_declined");
  let sessionId: string;
  try {
    sessionId = await attachConversation(db, {
      callSid,
      sessionId: sessionIdOf(parsed.data),
      conversationId: data.conversation_id,
      // Card numbers a caller read out are removed before anything is kept.
      transcript: declined ? null : redactDeep(data.transcript),
      summary: declined ? null : redactDeep(data.analysis?.transcript_summary ?? null),
      dataCollection: declined ? {} : redactDeep((data.analysis?.data_collection_results ?? {}) as Record<string, unknown>),
      evaluation: declined ? {} : ((data.analysis?.evaluation_criteria_results ?? {}) as Record<string, unknown>),
      metadata: {
        agent_id: data.agent_id,
        status: data.status ?? null,
        call_duration_secs: data.metadata.call_duration_secs ?? null,
        call_successful: data.analysis?.call_successful ?? null,
        ...(declined
          ? {
              recording_declined: true,
              compliance: { violations: [...new Set(scan.violations.map((v) => v.code))], summary: scan.summary },
            }
          : {}),
      },
    });
  } catch (error) {
    const code = (error as { code?: string }).code;
    // Unknown call or session: not ours to retry forever.
    if (code === "P0002") return { status: 200, body: { ok: true, ignored: "unknown_call" } };
    throw error;
  }
  await db.query(
    `update public.job set run_after = now()
      where dedupe_key = (select 'post_call:' || id::text from public.call where twilio_call_sid = $1)
        and status = 'pending'`,
    [callSid],
  );
  if (declined) {
    const { rows } = await db.query<{ tenant_id: string; business_id: string }>(
      "select tenant_id, business_id from public.agent_session where id = $1",
      [sessionId],
    );
    const owner = rows[0];
    if (owner) {
      await enqueueJob(db, {
        tenantId: owner.tenant_id,
        businessId: owner.business_id,
        kind: "vendor_purge",
        subjectId: sessionId,
        dedupeKey: `vendor_purge:${sessionId}`,
      });
    }
  }
  return { status: 200, body: { ok: true } };
}
