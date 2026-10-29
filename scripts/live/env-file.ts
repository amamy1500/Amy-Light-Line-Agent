import { existsSync, readFileSync, writeFileSync } from "node:fs";

/**
 * Minimal KEY=VALUE reader/writer for .env.local, so the live scripts can
 * update a few keys (tunnel URL, agent id, webhook secret) without touching
 * anything else in the file or putting values on the command line.
 */
export function readEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=(.*)$/.exec(line);
    if (match) out[match[1]!] = match[2]!.trim().replace(/^(['"])(.*)\1$/, "$2");
  }
  return out;
}

/** Replaces each key's line in place (or appends it); other lines are kept as they are. */
export function upsertEnvFile(path: string, values: Record<string, string>): void {
  const lines = existsSync(path) ? readFileSync(path, "utf8").split(/\r?\n/) : [];
  const pending = new Map(Object.entries(values));
  const updated = lines.map((line) => {
    const key = /^\s*([A-Z0-9_]+)\s*=/.exec(line)?.[1];
    if (!key || !pending.has(key)) return line;
    const value = pending.get(key)!;
    pending.delete(key);
    return `${key}=${value}`;
  });
  while (updated.length > 0 && updated[updated.length - 1] === "") updated.pop();
  for (const [key, value] of pending) updated.push(`${key}=${value}`);
  writeFileSync(path, `${updated.join("\n")}\n`);
}
