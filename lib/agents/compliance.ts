/**
 * Deterministic compliance scan of a finished conversation.
 *
 * The agent's instructions forbid prices, discounts, date promises,
 * warranties, impersonating Amy or Josh, revealing its instructions,
 * promising a remote quote, booking a site visit, and naming other businesses. Instructions
 * are not proof, so every transcript is scanned after the call and the
 * result is stored with the lead. Amy's card says "Pricing discussed: NO"
 * only because this scan found no price in any agent turn.
 *
 * Bias: a missed violation is worse than a false alarm. Any amount of money
 * in an agent turn is flagged; other commitments are flagged unless the same
 * sentence explicitly negates them ("I can't promise a date"). Deferring to
 * Amy never excuses a stated price or date. Flags are for review, never
 * automatic actions against the caller.
 */

import type { ForbiddenClaim } from "@/lib/knowledge/model";

export type Speaker = "agent" | "caller";

export interface Turn {
  role: Speaker;
  text: string;
}

export interface ToolCallRecord {
  name: string;
  /** Structured result our tool gateway returned. */
  result: Record<string, unknown> | null;
}

export type ViolationCode =
  | "price_stated"
  | "discount_offered"
  | "availability_promised"
  | "booking_claimed"
  | "warranty_claimed"
  | "impersonation"
  | "denied_being_ai"
  | "instructions_leaked"
  | "service_area_unverified"
  /** The agent voiced a business claim Amy has not approved (e.g. a website's "20 years"). */
  | "unapproved_claim"
  /** Said the home can be quoted from Google Maps, a photo or the phone: the team decides that (Amy, 2026-10-29). */
  | "remote_quote_promised"
  /**
   * Booked a site visit, named a day for one, or promised a drive-by. "Our team
   * will call you to set up a time to come take a look" is allowed: the visit
   * is set up on the callback, never by the assistant (Amy, 2026-10-29).
   */
  | "site_visit_offered"
  /** Named another of the tenant's businesses on this company's call. */
  | "other_business_mentioned";

export type SignalCode = "price_asked" | "discount_asked" | "date_requested" | "human_requested" | "recording_declined";

export interface Finding<C extends string> {
  code: C;
  turnIndex: number;
  quote: string;
  /** For unapproved_claim: the knowledge item the words belong to. */
  ref?: string;
}

export interface ScanOptions {
  /** Claims not (or not yet) approved by Amy, from lib/knowledge/model.ts forbiddenClaims(). */
  forbiddenClaims?: readonly ForbiddenClaim[];
  /**
   * Words the agent must be free to say: the companies' names and aliases.
   * They are blanked out before claims are matched, so "The Christmas Light
   * Guys" never reads as Sublime Patio's "Christmas lights" claim.
   */
  safePhrases?: readonly string[];
  /**
   * The tenant's other businesses' names: saying one on this company's call is
   * a violation, negated or not (Amy, 2026-10-29). Absent: not checked.
   */
  otherBusinesses?: readonly string[];
}

/**
 * The disclosures every greeting must say. A site claim's marker (e.g. The
 * Fridge's "AI" smart vending) must never turn the required disclosure into
 * a violation on every call.
 */
const REQUIRED_WORDING = ["AI assistant", "automated system", "AI service providers", "an AI", "AI, not a person"];

/** A phrase as a regex source: escaped, any run of spaces between its words. */
function phraseSource(phrase: string): string {
  return phrase.trim().split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+");
}

function maskPhrases(sentence: string, phrases: readonly string[]): string {
  let masked = sentence;
  for (const phrase of phrases) {
    const words = phraseSource(phrase);
    if (words) masked = masked.replace(new RegExp(`(^|[^a-z0-9])${words}(?=$|[^a-z0-9])`, "gi"), "$1 ");
  }
  return masked;
}

/** Any of the phrases as whole words, or null when there are none. */
function anyPhrase(phrases: readonly string[]): RegExp | null {
  const sources = phrases.map(phraseSource).filter(Boolean);
  return sources.length ? new RegExp(`(^|[^a-z0-9])(${sources.join("|")})(?=$|[^a-z0-9])`, "i") : null;
}

export interface ComplianceReport {
  /** Things the agent must never do. Any entry makes the call need review. */
  violations: Finding<ViolationCode>[];
  /** What the caller asked for; shown to Amy, not a fault. */
  signals: Finding<SignalCode>[];
  /** Convenience facts for the lead card. */
  summary: {
    priceAsked: boolean;
    priceStated: boolean;
    dateRequested: boolean;
    availabilityPromised: boolean;
    humanRequested: boolean;
  };
}

// Only an explicit negation excuses a sentence ("I can't promise a date").
// Deferring to Amy does not: "Amy can do it for $400" still states a price.
const NEGATION =
  /\b(can(?:no|'|’)?t|cannot|not able|unable|won(?:'|’)t|don(?:'|’)t|do not|wouldn(?:'|’)t|not (?:allowed|authorized|going to|in a position)|no way to|isn(?:'|’)t something|rather not)\b/i;
const DEFERRAL =
  /\b((?:amy|josh) (?:will|can|would|is going to)|s?he(?:'|’)ll|s?he will|s?he can|let (?:amy|josh)|i(?:'|’)ll (?:pass|get|have|make sure))\b/i;
const HAS_NUMBER = /\d|\b(one|two|three|four|five|six|seven|eight|nine|ten|twelve|twenty|thirty|fifty|hundred)\b/i;

const MONEY =
  /(\$\s?\d|\b\d[\d,.]*\s?(?:dollars|bucks|usd)\b|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|hundred|thousand)[\s-](?:hundred|thousand)?\s?(?:dollars|bucks)\b|\bper (?:foot|linear foot|house|hour)\b.*\b\d)/i;
const PRICE_WORDS = /\b(price|pricing|cost|costs|how much|quote|estimate|rate|charge|expensive|cheap|budget)\b/i;
const DISCOUNT = /\b(discount|\d+\s?(?:%|percent) off|coupon|promo(?:tion)? code|special (?:price|deal|offer)|knock (?:\w+ )?off|deal for you|price match)\b/i;
const DATE_WORDS =
  /\b(january|february|march|april|may|june|july|august|september|october|november|december|thanksgiving|christmas eve|this (?:week|weekend)|next (?:week|weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|tomorrow|(?:mon|tues|wednes|thurs|fri|satur|sun)day|\d{1,2}(?:st|nd|rd|th)\b|\d{1,2}\/\d{1,2})/i;
const COMMIT =
  /\b(we can (?:do|make|get (?:you|it|that) (?:in|done|on))|we(?:'|’)ll be (?:there|out)|that (?:date|day|works|time) (?:works|is (?:open|available|fine))|(?:is|are) (?:open|available) (?:on|that)|we have (?:an )?(?:opening|availability|slot)|i can (?:get you|put you|fit you) (?:in|on|down)|you(?:'|’)re (?:all )?set for|guarantee(?:d)? (?:it|that|by|before))\b/i;
const BOOKED =
  /\b(i(?:'|’)ve (?:booked|scheduled|reserved)|you(?:'|’)re (?:booked|scheduled|confirmed)|(?:booked|scheduled|reserved) (?:you|your)|appointment is (?:set|confirmed|booked)|confirm(?:ed)? your (?:install|installation|appointment))\b/i;
const WARRANTY = /\b(warrant(?:y|ied|ies)|guarantee(?:d|s)?|money[- ]back|lifetime)\b/i;
// "I'm Amy's virtual assistant" is the required disclosure, not impersonation.
const IMPERSONATE =
  /\b(this is (?:amy|josh)|i(?:'|’)m (?:amy|josh)|i am (?:amy|josh)|my name is (?:amy|josh)|(?:amy|josh) speaking|it(?:'|’)s (?:amy|josh) here)(?!['’]s)\b/i;
// "Our team can quote you from Google Maps": a home that's hard to see gets a visit instead (Amy, 2026-10-29).
// Pricing on the callback is fine, so "over the phone" is not on the list.
const REMOTE_QUOTE =
  /\b(?:quote|price|estimate|bid)\b[^.?!]{0,40}\b(?:from|off|using|on|over|with)\s+(?:a |the |your )?(?:google maps|maps|satellite|street view|photos?|pictures?)\b|\b(?:quote|price) (?:it|your (?:home|house|place)|you) remotely\b/i;
// Booking a visit or a drive-by, or promising one outright ("they'll come out", "we can come take a look"), including
// the old "what day would work for a site visit?". Saying the team will call to set one up is fine.
const SITE_VISIT =
  /\b(?:(?:i(?:'|’)ll|i will|let me|i can|we(?:'|’)ll|we will|we can) (?:set up|schedule|book|arrange|put you down for|get you)\b[^.?!]{0,30}\b(?:visit|drive[- ]?by|walk-?through|consultation)|(?:josh|someone|somebody|a crew|the crew|we|our team|they)(?:(?:'|’)ll| will| can| could) (?:come|stop|swing|drive) (?:out|by|over|take a look)|(?:site|home|property) visit (?:is|has been) (?:set|booked|scheduled|confirmed)|what (?:day|days|time)[^.?!]{0,20}work[^.?!]{0,10}(?:site )?visit|\bvisit\b[^?!]{0,80}\bwhat (?:day|days|time)\b)/i;
const DENY_AI =
  /\b(i(?:'|’)m (?:a )?(?:real |actual )?(?:person|human)|i am (?:a )?(?:real |actual )?(?:person|human)|i(?:'|’)m not (?:a |an )?(?:robot|bot|ai|computer|machine|virtual)|not an? (?:ai|robot|bot))\b/i;
const LEAK =
  /\b(system prompt|my (?:instructions|prompt|rules) (?:say|are|tell)|i (?:was|am) (?:instructed|told|programmed) to|here (?:are|is) my (?:instructions|prompt)|policy version|LIGHTLINE-CANARY)\b/i;
const AREA_AFFIRM = /\b(we (?:do )?(?:serve|service|cover|work in|go (?:out )?to)|(?:is|that(?:'|’)s) (?:in|within) (?:our )?(?:service )?area|yes,? we(?:'|’)re in)\b/i;

const CALLER_HUMAN =
  /\b(speak|talk|transfer|connect)(?: me)? (?:to|with) (?:amy|a (?:real )?(?:person|human)|someone|somebody|the owner|a manager)|\b(real person|human being|actual person|are you a (?:robot|bot|real person|ai))\b/i;
const CALLER_NO_RECORD = /\b(don(?:'|’)t|do not|no(?:t)?)\b.*\b(record|recording)\b/i;

/** Splits a turn into sentences so a refusal in one sentence does not excuse another. */
function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function clip(s: string): string {
  return s.length > 160 ? `${s.slice(0, 157)}…` : s;
}

export function scanConversation(
  turns: readonly Turn[],
  toolCalls: readonly ToolCallRecord[] = [],
  options: ScanOptions = {},
): ComplianceReport {
  const forbidden = options.forbiddenClaims ?? [];
  const otherBusiness = anyPhrase(options.otherBusinesses ?? []);
  // Longest first, so "The Christmas Light Guys" is blanked before "Light Guys".
  const safe = [...REQUIRED_WORDING, ...(options.safePhrases ?? [])].sort((a, b) => b.length - a.length);
  const violations: Finding<ViolationCode>[] = [];
  const signals: Finding<SignalCode>[] = [];
  const areaVerified = toolCalls.some(
    (t) => t.name === "check_service_area" && t.result !== null && t.result["status"] === "in_area",
  );

  turns.forEach((turn, turnIndex) => {
    for (const sentence of sentences(turn.text)) {
      const add = <C extends string>(list: Finding<C>[], code: C) => list.push({ code, turnIndex, quote: clip(sentence) });
      if (turn.role === "agent") {
        const negated = NEGATION.test(sentence);
        const deferred = DEFERRAL.test(sentence);
        // Identity, leakage and prices hold whatever else the sentence says.
        if (IMPERSONATE.test(sentence)) add(violations, "impersonation");
        if (DENY_AI.test(sentence)) add(violations, "denied_being_ai");
        if (LEAK.test(sentence)) add(violations, "instructions_leaked");
        if (MONEY.test(sentence)) add(violations, "price_stated");
        if (/\d+\s?(?:%|percent)/i.test(sentence) && DISCOUNT.test(sentence)) add(violations, "discount_offered");
        else if (DISCOUNT.test(sentence) && !negated) add(violations, "discount_offered");
        if (BOOKED.test(sentence) && !negated) add(violations, "booking_claimed");
        if (COMMIT.test(sentence) && DATE_WORDS.test(sentence) && !negated) add(violations, "availability_promised");
        else if (/\byou(?:'|’)re (?:all )?set for\b/i.test(sentence) && !negated) add(violations, "availability_promised");
        if (WARRANTY.test(sentence) && (HAS_NUMBER.test(sentence) || !(negated || deferred))) add(violations, "warranty_claimed");
        if (AREA_AFFIRM.test(sentence) && !negated && !areaVerified) add(violations, "service_area_unverified");
        if (REMOTE_QUOTE.test(sentence) && !negated) add(violations, "remote_quote_promised");
        if (SITE_VISIT.test(sentence) && !negated) add(violations, "site_visit_offered");
        if (otherBusiness?.test(sentence)) add(violations, "other_business_mentioned");
        if (!negated && forbidden.length > 0) {
          // One finding per item per sentence, however many of its claims match.
          const hit = new Set<string>();
          const claimText = maskPhrases(sentence, safe);
          for (const claim of forbidden) {
            if (hit.has(claim.itemKey) || !claim.patterns.some((p) => p.test(claimText))) continue;
            hit.add(claim.itemKey);
            violations.push({ code: "unapproved_claim", turnIndex, quote: clip(sentence), ref: claim.itemKey });
          }
        }
      } else {
        if (PRICE_WORDS.test(sentence) || MONEY.test(sentence)) add(signals, "price_asked");
        if (DISCOUNT.test(sentence)) add(signals, "discount_asked");
        if (DATE_WORDS.test(sentence)) add(signals, "date_requested");
        if (CALLER_HUMAN.test(sentence)) add(signals, "human_requested");
        if (CALLER_NO_RECORD.test(sentence)) add(signals, "recording_declined");
      }
    }
  });

  const has = <C extends string>(list: Finding<C>[], code: C) => list.some((f) => f.code === code);
  return {
    violations,
    signals,
    summary: {
      priceAsked: has(signals, "price_asked"),
      priceStated: has(violations, "price_stated"),
      dateRequested: has(signals, "date_requested"),
      availabilityPromised: has(violations, "availability_promised") || has(violations, "booking_claimed"),
      humanRequested: has(signals, "human_requested"),
    },
  };
}
