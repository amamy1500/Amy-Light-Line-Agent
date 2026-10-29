import type { AgentConnector } from "@/lib/agents/connector";
import type { VendorCircuit } from "@/lib/agents/circuit";
import { companyNotes, openingLine, sharedLineNotes } from "@/lib/agents/policy";
import { callbackName, DEFAULT_SCREENING, type BusinessConfig } from "@/lib/business-rules/config";
import {
  closureOn,
  localDate,
  routeAfterOwner,
  routeCarrierMissed,
  routeInbound,
  routeOwnerBusy,
  type InboundRoute,
} from "@/lib/business-rules/routing";
import {
  activeAgentSessions,
  attachTranscript,
  captureRecording,
  endAgentSession,
  finalizeCall,
  findLineByCallSid,
  findLineByNumber,
  getCallContext,
  handoffNote,
  ingestInboundCall,
  lineCompanies,
  markOwnerAccepted,
  ownerOnCall,
  raiseIncident,
  resolveDial,
  resolveTransfer,
  returningCallerSummary,
  sessionWrappedUp,
  startAgentSession,
  type CallContext,
  type Channel,
  type LineRow,
  type Queryable,
} from "@/lib/db";
import { loadActiveConfig } from "@/lib/db/config";
import { buildDynamicVariables, type Entry } from "@/lib/elevenlabs/dynamic-variables";
import { extractLeadFields, toStoredFields } from "@/lib/extraction";
import {
  acceptsCall,
  agentDroppedTwiml,
  decideAfterDial,
  genericRecoveryTwiml,
  handoffDialTwiml,
  handoffMissedTwiml,
  handoffScreenTwiml,
  hangupTwiml,
  normalizeUsPhone,
  recordDoneTwiml,
  recoveryTwiml,
  rejectTwiml,
  ringOwnerTwiml,
  screenAcceptTwiml,
  screenCallerTwiml,
  screenTwiml,
  unknownLineTwiml,
  voiceUrls,
  type LineConfig,
} from "@/lib/telephony";
import { findBlock, recordBlockHit, recordCallerCheck } from "@/lib/db/screening";
import { gateReason, passedGate } from "@/lib/telephony/screening";
import type { TwilioParams } from "./twilio-request";

export interface VoiceDeps {
  db: Queryable;
  now: () => Date;
  baseUrl: string;
  /** Puts a caller on the voice agent. Absent → the AI is unavailable and capture takes every call. */
  agent?: AgentConnector;
  circuit?: VendorCircuit;
  log?: (message: string, detail?: unknown) => void;
}

const SOURCE_LABEL: Record<Channel, string> = {
  tv: "TV",
  web: "the website",
  print: "print",
  postcard: "a postcard",
  referral: "a referral",
  other: "another source",
  main_line: "the main line",
};

export function sourceLabel(channel: Channel | null | undefined): string {
  return channel ? SOURCE_LABEL[channel] : "a call";
}

function toLineConfig(line: LineRow): LineConfig {
  return {
    brandName: line.brandName,
    ownerName: line.ownerName,
    ownerPhone: line.ownerRingE164,
    sourceLabel: line.channel === "main_line" ? "" : SOURCE_LABEL[line.channel],
    ringTimeoutSeconds: line.ringTimeoutS,
    recoveryAsk: line.recoveryAsk,
    lineNumber: line.e164,
  };
}

const TERMINAL_CALL_STATUSES = new Set(["completed", "busy", "no-answer", "failed", "canceled"]);

async function configFor(line: LineRow, deps: VoiceDeps): Promise<BusinessConfig | null> {
  try {
    return (await loadActiveConfig(deps.db, line.businessId, deps.log))?.config ?? null;
  } catch (error) {
    deps.log?.("config load failed; AI disabled for this call", error);
    return null;
  }
}

/** Amy's hours, and any day the office is closed today or in the next three weeks (Settings → Hours). */
function ringHoursNote(config: BusinessConfig, now: Date): string {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const owner = config.brand.ownerFirstName;
  const open = config.ringHours.map((w) => `${days[w.day]} ${w.open}-${w.close}`).join(", ");
  const hours = open ? `${owner} usually takes calls ${open} (${config.timezone}).` : "No set hours.";
  const today = closureOn(config, now);
  const until = localDate(new Date(now.getTime() + 21 * 24 * 3600 * 1000), config.timezone);
  const soon = config.closures
    .filter((c) => c.date > localDate(now, config.timezone) && c.date <= until)
    .map((c) => `${spokenDate(c.date)} (${c.label})`);
  return [
    hours,
    today ? `The office is closed today (${today.label}): ${owner} calls back on the next open day.` : "",
    soon.length ? `Also closed: ${soon.join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** "Thursday, November 26, 2026 at 2:15 PM (America/Chicago)": the agent knows the date only if told. */
function localNow(now: Date, timezone: string): string {
  const when = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(now);
  return `${when} (${timezone})`;
}

/** "Thursday, November 26" for a YYYY-MM-DD date. */
function spokenDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" }).format(new Date(`${date}T12:00:00Z`));
}

/**
 * Which company the agent is speaking for. A company line (or a shared-line
 * call already assigned) gets that company's notes; a shared line that
 * doesn't know yet gets the list of companies and the rule to ask.
 */
async function companyVariables(
  ctx: CallContext,
  line: LineRow,
  lineConfig: BusinessConfig,
  deps: VoiceDeps,
): Promise<{ companyName: string | null; companyContext: string; sharedLine: string[] }> {
  if (ctx.businessKind === "company") {
    const current =
      ctx.businessId === line.businessId ? lineConfig : ((await loadActiveConfig(deps.db, ctx.businessId, deps.log))?.config ?? lineConfig);
    return { companyName: current.brand.spokenName, companyContext: companyNotes(current), sharedLine: [] };
  }
  const names: string[] = [];
  for (const company of await lineCompanies(deps.db, ctx.callId)) {
    names.push((await loadActiveConfig(deps.db, company.businessId, deps.log))?.config.brand.spokenName ?? company.name);
  }
  return { companyName: null, companyContext: sharedLineNotes(names), sharedLine: names };
}

/**
 * Hands a live call to the agent. Every failure — no agent configured, no
 * capacity, vendor error or timeout — returns capture TwiML instead, so the
 * caller always hears a person, the agent, or a way to leave details.
 */
async function connectAgent(
  p: { callSid: string; from: string | null; to: string },
  line: LineRow,
  config: BusinessConfig,
  entry: Entry,
  deps: VoiceDeps,
  capture: () => string,
): Promise<string> {
  const urls = voiceUrls(deps.baseUrl);
  if (!deps.agent || !config.ai.agentId) return capture();
  if (deps.circuit && !deps.circuit.healthy()) return capture();

  const session = await startAgentSession(deps.db, {
    callSid: p.callSid,
    provider: deps.agent.provider,
    agentId: config.ai.agentId,
    agentVersion: config.configVersion,
    routeReason: entry,
    maxSessions: config.ai.maxConcurrentSessions,
  });
  if (!session) return capture(); // at capacity: refused inside the same transaction that counts

  try {
    const ctx = await getCallContext(deps.db, p.callSid);
    // The stored caller number, not Twilio's From: a forward that replaced the
    // caller ID was stored as unknown, and must not pull up another caller's history.
    const caller = ctx?.from ?? null;
    const returning = ctx && caller
      ? await returningCallerSummary(deps.db, { businessId: line.businessId, phone: caller, excludeCallId: ctx.callId })
      : null;
    const note = entry === "handoff_failed" ? await handoffNote(deps.db, p.callSid) : null;
    const company = ctx
      ? await companyVariables(ctx, line, config, deps)
      : { companyName: config.brand.spokenName, companyContext: companyNotes(config), sharedLine: [] };
    const twiml = await deps.agent.connect({
      agentId: config.ai.agentId,
      from: p.from ?? "",
      to: p.to,
      actionUrl: urls.agentEnded,
      dynamicVariables: buildDynamicVariables({
        callSid: p.callSid,
        sessionId: session,
        callerNumber: caller,
        entry,
        returningContext: returning,
        handoffNote: note,
        ringHoursNote: ringHoursNote(config, deps.now()),
        opening: openingLine(config, entry, company.sharedLine),
        companyName: company.companyName,
        companyContext: company.companyContext,
        ownerName: config.brand.ownerFirstName,
        callbackName: callbackName(config),
        assistantRole: config.brand.assistantRole,
        today: localNow(deps.now(), config.timezone),
      }),
    });
    deps.circuit?.recordSuccess();
    return twiml;
  } catch (error) {
    deps.circuit?.recordFailure();
    deps.log?.("agent connect failed; capturing caller", error instanceof Error ? error.message : error);
    await endAgentSession(deps.db, { callSid: p.callSid, reason: "connect_failed", failed: true });
    const ctx = await getCallContext(deps.db, p.callSid);
    if (ctx) {
      await raiseIncident(deps.db, {
        tenantId: ctx.tenantId,
        businessId: ctx.businessId,
        callId: ctx.callId,
        leadId: ctx.leadId,
        kind: "agent_connect_failed",
        severity: "warning",
        detail: { entry, error: error instanceof Error ? error.name : "unknown" },
        dedupeKey: `agent_connect_failed:${ctx.callId}:${entry}`,
      });
    }
    return capture();
  }
}

async function capacity(line: LineRow, deps: VoiceDeps) {
  return {
    activeSessions: await activeAgentSessions(deps.db, line.businessId),
    vendorHealthy: deps.circuit?.healthy() ?? true,
  };
}


/**
 * The caller's number, or null when a forward replaced it with one of our own
 * numbers: every forwarded caller would then share one phone number, merge
 * into one lead and hear each other's history.
 */
async function callerNumberFor(p: TwilioParams, deps: VoiceDeps): Promise<string | null> {
  const from = p.From?.trim() || null;
  if (!from) return null;
  const normalized = normalizeUsPhone(from);
  if (normalized && normalized === normalizeUsPhone(p.ForwardedFrom)) return null;
  if (await findLineByNumber(deps.db, normalized ?? from)) return null;
  return from;
}

/**
 * Inbound call. Errors propagate on purpose: a 5xx makes Twilio use the
 * number's fallback URL (static TwiML hosted by Twilio), which still records
 * a message without this server.
 */
/**
 * Inbound call. `screened` is set when the call comes back from the spam
 * gate: "passed" continues as normal, "no_response" takes a message.
 */
export async function handleInbound(
  p: TwilioParams,
  deps: VoiceDeps,
  screened: "passed" | "no_response" | null = null,
): Promise<string> {
  // The Twilio number decides the line (and so the company). ForwardedFrom is
  // carrier-dependent and can't tell forward-on-no-answer from forward-all
  // (docs/research/telephony-receive-options.md), so it never routes.
  const line = await findLineByNumber(deps.db, p.To ?? "");
  if (!line) return unknownLineTwiml();
  const urls = voiceUrls(deps.baseUrl);
  const lineConfig = toLineConfig(line);

  // Spam screen, before anything is stored or anyone is rung. A number Amy
  // blocked is refused ($0); a hidden or unverified caller, or one the
  // assistant flagged as spam twice, must press 1 or say yes first.
  const config = await configFor(line, deps);
  if (screened === null && !(await getCallContext(deps.db, p.CallSid ?? ""))) {
    const block = await findBlock(deps.db, line.tenantId, normalizeUsPhone(p.From) ?? p.From ?? null);
    if (block) await recordBlockHit(deps.db, block.id);
    if (block?.kind === "manual") return rejectTwiml();
    const rules = config?.screening ?? DEFAULT_SCREENING;
    if (gateReason({ from: p.From, stirVerstat: p.StirVerstat, autoBlocked: block?.kind === "auto", rules })) {
      return screenCallerTwiml(line.brandName, urls);
    }
  }

  // No valid configuration: ring Amy (unless her carrier already did), capture otherwise. Never AI on a guess.
  let route: InboundRoute =
    screened === "no_response"
      ? { kind: "capture", reason: "ai_off" }
      : config
        ? line.ringOwner
          ? routeInbound(config, deps.now(), await capacity(line, deps))
          : routeCarrierMissed(config, deps.now(), await capacity(line, deps))
        : line.ringOwner
          ? { kind: "ring_owner" }
          : { kind: "capture", reason: "ai_not_configured" };
  // Amy is already talking to one of our callers: this one goes to the assistant
  // now rather than to her call waiting, where it would ring out unanswered.
  if (route.kind === "ring_owner" && config && (await ownerOnCall(deps.db, line.ownerRingE164))) {
    route = routeOwnerBusy(config, await capacity(line, deps));
  }
  const call = await ingestInboundCall(deps.db, {
    callSid: p.CallSid ?? "",
    from: await callerNumberFor(p, deps),
    to: line.e164,
    afterHours: route.kind !== "ring_owner",
  });
  // Two weeks of these decide whether screening needs tightening (spam-screening.md §4).
  await recordCallerCheck(deps.db, { callSid: p.CallSid ?? "", stirVerstat: p.StirVerstat ?? null, screened });

  // A replayed webhook keeps the first delivery's choice between ringing Amy
  // and not ringing her, even if the clock or capacity changed since.
  const effective: InboundRoute =
    !call.afterHours ? { kind: "ring_owner" } : route.kind === "ring_owner" ? { kind: "capture", reason: "ai_off" } : route;

  switch (effective.kind) {
    case "ring_owner":
      return ringOwnerTwiml(lineConfig, urls);
    case "capture":
      return recoveryTwiml(lineConfig, urls, { afterHours: true });
    case "agent": {
      if (call.state !== "recovery" && call.state !== "agent_active") {
        // A replay of a call that already moved on (e.g. answered): repeat nothing risky.
        return hangupTwiml();
      }
      return connectAgent(
        { callSid: p.CallSid ?? "", from: p.From ?? null, to: p.To ?? "" },
        line,
        config!,
        effective.reason,
        deps,
        // Amy is busy, not closed: "she can't get to the phone right now".
        () => recoveryTwiml(lineConfig, urls, { afterHours: effective.reason !== "owner_busy" }),
      );
    }
  }
}

/** The gate's answer: a pressed 1 or a spoken yes continues; silence takes a message. */
export async function handleScreenCaller(p: TwilioParams, deps: VoiceDeps): Promise<string> {
  const passed = passedGate({ digits: p.Digits, speech: p.SpeechResult });
  return handleInbound(p, deps, passed ? "passed" : "no_response");
}

/** Runs on the owner's leg before bridging (first ring or hand-off). */
export async function handleScreen(p: TwilioParams, deps: VoiceDeps, query?: URLSearchParams): Promise<string> {
  const urls = voiceUrls(deps.baseUrl);
  const handoff = query?.get("stage") === "handoff";
  try {
    const line = await findLineByCallSid(deps.db, p.ParentCallSid ?? "");
    if (line && handoff) {
      // By the hand-off the caller has usually said which company; Amy hears that one.
      const ctx = await getCallContext(deps.db, p.ParentCallSid ?? "");
      const company = ctx?.businessKind === "company" ? ctx.businessName : line.brandName;
      return handoffScreenTwiml(company, await handoffNote(deps.db, p.ParentCallSid ?? ""), urls);
    }
    if (line) return screenTwiml(toLineConfig(line), urls);
  } catch (error) {
    deps.log?.("screen: line lookup failed, using generic whisper", error);
  }
  return handoff
    ? handoffScreenTwiml("Customer", null, urls)
    : screenTwiml({ brandName: "Customer", sourceLabel: "a tracked line" }, urls);
}

/** The owner's keypress (any key). Bridging never waits on the database. */
export async function handleScreenAccept(p: TwilioParams, deps: VoiceDeps): Promise<string> {
  if (acceptsCall(p.Digits)) {
    try {
      await markOwnerAccepted(deps.db, p.ParentCallSid ?? "");
    } catch (error) {
      deps.log?.("screen-accept: could not record acceptance", error);
    }
  }
  return screenAcceptTwiml(p.Digits);
}

/**
 * After the first ring. If the database is unavailable the same rule
 * (decideAfterDial) runs locally so the caller is never left in silence.
 */
export async function handleDialResult(p: TwilioParams, deps: VoiceDeps): Promise<string> {
  const urls = voiceUrls(deps.baseUrl);
  const bridged = p.DialBridged === "true";
  let decision: "owner_answered" | "recovery";
  try {
    decision = await resolveDial(deps.db, {
      callSid: p.CallSid ?? "",
      dialCallStatus: p.DialCallStatus ?? null,
      dialBridged: p.DialBridged === undefined ? null : bridged,
    });
  } catch (error) {
    deps.log?.("dial-result: database unavailable, deciding locally", error);
    return decideAfterDial(p.DialBridged) === "owner_answered" ? hangupTwiml() : genericRecoveryTwiml(urls);
  }
  if (decision === "owner_answered") return hangupTwiml();

  const line = await findLineByCallSid(deps.db, p.CallSid ?? "");
  if (!line) return genericRecoveryTwiml(urls);
  const lineConfig = toLineConfig(line);
  const capture = () => recoveryTwiml(lineConfig, urls, { afterHours: false });
  const config = await configFor(line, deps);
  if (!config) return capture();

  const route = routeAfterOwner(config, await capacity(line, deps));
  if (route.kind === "capture") return capture();
  return connectAgent(
    { callSid: p.CallSid ?? "", from: p.From ?? null, to: p.To ?? "" },
    line,
    config,
    "owner_unavailable",
    deps,
    capture,
  );
}

/**
 * The agent's stream ended (the <Connect> action). A wrapped-up agent means
 * a normal goodbye; anything else is a drop, and the caller is offered a
 * message so the call still ends with something Amy can act on.
 */
export async function handleAgentEnded(p: TwilioParams, deps: VoiceDeps): Promise<string> {
  const callSid = p.CallSid ?? "";
  const urls = voiceUrls(deps.baseUrl);
  if (p.CallStatus && TERMINAL_CALL_STATUSES.has(p.CallStatus)) {
    // The caller hung up; Twilio ignores TwiML now. The status callback finalizes.
    await endAgentSession(deps.db, { callSid, reason: "caller_hung_up", failed: false });
    return hangupTwiml();
  }

  const ctx = await getCallContext(deps.db, callSid);
  const line = await findLineByCallSid(deps.db, callSid);
  if (!ctx || !line) return genericRecoveryTwiml(urls);
  const lineConfig = toLineConfig(line);

  if (ctx.state === "transfer_ringing") {
    // The agent closed its stream before our redirect landed: ring Amy now.
    return handoffDialTwiml(lineConfig, urls);
  }
  if (ctx.state !== "agent_active") return hangupTwiml();

  const wrapped = await sessionWrappedUp(deps.db, callSid);
  await endAgentSession(deps.db, { callSid, reason: wrapped ? "agent_finished" : "stream_ended", failed: !wrapped });
  if (wrapped) return hangupTwiml();

  await raiseIncident(deps.db, {
    tenantId: ctx.tenantId,
    businessId: ctx.businessId,
    callId: ctx.callId,
    leadId: ctx.leadId,
    kind: "agent_stream_dropped",
    severity: "warning",
    detail: { call_status: p.CallStatus ?? null },
    dedupeKey: `agent_stream_dropped:${ctx.callId}:${ctx.sessionId ?? "none"}`,
  });
  const config = await configFor(line, deps);
  return agentDroppedTwiml(lineConfig, urls, { record: (config?.ai.recording ?? "disclosed") === "disclosed" });
}

/** Target of the live-call redirect after the agent's transfer_to_amy tool. */
export async function handleHandoff(p: TwilioParams, deps: VoiceDeps): Promise<string> {
  const urls = voiceUrls(deps.baseUrl);
  const ctx = await getCallContext(deps.db, p.CallSid ?? "");
  const line = await findLineByCallSid(deps.db, p.CallSid ?? "");
  if (!ctx || !line) return genericRecoveryTwiml(urls);
  if (ctx.state === "transferred") return hangupTwiml();
  await deps.db.query("select app.emit($1, $2, 'call', $3, 'transfer.dial_started', '{}'::jsonb, 'webhook', $4)", [
    ctx.tenantId,
    ctx.businessId,
    ctx.callId,
    ctx.callSid,
  ]);
  return handoffDialTwiml(toLineConfig(line), urls);
}

/** Amy's answer to the hand-off ring. Missed → back to the agent with context, or capture. */
export async function handleHandoffResult(p: TwilioParams, deps: VoiceDeps): Promise<string> {
  const urls = voiceUrls(deps.baseUrl);
  const callSid = p.CallSid ?? "";
  const result = await resolveTransfer(deps.db, {
    callSid,
    dialCallStatus: p.DialCallStatus ?? null,
    dialBridged: p.DialBridged === undefined ? null : p.DialBridged === "true",
  });
  if (result === "transferred") return hangupTwiml();

  const line = await findLineByCallSid(deps.db, callSid);
  if (!line) return genericRecoveryTwiml(urls);
  const lineConfig = toLineConfig(line);
  const config = await configFor(line, deps);
  const record = (config?.ai.recording ?? "disclosed") === "disclosed";
  const capture = () => handoffMissedTwiml(lineConfig, urls, { record });
  if (!config) return capture();
  const route = routeAfterOwner(config, await capacity(line, deps));
  if (route.kind === "capture") return capture();
  return connectAgent(
    { callSid, from: p.From ?? null, to: p.To ?? "" },
    line,
    config,
    "handoff_failed",
    deps,
    capture,
  );
}

export async function handleRecordDone(p: TwilioParams, deps: VoiceDeps): Promise<string> {
  try {
    const line = await findLineByCallSid(deps.db, p.CallSid ?? "");
    return recordDoneTwiml(line ? toLineConfig(line) : null);
  } catch {
    return recordDoneTwiml(null);
  }
}

/** recordingStatusCallback: the message exists (or was empty). */
export async function handleRecording(p: TwilioParams, deps: VoiceDeps): Promise<void> {
  if (p.RecordingStatus && p.RecordingStatus !== "completed") return;
  const duration = p.RecordingDuration === undefined ? null : Number.parseInt(p.RecordingDuration, 10);
  await captureRecording(deps.db, {
    callSid: p.CallSid ?? "",
    recordingSid: p.RecordingSid ?? "",
    recordingUrl: p.RecordingUrl ?? null,
    durationSeconds: Number.isFinite(duration) ? duration : null,
  });
}

/** transcribeCallback: store the text and fill only fields the caller actually said. */
export async function handleTranscript(p: TwilioParams, deps: VoiceDeps): Promise<void> {
  const completed = p.TranscriptionStatus === "completed";
  const text = completed ? (p.TranscriptionText ?? null) : null;
  await attachTranscript(deps.db, {
    callSid: p.CallSid ?? "",
    text,
    status: p.TranscriptionStatus ?? null,
    fields: completed ? toStoredFields(extractLeadFields(text)) : {},
  });
}

/** Call status callback (configured on the number): the call is over. */
export async function handleStatus(p: TwilioParams, deps: VoiceDeps): Promise<void> {
  if (!p.CallStatus || !TERMINAL_CALL_STATUSES.has(p.CallStatus)) return;
  await finalizeCall(deps.db, { callSid: p.CallSid ?? "", callStatus: p.CallStatus });
}

