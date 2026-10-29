import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { parseBusinessConfig, type AiMode, type BusinessConfig } from "@/lib/business-rules/config";
import { isRingHours, routeAfterOwner, routeInbound, routeOwnerBusy, transferAllowed } from "@/lib/business-rules/routing";

function config(mode: AiMode, overrides: Partial<BusinessConfig["ai"]> = {}): BusinessConfig {
  return parseBusinessConfig({
    configVersion: "test-1",
    brand: {
      spokenName: "The Christmas Light Guys",
      ownerFirstName: "Amy",
      assistantRole: "Amy's AI assistant",
    },
    profile: { description: "a lighting company", callerFocus: "Lights.", collect: "Name and address." },
    timezone: "America/Chicago",
    // Mon–Sat 9:00–18:00
    ringHours: [1, 2, 3, 4, 5, 6].map((day) => ({ day, open: "09:00", close: "18:00" })),
    closures: [],
    screening: { gateHiddenNumbers: true, gateFailedCallerId: true, autoFlagAfter: 2, autoFlagDays: 30 },
    alerts: { holdLikelySpam: true, dailySummary: true, dailySummaryTime: "08:00" },
    ai: { mode, maxConcurrentSessions: 2, recording: "disclosed", agentId: "agent_test", ...overrides },
    transfer: { enabled: true, onlyDuringRingHours: true, maxAttempts: 1 },
    serviceArea: { status: "draft", zips: [], cities: [] },
    services: [],
    intake: ["caller_name", "property_address"],
    facts: [],
    escalateTopics: ["price"],
    notifications: { sms: [], email: [] },
  });
}

const WEDNESDAY_NOON = new Date("2026-10-21T17:00:00Z"); // 12:00 in Austin
const WEDNESDAY_NIGHT = new Date("2026-10-22T03:00:00Z"); // 22:00 in Austin
const SUNDAY_NOON = new Date("2026-10-25T17:00:00Z");
const ROOM = { activeSessions: 0, vendorHealthy: true };

describe("ring hours", () => {
  it("follows the weekly schedule in the business's own time zone", () => {
    const c = config("overflow");
    expect(isRingHours(c, WEDNESDAY_NOON)).toBe(true);
    expect(isRingHours(c, WEDNESDAY_NIGHT)).toBe(false);
    expect(isRingHours(c, SUNDAY_NOON)).toBe(false);
  });
});

describe("routing", () => {
  it("kill switch: mode off never reaches the agent, whatever the hour or capacity", () => {
    const c = config("off");
    expect(routeInbound(c, WEDNESDAY_NOON, ROOM)).toEqual({ kind: "ring_owner" });
    expect(routeInbound(c, WEDNESDAY_NIGHT, ROOM)).toEqual({ kind: "capture", reason: "ai_off" });
    expect(routeAfterOwner(c, ROOM)).toEqual({ kind: "capture", reason: "ai_off" });
  });

  it("Amy always gets the first ring during her hours unless the line is AI-first", () => {
    for (const mode of ["after_hours_only", "overflow"] as const) {
      expect(routeInbound(config(mode), WEDNESDAY_NOON, ROOM)).toEqual({ kind: "ring_owner" });
    }
  });

  it("overflow hands an unanswered call to the agent; after_hours_only does not", () => {
    expect(routeAfterOwner(config("overflow"), ROOM)).toEqual({ kind: "agent", reason: "owner_unavailable" });
    expect(routeAfterOwner(config("after_hours_only"), ROOM)).toEqual({ kind: "capture", reason: "ai_off" });
  });

  it("Amy already on a call: the assistant takes the next one only where it may take her missed calls", () => {
    expect(routeOwnerBusy(config("overflow"), ROOM)).toEqual({ kind: "agent", reason: "owner_busy" });
    expect(routeOwnerBusy(config("always"), ROOM)).toEqual({ kind: "agent", reason: "owner_busy" });
    // No assistant for missed calls, or none free: her phone rings (call waiting) as before.
    expect(routeOwnerBusy(config("after_hours_only"), ROOM)).toEqual({ kind: "ring_owner" });
    expect(routeOwnerBusy(config("off"), ROOM)).toEqual({ kind: "ring_owner" });
    expect(routeOwnerBusy(config("overflow"), { activeSessions: 2, vendorHealthy: true })).toEqual({ kind: "ring_owner" });
    expect(routeOwnerBusy(config("overflow"), { activeSessions: 0, vendorHealthy: false })).toEqual({ kind: "ring_owner" });
  });

  it("a full AI tier degrades to capture instead of failing the call", () => {
    const busy = { activeSessions: 2, vendorHealthy: true };
    expect(routeInbound(config("overflow"), WEDNESDAY_NIGHT, busy)).toEqual({ kind: "capture", reason: "ai_at_capacity" });
    expect(routeAfterOwner(config("overflow"), busy)).toEqual({ kind: "capture", reason: "ai_at_capacity" });
  });

  it("an unhealthy vendor or a missing agent id degrades to capture", () => {
    expect(routeAfterOwner(config("overflow"), { activeSessions: 0, vendorHealthy: false })).toEqual({
      kind: "capture",
      reason: "ai_unavailable",
    });
    expect(routeAfterOwner(config("overflow", { agentId: undefined }), ROOM)).toEqual({
      kind: "capture",
      reason: "ai_not_configured",
    });
  });

  it("AI-first lines still ring Amy in hours when the agent cannot take the call", () => {
    const busy = { activeSessions: 9, vendorHealthy: true };
    expect(routeInbound(config("always"), WEDNESDAY_NOON, ROOM)).toEqual({ kind: "agent", reason: "ai_first" });
    expect(routeInbound(config("always"), WEDNESDAY_NOON, busy)).toEqual({ kind: "ring_owner" });
  });

  it("property: every route ends at Amy, the agent, or capture — and the agent only within capacity", () => {
    const modes = ["off", "after_hours_only", "overflow", "always"] as const;
    fc.assert(
      fc.property(
        fc.constantFrom(...modes),
        fc.integer({ min: 0, max: 6 }),
        fc.boolean(),
        fc.date({ min: new Date("2026-01-01T00:00:00Z"), max: new Date("2027-01-01T00:00:00Z"), noInvalidDate: true }),
        (mode, active, healthy, now) => {
          const c = config(mode);
          const capacity = { activeSessions: active, vendorHealthy: healthy };
          for (const route of [routeInbound(c, now, capacity), routeAfterOwner(c, capacity)]) {
            expect(["ring_owner", "agent", "capture"]).toContain(route.kind);
            if (route.kind === "agent") {
              expect(mode).not.toBe("off");
              expect(healthy).toBe(true);
              expect(active).toBeLessThan(c.ai.maxConcurrentSessions);
            }
          }
        },
      ),
    );
  });
});

describe("transfer policy", () => {
  it("offers a live transfer only in ring hours and only up to the attempt limit", () => {
    const c = config("overflow");
    expect(transferAllowed(c, WEDNESDAY_NOON, 0)).toBe(true);
    expect(transferAllowed(c, WEDNESDAY_NOON, 1)).toBe(false);
    expect(transferAllowed(c, WEDNESDAY_NIGHT, 0)).toBe(false);
  });
});
