/**
 * Who has to say "yes" before the assistant (or Amy) picks up. Pure rules, so
 * each is unit-tested without a phone (docs/research/spam-screening.md).
 *
 * Day 1 gates only the callers least likely to be real customers: hidden
 * numbers, numbers the carrier's caller-ID check failed, and numbers the
 * assistant flagged as spam twice. "No-TN-Validation" is NOT gated: about
 * 45% of real callers arrive that way (landlines, small carriers).
 */

/** What Twilio sends in From for callers who hide or have no number. */
const HIDDEN_CALLER = new Set([
  "",
  "anonymous",
  "restricted",
  "unavailable",
  "unknown",
  "private",
  "+266696687", // Anonymous
  "+86282452253", // Restricted
  "+8656696", // Unavailable
  "+2562533", // Blocked
]);

export type GateReason = "hidden_number" | "caller_id_failed" | "flagged_spam";

export function gateReason(input: {
  from: string | null | undefined;
  stirVerstat: string | null | undefined;
  autoBlocked: boolean;
  /** Amy's screening settings; both on unless she turned one off. */
  rules?: { gateHiddenNumbers: boolean; gateFailedCallerId: boolean };
}): GateReason | null {
  const rules = input.rules ?? { gateHiddenNumbers: true, gateFailedCallerId: true };
  if (input.autoBlocked) return "flagged_spam";
  const from = (input.from ?? "").trim().toLowerCase();
  if (rules.gateHiddenNumbers && (HIDDEN_CALLER.has(from) || !/^\+?\d{7,15}$/.test(from))) return "hidden_number";
  if (rules.gateFailedCallerId && (input.stirVerstat ?? "").startsWith("TN-Validation-Failed")) return "caller_id_failed";
  return null;
}

/** A pressed 1, or a spoken yes in any of the usual ways (English or Spanish). */
export function passedGate(input: { digits: string | null | undefined; speech: string | null | undefined }): boolean {
  if (input.digits === "1") return true;
  // Accents dropped first ("sí" → "si"): \b only sees ASCII word characters.
  const speech = (input.speech ?? "").normalize("NFD").replace(/\p{M}/gu, "");
  return /\b(yes|yeah|yep|yup|sure|ok|okay|uh huh|si|hello|hi)\b/i.test(speech);
}
