/**
 * Card numbers never get stored (docs/research/voice-agent-edge-cases.md E10).
 * The assistant is told to stop anyone reading one out, but a caller can be
 * faster than the instruction, and transcript redaction is an enterprise-only
 * vendor feature. So every string we keep from a call passes through here.
 */

const CARD_LIKE = /\b(?:\d[ -]?){12,18}\d\b/g;

/** The Luhn checksum every payment card number passes; random digit runs mostly don't. */
function luhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i += 1) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

export const CARD_REDACTED = "[card number removed]";

/** Replaces 13–19 digit runs (spaces or dashes allowed) that pass the Luhn check. Phone numbers are too short to match. */
export function redactCardNumbers(text: string): string {
  return text.replace(CARD_LIKE, (match) => {
    const digits = match.replace(/\D/g, "");
    return digits.length >= 13 && digits.length <= 19 && luhn(digits) ? CARD_REDACTED : match;
  });
}

/** The same, through every string in a JSON-like value. */
export function redactDeep<T>(value: T): T {
  if (typeof value === "string") return redactCardNumbers(value) as T;
  if (Array.isArray(value)) return value.map((v) => redactDeep(v)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redactDeep(v)])) as T;
  }
  return value;
}
