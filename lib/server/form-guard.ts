import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Cheap, layered spam defence for public forms, built for the failure the
 * old site has (bots posting straight to the handler):
 *  1. honeypot field real people never fill,
 *  2. a signed render stamp: a post without one never loaded the page, and
 *     a post faster than a human can type is a bot,
 *  3. content scoring (links, scripts, gibberish),
 *  4. a per-IP rate limit (in the route).
 * A rejected post is answered exactly like a real one, so bots learn nothing.
 * A CAPTCHA can be added on top if these let spam through; it is not the
 * first line because it costs real customers effort.
 */

export const MIN_FILL_MS = 3_000;
export const MAX_FILL_MS = 2 * 60 * 60 * 1000;

function sign(secret: string, value: string): string {
  return createHmac("sha256", secret).update(`lightline-form:${value}`).digest("base64url").slice(0, 32);
}

export function formStamp(secret: string, now = Date.now()): string {
  const t = String(now);
  return `${t}.${sign(secret, t)}`;
}

export type StampCheck = "ok" | "missing" | "forged" | "too_fast" | "expired";

export function checkStamp(secret: string, stamp: string | null, now = Date.now()): StampCheck {
  if (!stamp) return "missing";
  const [t, mac] = stamp.split(".");
  if (!t || !mac || !/^\d{10,16}$/.test(t)) return "forged";
  const expected = Buffer.from(sign(secret, t));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return "forged";
  const age = now - Number(t);
  if (age < MIN_FILL_MS) return "too_fast";
  if (age > MAX_FILL_MS) return "expired";
  return "ok";
}

/** 0 = clean. Each signal adds weight; the route drops posts at SPAM_THRESHOLD or more. */
export function spamScore(fields: Record<string, string>): number {
  const text = Object.values(fields).join(" ");
  let score = 0;
  if (/https?:\/\/|www\.|\[url|<a\s/i.test(text)) score += 3;
  if (/<script|<\/|&#x?[0-9a-f]+;/i.test(text)) score += 3;
  if (/\b(seo|backlinks?|crypto|casino|viagra|loan|rank your (site|website)|guest post)\b/i.test(text)) score += 2;
  if (/[Ѐ-ӿ一-鿿]/.test(text)) score += 1;
  const name = fields.name ?? "";
  if (name && !/[aeiouy]/i.test(name) && name.length > 5) score += 1;
  return score;
}

export const SPAM_THRESHOLD = 3;
