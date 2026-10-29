import twilio from "twilio";

export interface SignatureCheck {
  /** Twilio auth token. Missing or empty means the check fails. */
  authToken: string | undefined;
  /** Value of the X-Twilio-Signature header. */
  signature: string | null | undefined;
  /** The full public URL Twilio requested, including the query string. */
  url: string;
  /** Form-encoded POST parameters exactly as Twilio sent them. */
  params: Record<string, string>;
}

/**
 * Verifies a Twilio webhook signature. Fails closed: an unset auth token or a
 * missing header is always a rejection, never a skipped check (the reference
 * receptionist we studied skipped validation when its token was unset).
 */
export function isValidTwilioSignature(check: SignatureCheck): boolean {
  if (!check.authToken) return false;
  if (!check.signature) return false;
  return twilio.validateRequest(check.authToken, check.signature, check.url, check.params);
}

/** Signs a request the way Twilio does. Used by tests and the call simulator only. */
export function signLikeTwilio(authToken: string, url: string, params: Record<string, string>): string {
  return twilio.getExpectedTwilioSignature(authToken, url, params);
}
