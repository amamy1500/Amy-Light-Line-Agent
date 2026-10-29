import type { BusinessConfig } from "./config";

/**
 * Which company a caller on a shared line wants, decided by our code from
 * the caller's own words; the agent only proposes. A name or alias decides
 * outright; otherwise a need that points to exactly one company decides; two
 * candidates mean one short question; nothing means asking again. A
 * caller's history never decides (docs/research/one-number-three-businesses.md §1.4).
 */

export interface CompanyOption {
  businessId: string;
  config: BusinessConfig;
}

export type CompanyResolution =
  | { kind: "set"; option: CompanyOption; by: "name" | "need" }
  | { kind: "ambiguous"; options: CompanyOption[] }
  | { kind: "none" };

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole-phrase, case-insensitive match ("deck" does not match "decked"); a leading "the" is optional. */
export function saysPhrase(said: string, phrase: string): boolean {
  const core = phrase.trim().replace(/^the\s+/i, "");
  if (!core) return false;
  const words = core.split(/\s+/).map(escapeRegex).join("\\s+");
  return new RegExp(`(^|[^a-z0-9])${words}s?($|[^a-z0-9])`, "i").test(said);
}

function names(config: BusinessConfig): string[] {
  return [config.brand.spokenName, ...config.profile.aliases];
}

export function resolveCompany(said: string, options: CompanyOption[]): CompanyResolution {
  const byName = options.filter((o) => names(o.config).some((n) => saysPhrase(said, n)));
  if (byName.length === 1) return { kind: "set", option: byName[0]!, by: "name" };
  if (byName.length > 1) return { kind: "ambiguous", options: byName };
  const byNeed = options.filter((o) => o.config.profile.signals.some((s) => saysPhrase(said, s)));
  if (byNeed.length === 1) return { kind: "set", option: byNeed[0]!, by: "need" };
  if (byNeed.length > 1) return { kind: "ambiguous", options: byNeed };
  return { kind: "none" };
}

/** "A, B or C" for spoken lists. */
export function spokenList(items: string[], joiner = "or"): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} ${joiner} ${items[items.length - 1]}`;
}
