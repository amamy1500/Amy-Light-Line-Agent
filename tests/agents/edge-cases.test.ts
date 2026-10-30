import { beforeAll, describe, expect, it } from "vitest";
import { scanConversation } from "@/lib/agents/compliance";
import { simulatorConnector } from "@/lib/agents/connector";
import { runTool } from "@/lib/agents/gateway";
import { SAFETY_LINE, SPANISH_OPENING } from "@/lib/agents/lines";
import { systemPrompt } from "@/lib/agents/policy";
import { CARD_REDACTED, redactCardNumbers, redactDeep } from "@/lib/agents/redact";
import { spokenPhone, TOOL_NAMES } from "@/lib/agents/tools";
import { christmasLightGuysConfig } from "@/lib/business-rules/tenants/christmas-light-guys";
import { claimPendingAlerts, seedChristmasLightGuys, type PendingAlert, type Queryable } from "@/lib/db";
import { getCallContext } from "@/lib/db/agent";
import { loadActiveConfig } from "@/lib/db/config";
import { openPglite } from "@/lib/db/pglite";
import { asrKeywords, buildAgentRequest, buildToolRequests } from "@/lib/elevenlabs/agent-spec";
import { renderAlert } from "@/lib/server/alerts";
import { handleInbound, type VoiceDeps } from "@/lib/server/voice";
import { saveSettings } from "@/lib/settings/office-settings";

// Edge cases from docs/research/voice-agent-edge-cases.md that live in code
// rather than in the model: what is never stored, what is always said, and
// the platform settings that make a phone line behave.
const OPTIONS = { publicBaseUrl: "https://lightline.example.test", toolSecretId: "sec_1", voiceId: "voice_1", llm: "claude-haiku-5-5" } as const;
const BASE = "https://clg.example.test";
const LINE = "+15125550101";
const NIGHT = new Date("2026-10-21T04:00:00Z");

describe("card numbers are never stored (E10)", () => {
  it("removes card-like numbers that pass the Luhn check, and nothing else", () => {
    expect(redactCardNumbers("my card is 4111 1111 1111 1111, exp 12/29")).toBe(`my card is ${CARD_REDACTED}, exp 12/29`);
    expect(redactCardNumbers("5500-0000-0000-0004")).toBe(CARD_REDACTED);
    expect(redactCardNumbers("378282246310005")).toBe(CARD_REDACTED); // 15-digit Amex
    // Phone numbers, ZIPs, addresses and random digit runs that fail Luhn stay.
    for (const keep of ["call me at 512-555-0123", "ZIP 78745", "4100 Bee Cave Rd", "order 1234567890123"]) {
      expect(redactCardNumbers(keep)).toBe(keep);
    }
  });

  it("works through whole transcripts and tool inputs", () => {
    const turns = [{ role: "user", message: "4111111111111111 is my card" }, { role: "agent", message: "Please don't share card details." }];
    expect(redactDeep(turns)).toEqual([{ role: "user", message: `${CARD_REDACTED} is my card` }, turns[1]]);
    expect(redactDeep({ notes: "4111 1111 1111 1111", n: 3, ok: true, none: null })).toEqual({ notes: CARD_REDACTED, n: 3, ok: true, none: null });
  });
});

describe("what the assistant always says", () => {
  it("the safety and Spanish lines pass the compliance scan (no false alarms)", () => {
    for (const line of [SAFETY_LINE, SPANISH_OPENING, "To report a downed line, call Austin Energy at 512, 322, 9100.", "You can call or text 988 any time, day or night."]) {
      expect(scanConversation([{ role: "agent", text: line }]).violations).toEqual([]);
    }
    expect(spokenPhone("+15123229100")).toBe("512, 322, 9100");
  });

  it("the prompt puts danger first and covers each edge case family", () => {
    const prompt = systemPrompt();
    expect(prompt.indexOf("# Safety comes first")).toBeLessThan(prompt.indexOf("# Sounding like a person"));
    expect(prompt).toContain(SAFETY_LINE);
    for (const must of ["988", "take me off speaker", "Are you still there?", "B as in boy", "payment details", "another customer", "flag_urgent", "grown-up", "We won't contact you again", "Soy un asistente", "{{today}}", "keeps asking", "gate codes", "relay operator", "call the caller only", "recap"]) {
      expect(prompt).toContain(must);
    }
  });

  it("names only tools that exist, and teaches every one of them", () => {
    // A shared-line agent has every tool; a single-company one everything but select_business.
    for (const [prompt, tools] of [
      [systemPrompt({ sharedLine: true }), TOOL_NAMES],
      [systemPrompt(), TOOL_NAMES.filter((n) => n !== "select_business")],
    ] as const) {
      const named = new Set([...prompt.matchAll(/call ([a-z]+(?:_[a-z]+)+)/g)].map((m) => m[1]!));
      for (const name of named) expect(tools).toContain(name);
      for (const tool of tools) expect(prompt).toContain(tool);
    }
  });

  it("humor is rare, follows the caller, and makes no business claim", () => {
    const prompt = systemPrompt();
    const humor = prompt.slice(prompt.indexOf("# Humor"), prompt.indexOf("# Getting details right"));
    expect(humor).toContain("only after the caller jokes");
    expect(humor).toContain("A joke never adds a fact.");
    for (const line of [...humor.matchAll(/"([^"]+)"/g)].map((m) => m[1]!)) {
      expect(scanConversation([{ role: "agent", text: line }]).violations).toEqual([]);
    }
  });

  it("every line the prompt gives the assistant to say passes the scan", () => {
    // Quotes come in pairs; a pair right after "Caller: " is the caller's half of an example.
    const prompt = systemPrompt();
    const lines = [...prompt.matchAll(/"([^"]*)"/g)]
      .filter((m) => m[1]!.length >= 12 && !prompt.slice(0, m.index).endsWith("Caller: "))
      .map((m) => m[1]!);
    expect(lines.length).toBeGreaterThan(40);
    for (const line of lines) expect(scanConversation([{ role: "agent", text: line }]).violations, line).toEqual([]);
  });
});

describe("phone-line platform settings (§2 of the research)", () => {
  const config = christmasLightGuysConfig({
    serviceArea: { status: "approved", zips: [], cities: ["Lakeway", "Bee Cave"] },
  });
  const spec = buildAgentRequest(config, OPTIONS, ["tool_1"]);

  it("ends a dead line after 60 s, ignores backchannels, keeps speech said over the greeting", () => {
    expect(spec.conversationConfig.turn).toMatchObject({
      turnTimeout: 7,
      silenceEndCallTimeout: 60,
      mergeWithDefaultIgnoreTerms: true,
      transcribeOnDisabledInterruptions: true,
      softTimeoutConfig: { timeoutSeconds: 3 },
    });
    expect(spec.conversationConfig.turn?.interruptionIgnoreTerms).toEqual(expect.arrayContaining(["uh-huh", "mm-hmm", "yeah"]));
    expect(spec.conversationConfig.agent?.disableFirstMessageInterruptions).toBe(true);
    expect(spec.conversationConfig.agent?.maxConversationDurationMessage).toMatch(/call you back/);
  });

  it("can wait when asked to hold on, and listens for the company's names and approved towns", () => {
    expect(spec.conversationConfig.agent?.prompt?.builtInTools?.skipTurn).toMatchObject({ params: { systemToolType: "skip_turn" } });
    expect(asrKeywords(config)).toEqual(expect.arrayContaining(["The Christmas Light Guys", "Light Guys", "Lakeway", "Bee Cave"]));
    expect(asrKeywords(christmasLightGuysConfig())).not.toContain("Lakeway"); // a draft area is never a keyword
    expect(spec.conversationConfig.asr?.keywords).toEqual(asrKeywords(config));
  });

  it("speaks English only until Spanish is turned on, then switches model, preset and detection", () => {
    expect(spec.conversationConfig.tts?.modelId).toBe("eleven_flash_v2");
    expect(spec.conversationConfig.languagePresets).toBeUndefined();
    expect(spec.conversationConfig.agent?.prompt?.builtInTools?.languageDetection).toBeUndefined();

    const es = buildAgentRequest(christmasLightGuysConfig({ spanish: true }), OPTIONS, ["tool_1"]);
    expect(es.conversationConfig.tts?.modelId).toBe("eleven_flash_v2_5");
    expect(es.conversationConfig.languagePresets?.es?.overrides.agent).toEqual({ language: "es", firstMessage: SPANISH_OPENING });
    expect(es.conversationConfig.agent?.prompt?.builtInTools?.languageDetection).toMatchObject({ params: { systemToolType: "language_detection" } });
    expect(es.conversationConfig.turn?.interruptionIgnoreTermLanguages).toEqual(["en", "es"]);
  });

  it("what follows a danger report can't be talked over", () => {
    const urgent = buildToolRequests(OPTIONS).find((t) => t.name === "flag_urgent")!.request.toolConfig;
    expect(urgent).toMatchObject({ interruptionMode: "disable_during_tool_and_turn" });
  });
});

describe("urgent alerts", () => {
  const alert = (detail: PendingAlert["detail"], channel: "sms" | "email"): PendingAlert => ({
    id: "x", kind: "urgent", channel, toAddress: "+15125550198", attempts: 1, leadId: "11111111-1111-4111-8111-111111111111",
    callId: null, brandName: "The Christmas Light Guys", campaignName: "TV", channelLabel: "tv", contactPhone: "+15125550147",
    contactName: "Nora", address: "41 Quarry Rd", serviceWanted: null, timing: null, callbackWindow: null, hasRecording: false,
    companyName: "The Christmas Light Guys", companyKind: "company", summary: null, intent: "unknown", email: null, siteVisit: null, mapsVisible: null, detail,
  });

  it("say URGENT and why, first thing, by text and by email", () => {
    const sms = renderAlert(alert({ urgent: "safety", summary: "strand on the roof sparking" }, "sms"), BASE);
    expect(sms.subject).toContain("URGENT call from Nora");
    expect(sms.body).toContain("Safety: strand on the roof sparking");
    expect(sms.body.length).toBeLessThanOrEqual(320);
    const email = renderAlert(alert({ urgent: "complaint", summary: "gutters cracked" }, "email"), BASE);
    expect(email.body).toContain("Why it's urgent: Complaint or claim: gutters cracked");
  });
});

describe("on a live call", () => {
  let db: Queryable;
  let businessId: string;
  let seq = 0;
  const sid = () => `CA${(0xf000 + ++seq).toString(16).padStart(32, "0")}`;
  const voice = (): VoiceDeps => ({ db, now: () => NIGHT, baseUrl: BASE, agent: simulatorConnector() });
  const param = (twiml: string, name: string) =>
    new RegExp(`name="${name}" value="([^"]*)"`).exec(twiml)?.[1]?.replace(/&amp;/g, "&").replace(/&#39;|&apos;|&quot;/g, "'") ?? null;
  const tool = (call: string, name: string, args: Record<string, unknown>) =>
    runTool(name, { call_sid: call, ...args }, {
      db,
      now: NIGHT,
      loadConfig: async (id: string) => (await loadActiveConfig(db, id))?.config ?? null,
      scheduleHandoff: async () => {},
    });

  beforeAll(async () => {
    db = await openPglite();
    ({ businessId } = await seedChristmasLightGuys(db, {
      ownerName: "Amy",
      ownerRingE164: "+15125550199",
      numbers: { tv: LINE, web: "+15125550102", print: "+15125550103" },
      alertSms: "+15125550198",
      ringStart: "09:00",
      ringEnd: "18:00",
      aiMode: "always",
      agentId: "agent_edge",
      maxConcurrentSessions: 50,
    }));
  });

  it("the agent is told who answers the phones, who calls back, and what day it is", async () => {
    const twiml = await handleInbound({ CallSid: sid(), From: "+15125550401", To: LINE }, voice());
    expect(param(twiml, "owner_name")).toBe("Amy");
    // Callers hear "our team", and the team calls on weekdays, 9 to 5 (Amy, 2026-10-29).
    expect(param(twiml, "callback_name")).toBe("our team");
    expect(param(twiml, "callback_hours")).toBe("on weekdays, between nine and five");
    expect(param(twiml, "callback_question")).toBe(
      "Our team returns calls on weekdays, between nine and five. When would be the best time to give you a call?",
    );
    // Tuesday at 11 PM: the next times are tomorrow.
    expect(param(twiml, "callback_choice")).toBe("tomorrow morning or afternoon");
    expect(param(twiml, "assistant_role")).toBe("The Christmas Light Guys' AI assistant");
    expect(param(twiml, "today")).toBe("Tuesday, October 20, 2026 at 11:00 PM (America/Chicago)");
  });

  it("a redial within minutes picks up where the dropped call left off (F1)", async () => {
    const first = sid();
    await handleInbound({ CallSid: first, From: "+15125550402", To: LINE }, voice());
    await tool(first, "save_lead_details", { caller_name: "Dana" });
    const again = await handleInbound({ CallSid: sid(), From: "+15125550402", To: LINE }, voice());
    expect(param(again, "returning_context")).toContain("Looks like we got cut off");
  });

  it("no 'cut off' after a call that hung up at once, or one that ended properly (second live call, 2026-10-29)", async () => {
    await handleInbound({ CallSid: sid(), From: "+15125550406", To: LINE }, voice());
    const afterHangUp = await handleInbound({ CallSid: sid(), From: "+15125550406", To: LINE }, voice());
    expect(param(afterHangUp, "returning_context")).not.toContain("cut off");

    const finished = sid();
    await handleInbound({ CallSid: finished, From: "+15125550407", To: LINE }, voice());
    await tool(finished, "save_lead_details", { caller_name: "Lee" });
    await tool(finished, "finish_call", { outcome: "callback_requested", summary: "Lee wants roofline lights." });
    const afterFinish = await handleInbound({ CallSid: sid(), From: "+15125550407", To: LINE }, voice());
    expect(param(afterFinish, "returning_context")).not.toContain("cut off");
    // Called before is not a customer: no "welcome back" (third live call, 2026-10-29).
    expect(param(afterFinish, "returning_context")).toContain("never been a customer");
    expect(param(afterFinish, "returning_context")).not.toMatch(/Acknowledge warmly/);
  });

  it("a danger report texts Amy at once, once per call, and the callback is urgent", async () => {
    const call = sid();
    await handleInbound({ CallSid: call, From: "+15125550403", To: LINE }, voice());
    const res = await tool(call, "flag_urgent", { kind: "safety", summary: "Strand on the roof sparking" });
    expect(res.body).toMatchObject({ ok: true, flagged: "safety" });
    expect(String(res.body.instruction)).toContain(SAFETY_LINE);
    expect(String(res.body.instruction)).toContain("Austin Energy at 512, 322, 9100");
    await tool(call, "flag_urgent", { kind: "safety", summary: "Strand on the roof sparking, still" });
    const ctx = (await getCallContext(db, call))!;
    const urgent = (await claimPendingAlerts(db, 50)).filter((a) => a.kind === "urgent" && a.leadId === ctx.leadId);
    expect(urgent).toHaveLength(1);
    expect(urgent[0]!.detail).toMatchObject({ urgent: "safety" });
    const tasks = await db.query<{ priority: string }>("select priority from public.task where lead_id = $1 and status = 'open'", [ctx.leadId]);
    expect(tasks.rows.map((t) => t.priority)).toContain("high");
  });

  it("Settings change the utility the assistant names, and Spanish, without touching the rest", async () => {
    const result = await saveSettings(db, {
      section: "callers",
      form: new URLSearchParams({ utility_name: "Pedernales Electric", utility_phone: "(888) 554-4732", spanish: "on" }),
      actor: "operator",
    });
    expect(result).toMatchObject({ ok: true });
    const config = (await loadActiveConfig(db, businessId))!.config;
    expect(config.safety).toEqual({ utilityName: "Pedernales Electric", utilityPhone: "+18885544732" });
    expect(config.ai.spanish).toBe(true);
    expect(config.ai.mode).toBe("always");

    const call = sid();
    await handleInbound({ CallSid: call, From: "+15125550404", To: LINE }, voice());
    const res = await tool(call, "flag_urgent", { kind: "safety", summary: "Line down in the yard" });
    expect(String(res.body.instruction)).toContain("Pedernales Electric at 888, 554, 4732");
  });
});
