import { localMinutes, parseClock } from "@/lib/telephony/hours";
import type { BusinessConfig, ClosedDay } from "./config";

/**
 * Where a live call goes next. Pure functions of configuration, clock and
 * capacity, so every routing rule is unit-tested without a phone.
 *
 * The safety property: every branch ends at a human, the agent, or the
 * deterministic capture path. Capture needs no AI vendor and no database
 * write on the caller's path, so it is the floor every failure falls to.
 */
export type InboundRoute =
  | { kind: "ring_owner" }
  | { kind: "agent"; reason: "after_hours" | "ai_first" | "owner_unavailable" | "owner_busy" }
  | { kind: "capture"; reason: CaptureReason };

export type AfterOwnerRoute =
  | { kind: "agent"; reason: "owner_unavailable" }
  | { kind: "capture"; reason: CaptureReason };

export type CaptureReason =
  | "ai_off" // kill switch or mode does not allow AI here
  | "ai_not_configured" // no agent id
  | "ai_at_capacity" // our admission limit reached
  | "ai_unavailable"; // vendor health check failed / circuit open

export interface Capacity {
  /** Agent sessions currently active for this business (our own count). */
  activeSessions: number;
  /** False while the vendor circuit breaker is open. */
  vendorHealthy: boolean;
}

/** The local calendar date (YYYY-MM-DD) of `now` in a time zone. */
export function localDate(now: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** The closure covering today, if the office is closed all day. */
export function closureOn(config: Pick<BusinessConfig, "closures" | "timezone">, now: Date): ClosedDay | null {
  const today = localDate(now, config.timezone);
  return (config.closures ?? []).find((c) => c.date === today) ?? null;
}

/** True when `now` falls in one of the configured weekly ring windows and the office isn't closed today. */
export function isRingHours(config: Pick<BusinessConfig, "ringHours" | "timezone" | "closures">, now: Date): boolean {
  if (closureOn(config, now)) return false;
  const day = localDay(now, config.timezone);
  const minute = localMinutes(now, config.timezone);
  return config.ringHours.some((w) => {
    if (w.day !== day) return false;
    const open = parseClock(w.open);
    const close = parseClock(w.close) || 24 * 60; // closing at 00:00 means midnight, end of the day
    if (open === close) return true; // a window that opens and closes at the same minute rings all day
    return open < close ? minute >= open && minute < close : false;
  });
}

function localDay(now: Date, timezone: string): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(now);
  const index = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
  if (index < 0) throw new Error(`Could not resolve weekday in ${timezone}`);
  return index;
}

function agentAdmission(config: BusinessConfig, capacity: Capacity): CaptureReason | null {
  if (config.ai.mode === "off") return "ai_off";
  if (!config.ai.agentId) return "ai_not_configured";
  if (!capacity.vendorHealthy) return "ai_unavailable";
  if (capacity.activeSessions >= config.ai.maxConcurrentSessions) return "ai_at_capacity";
  return null;
}

/** First decision when a call arrives. */
export function routeInbound(config: BusinessConfig, now: Date, capacity: Capacity): InboundRoute {
  const inHours = isRingHours(config, now);
  const mode = config.ai.mode;
  switch (mode) {
    case "off":
      return inHours ? { kind: "ring_owner" } : { kind: "capture", reason: "ai_off" };
    case "after_hours_only":
    case "overflow": {
      if (inHours) return { kind: "ring_owner" };
      const blocked = agentAdmission(config, capacity);
      return blocked ? { kind: "capture", reason: blocked } : { kind: "agent", reason: "after_hours" };
    }
    case "always": {
      const blocked = agentAdmission(config, capacity);
      if (!blocked) return { kind: "agent", reason: "ai_first" };
      return inHours ? { kind: "ring_owner" } : { kind: "capture", reason: blocked };
    }
    default:
      return assertNever(mode);
  }
}

/**
 * First decision on a line whose carrier already rang Amy and forwarded the
 * call because she didn't answer (e.g. Bestline forward-on-no-answer). We
 * never ring her a second time: in her hours this is the same decision as
 * after our own ring; outside them it is the normal after-hours decision.
 */
export function routeCarrierMissed(config: BusinessConfig, now: Date, capacity: Capacity): InboundRoute {
  if (!isRingHours(config, now)) {
    const route = routeInbound(config, now, capacity);
    // Out of hours routeInbound never rings Amy, but keep the guarantee explicit.
    return route.kind === "ring_owner" ? { kind: "capture", reason: "ai_off" } : route;
  }
  const after = routeAfterOwner(config, capacity);
  return after.kind === "agent" ? { kind: "agent", reason: "owner_unavailable" } : after;
}

/** Decision after Amy's phone rang and she did not bridge (DialBridged was not true). */
export function routeAfterOwner(config: BusinessConfig, capacity: Capacity): AfterOwnerRoute {
  const mode = config.ai.mode;
  switch (mode) {
    case "off":
    case "after_hours_only":
      return { kind: "capture", reason: "ai_off" };
    case "overflow":
    case "always": {
      const blocked = agentAdmission(config, capacity);
      return blocked ? { kind: "capture", reason: blocked } : { kind: "agent", reason: "owner_unavailable" };
    }
    default:
      return assertNever(mode);
  }
}

/**
 * Amy is already on one of our calls. If the assistant may take the calls she
 * misses, it takes this one at once instead of ringing a busy phone; otherwise
 * her phone still rings (call waiting), exactly as it would have.
 */
export function routeOwnerBusy(config: BusinessConfig, capacity: Capacity): InboundRoute {
  return routeAfterOwner(config, capacity).kind === "agent" ? { kind: "agent", reason: "owner_busy" } : { kind: "ring_owner" };
}

/** Whether the agent may offer a live transfer right now. */
export function transferAllowed(config: BusinessConfig, now: Date, attemptsSoFar: number): boolean {
  if (!config.transfer.enabled) return false;
  if (attemptsSoFar >= config.transfer.maxAttempts) return false;
  if (config.transfer.onlyDuringRingHours && !isRingHours(config, now)) return false;
  return true;
}

export function assertNever(value: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(value)}`);
}
