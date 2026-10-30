import type { ComplianceReport } from "./compliance";
import type { FactField, WrapUpOutcome } from "@/lib/db/agent";

export type Intent = "hot" | "warm" | "cold" | "not_a_lead" | "unknown";

export interface IntentInput {
  facts: Partial<Record<FactField, string>>;
  compliance: ComplianceReport["summary"] | null;
  wrapUpOutcome: WrapUpOutcome | null;
  transferred: boolean;
}

export interface IntentResult {
  intent: Intent;
  /** Plain reasons Amy can read, e.g. "asked for a date". */
  reasons: string[];
  /** Of the details the callback needs, which were captured. Shown as "4 of 5", never as a fake confidence score. */
  captured: FactField[];
  missing: FactField[];
}

/** What the callback needs so nobody re-interviews the caller (Amy, 2026-10-29). */
export const ESSENTIAL_FIELDS: readonly FactField[] = [
  "caller_name",
  "service_requested",
  "property_address",
  "maps_visible",
  "callback_window",
];

/**
 * Rule-based intent. Deliberately simple and explainable: every label comes
 * with the reasons that produced it, and nothing here is a model's guess.
 */
export function classifyIntent(input: IntentInput): IntentResult {
  const has = (f: FactField) => Boolean(input.facts[f]?.trim());
  const captured = ESSENTIAL_FIELDS.filter(has);
  const missing = ESSENTIAL_FIELDS.filter((f) => !has(f));
  const reasons: string[] = [];

  if (input.wrapUpOutcome && ["not_a_lead", "wrong_number", "spam"].includes(input.wrapUpOutcome)) {
    return { intent: "not_a_lead", reasons: [`assistant marked it ${input.wrapUpOutcome.replace(/_/g, " ")} (Amy to confirm)`], captured, missing };
  }

  const service = has("service_requested");
  const place = has("property_address") || has("zip");
  const timing = has("desired_timing");
  const wantsHuman = input.compliance?.humanRequested ?? false;
  const askedDate = input.compliance?.dateRequested ?? false;

  if (service) reasons.push("said what they want lit");
  if (place) reasons.push("gave the property location");
  if (timing || askedDate) reasons.push("has a date in mind");
  if (wantsHuman) reasons.push("asked for Amy");
  if (input.transferred) reasons.push("was put through to Amy");
  if (input.compliance?.priceAsked) reasons.push("asked about price");

  if (service && place && (timing || askedDate || wantsHuman || input.transferred)) return { intent: "hot", reasons, captured, missing };
  if (service && (place || timing || has("callback_window"))) return { intent: "warm", reasons, captured, missing };
  if (captured.length > 0 || input.compliance?.priceAsked) return { intent: "cold", reasons, captured, missing };
  return { intent: "unknown", reasons: ["hung up before sharing details"], captured, missing };
}
