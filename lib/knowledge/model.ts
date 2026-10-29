/**
 * The verified business brain. Everything the business might say about
 * itself is a knowledge ITEM (one topic: years in business, service area,
 * storage…). Each item gathers the CLAIMS the public sources make about it,
 * with the source, the quote, and the words that would give the claim away
 * if the agent spoke it. Amy's decision on the item is the only truth:
 *
 *   sources disagree      → conflict: the agent says neither; ask Amy
 *   one source, or risky  → hold until Amy approves the exact words
 *   sources agree, benign → quick confirm, still Amy's click
 *   approved              → the agent says Amy's words, nothing else
 *   rejected              → the agent never says it; defers to Amy
 *
 * Nothing here is ever inferred from a website at call time.
 */

/** clg/tlg: the two Christmas Light Guys sites; sp: Sublime Patio; tf: The Fridge; policy: proposed wording. */
export type Brand = "clg" | "tlg" | "sp" | "tf" | "policy";

export interface Claim {
  brand: Brand;
  /** Normalised value used to decide agreement ("9 years" vs "20 years"). */
  value: string;
  /** Exact words on the source, as captured. */
  quote: string;
  sourceUrl: string | null;
  /** Evidence id in docs/research/site-facts.json, when the claim came from the sites. */
  siteFactId: string | null;
  /** How an agent repeating this claim would sound; defaults to the quote. */
  spoken: string;
  /**
   * Case-insensitive regex sources that reveal the claim in speech. Empty for
   * claims whose words are too common to detect (e.g. "roofline").
   */
  markers: string[];
}

export type ItemKind = "fact" | "service_area" | "policy";
export type Risk = "low" | "high";
export type DecisionStatus = "pending" | "approved" | "rejected";

/** The owner's decision on one item, recorded outside the console (e.g. answers by email). */
export interface OwnerDecision {
  key: string;
  status: "approved" | "rejected";
  /** The exact words the assistant may say (facts and policies). */
  text?: string;
  /** For a service area: the cities and ZIPs served. */
  value?: { cities: string[]; zips: string[] };
  /** Who decided and how, when it differs from the batch's (a later message from the owner). */
  by?: string;
}

export interface KnowledgeItem {
  key: string;
  title: string;
  kind: ItemKind;
  risk: Risk;
  /** Words a caller's question would contain; used by the answer tool. */
  topics: string[];
  /** How a caller would actually ask; the generated tests ask exactly this. */
  callerQuestion: string;
  claims: Claim[];
  /** Our proposed wording for a quick confirm; never used before Amy approves it. */
  suggestedText: string | null;
  status: DecisionStatus;
  approvedText: string | null;
  /** Structured approval, e.g. the service-area city list. */
  approvedValue: { cities?: string[]; zips?: string[] } | null;
  decidedBy: string | null;
  decidedAt: string | null;
}

export type QueueCategory = "conflict" | "exact_words" | "quick_confirm" | "question_bank";

/** The claim value that marks a common customer question waiting for Amy's own answer (tenants/clg-questions.ts). */
export const QUESTION_BANK_VALUE = "common question: owner's words needed";

/** A common customer question, not something any source claims: Amy answers it when she has a minute. */
export function isQuestionBank(item: Pick<KnowledgeItem, "claims">): boolean {
  return item.claims.length > 0 && item.claims.every((c) => c.brand === "policy" && c.value === QUESTION_BANK_VALUE);
}

const norm = (v: string) => v.toLowerCase().replace(/\s+/g, " ").trim();

/** The sources disagree: more than one distinct value among the claims. */
export function isConflict(item: Pick<KnowledgeItem, "claims">): boolean {
  return new Set(item.claims.map((c) => norm(c.value))).size > 1;
}

/** Both public sites state the same thing. */
export function bothSitesAgree(item: Pick<KnowledgeItem, "claims">): boolean {
  const brands = new Set(item.claims.map((c) => c.brand));
  return !isConflict(item) && brands.has("clg") && brands.has("tlg");
}

export function queueCategory(item: KnowledgeItem): QueueCategory {
  if (isQuestionBank(item)) return "question_bank";
  if (isConflict(item)) return "conflict";
  if (item.risk === "low" && bothSitesAgree(item)) return "quick_confirm";
  return "exact_words";
}

/** What the production agent does about this topic right now, in words Amy reads. */
export function productionAction(item: KnowledgeItem): string {
  if (item.status === "approved") return "Says Amy's approved words only.";
  if (item.status === "rejected") return "Never says it; offers to have Amy follow up.";
  switch (queueCategory(item)) {
    case "conflict":
      return "Don't infer. Ask Amy.";
    case "exact_words":
      return "Hold until Amy approves exact language.";
    case "quick_confirm":
      return "Both sites agree; still held until Amy confirms.";
    case "question_bank":
      return "Says Amy will cover it on the callback, and adds the question to her brief.";
  }
}

export interface ForbiddenClaim {
  itemKey: string;
  brand: Brand;
  value: string;
  patterns: RegExp[];
}

/**
 * Words the agent must not voice right now. Pending and rejected items: every
 * marker of every claim. Approved items: only the markers Amy's own approved
 * text does not contain — so if Amy approves "20 years", the site's "9 years"
 * stays forbidden, and if she approves "licensed and insured", "bonded" stays
 * forbidden while "licensed" is fine. Derived from her words, not a second setting.
 */
export function forbiddenClaims(items: readonly KnowledgeItem[]): ForbiddenClaim[] {
  const out: ForbiddenClaim[] = [];
  for (const item of items) {
    const approved = item.status === "approved" ? (item.approvedText ?? "") : null;
    for (const claim of item.claims) {
      const patterns = claim.markers
        .map((m) => new RegExp(m, "i"))
        .filter((p) => approved === null || !p.test(approved));
      if (patterns.length) out.push({ itemKey: item.key, brand: claim.brand, value: claim.value, patterns });
    }
  }
  return out;
}
