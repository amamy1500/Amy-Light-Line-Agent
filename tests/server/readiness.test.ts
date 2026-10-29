import { describe, expect, it } from "vitest";
import { isPlaceholderNumber, readinessChecks, type ReadinessInput } from "@/lib/server/readiness";

const SECRET = "sk_live_should_never_show_1234567890";

const READY: ReadinessInput = {
  env: {
    publicBaseUrl: "https://lightline.example.com",
    twilioAccountSid: "AC00000000000000000000000000000000",
    twilioAuthToken: SECRET,
    twilioAlertFrom: "+17373398333",
    databaseUrl: "postgres://db.example.com/lightline",
    operatorToken: SECRET,
    alertMode: "live",
    resendApiKey: SECRET,
    alertEmailFrom: "alerts@example.com",
    agentProvider: "elevenlabs",
    elevenLabsApiKey: SECRET,
    elevenLabsWebhookSecret: SECRET,
    agentToolSecret: SECRET,
    cronSecret: SECRET,
  },
  twilioFallbackUrl: "https://handler.twilio.com/twiml/EH00",
  lines: [{ e164: "+17373398333", ownerRingE164: "+15122527200", ringOwner: true }],
  aiMode: "overflow",
  agentId: "agent_123",
  alertContacts: { sms: ["+15122527200"], email: ["amy@example.com"] },
};

const state = (input: ReadinessInput, id: string) => readinessChecks(input).find((c) => c.id === id)!;

describe("ready for real callers", () => {
  it("a fully set-up office is ready on every check", () => {
    const checks = readinessChecks(READY);
    expect(checks.filter((c) => c.state !== "ok").map((c) => c.id)).toEqual([]);
    expect(state(READY, "line").detail).toContain("(737) 339-8333");
  });

  it("never shows a secret, only whether it is set", () => {
    const text = JSON.stringify(readinessChecks(READY));
    expect(text).not.toContain(SECRET);
  });

  it("flags a localhost address: Twilio can't reach this computer", () => {
    expect(state({ ...READY, env: { ...READY.env, publicBaseUrl: "http://localhost:3000" } }, "public_url").state).toBe("warn");
  });

  it("test (555) numbers are not a real line, and a 555 ring phone rings nobody", () => {
    expect(isPlaceholderNumber("+15125550101")).toBe(true);
    expect(isPlaceholderNumber("+17373398333")).toBe(false);
    const test = { ...READY, lines: [{ e164: "+15125550101", ownerRingE164: "+15125550199", ringOwner: true }] };
    expect(state(test, "line").state).toBe("missing");
    expect(state(test, "owner_phone").state).toBe("missing");
  });

  it("the assistant: off is a warning, no agent is missing, the simulator is a warning", () => {
    expect(state({ ...READY, aiMode: "off" }, "assistant").state).toBe("warn");
    expect(state({ ...READY, agentId: undefined }, "assistant").state).toBe("missing");
    expect(state({ ...READY, env: { ...READY.env, agentProvider: "simulator" } }, "assistant").state).toBe("warn");
  });

  it("alerts: no inbox is missing; simulate mode says where they would go; texts wait for registration", () => {
    expect(state({ ...READY, alertContacts: { sms: [], email: [] } }, "alerts_email").state).toBe("missing");
    const simulated = state({ ...READY, env: { ...READY.env, alertMode: "simulate" } }, "alerts_email");
    expect(simulated.state).toBe("warn");
    expect(simulated.detail).toContain("amy@example.com");
    expect(state({ ...READY, env: { ...READY.env, twilioAlertFrom: undefined } }, "alerts_sms").state).toBe("warn");
  });

  it("no fallback, embedded database, no cron or console password are warnings, not blockers", () => {
    const bare = {
      ...READY,
      twilioFallbackUrl: undefined,
      env: { ...READY.env, databaseUrl: undefined, cronSecret: undefined, operatorToken: undefined },
    };
    for (const id of ["fallback", "database", "jobs", "console_login"]) expect(state(bare, id).state, id).toBe("warn");
  });
});
