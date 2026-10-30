import { z } from "zod";

/**
 * Tenant configuration as data. A new tenant (plumber, electrician, …) is a
 * new row of this shape, not a copy of the code. Everything the phone agent
 * may say or do is derived from it; nothing about a business is hard-coded
 * in prompts or handlers.
 */

const E164 = z.string().regex(/^\+[1-9]\d{7,14}$/, "E.164 phone number");
const CLOCK = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:MM");
const ZIP = z.string().regex(/^\d{5}$/, "5-digit ZIP");

/**
 * How much of the call the AI may take. This is also the kill switch:
 * setting it to "off" sends every call down the deterministic capture path.
 *  - off: never AI. Amy first in hours, recorded message otherwise.
 *  - after_hours_only: Amy in hours; AI outside the ring window.
 *  - overflow: Amy first in hours; AI whenever she does not bridge, and after hours.
 *  - always: AI answers first (direct-AI number). Not used in the pilot.
 */
export const AiMode = z.enum(["off", "after_hours_only", "overflow", "always"]);
export type AiMode = z.infer<typeof AiMode>;

/** Recording of the AI portion: off, or on with a spoken notice at the start. */
export const RecordingMode = z.enum(["off", "disclosed"]);
export type RecordingMode = z.infer<typeof RecordingMode>;

/** A fact moves to production truth only after Amy approves it. */
export const FactStatus = z.enum(["draft", "approved", "rejected"]);

export const ApprovedFact = z.object({
  id: z.string().min(1),
  /** What the agent may say, in one or two short sentences. */
  text: z.string().min(1).max(400),
  /** Topics the fact answers, e.g. ["estimate", "process"]. */
  topics: z.array(z.string().min(1)).min(1),
  status: FactStatus,
  sourceUrl: z.string().url().optional(),
  approvedBy: z.string().optional(),
  approvedAt: z.string().optional(),
});
export type ApprovedFact = z.infer<typeof ApprovedFact>;

export const Service = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  /** Words callers use for it; drives intent hints, never pricing. */
  synonyms: z.array(z.string()).default([]),
  /** Only approved services may be described as offered. */
  status: FactStatus,
});
export type Service = z.infer<typeof Service>;

export const IntakeField = z.enum([
  "caller_name",
  "customer_type", // new vs returning
  "property_type", // residential vs commercial
  "property_address",
  "zip",
  "service_requested",
  "job_type", // new installation / existing installation / repair / takedown
  "desired_timing",
  "callback_window",
  "lead_source",
  "notes",
  "caller_email",
  "home_size", // approximate square footage of the home
  "outdoor_plugs", // yes / no / not sure
  "site_visit_window", // when a site visit would work, if one is needed
  "maps_visible", // yes / no / unsure: is the home clearly visible on Google Maps
]);
export type IntakeField = z.infer<typeof IntakeField>;

/**
 * What makes the agent sound like it works for this company rather than a
 * generic one: how it describes the business, where calls usually start and
 * what to ask, in plain words. Facts about the business never go here; they
 * come only from Amy's approved knowledge items.
 */
export const BusinessProfile = z.object({
  /** One phrase, e.g. "a holiday lighting company in Austin, Texas". */
  description: z.string().min(1).max(200),
  /** Where calls usually start, and what not to offer unasked. */
  callerFocus: z.string().min(1).max(600),
  /** What to collect, in plain words and in the preferred order. */
  collect: z.string().min(1).max(600),
  /** Labels Amy sees where the generic field name doesn't fit (e.g. "Location address"). */
  fieldLabels: z.partialRecord(IntakeField, z.string().min(1).max(40)).default({}),
  /**
   * Other NAMES callers use for the company ("Light Guys", "Fridge Vending"). Never
   * service words: names are blanked before claims are scanned, service words are not.
   */
  aliases: z.array(z.string().min(2)).default([]),
  /**
   * Words that point to this company on a shared line ("pergola", "vending").
   * A word two companies share ("landscape lighting") makes the agent ask.
   */
  signals: z.array(z.string().min(2)).default([]),
});
export type BusinessProfile = z.infer<typeof BusinessProfile>;

export const WeeklyHours = z.object({
  /** 0 = Sunday … 6 = Saturday. */
  day: z.number().int().min(0).max(6),
  open: CLOCK,
  close: CLOCK,
});

const ISO_DATE = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, "YYYY-MM-DD");

/**
 * A day the office is closed (Thanksgiving, Christmas Day, a crew day off).
 * Amy's phone doesn't ring that day and the assistant says the office is
 * closed, so nobody waits for a ring that never comes.
 */
export const ClosedDay = z.object({
  date: ISO_DATE,
  label: z.string().min(1).max(60),
});
export type ClosedDay = z.infer<typeof ClosedDay>;

/**
 * Who must press 1 or say "yes" before reaching anyone
 * (lib/telephony/screening.ts; docs/research/spam-screening.md).
 */
export const ScreeningSettings = z.object({
  /** Hidden or "anonymous" numbers. */
  gateHiddenNumbers: z.boolean(),
  /** Numbers whose carrier caller-ID check (STIR/SHAKEN) failed. */
  gateFailedCallerId: z.boolean(),
  /** Calls the assistant judged spam (within 90 days) before the number must press 1. 0 = never. */
  autoFlagAfter: z.number().int().min(0).max(10),
  /** How long that flag lasts, in days. */
  autoFlagDays: z.number().int().min(1).max(365),
});
export type ScreeningSettings = z.infer<typeof ScreeningSettings>;
export const DEFAULT_SCREENING: ScreeningSettings = {
  gateHiddenNumbers: true,
  gateFailedCallerId: true,
  autoFlagAfter: 2,
  autoFlagDays: 30,
};

/** How Amy hears about calls (workflows/post-call/runner.ts, digest.ts). */
export const AlertSettings = z.object({
  /**
   * Calls that looked like spam AND left nothing a customer would say wait
   * for the daily summary instead of texting. false = every call texts.
   */
  holdLikelySpam: z.boolean(),
  /** One text a day counting the held calls, with a link to the list. */
  dailySummary: z.boolean(),
  /** When it goes out, in the business's time zone. */
  dailySummaryTime: CLOCK,
});
export type AlertSettings = z.infer<typeof AlertSettings>;
export const DEFAULT_ALERTS: AlertSettings = { holdLikelySpam: true, dailySummary: true, dailySummaryTime: "08:00" };

/**
 * What the assistant says about danger it can't fix: a downed power line goes
 * to the electric company (docs/research/voice-agent-edge-cases.md C2). Austin
 * Energy's line is the default; suburbs are served by other utilities.
 */
export const SafetySettings = z.object({
  utilityName: z.string().min(2).max(60),
  utilityPhone: E164,
});
export type SafetySettings = z.infer<typeof SafetySettings>;
export const DEFAULT_SAFETY: SafetySettings = { utilityName: "Austin Energy", utilityPhone: "+15123229100" };

/** Configs saved before 2026-10-29 named whoever calls back `callbackFirstName`. */
function renameLegacyCallbackField(brand: unknown): unknown {
  if (!brand || typeof brand !== "object" || !("callbackFirstName" in brand)) return brand;
  const { callbackFirstName, ...rest } = brand as Record<string, unknown>;
  return { callbackBy: callbackFirstName, ...rest };
}

export const BusinessConfig = z.object({
  configVersion: z.string().min(1),
  brand: z.preprocess(
    renameLegacyCallbackField,
    z.object({
      /** Spoken name, e.g. "The Christmas Light Guys". */
      spokenName: z.string().min(1),
      /** The person callers want, e.g. "Amy". The agent never claims to be them. */
      ownerFirstName: z.string().min(1),
      /**
       * How the assistant names whoever calls sales leads back: a first name
       * ("Josh") or a team ("our team"). Absent: the owner. The agent never
       * claims to be them either.
       */
      callbackBy: z.string().min(1).max(40).optional(),
      /** How the agent describes itself, e.g. "Amy's AI assistant". */
      assistantRole: z.string().min(1),
      /** The owner's own goodbye, said word for word. Absent: a plain one that fits the time of day. */
      goodbye: z.string().min(1).max(200).optional(),
    }),
  ),
  profile: BusinessProfile,
  timezone: z.string().min(1),
  /**
   * When Amy's phone rings first. Outside these hours the AI (or capture)
   * answers. Which phone rings, and for how long, is set per tracking number.
   */
  ringHours: z.array(WeeklyHours),
  /**
   * When leads get called back. The assistant asks for a time inside these
   * hours and steers a caller who picks a weekend or an evening to the next
   * one. Absent: any time the caller likes.
   */
  callbackHours: z.array(WeeklyHours).optional(),
  /** Whole days closed; they override ringHours. Older configs have none. */
  closures: z.array(ClosedDay).max(60).default([]),
  screening: ScreeningSettings.default(DEFAULT_SCREENING),
  alerts: AlertSettings.default(DEFAULT_ALERTS),
  safety: SafetySettings.default(DEFAULT_SAFETY),
  ai: z.object({
    mode: AiMode,
    /** Our own admission limit, at or below the vendor plan's concurrency. */
    maxConcurrentSessions: z.number().int().min(0).max(500),
    recording: RecordingMode,
    /** Vendor agent id (e.g. ElevenLabs agent_id). Absent → AI unavailable. */
    agentId: z.string().min(1).optional(),
    /**
     * "owner_clone" when the agent speaks in Amy's own cloned voice (with her
     * written consent). The greeting then says so, so no caller mistakes it for Amy.
     */
    voice: z.enum(["stock", "owner_clone"]).default("stock"),
    /**
     * Spanish-speaking callers are answered in Spanish (language detection +
     * a multilingual voice). Off until a native speaker has checked the
     * Spanish greeting; applies when the assistant is re-published.
     */
    spanish: z.boolean().default(false),
  }),
  transfer: z.object({
    enabled: z.boolean(),
    /** Only offer a live transfer while Amy's ring hours are open. */
    onlyDuringRingHours: z.boolean(),
    /** Live transfer attempts per call before falling back to a callback. */
    maxAttempts: z.number().int().min(0).max(2),
  }),
  serviceArea: z.object({
    /** draft until Amy confirms; a draft area is never stated as served. */
    status: FactStatus,
    zips: z.array(ZIP),
    cities: z.array(z.string().min(1)),
  }),
  services: z.array(Service),
  /** Questions in the order the agent prefers; it skips any already answered. */
  intake: z.array(IntakeField).min(1).max(12),
  facts: z.array(ApprovedFact),
  /** Topics the agent must hand to Amy, whatever the caller says. */
  escalateTopics: z.array(z.string().min(1)),
  notifications: z.object({
    sms: z.array(E164),
    email: z.array(z.string().email()),
  }),
});
export type BusinessConfig = z.infer<typeof BusinessConfig>;

/** Parses untrusted config (database row, admin form) or throws with every problem listed. */
export function parseBusinessConfig(input: unknown): BusinessConfig {
  const result = BusinessConfig.safeParse(input);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
    throw new Error(`Invalid business config:\n- ${problems.join("\n- ")}`);
  }
  return result.data;
}

/** Who calls a sales lead back, as the assistant says it: the configured person or team, else the owner. */
export function callbackName(config: BusinessConfig): string {
  return config.brand.callbackBy ?? config.brand.ownerFirstName;
}

/**
 * Who actually dials a lead back: the callback person, or the owner when
 * callers are told "our team" (Amy calls everyone back, 2026-10-29).
 */
export function callbackCaller(config: BusinessConfig): string {
  const by = config.brand.callbackBy;
  return by && !/^(our|the|someone)\b/i.test(by) ? by : config.brand.ownerFirstName;
}

/** Facts the agent may state. Drafts and rejected facts never leave this function. */
export function approvedFacts(config: BusinessConfig): ApprovedFact[] {
  return config.facts.filter((f) => f.status === "approved");
}

export function approvedServices(config: BusinessConfig): Service[] {
  return config.services.filter((s) => s.status === "approved");
}
