import { DEFAULT_ALERTS, DEFAULT_SAFETY, DEFAULT_SCREENING, type BusinessConfig, type Service } from "../config";
import type { ConfigOverrides } from "./christmas-light-guys";

/**
 * Sister company #2: Sublime Patio (outdoor living, Austin, TX), answered by
 * the same office manager on the same phone setup. As for the Christmas
 * Light Guys, nothing the business says about itself lives here: facts come
 * only from Amy's approved knowledge items. These are operational proposals.
 */

/** Intent hints from the public site (docs/prior-work/08-client-audits.md §2.4); never spoken as offers. */
export const SUBLIME_PATIO_SERVICES: Service[] = [
  { id: "outdoor_kitchen", label: "outdoor kitchens", synonyms: ["outdoor kitchen", "grill", "bbq", "barbecue"], status: "draft" },
  { id: "pergola_cover", label: "pergolas, covered patios and shade", synonyms: ["pergola", "patio cover", "covered patio", "shade", "louvered", "roof"], status: "draft" },
  { id: "hardscape", label: "patios, stonework, paths and decking", synonyms: ["patio", "pavers", "stone", "flagstone", "gravel", "path", "walkway", "deck", "decking", "masonry"], status: "draft" },
  { id: "landscape", label: "landscaping, turf and landscape lighting", synonyms: ["landscaping", "turf", "artificial grass", "putting green", "golf green", "landscape lighting"], status: "draft" },
];

export function sublimePatioConfig(overrides: ConfigOverrides = {}): BusinessConfig {
  const owner = overrides.ownerFirstName ?? "Amy";
  return {
    configVersion: "sublime-2026.10.22-1",
    brand: { spokenName: "Sublime Patio", ownerFirstName: owner, assistantRole: `${owner}'s AI assistant` },
    profile: {
      description: "an outdoor living company in Austin, Texas",
      callerFocus:
        "Callers usually want a new outdoor project: an outdoor kitchen, a pergola or covered patio, a patio, stonework or decking, or landscaping and turf. Find out what they have in mind first; don't list services unless asked.",
      collect: `Home or business; new or returning customer; what project they have in mind and roughly how big; the property address and ZIP; any timing they have in mind; their name; the best time for ${owner} to call back about an estimate; how they heard about us (only if it fits). Don't ask about budget. If they mention one, note it in save_lead_details notes without repeating the number.`,
      fieldLabels: { service_requested: "Project" },
      aliases: ["Sublime Patio", "Sublime", "Sublime Patios"],
      signals: ["patio", "pergola", "outdoor kitchen", "covered patio", "patio cover", "pavers", "flagstone", "stonework", "decking", "deck", "turf", "artificial grass", "putting green", "landscaping", "landscape lighting", "backyard"],
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
    serviceArea: overrides.serviceArea ?? { status: "draft", zips: [], cities: [] },
    services: SUBLIME_PATIO_SERVICES,
    intake: [
      "property_type",
      "customer_type",
      "service_requested",
      "property_address",
      "desired_timing",
      "caller_name",
      "callback_window",
      "lead_source",
    ],
    facts: overrides.facts ?? [],
    escalateTopics: ["price", "discount", "budget", "financing", "availability", "warranty", "insurance", "permit", "damage", "complaint", "existing job status", "payment"],
    notifications: overrides.notifications ?? { sms: [], email: [] },
  };
}
