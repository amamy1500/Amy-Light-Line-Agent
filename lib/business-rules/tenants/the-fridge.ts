import { DEFAULT_ALERTS, DEFAULT_SAFETY, DEFAULT_SCREENING, type BusinessConfig, type Service } from "../config";
import type { ConfigOverrides } from "./christmas-light-guys";

/**
 * Sister company #3: The Fridge (smart vending machines), answered by the
 * same office manager. Two kinds of caller: someone who wants a machine at
 * their location, and someone with a problem at an existing machine. Facts
 * come only from Amy's approved knowledge items; refunds, commissions and
 * contracts always go to Amy.
 */

/** Intent hints from the public site (docs/prior-work/08-client-audits.md §2.5); never spoken as offers. */
export const THE_FRIDGE_SERVICES: Service[] = [
  { id: "placement", label: "a vending machine at a location", synonyms: ["vending machine", "a machine", "placement", "put a machine", "break room", "smart fridge"], status: "draft" },
  { id: "machine_problem", label: "a problem with one of our machines", synonyms: ["lost money", "took my money", "didn't drop", "stuck", "broken", "not working", "card declined", "refund"], status: "draft" },
  { id: "stock_request", label: "product requests for a machine", synonyms: ["stock", "restock", "out of", "snacks", "drinks", "meals", "add an item"], status: "draft" },
];

export function theFridgeConfig(overrides: ConfigOverrides = {}): BusinessConfig {
  const owner = overrides.ownerFirstName ?? "Amy";
  return {
    configVersion: "fridge-2026.10.22-1",
    brand: { spokenName: "The Fridge", ownerFirstName: owner, assistantRole: `${owner}'s AI assistant` },
    profile: {
      description: "a vending machine company based in Austin, Texas",
      callerFocus:
        "Most callers either want a vending machine at their location (a business, shop, apartment community or workplace) or have a problem with one of our machines (lost money, an item that didn't drop, out of stock, not working). Find out which one first, in a few words. For a problem: apologize once, get where the machine is and what happened, and never promise a refund or a fix time; " +
        `${owner} follows up.`,
      collect: `For a new machine: what they're looking for (drinks, snacks, meals, a fridge); the business or property name and what kind of place it is; the location address; roughly how many people are there on a normal day (put it in notes); their name; the best time for ${owner} to call back. For a problem: where the machine is; what happened and when (in notes); their name; the best number and time to reach them.`,
      fieldLabels: {
        property_type: "Location type",
        property_address: "Machine location",
        service_requested: "Looking for",
        notes: "Details",
      },
      aliases: ["The Fridge", "Fridge Vending"],
      signals: ["vending", "vending machine", "machine", "snacks", "drinks", "break room", "took my money", "ate my money", "didn't drop", "micro market", "smart fridge"],
    },
    timezone: "America/Chicago",
    ringHours: overrides.ringHours ?? [1, 2, 3, 4, 5].map((day) => ({ day, open: "09:00", close: "17:00" })),
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
    services: THE_FRIDGE_SERVICES,
    intake: ["service_requested", "property_type", "property_address", "caller_name", "notes", "callback_window", "lead_source"],
    facts: overrides.facts ?? [],
    escalateTopics: ["price", "commission", "revenue share", "refund", "contract", "damage", "complaint", "payment", "existing machine problem"],
    notifications: overrides.notifications ?? { sms: [], email: [] },
  };
}
