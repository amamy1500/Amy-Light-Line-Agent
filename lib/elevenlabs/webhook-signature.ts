import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies an ElevenLabs webhook: header `ElevenLabs-Signature: t=<unix>,v0=<hex>`
 * where v0 = HMAC-SHA256(secret, "<t>.<rawBody>"). Mirrors the official SDK
 * (elevenlabs-js src/wrapper/webhooks.ts) but compares in constant time and
 * fails closed on a missing secret, header or timestamp.
 */
export const SIGNATURE_TOLERANCE_SECONDS = 30 * 60;

export type SignatureResult = { ok: true } | { ok: false; reason: "no_secret" | "no_header" | "malformed" | "stale" | "mismatch" };

export function verifyElevenLabsSignature(input: {
  secret: string | undefined;
  header: string | null | undefined;
  rawBody: string;
  nowSeconds: number;
}): SignatureResult {
  if (!input.secret) return { ok: false, reason: "no_secret" };
  if (!input.header) return { ok: false, reason: "no_header" };

  const parts = new Map<string, string[]>();
  for (const piece of input.header.split(",")) {
    const eq = piece.indexOf("=");
    if (eq <= 0) continue;
    const key = piece.slice(0, eq).trim();
    parts.set(key, [...(parts.get(key) ?? []), piece.slice(eq + 1).trim()]);
  }
  const t = parts.get("t")?.[0];
  const signatures = parts.get("v0") ?? [];
  if (!t || !/^\d+$/.test(t) || signatures.length === 0) return { ok: false, reason: "malformed" };
  if (Math.abs(input.nowSeconds - Number(t)) > SIGNATURE_TOLERANCE_SECONDS) return { ok: false, reason: "stale" };

  const expected = Buffer.from(createHmac("sha256", input.secret).update(`${t}.${input.rawBody}`).digest("hex"));
  const matches = signatures.some((candidate) => {
    const given = Buffer.from(candidate);
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
  return matches ? { ok: true } : { ok: false, reason: "mismatch" };
}

/** Produces a header the way ElevenLabs does. Tests and the simulator only. */
export function signLikeElevenLabs(secret: string, rawBody: string, timestamp: number): string {
  const v0 = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  return `t=${timestamp},v0=${v0}`;
}
