import { z } from "zod";
import { AiMode, IntakeField, parseBusinessConfig, type BusinessConfig, type ClosedDay } from "@/lib/business-rules/config";
import { activateConfig } from "@/lib/db/config";
import { officeBusinesses, type OfficeBusiness } from "@/lib/db/dashboard";
import type { Queryable } from "@/lib/db/migrate";
import { normalizeUsPhone } from "@/lib/telephony/phone";

/**
 * Everything Amy can change without a developer. Each section is a pure
 * patch of the business config (plus, for two sections, the tables the phone
 * path reads directly). A save is validated whole by the same schema the
 * phone path uses, stored as a new config version (the old one is kept and
 * can be restored) and audited; the next call uses it. API keys are not
 * here: they live in the server's environment.
 *
 * Never configurable, on purpose (LOCKED_RULES): the AI disclosure, the
 * recording notice, no prices / dates / warranties, and the voicemail floor.
 */

export const SETTINGS_SECTIONS = ["answering", "owner", "hours", "spam", "alerts", "callers", "company"] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

/** Office-wide sections apply to every company Amy answers for; "company" to the one picked. */
export const OFFICE_WIDE: ReadonlySet<SettingsSection> = new Set(["answering", "owner", "hours", "spam", "alerts", "callers"]);

/** Shown on the settings page as "always on". */
export const LOCKED_RULES = [
  "Says it's an AI assistant, not a person, at the start of every call.",
  "Says the call is recorded and transcribed, and stops keeping it if the caller says no.",
  "Never gives a price, a date, a discount, a warranty or an insurance claim.",
  "Only repeats answers you approved (Approvals).",
  "If anything fails, the caller can still leave a voicemail. No call is dropped.",
] as const;

export const US_TIMEZONES = [
  "America/Chicago",
  "America/New_York",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
] as const;

export type SaveResult = { ok: true; changed: number } | { ok: false; errors: string[] };

/** FormData, or URLSearchParams in tests. */
export interface FormLike {
  get(name: string): FormDataEntryValue | null;
  getAll(name: string): FormDataEntryValue[];
}

interface Parsed {
  patch: (config: BusinessConfig) => BusinessConfig;
  errors: string[];
  /** Tables outside the config that the phone path reads directly. */
  effects?: (db: Queryable, targets: OfficeBusiness[], actor: string) => Promise<void>;
}

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const text = (form: FormLike, name: string) => String(form.get(name) ?? "").trim();
const checked = (form: FormLike, name: string) => form.get(name) === "on";
const items = (value: string) =>
  value
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);

function whole(form: FormLike, name: string, label: string, min: number, max: number, errors: string[]): number {
  const raw = text(form, name);
  const n = Number(raw);
  if (!/^\d+$/.test(raw) || n < min || n > max) {
    errors.push(`${label}: enter a whole number from ${min} to ${max}.`);
    return min;
  }
  return n;
}

function boundedText(form: FormLike, name: string, label: string, min: number, max: number, errors: string[]): string {
  const value = text(form, name).replace(/\s+/g, " ");
  if (value.length < min || value.length > max) errors.push(`${label}: ${min}–${max} characters.`);
  return value;
}

function minutes(clock: string): number {
  const [h, m] = clock.split(":").map(Number) as [number, number];
  return h * 60 + m;
}

/** A closing time of 00:00 means midnight at the end of the day (so 00:00–00:00 rings all day). */
const closingMinutes = (clock: string) => minutes(clock) || 24 * 60;

/** "2026-11-26 Thanksgiving" per line; a dash or colon after the date is fine. */
export function parseClosures(value: string, errors: string[]): ClosedDay[] {
  const byDate = new Map<string, ClosedDay>();
  for (const line of value.split("\n").map((l) => l.trim()).filter(Boolean)) {
    const match = /^(\d{4}-\d{2}-\d{2})\s*[-–:]?\s*(.*)$/.exec(line);
    const date = match?.[1];
    const real = date ? new Date(`${date}T12:00:00Z`) : null;
    if (!date || !real || Number.isNaN(real.getTime()) || real.toISOString().slice(0, 10) !== date) {
      errors.push(`Closed days: "${line}" isn't a date like 2026-11-26.`);
      continue;
    }
    byDate.set(date, { date, label: (match?.[2] || "Closed").slice(0, 60) });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

const SECTION_PARSERS: Record<SettingsSection, (form: FormLike) => Parsed> = {
  /** Who picks up first, and whether the assistant may put callers through to Amy. */
  answering(form) {
    const errors: string[] = [];
    const mode = AiMode.safeParse(text(form, "mode"));
    if (!mode.success) errors.push("Who answers: pick one of the options.");
    const maxAttempts = whole(form, "transfer_max_attempts", "Tries to reach you per call", 0, 2, errors);
    const enabled = checked(form, "transfer_enabled");
    const onlyDuringRingHours = checked(form, "transfer_only_in_hours");
    return {
      errors,
      patch: (c) => ({
        ...c,
        ai: { ...c.ai, mode: mode.success ? mode.data : c.ai.mode },
        transfer: { enabled, onlyDuringRingHours, maxAttempts },
      }),
    };
  },

  /** Who the assistant works for and whose phone rings: changes in a minute when someone new takes over. */
  owner(form) {
    const errors: string[] = [];
    const name = boundedText(form, "owner_first_name", "First name", 1, 30, errors);
    if (name && !/^[\p{L}][\p{L} .'-]*$/u.test(name)) errors.push("First name: letters only.");
    const role = text(form, "assistant_role").replace(/\s+/g, " ") || `${name}'s AI assistant`;
    // "AI assistant", never "virtual assistant": the latter can mean a remote human (docs/research/legal-compliance.md §4.8).
    if (!/\bAI\b/.test(role)) errors.push(`How the assistant introduces itself must say it's an AI, e.g. "${name}'s AI assistant".`);
    if (role.length > 60) errors.push("How the assistant introduces itself: 60 characters at most.");
    const phone = normalizeUsPhone(text(form, "ring_phone"));
    if (!phone) errors.push("Phone to ring: enter a US number like (512) 555-0123.");
    const seconds = whole(form, "ring_seconds", "Seconds to ring", 10, 45, errors);
    return {
      errors,
      patch: (c) => ({ ...c, brand: { ...c.brand, ownerFirstName: name, assistantRole: role } }),
      effects: async (db, targets, actor) => {
        const tenants = [...new Set(targets.map((t) => t.tenantId))];
        for (const tenantId of tenants) {
          await db.query(
            `update public.tracking_number set owner_name = $2, owner_ring_e164 = $3, ring_timeout_s = $4
              where tenant_id = $1`,
            [tenantId, name, phone, seconds],
          );
          const first = targets.find((t) => t.tenantId === tenantId)!;
          await db.query("select app.emit($1, $2, 'business', $2, 'settings.owner_changed', $3::jsonb, 'user', $4)", [
            tenantId,
            first.businessId,
            JSON.stringify({ owner_name: name, ring_seconds: seconds }),
            actor,
          ]);
        }
      },
    };
  },

  /** When Amy's phone rings first, and whole days the office is closed. */
  hours(form) {
    const errors: string[] = [];
    const ringHours: BusinessConfig["ringHours"] = [];
    for (let day = 0; day < 7; day += 1) {
      if (!checked(form, `day_${day}`)) continue;
      const open = text(form, `open_${day}`);
      const close = text(form, `close_${day}`);
      if (!CLOCK.test(open) || !CLOCK.test(close)) {
        errors.push(`${DAY_NAMES[day]}: times look like 09:00.`);
        continue;
      }
      if (minutes(open) >= closingMinutes(close)) {
        errors.push(`${DAY_NAMES[day]}: closing time must be after opening time.`);
        continue;
      }
      ringHours.push({ day, open, close });
    }
    const timezone = text(form, "timezone");
    if (!(US_TIMEZONES as readonly string[]).includes(timezone)) errors.push("Time zone: pick one from the list.");
    const closures = parseClosures(String(form.get("closures") ?? ""), errors);
    return { errors, patch: (c) => ({ ...c, ringHours, timezone, closures }) };
  },

  /** Who must press 1 first. Amy's own blocks are made on a lead's page. */
  spam(form) {
    const errors: string[] = [];
    const screening = {
      gateHiddenNumbers: checked(form, "gate_hidden"),
      gateFailedCallerId: checked(form, "gate_failed_caller_id"),
      autoFlagAfter: whole(form, "auto_flag_after", "Spam calls before a number must press 1", 0, 10, errors),
      autoFlagDays: whole(form, "auto_flag_days", "Days a flag lasts", 1, 365, errors),
    };
    return { errors, patch: (c) => ({ ...c, screening }) };
  },

  /** Who gets told about calls, and how. At least one contact, always: no lead may go unseen. */
  alerts(form) {
    const errors: string[] = [];
    const sms: string[] = [];
    for (const raw of items(String(form.get("sms") ?? ""))) {
      const phone = normalizeUsPhone(raw);
      if (phone) sms.push(phone);
      else errors.push(`Text alerts: "${raw}" isn't a US phone number.`);
    }
    const email: string[] = [];
    for (const raw of items(String(form.get("email") ?? ""))) {
      if (z.email().safeParse(raw).success) email.push(raw.toLowerCase());
      else errors.push(`Email alerts: "${raw}" isn't an email address.`);
    }
    const contacts = { sms: [...new Set(sms)], email: [...new Set(email)] };
    if (contacts.sms.length + contacts.email.length === 0 && errors.length === 0) {
      errors.push("Keep at least one phone or email, so every caller reaches someone.");
    }
    if (contacts.sms.length > 5 || contacts.email.length > 5) errors.push("Up to 5 phones and 5 emails.");
    const time = text(form, "daily_summary_time");
    if (!CLOCK.test(time)) errors.push("Daily summary time: like 08:00.");
    const alerts = {
      holdLikelySpam: checked(form, "hold_likely_spam"),
      dailySummary: checked(form, "daily_summary"),
      dailySummaryTime: CLOCK.test(time) ? time : "08:00",
    };
    return {
      errors,
      patch: (c) => ({ ...c, notifications: contacts, alerts }),
      effects: async (db, targets) => {
        const wanted = [...contacts.sms.map((a) => `sms:${a}`), ...contacts.email.map((a) => `email:${a}`)];
        for (const t of targets) {
          await db.query(
            `update public.alert_contact set active = false
              where business_id = $1 and active and not ((channel || ':' || address) = any($2::text[]))`,
            [t.businessId, wanted],
          );
          for (const key of wanted) {
            const [channel, ...rest] = key.split(":");
            await db.query(
              `insert into public.alert_contact (tenant_id, business_id, channel, address) values ($1, $2, $3, $4)
               on conflict (business_id, channel, address) do update set active = true`,
              [t.tenantId, t.businessId, channel, rest.join(":")],
            );
          }
        }
      },
    };
  },

  /** What the assistant says about danger it can't fix, and whether it answers in Spanish. */
  callers(form) {
    const errors: string[] = [];
    const utilityName = boundedText(form, "utility_name", "Electric company", 2, 60, errors);
    const utilityPhone = normalizeUsPhone(text(form, "utility_phone"));
    if (!utilityPhone) errors.push("Electric company's outage line: enter a US number like (512) 322-9100.");
    const spanish = checked(form, "spanish");
    return {
      errors,
      patch: (c) => ({
        ...c,
        safety: { utilityName, utilityPhone: utilityPhone ?? c.safety.utilityPhone },
        ai: { ...c.ai, spanish },
      }),
    };
  },

  /** How the assistant describes one company and what it asks its callers. Facts stay in Approvals. */
  company(form) {
    const errors: string[] = [];
    const spokenName = boundedText(form, "spoken_name", "Company name", 2, 60, errors);
    const description = boundedText(form, "description", "What the company is", 3, 200, errors);
    const callerFocus = boundedText(form, "caller_focus", "What callers usually want", 3, 600, errors);
    const collect = boundedText(form, "collect", "What to ask", 3, 600, errors);
    const aliases = items(text(form, "aliases")).filter((a) => a.length >= 2);
    const signals = items(text(form, "signals")).filter((a) => a.length >= 2);
    const escalateTopics = items(text(form, "escalate_topics"));
    const picked = new Set(form.getAll("intake").map(String));
    const fields = IntakeField.options.filter((f) => picked.has(f));
    if (fields.length === 0) errors.push("Questions: pick at least one.");
    if (fields.length > 12) errors.push("Questions: 12 at most, or calls get long.");
    return {
      errors,
      patch: (c) => {
        // Keep Amy's current order for questions she kept; new ones go last.
        const intake = [...c.intake.filter((f) => picked.has(f)), ...fields.filter((f) => !c.intake.includes(f))];
        return {
          ...c,
          brand: { ...c.brand, spokenName },
          profile: { ...c.profile, description, callerFocus, collect, aliases, signals },
          escalateTopics,
          intake,
        };
      },
    };
  },
};

export function isSettingsSection(value: unknown): value is SettingsSection {
  return typeof value === "string" && (SETTINGS_SECTIONS as readonly string[]).includes(value);
}

/**
 * Validates every target's new config before writing any, then activates one
 * new version per company that changed. An unchanged save writes nothing.
 */
export async function saveSettings(
  db: Queryable,
  input: { section: string; businessId?: string | null; form: FormLike; actor: string },
): Promise<SaveResult> {
  if (!isSettingsSection(input.section)) return { ok: false, errors: ["Unknown settings section."] };
  const businesses = await officeBusinesses(db);
  const targets = OFFICE_WIDE.has(input.section)
    ? businesses
    : businesses.filter((b) => b.businessId === input.businessId && b.kind === "company");
  if (targets.length === 0) return { ok: false, errors: [businesses.length ? "Pick a company first." : "No business is set up yet."] };

  const parsed = SECTION_PARSERS[input.section](input.form);
  if (parsed.errors.length) return { ok: false, errors: parsed.errors };

  const changes: Array<{ target: OfficeBusiness; config: BusinessConfig }> = [];
  for (const target of targets) {
    const current = parseBusinessConfig(target.config);
    let next: BusinessConfig;
    try {
      next = parseBusinessConfig(parsed.patch(current));
    } catch (error) {
      return { ok: false, errors: [(error as Error).message] };
    }
    if (JSON.stringify(next) !== JSON.stringify(current)) changes.push({ target, config: next });
  }
  for (const { target, config } of changes) {
    await activateConfig(db, { tenantId: target.tenantId, businessId: target.businessId, config, createdBy: input.actor });
  }
  await parsed.effects?.(db, targets, input.actor);
  return { ok: true, changed: changes.length };
}

/** What each part of the config is called on the settings page. */
const SECTION_OF: Array<[label: string, paths: string[]]> = [
  ["Who answers", ["ai.mode", "transfer"]],
  ["Owner & ring phone", ["brand.ownerFirstName", "brand.assistantRole"]],
  ["Hours & closed days", ["ringHours", "timezone", "closures"]],
  ["Spam screening", ["screening"]],
  ["Alerts", ["alerts", "notifications"]],
  ["Safety & languages", ["safety", "ai.spanish"]],
  ["Company details", ["brand.spokenName", "profile", "intake", "escalateTopics"]],
  ["Approved answers", ["facts", "serviceArea", "services"]],
  ["Assistant setup", ["ai.agentId", "ai.voice", "ai.recording", "ai.maxConcurrentSessions", "configVersion"]],
];

function at(config: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((v, k) => (v && typeof v === "object" ? (v as Record<string, unknown>)[k] : undefined), config);
}

/** Which settings sections differ between two configs, in page order. */
export function changedSections(before: unknown, after: unknown): string[] {
  return SECTION_OF.filter(([, paths]) => paths.some((p) => JSON.stringify(at(before, p)) !== JSON.stringify(at(after, p)))).map(
    ([label]) => label,
  );
}

export interface ConfigVersion {
  version: number;
  active: boolean;
  createdBy: string | null;
  createdAt: Date;
  /** Sections changed from the version before; empty for the first. */
  changes: string[];
}

/** A company's saved versions, newest first, each with what it changed. */
export async function configHistory(db: Queryable, businessId: string, limit = 15): Promise<ConfigVersion[]> {
  const { rows } = await db.query<{ version: number; active: boolean; created_by: string | null; created_at: Date; config: unknown }>(
    `select version, active, created_by, created_at, config from public.business_config
      where business_id = $1 order by version desc limit $2`,
    [businessId, limit + 1],
  );
  return rows.slice(0, limit).map((row, i) => ({
    version: row.version,
    active: row.active,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at),
    changes: rows[i + 1] ? changedSections(rows[i + 1]!.config, row.config) : [],
  }));
}

/**
 * Puts an earlier version's settings back as a new version (history is never
 * rewritten). Approved answers and the assistant's setup stay as they are
 * now: restoring last week's hours must not un-approve this week's facts.
 */
export async function restoreConfigVersion(
  db: Queryable,
  input: { businessId: string; version: number; actor: string },
): Promise<SaveResult> {
  const { rows } = await db.query<{ tenant_id: string; config: unknown; active: boolean }>(
    "select tenant_id, config, active from public.business_config where business_id = $1 and version = $2",
    [input.businessId, input.version],
  );
  const old = rows[0];
  if (!old) return { ok: false, errors: ["That version doesn't exist."] };
  if (old.active) return { ok: true, changed: 0 };
  const current = (await officeBusinesses(db)).find((b) => b.businessId === input.businessId);
  if (!current) return { ok: false, errors: ["Unknown company."] };
  const now = parseBusinessConfig(current.config);
  let restored: BusinessConfig;
  try {
    const then = parseBusinessConfig(old.config);
    restored = parseBusinessConfig({
      ...then,
      configVersion: now.configVersion,
      facts: now.facts,
      serviceArea: now.serviceArea,
      services: now.services,
      ai: { ...then.ai, agentId: now.ai.agentId, voice: now.ai.voice, recording: now.ai.recording, maxConcurrentSessions: now.ai.maxConcurrentSessions },
    });
  } catch (error) {
    return { ok: false, errors: [`That version can't be restored: ${(error as Error).message}`] };
  }
  if (JSON.stringify(restored) === JSON.stringify(now)) return { ok: true, changed: 0 };
  await activateConfig(db, { tenantId: old.tenant_id, businessId: input.businessId, config: restored, createdBy: `${input.actor} (restored v${input.version})` });
  return { ok: true, changed: 1 };
}

export interface OfficeLines {
  ownerName: string;
  ringPhone: string;
  ringSeconds: number;
  /** The Twilio numbers callers dial. */
  numbers: string[];
}

/** Whose phone the office's numbers ring, and for how long (the first line's values; a save sets them all). */
export async function officeLines(db: Queryable, tenantId: string): Promise<OfficeLines | null> {
  const { rows } = await db.query<{ owner_name: string; owner_ring_e164: string; ring_timeout_s: number; e164: string }>(
    "select owner_name, owner_ring_e164, ring_timeout_s, e164 from public.tracking_number where tenant_id = $1 order by e164",
    [tenantId],
  );
  const first = rows[0];
  if (!first) return null;
  return { ownerName: first.owner_name, ringPhone: first.owner_ring_e164, ringSeconds: first.ring_timeout_s, numbers: rows.map((r) => r.e164) };
}

/** Active alert contacts of one business, as the alerts form shows them. */
export async function alertContacts(db: Queryable, businessId: string): Promise<{ sms: string[]; email: string[] }> {
  const { rows } = await db.query<{ channel: "sms" | "email"; address: string }>(
    "select channel, address from public.alert_contact where business_id = $1 and active order by address",
    [businessId],
  );
  return { sms: rows.filter((r) => r.channel === "sms").map((r) => r.address), email: rows.filter((r) => r.channel === "email").map((r) => r.address) };
}

export interface BlockedRow {
  e164: string;
  kind: "manual" | "auto";
  reason: string | null;
  blockedUntil: Date | null;
  hits: number;
}

/** Numbers currently blocked (Amy's) or flagged (the assistant's), newest first. */
export async function activeBlocks(db: Queryable, tenantId: string, limit = 50): Promise<BlockedRow[]> {
  const { rows } = await db.query<{ e164: string; kind: "manual" | "auto"; reason: string | null; blocked_until: Date | null; hits: number }>(
    `select e164, kind, reason, blocked_until, hits from public.blocked_number
      where tenant_id = $1 and (blocked_until is null or blocked_until > now())
      order by created_at desc limit $2`,
    [tenantId, limit],
  );
  return rows.map((r) => ({ e164: r.e164, kind: r.kind, reason: r.reason, blockedUntil: r.blocked_until ? new Date(r.blocked_until) : null, hits: r.hits }));
}
