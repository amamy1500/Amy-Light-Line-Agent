import type { Brand, Claim, ItemKind, KnowledgeItem, Risk } from "../model";

/** A claim copied from a public page. `id` is its register id in the research doc. */
export function captured(
  id: string,
  brand: Brand,
  value: string,
  quote: string,
  sourceUrl: string,
  markers: string[],
  spoken?: string,
): Claim {
  return { brand, value, quote, sourceUrl, siteFactId: id, spoken: spoken ?? quote, markers };
}

/** No site answers this topic. Lightline proposes the wording; Amy decides. */
export function proposed(value: string, spoken: string, markers: string[] = []): Claim {
  return {
    brand: "policy",
    value,
    quote: "Proposed by Lightline; not on the site.",
    sourceUrl: null,
    siteFactId: null,
    spoken,
    markers,
  };
}

export function pendingItem(def: {
  key: string;
  title: string;
  kind?: ItemKind;
  risk: Risk;
  topics: string[];
  callerQuestion: string;
  claims: Claim[];
  suggestedText?: string;
}): KnowledgeItem {
  return {
    kind: "fact",
    suggestedText: null,
    status: "pending",
    approvedText: null,
    approvedValue: null,
    decidedBy: null,
    decidedAt: null,
    ...def,
  };
}

/** Marker sets reused by both tenants. Case-insensitive regex sources. */
export const MONEY = [
  "\\$\\s?\\d",
  "\\b\\d{1,3},\\d{3}\\b",
  "\\b(six|eight|ten|twelve|fifteen|eighteen|twenty[- ]?five|thirty[- ]?five|fifty|sixty) thousand\\b",
  "a few thousand",
];
export const DURATION = [
  "\\b(\\d+|one|two|three) ?(to|-|–) ?(\\d+|three|four|five|six|seven|ten) (days|weeks)\\b",
];
export const ONE_BUSINESS_DAY = ["one business day", "within (a|one|1) (business )?day", "24 hours"];
export const RELATIONSHIP = [
  "sister compan(y|ies)",
  "same (company|companies|owner|owners|people|team)",
  "(owns|runs) (both|all)",
];
