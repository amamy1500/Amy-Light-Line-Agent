import { scanConversation, type ComplianceReport, type ToolCallRecord, type Turn } from "@/lib/agents/compliance";
import { classifyIntent, type IntentResult } from "@/lib/agents/lead-card";
import {
  claimJobs,
  enqueueJob,
  raiseIncident,
  recordLeadFact,
  requestCallback,
  settleJob,
  type ClaimedJob,
  type FactField,
  type WrapUpOutcome,
} from "@/lib/db/agent";
import type { Queryable } from "@/lib/db/migrate";
import { deleteConversation, findConversationsForCall } from "@/lib/elevenlabs/conversations";
import { tenantScanOptions } from "@/lib/db/knowledge";
import { blockNumber } from "@/lib/db/screening";
import { loadActiveConfig } from "@/lib/db/config";
import { DEFAULT_ALERTS, DEFAULT_SCREENING } from "@/lib/business-rules/config";
import { ensureDigestJobs, processDigest } from "./digest";
import { ingestPostCall } from "@/lib/server/post-call-webhook";

/**
 * Post-call workflow. A plain, durable sequence over database state:
 *
 *   wait for transcript (bounded) → compliance scan → merge extracted facts
 *   → intent → guarantee a callback task → Amy's alert → schedule escalation
 *
 * Each step is idempotent (facts keep provenance and never override a more
 * trusted source; one open callback per lead; one alert per call and kind),
 * so a retried job can safely run the whole sequence again. The job row is
 * the durable state; there is no in-memory workflow to lose.
 */

const FACT_FIELDS: readonly FactField[] = [
  "caller_name",
  "customer_type",
  "property_type",
  "property_address",
  "zip",
  "service_requested",
  "job_type",
  "desired_timing",
  "callback_window",
  "lead_source",
  "callback_phone",
  "caller_email",
  "home_size",
  "outdoor_plugs",
  "site_visit_window",
  "maps_visible",
];

/** Extracted facts that must be one of a few words; anything else is dropped rather than guessed. */
const ENUM_FACTS: Partial<Record<FactField, readonly string[]>> = { maps_visible: ["yes", "no", "unsure"] };

/** Attempts to wait for the vendor's transcript before analysing without it. */
export const TRANSCRIPT_WAIT_ATTEMPTS = 4;
/** From this attempt on, a missing webhook is fetched from the vendor's API instead. */
export const RECONCILE_FROM_ATTEMPT = 2;

/** Where to fetch conversations whose webhook never came; absent → only wait. */
export interface VendorAccess {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}
/** How long a hot lead may wait for a callback before Amy is reminded. */
export const HOT_LEAD_ESCALATION_SECONDS = 30 * 60;

/** Facts only a would-be customer gives. Notes and "heard about us" don't count: a pitch fills those too. */
const CUSTOMER_FACTS: readonly FactField[] = [
  "caller_name",
  "property_address",
  "zip",
  "service_requested",
  "desired_timing",
  "callback_window",
  "callback_phone",
  "caller_email",
  "home_size",
  "site_visit_window",
  "maps_visible",
];

interface CallBundle {
  callId: string;
  callSid: string;
  /** The caller's own number, or null when hidden or replaced by a forward. */
  from: string | null;
  tenantId: string;
  businessId: string;
  leadId: string | null;
  state: string;
  sessions: Array<{
    provider: string;
    agentId: string | null;
    startedAt: Date;
    status: string;
    endReason: string | null;
    transcript: unknown;
    summary: string | null;
    dataCollection: Record<string, { value?: unknown }>;
    metadata: {
      wrapped_up?: boolean;
      outcome?: WrapUpOutcome;
      agent_summary?: string;
      recording_declined?: boolean;
      compliance?: { violations: ComplianceReport["violations"][number]["code"][]; summary: ComplianceReport["summary"] };
    };
    postCallAt: Date | null;
  }>;
  toolCalls: ToolCallRecord[];
  facts: Partial<Record<FactField, string>>;
  transferred: boolean;
}

async function loadBundle(db: Queryable, callId: string): Promise<CallBundle | null> {
  const { rows: calls } = await db.query<{
    id: string; sid: string; from_e164: string | null; tenant_id: string; business_id: string; lead_id: string | null; state: string;
  }>(
    "select id, twilio_call_sid as sid, from_e164, tenant_id, business_id, lead_id, state from public.call where id = $1",
    [callId],
  );
  const call = calls[0];
  if (!call) return null;
  const { rows: sessions } = await db.query<CallBundle["sessions"][number]>(
    `select provider, agent_id as "agentId", started_at as "startedAt", status, end_reason as "endReason", transcript, summary,
            data_collection as "dataCollection", metadata, post_call_at as "postCallAt"
       from public.agent_session where call_id = $1 order by started_at`,
    [callId],
  );
  const { rows: tools } = await db.query<{ name: string; result: Record<string, unknown> }>(
    "select tool_name as name, output as result from public.tool_call where call_id = $1 order by created_at",
    [callId],
  );
  const facts: Partial<Record<FactField, string>> = {};
  if (call.lead_id) {
    const { rows } = await db.query<{ field: FactField; value: string }>(
      "select field, value from public.lead_fact_current where lead_id = $1",
      [call.lead_id],
    );
    for (const r of rows) facts[r.field] = r.value;
  }
  const { rows: transfers } = await db.query<{ n: number | string }>(
    "select count(*) as n from public.event where aggregate_id = $1 and type = 'transfer.transferred'",
    [callId],
  );
  return {
    callId: call.id,
    callSid: call.sid,
    from: call.from_e164,
    tenantId: call.tenant_id,
    businessId: call.business_id,
    leadId: call.lead_id,
    state: call.state,
    sessions,
    toolCalls: tools,
    facts,
    transferred: Number(transfers[0]?.n ?? 0) > 0,
  };
}

/** Vendor transcript turns (ElevenLabs shape: role agent|user, message) → scanner turns. */
export function transcriptTurns(transcript: unknown): Turn[] {
  if (!Array.isArray(transcript)) return [];
  return transcript.flatMap((t): Turn[] => {
    if (!t || typeof t !== "object") return [];
    const { role, message } = t as { role?: unknown; message?: unknown };
    if (typeof message !== "string" || !message.trim()) return [];
    return [{ role: role === "agent" ? "agent" : "caller", text: message }];
  });
}

export type PostCallOutcome =
  | { status: "done"; intent: IntentResult["intent"]; violations: number; transcript: boolean }
  | { status: "retry"; inSeconds: number; why: string };

/** A session that never connected will never get a transcript; don't wait for it. */
function awaitingTranscript(bundle: CallBundle): boolean {
  return bundle.sessions.some((s) => s.postCallAt === null && s.endReason !== "connect_failed");
}

/**
 * The vendor's post-call webhook is late or lost: fetch this call's finished
 * conversations from its API and store them exactly as the webhook would.
 * Returns how many were ingested.
 */
async function reconcileFromVendor(db: Queryable, bundle: CallBundle, vendor: VendorAccess): Promise<number> {
  const pending = bundle.sessions.filter(
    (s) => s.provider === "elevenlabs" && s.postCallAt === null && s.endReason !== "connect_failed" && s.agentId,
  );
  let ingested = 0;
  for (const agentId of new Set(pending.map((s) => s.agentId!))) {
    const startedAfterUnix = Math.min(
      ...pending.filter((s) => s.agentId === agentId).map((s) => Math.floor(new Date(s.startedAt).getTime() / 1000)),
    );
    const conversations = await findConversationsForCall({
      apiKey: vendor.apiKey,
      ...(vendor.baseUrl ? { baseUrl: vendor.baseUrl } : {}),
      ...(vendor.fetchImpl ? { fetchImpl: vendor.fetchImpl } : {}),
      agentId,
      callSid: bundle.callSid,
      startedAfterUnix,
    });
    for (const conversation of conversations) {
      const result = await ingestPostCall(db, { type: "post_call_transcription", data: conversation });
      if (result.status === 200 && result.body.ignored === undefined) ingested += 1;
    }
  }
  return ingested;
}

export async function processPostCall(
  db: Queryable,
  job: Pick<ClaimedJob, "subjectId" | "attempts">,
  vendor?: VendorAccess,
): Promise<PostCallOutcome> {
  let bundle = await loadBundle(db, job.subjectId);
  if (!bundle || !bundle.leadId) return { status: "done", intent: "unknown", violations: 0, transcript: false };

  let awaiting = awaitingTranscript(bundle);
  if (awaiting && vendor && job.attempts >= RECONCILE_FROM_ATTEMPT) {
    if ((await reconcileFromVendor(db, bundle, vendor)) > 0) {
      bundle = (await loadBundle(db, job.subjectId))!;
      awaiting = awaitingTranscript(bundle);
    }
  }
  if (!bundle.leadId) return { status: "done", intent: "unknown", violations: 0, transcript: false };
  if (awaiting && job.attempts < TRANSCRIPT_WAIT_ATTEMPTS) {
    return { status: "retry", inSeconds: 60, why: "waiting for post-call transcript" };
  }
  if (awaiting) {
    await raiseIncident(db, {
      tenantId: bundle.tenantId,
      businessId: bundle.businessId,
      callId: bundle.callId,
      leadId: bundle.leadId,
      kind: "post_call_transcript_missing",
      severity: "warning",
      detail: { sessions: bundle.sessions.length },
      dedupeKey: `post_call_transcript_missing:${bundle.callId}`,
    });
  }

  // 1. Compliance over every conversation on this call (a hand-off can create two).
  const turns = bundle.sessions.flatMap((s) => transcriptTurns(s.transcript));
  // Site claims Amy has not approved, for any of the tenant's companies, are
  // policy violations too (the verified business brain).
  const scanOptions = await tenantScanOptions(db, bundle.tenantId, bundle.businessId);
  const scanned: ComplianceReport = scanConversation(turns, bundle.toolCalls, scanOptions);
  // Declined-recording conversations kept no transcript; their scan was done
  // at ingest and stored as codes and flags only.
  const kept = bundle.sessions.flatMap((s) => (s.metadata?.compliance ? [s.metadata.compliance] : []));
  const report: ComplianceReport = {
    violations: [
      ...scanned.violations,
      ...kept.flatMap((k) => k.violations.map((code) => ({ code, turnIndex: -1, quote: "(not kept: caller declined recording)" }))),
    ],
    signals: scanned.signals,
    summary: kept.reduce(
      (acc, k) => ({
        priceAsked: acc.priceAsked || k.summary.priceAsked,
        priceStated: acc.priceStated || k.summary.priceStated,
        dateRequested: acc.dateRequested || k.summary.dateRequested,
        availabilityPromised: acc.availabilityPromised || k.summary.availabilityPromised,
        humanRequested: acc.humanRequested || k.summary.humanRequested,
      }),
      scanned.summary,
    ),
  };
  const heard = turns.length > 0 || kept.length > 0;

  // 2. Facts from the vendor's post-call extraction; never overrides what the caller confirmed live.
  for (const session of bundle.sessions) {
    for (const field of FACT_FIELDS) {
      const raw = session.dataCollection?.[field]?.value;
      if (typeof raw !== "string" || !raw.trim() || /^(none|null|unknown|n\/a)$/i.test(raw.trim())) continue;
      const allowed = ENUM_FACTS[field];
      const value = allowed ? raw.trim().toLowerCase() : raw.trim();
      if (allowed && !allowed.includes(value)) continue;
      await recordLeadFact(db, {
        leadId: bundle.leadId,
        callId: bundle.callId,
        field,
        value,
        source: "post_call_extraction",
        confidence: 0.7,
        evidence: null,
      });
      bundle.facts[field] ??= value;
    }
  }

  // 3. Intent and summary.
  const lastWrap = [...bundle.sessions].reverse().find((s) => s.metadata?.wrapped_up);
  const intent = classifyIntent({
    facts: bundle.facts,
    compliance: heard ? report.summary : null,
    wrapUpOutcome: lastWrap?.metadata.outcome ?? null,
    transferred: bundle.transferred,
  });
  const summary =
    [...bundle.sessions].reverse().map((s) => s.summary ?? s.metadata?.agent_summary ?? null).find(Boolean) ?? null;
  const violations = report.violations.length;
  await db.query("select app.apply_post_call($1, $2, $3, $4, $5::jsonb, $6)", [
    bundle.leadId,
    bundle.callId,
    intent.intent,
    summary,
    JSON.stringify({ ...report, intentReasons: intent.reasons, captured: intent.captured, missing: intent.missing, transcript: turns.length > 0, recordingDeclined: kept.length > 0 }),
    violations > 0,
  ]);
  if (violations > 0) {
    await raiseIncident(db, {
      tenantId: bundle.tenantId,
      businessId: bundle.businessId,
      callId: bundle.callId,
      leadId: bundle.leadId,
      kind: "agent_policy_violation",
      severity: "critical",
      detail: { codes: [...new Set(report.violations.map((v) => v.code))] },
      dedupeKey: `agent_policy_violation:${bundle.callId}`,
    });
  }

  // 4. A real prospect who did not reach Amy always leaves with a callback task.
  // Callers who only wanted an answer, or declined to go further, are kept
  // as leads but not queued; an agent that never wrapped up (a drop) always queues.
  // A threatening caller isn't queued either: Amy already got the urgent text and decides.
  const noCallback = ["info_only", "caller_declined", "abusive"].includes(lastWrap?.metadata.outcome ?? "");
  let taskId: string | null = null;
  if (intent.intent !== "not_a_lead" && !bundle.transferred && !noCallback) {
    taskId = await requestCallback(db, {
      leadId: bundle.leadId,
      callId: bundle.callId,
      window: bundle.facts.callback_window ?? null,
      reason: "Recovered by the assistant",
      priority: intent.intent === "hot" ? "high" : "normal",
    });
  }

  // 5. Amy's alert (once per call), and a reminder if a hot lead waits too long.
  // When in doubt, text. The assistant's "spam" is a judgment, not proof, so a
  // call is held for the daily summary only when it looked like spam or the
  // caller hung up early AND nothing a customer would say or ask was heard.
  // Everything else texts Amy right away (her line is full of robocalls; Amy, 2026-10-22).
  const customerSignal =
    CUSTOMER_FACTS.some((f) => Boolean(bundle.facts[f]?.trim())) ||
    report.summary.priceAsked ||
    report.summary.dateRequested ||
    report.summary.humanRequested ||
    bundle.transferred;
  // Amy's settings (Settings → Alerts, Spam): she can turn holding off, and change when a number gets flagged.
  const settings = (await loadActiveConfig(db, bundle.businessId))?.config;
  const alerts = settings?.alerts ?? DEFAULT_ALERTS;
  const screening = settings?.screening ?? DEFAULT_SCREENING;
  const holdForDigest =
    alerts.holdLikelySpam && violations === 0 && (intent.intent === "not_a_lead" || intent.intent === "unknown") && !customerSignal;
  if (holdForDigest) {
    await db.query("select app.emit($1, $2, 'lead', $3, 'alert.held', $4::jsonb, 'system', null)", [
      bundle.tenantId,
      bundle.businessId,
      bundle.leadId,
      JSON.stringify({ call_id: bundle.callId, intent: intent.intent }),
    ]);
  } else {
    await db.query("select app.enqueue_alerts($1, $2, $3, $4, 'agent_lead')", [
      bundle.tenantId,
      bundle.businessId,
      bundle.leadId,
      bundle.callId,
    ]);
  }

  // A number the assistant called spam twice (by default) must press 1 or say
  // yes for 30 days. Not rejected: a misjudged customer can still get through.
  if (screening.autoFlagAfter > 0 && lastWrap?.metadata.outcome === "spam" && bundle.from) {
    const { rows: flagged } = await db.query<{ n: number | string }>(
      `select count(distinct s.call_id) as n
         from public.agent_session s join public.call c on c.id = s.call_id
        where c.tenant_id = $1 and c.from_e164 = $2 and s.metadata->>'outcome' = 'spam'
          and s.started_at > now() - interval '90 days'`,
      [bundle.tenantId, bundle.from],
    );
    if (Number(flagged[0]?.n ?? 0) >= screening.autoFlagAfter) {
      await blockNumber(db, {
        tenantId: bundle.tenantId,
        e164: bundle.from,
        kind: "auto",
        reason: `assistant flagged spam ${screening.autoFlagAfter}+ times`,
        days: screening.autoFlagDays,
        by: "assistant",
      });
    }
  }
  if (taskId && intent.intent === "hot") {
    await enqueueJob(db, {
      tenantId: bundle.tenantId,
      businessId: bundle.businessId,
      kind: "callback_escalation",
      subjectId: taskId,
      dedupeKey: `callback_escalation:${taskId}`,
      runAfterSeconds: HOT_LEAD_ESCALATION_SECONDS,
    });
  }
  return { status: "done", intent: intent.intent, violations, transcript: turns.length > 0 };
}

/** A hot lead's callback is still open after the grace period: remind Amy once. */
async function processEscalation(db: Queryable, taskId: string): Promise<void> {
  const { rows } = await db.query<{ tenant_id: string; business_id: string; lead_id: string; call_id: string | null; status: string }>(
    "select tenant_id, business_id, lead_id, call_id, status from public.task where id = $1",
    [taskId],
  );
  const task = rows[0];
  if (!task || task.status !== "open") return;
  await db.query("select app.enqueue_alerts($1, $2, $3, $4, 'callback')", [
    task.tenant_id,
    task.business_id,
    task.lead_id,
    task.call_id,
  ]);
}

/**
 * Caller declined recording: delete the vendor's copy of the conversation.
 * Without an API key (or for simulated sessions) the purge cannot be done
 * here, so it becomes an incident someone must close by hand.
 */
async function processVendorPurge(db: Queryable, job: ClaimedJob, apiKey: string | undefined, baseUrl?: string): Promise<void> {
  const { rows } = await db.query<{ conversation_id: string | null; provider: string; call_id: string; lead_id: string | null }>(
    "select conversation_id, provider, call_id, lead_id from public.agent_session where id = $1",
    [job.subjectId],
  );
  const session = rows[0];
  if (!session?.conversation_id || session.provider === "simulator") return;
  if (!apiKey) {
    await raiseIncident(db, {
      tenantId: job.tenantId,
      businessId: job.businessId,
      callId: session.call_id,
      leadId: session.lead_id,
      kind: "manual_vendor_purge_required",
      severity: "warning",
      detail: { conversation_id: session.conversation_id },
      dedupeKey: `manual_vendor_purge_required:${job.subjectId}`,
    });
    return;
  }
  await deleteConversation({ apiKey, conversationId: session.conversation_id, ...(baseUrl ? { baseUrl } : {}) });
  await db.query("select app.emit($1, $2, 'call', $3, 'consent.vendor_copy_deleted', $4::jsonb, 'system', null)", [
    job.tenantId,
    job.businessId,
    session.call_id,
    JSON.stringify({ conversation_id: session.conversation_id }),
  ]);
}

/** Runs due jobs until none are left (bounded). Safe to call from any request or a cron. */
export async function runDueJobs(
  db: Queryable,
  opts: { env?: { elevenLabsApiKey?: string | undefined; elevenLabsApiBase?: string | undefined } } = {},
  limit = 25,
): Promise<{ done: number; retried: number; failed: number }> {
  let done = 0;
  let retried = 0;
  let failed = 0;
  const apiKey = opts.env?.elevenLabsApiKey;
  const baseUrl = opts.env?.elevenLabsApiBase;
  const vendor: VendorAccess | undefined = apiKey ? { apiKey, ...(baseUrl ? { baseUrl } : {}) } : undefined;
  await ensureDigestJobs(db);
  const jobs = await claimJobs(db, limit);
  for (const job of jobs) {
    try {
      if (job.kind === "post_call") {
        const outcome = await processPostCall(db, job, vendor);
        if (outcome.status === "retry") {
          await settleJob(db, { id: job.id, status: "pending", error: outcome.why, retryInSeconds: outcome.inSeconds });
          retried += 1;
          continue;
        }
        await settleJob(db, { id: job.id, status: "done", result: outcome });
      } else if (job.kind === "daily_digest") {
        const held = await processDigest(db, job);
        await settleJob(db, { id: job.id, status: "done", result: { held } });
      } else if (job.kind === "vendor_purge") {
        await processVendorPurge(db, job, apiKey, baseUrl);
        await settleJob(db, { id: job.id, status: "done" });
      } else {
        await processEscalation(db, job.subjectId);
        await settleJob(db, { id: job.id, status: "done" });
      }
      done += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      await settleJob(db, { id: job.id, status: job.attempts >= 6 ? "failed" : "pending", error: message.slice(0, 500), retryInSeconds: 60 });
      failed += 1;
    }
  }
  return { done, retried, failed };
}
