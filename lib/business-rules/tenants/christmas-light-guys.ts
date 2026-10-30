import { DEFAULT_ALERTS, DEFAULT_SAFETY, DEFAULT_SCREENING, type ApprovedFact, type BusinessConfig, type Service } from "../config";

/**
 * Tenant #1: The Christmas Light Guys (Austin, TX).
 *
 * What the business says about itself does NOT live here: it lives in the
 * knowledge items (lib/knowledge/tenants/christmas-light-guys.ts), and
 * `facts` and `serviceArea` below are regenerated from Amy's decisions on
 * them (lib/db/knowledge.ts, syncConfigFromKnowledge). This file holds only
 * operational settings, every one a proposal for Amy's interview.
 */

/** Intent hints for routing what a caller asks about; never spoken as offers. */
export const CLG_SERVICES: Service[] = [
  { id: "roofline", label: "roofline and front-of-house Christmas lights", synonyms: ["roof", "roofline", "gutters", "eaves", "fascia", "front of the house"], status: "draft" },
  { id: "trees", label: "tree trunk and canopy lighting", synonyms: ["trees", "tree wrap", "trunks", "canopy"], status: "draft" },
  { id: "greenery", label: "wreaths and garland", synonyms: ["wreath", "garland", "greenery"], status: "draft" },
  { id: "trims", label: "door and window trims", synonyms: ["door", "windows", "trim"], status: "draft" },
  { id: "hedges_walkways", label: "hedge and walkway lighting", synonyms: ["bushes", "hedges", "shrubs", "walkway", "pathway", "driveway"], status: "draft" },
  { id: "takedown_storage", label: "takedown after the season and storage", synonyms: ["take down", "takedown", "removal", "storage"], status: "draft" },
  { id: "commercial", label: "commercial holiday lighting", synonyms: ["business", "storefront", "office", "commercial", "HOA", "entrance"], status: "draft" },
  { id: "permanent", label: "permanent LED lighting", synonyms: ["permanent", "year round"], status: "draft" },
];

/** Operational settings a seed or an admin may override; the same for every company. */
export interface ConfigOverrides {
  ownerFirstName?: string;
  callbackBy?: string;
  agentId?: string;
  aiMode?: BusinessConfig["ai"]["mode"];
  voice?: BusinessConfig["ai"]["voice"];
  ringHours?: BusinessConfig["ringHours"];
  callbackHours?: BusinessConfig["callbackHours"];
  closures?: BusinessConfig["closures"];
  screening?: BusinessConfig["screening"];
  alerts?: BusinessConfig["alerts"];
  safety?: BusinessConfig["safety"];
  spanish?: boolean;
  maxConcurrentSessions?: number;
  notifications?: BusinessConfig["notifications"];
  facts?: ApprovedFact[];
  serviceArea?: BusinessConfig["serviceArea"];
}

export const CLG_CONFIG_VERSION = "clg-2026.10.29-2";

/** Amy's own goodbye (2026-10-29), word for word. */
export const CLG_GOODBYE =
  "Thanks for calling The Christmas Light Guys, we are looking forward to making your home bright for the holidays!";

export const CLG_CALLBACK_HOURS: NonNullable<BusinessConfig["callbackHours"]> = [1, 2, 3, 4, 5].map((day) => ({
  day,
  open: "09:00",
  close: "17:00",
}));

function clgCollect(callback: string): string {
  return `What they're calling about, in a few words; their name; the property address with the city; whether the home is clearly visible on Google Maps; the best time for ${callback} to call back; and confirm the best number. Anything else (home size, the lights they want, timing, home or business) only if they volunteer it.`;
}

/**
 * Brings an office seeded by an earlier release up to this one. Only values
 * still at what that release seeded change, and fields it didn't have are
 * added; anything Amy changed in Settings stays hers. Returns the config
 * unchanged when there is nothing to do.
 */
export function upgradeChristmasLightGuysConfig(stored: BusinessConfig): BusinessConfig {
  const release = christmasLightGuysConfig();
  // clg-2026.10.29-1 named Josh as the one who calls back.
  const callbackBy = stored.brand.callbackBy === "Josh" ? release.brand.callbackBy : stored.brand.callbackBy;
  const next: BusinessConfig = {
    ...stored,
    configVersion: release.configVersion,
    brand: { ...stored.brand, callbackBy, goodbye: stored.brand.goodbye ?? release.brand.goodbye },
    profile: stored.profile.collect === clgCollect("Josh") ? { ...stored.profile, collect: release.profile.collect } : stored.profile,
    callbackHours: stored.callbackHours ?? release.callbackHours,
  };
  return JSON.stringify(next) === JSON.stringify({ ...stored, configVersion: release.configVersion }) ? stored : next;
}

/** Pilot defaults. The AI starts in after-hours-only mode (release ladder stage 3). */
export function christmasLightGuysConfig(overrides: ConfigOverrides = {}): BusinessConfig {
  const owner = overrides.ownerFirstName ?? "Amy";
  // Amy calls leads back herself, and callers hear "someone from our team" so it
  // isn't her job forever (Amy, 2026-10-29). Pricing happens on that callback.
  const callback = overrides.callbackBy ?? "our team";
  return {
    configVersion: CLG_CONFIG_VERSION,
    brand: {
      spokenName: "The Christmas Light Guys",
      ownerFirstName: owner,
      callbackBy: callback,
      // The company's assistant, never Amy's (Amy, 2026-10-29). "AI assistant", not
      // "virtual assistant": the latter can mean a remote human (docs/research/legal-compliance.md §4.8).
      assistantRole: "The Christmas Light Guys' AI assistant",
      goodbye: CLG_GOODBYE,
    },
    profile: {
      description: "a lighting company in Austin, Texas",
      callerFocus:
        "Callers are almost always asking about Christmas and holiday lighting. Start there; don't list other services unless asked.",
      // Short on purpose: the callback goes through the options (Amy, 2026-10-29).
      collect: clgCollect(callback),
      fieldLabels: {},
      aliases: ["Christmas Light Guys", "Light Guys", "Christmas guys"],
      signals: ["Christmas", "holiday", "roofline", "lights on the house", "light up", "takedown", "take down", "wreath", "garland", "permanent lighting", "landscape lighting"],
    },
    timezone: "America/Chicago",
    // Mon–Sat 9 AM–6 PM: confirmed by Amy, 2026-10-22. Evenings and Sundays the assistant answers.
    ringHours: overrides.ringHours ?? [1, 2, 3, 4, 5, 6].map((day) => ({ day, open: "09:00", close: "18:00" })),
    // Callbacks go out on weekdays, 9 to 5, with no Saturdays even in the rush (Amy, 2026-10-29).
    callbackHours: overrides.callbackHours ?? CLG_CALLBACK_HOURS,
    // Holidays and days off are Amy's to set (Settings); none are assumed.
    closures: overrides.closures ?? [],
    screening: overrides.screening ?? DEFAULT_SCREENING,
    alerts: overrides.alerts ?? DEFAULT_ALERTS,
    safety: overrides.safety ?? DEFAULT_SAFETY,
    ai: {
      mode: overrides.aiMode ?? "after_hours_only",
      maxConcurrentSessions: overrides.maxConcurrentSessions ?? 8,
      recording: "disclosed",
      voice: overrides.voice ?? "stock",
      spanish: overrides.spanish ?? false,
      ...(overrides.agentId ? { agentId: overrides.agentId } : {}),
    },
    transfer: { enabled: true, onlyDuringRingHours: true, maxAttempts: 1 },
    // Projected from the approved service-area knowledge item; empty and draft until Amy decides.
    serviceArea: overrides.serviceArea ?? { status: "draft", zips: [], cities: [] },
    services: CLG_SERVICES,
    // Amy's core questions (2026-10-29). The number is confirmed by the prompt, not asked as a field.
    intake: ["service_requested", "caller_name", "property_address", "maps_visible", "callback_window"],
    // Projected from approved knowledge items; empty until Amy approves any.
    facts: overrides.facts ?? [],
    escalateTopics: [
      "price",
      "discount",
      "availability",
      "warranty",
      "insurance",
      "damage",
      "complaint",
      "existing job status",
      "payment",
    ],
    notifications: overrides.notifications ?? { sms: [], email: [] },
  };
}
