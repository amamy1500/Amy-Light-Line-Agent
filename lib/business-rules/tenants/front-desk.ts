import { DEFAULT_ALERTS, DEFAULT_SAFETY, DEFAULT_SCREENING, type BusinessConfig } from "../config";
import type { ConfigOverrides } from "./christmas-light-guys";

/**
 * The shared office line (e.g. what Bestline forwards 512-339-9313 to): it
 * owns a call only until the caller says which company they want. It holds
 * the line's operating rules and no services or facts, so nothing about any
 * company can be said from here; select_business moves the call on.
 */
export function frontDeskConfig(overrides: ConfigOverrides = {}): BusinessConfig {
  const owner = overrides.ownerFirstName ?? "Amy";
  return {
    configVersion: "front-desk-2026.10.22-1",
    brand: { spokenName: `${owner}'s office line`, ownerFirstName: owner, assistantRole: `${owner}'s AI assistant` },
    profile: {
      description: `the office line ${owner} answers for several companies`,
      callerFocus: "The caller may want any of the companies on this line. The greeting asks which one.",
      collect: `Which company and what it's about; their name; the best time for ${owner} to call back.`,
      fieldLabels: {},
      aliases: [],
      signals: [],
    },
    timezone: "America/Chicago",
    ringHours: overrides.ringHours ?? [1, 2, 3, 4, 5, 6].map((day) => ({ day, open: "09:00", close: "18:00" })),
    // Holidays and days off are Amy's to set (Settings); none are assumed.
    closures: overrides.closures ?? [],
    screening: overrides.screening ?? DEFAULT_SCREENING,
    alerts: overrides.alerts ?? DEFAULT_ALERTS,
    safety: overrides.safety ?? DEFAULT_SAFETY,
    ai: {
      mode: overrides.aiMode ?? "after_hours_only",
      maxConcurrentSessions: overrides.maxConcurrentSessions ?? 8,
      recording: "disclosed",
      voice: overrides.voice ?? "stock",
      spanish: overrides.spanish ?? false,
      ...(overrides.agentId ? { agentId: overrides.agentId } : {}),
    },
    transfer: { enabled: true, onlyDuringRingHours: true, maxAttempts: 1 },
    serviceArea: { status: "draft", zips: [], cities: [] },
    services: [],
    intake: ["service_requested", "caller_name", "callback_window"],
    facts: [],
    escalateTopics: ["price", "discount", "availability", "warranty", "refund", "complaint", "payment"],
    notifications: overrides.notifications ?? { sms: [], email: [] },
  };
}
