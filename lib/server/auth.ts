import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { readEnv } from "./env";

/**
 * Interim operator access for the call inbox: one shared secret
 * (OPERATOR_TOKEN) exchanged for an httpOnly cookie. Replaced by per-user
 * Supabase sign-in + RLS memberships in the next slice; the database policies
 * for that already exist and are tested.
 */
export const OPERATOR_COOKIE = "lgos_operator";

export function operatorCookieValue(token: string): string {
  return createHash("sha256").update(`lgos-operator:${token}`).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function tokenMatches(candidate: string | null | undefined): boolean {
  const { operatorToken } = readEnv();
  if (!operatorToken || !candidate) return false;
  return safeEqual(operatorCookieValue(candidate), operatorCookieValue(operatorToken));
}

export async function isOperator(): Promise<boolean> {
  const { operatorToken } = readEnv();
  if (!operatorToken) return false; // fail closed when unconfigured
  const value = (await cookies()).get(OPERATOR_COOKIE)?.value;
  return !!value && safeEqual(value, operatorCookieValue(operatorToken));
}
