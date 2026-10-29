/**
 * Voicemail transcript → lead fields.
 *
 * Rule: a field is filled only when the transcript literally contains it.
 * Anything not found stays absent (never guessed). The caller ID, not the
 * transcript, is the phone of record; a spoken number is kept separately as
 * `callbackPhone`. An LLM extractor can replace this later behind the same
 * interface, held to the same golden set (packages/extraction/test).
 */

export interface ExtractedFields {
  contactName?: string;
  address?: string;
  serviceWanted?: string;
  timing?: string;
  callbackWindow?: string;
  callbackPhone?: string;
}

export interface Extraction {
  method: "rules-v1";
  fields: ExtractedFields;
}

export type Extractor = (transcript: string | null | undefined) => Extraction;

// Words that follow "I'm" / "this is" but are not names.
const NOT_NAMES = new Set(
  [
    "calling", "looking", "interested", "just", "trying", "wondering", "here", "the", "a", "an",
    "not", "going", "hoping", "on", "at", "in", "your", "you", "with", "from", "about", "so",
    "sorry", "back", "still", "very", "really", "getting", "needing", "ready", "available",
  ].map((w) => w.toLowerCase()),
);

// The trigger phrase is case-insensitive; the name itself must be capitalised
// (Twilio capitalises proper nouns), so the regex cannot use the `i` flag.
const NAME_PATTERN =
  /\b(?:[Mm]y name is|[Mm]y name[’']s|[Tt]his is|[Ii]t[’']s|I am|I[’']m)\s+([A-Z][a-z’'-]+(?:\s+[A-Z][a-z’'-]+)?)/g;

const STREET_SUFFIX =
  "Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Court|Ct|Circle|Cir|Boulevard|Blvd|Way|Trail|Trl|" +
  "Cove|Cv|Parkway|Pkwy|Place|Pl|Loop|Path|Pass|Run|Bend|Hollow|Ridge|Terrace|Ter|Highway|Hwy";
const ADDRESS_PATTERN = new RegExp(
  `\\b(\\d{2,6})\\s+((?:[A-Z0-9][\\w'.-]*\\s+){0,4}?)(${STREET_SUFFIX})\\b\\.?`,
);

const PHONE_PATTERN = /(?:\+?1[\s.-]?)?\(?([2-9]\d{2})\)?[\s.-]?([2-9]\d{2})[\s.-]?(\d{4})\b/;

const SERVICES: ReadonlyArray<[RegExp, string]> = [
  [/\b(roof ?line|roof|gutters?|eaves|fascia)\b/i, "roofline"],
  [/\b(trees?|tree wrap|trunks?)\b/i, "trees"],
  [/\bwreaths?\b/i, "wreath"],
  [/\bgarlands?\b/i, "garland"],
  [/\b(bushes|hedges?|shrubs?)\b/i, "bushes"],
  [/\b(walkway|pathway|driveway)\b/i, "walkway"],
  [/\b(permanent|year[- ]round|jellyfish)\b/i, "permanent lighting"],
  // "your business" is common filler on calls, so only explicit words count.
  [/\b(commercial|storefront|shopping center)\b/i, "commercial"],
  [/\b(take ?down|takedown|removal)\b/i, "takedown"],
  [/\blandscape lighting\b/i, "landscape lighting"],
  [/\b(wedding|event lighting)\b/i, "event lighting"],
];

const TIMING_PATTERN =
  /\b((?:before|by|after|around|for)\s+(?:thanksgiving|christmas|halloween|new year'?s|the holidays|next week|this weekend|the weekend|(?:october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?)|as soon as possible|asap)\b/i;

const CALLBACK_PATTERN =
  /\b((?:anytime|any time)(?:\s+(?:today|tomorrow|after\s+\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?))?|(?:after|before|between|around)\s+\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?(?:\s+and\s+\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)?|in the (?:morning|afternoon|evening)|(?:this|tomorrow)\s+(?:morning|afternoon|evening))\b/i;

function firstName(text: string): string | undefined {
  for (const match of text.matchAll(NAME_PATTERN)) {
    const candidate = match[1]!.trim();
    const first = candidate.split(/\s+/)[0]!.toLowerCase();
    if (!NOT_NAMES.has(first)) return candidate;
  }
  return undefined;
}

function address(text: string): string | undefined {
  const match = ADDRESS_PATTERN.exec(text);
  return match ? match[0].replace(/\s+/g, " ").replace(/\.$/, "").trim() : undefined;
}

function callbackPhone(text: string): string | undefined {
  const match = PHONE_PATTERN.exec(text);
  return match ? `+1${match[1]}${match[2]}${match[3]}` : undefined;
}

function services(text: string): string | undefined {
  const found = SERVICES.filter(([pattern]) => pattern.test(text)).map(([, label]) => label);
  return found.length ? found.join(", ") : undefined;
}

function callbackWindow(text: string): string | undefined {
  // Only take a time phrase from a sentence that is about being called back.
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    if (!/\b(call|reach|best time|available|free)\b/i.test(sentence)) continue;
    const match = CALLBACK_PATTERN.exec(sentence);
    if (match) return match[1]!.trim();
  }
  return undefined;
}

export const extractLeadFields: Extractor = (transcript) => {
  const text = (transcript ?? "").replace(/\s+/g, " ").trim();
  const fields: ExtractedFields = {};
  if (!text) return { method: "rules-v1", fields };

  const assign = <K extends keyof ExtractedFields>(key: K, value: string | undefined) => {
    if (value) fields[key] = value;
  };
  assign("contactName", firstName(text));
  assign("address", address(text));
  assign("serviceWanted", services(text));
  assign("timing", TIMING_PATTERN.exec(text)?.[1]?.trim());
  assign("callbackWindow", callbackWindow(text));
  assign("callbackPhone", callbackPhone(text));
  return { method: "rules-v1", fields };
};

/** Flattens fields for storage as jsonb (string values only). */
export function toStoredFields(extraction: Extraction): Record<string, string> {
  const out: Record<string, string> = { method: extraction.method };
  for (const [key, value] of Object.entries(extraction.fields)) {
    if (typeof value === "string" && value) out[key] = value;
  }
  return out;
}
