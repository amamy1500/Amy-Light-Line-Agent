import { randomBytes } from "node:crypto";

/** 192 bits of randomness, URL-safe: share links cannot be guessed. */
export function newShareToken(): string {
  return randomBytes(24).toString("base64url");
}

const windows = new Map<string, number[]>();

/**
 * Per-IP limiter for the public business check (each run fetches a stranger's
 * website). In-memory: good enough for one server process; swap for a shared
 * store before running several instances.
 */
export function allowRequest(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const recent = (windows.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    windows.set(key, recent);
    return false;
  }
  recent.push(now);
  windows.set(key, recent);
  return true;
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}
