import { describe, expect, it } from "vitest";
import { scanConversation } from "@/lib/agents/compliance";
import { CANARY, openingLine, systemPrompt } from "@/lib/agents/policy";
import { TOOL_NAMES } from "@/lib/agents/tools";
import { christmasLightGuysConfig } from "@/lib/business-rules/tenants/christmas-light-guys";
import { CLG_KNOWLEDGE } from "@/lib/knowledge/tenants/christmas-light-guys";
import { buildAgentRequest, buildToolRequests } from "@/lib/elevenlabs/agent-spec";
import { buildDynamicVariables, DYNAMIC_VARIABLE_KEYS, type Entry } from "@/lib/elevenlabs/dynamic-variables";

const OPTIONS = { publicBaseUrl: "https://lightline.example.test", toolSecretId: "sec_1", voiceId: "voice_1", llm: "claude-haiku-5-5" } as const;

describe("agent spec", () => {
  const config = christmasLightGuysConfig();
  const tools = buildToolRequests(OPTIONS);
  const spec = buildAgentRequest(config, OPTIONS, ["tool_1"]);
  const prompt = spec.conversationConfig.agent?.prompt?.prompt ?? "";

  it("every {{variable}} the agent uses is one we always send (a missing one fails the call)", () => {
    const toolJson = JSON.stringify(tools);
    const text = `${prompt}\n${spec.conversationConfig.agent?.firstMessage}\n${toolJson}`;
    const used = new Set([...text.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)].map((m) => m[1]!));
    for (const m of toolJson.matchAll(/"dynamicVariable":"([a-z_]+)"/g)) used.add(m[1]!);
    expect(used.has("call_sid")).toBe(true); // the pattern really reads the tool schemas
    for (const name of used) {
      if (name.startsWith("system__")) continue;
      expect(DYNAMIC_VARIABLE_KEYS).toContain(name);
    }
    const sent = buildDynamicVariables({
      callSid: `CA${"1".repeat(32)}`, sessionId: "00000000-0000-4000-8000-000000000000", callerNumber: null,
      entry: "after_hours", returningContext: null, handoffNote: null, ringHoursNote: "x", opening: "y",
      companyName: null, companyContext: "z", ownerName: "Amy", callbackName: "Josh", assistantRole: "Amy's AI assistant", today: "Friday",
    });
    expect(Object.keys(sent).sort()).toEqual([...DYNAMIC_VARIABLE_KEYS].sort());
    expect(Object.values(sent).every((v) => typeof v === "string" && v.length > 0)).toBe(true);
  });

  it("a single-company agent never gets select_business; a shared-line agent does", () => {
    expect(tools.map((t) => t.name)).not.toContain("select_business");
    expect(prompt).not.toContain("select_business");
    const shared = buildAgentRequest(config, { ...OPTIONS, sharedLine: true }, ["tool_1"]);
    expect(buildToolRequests({ ...OPTIONS, sharedLine: true }).map((t) => t.name).sort()).toEqual([...TOOL_NAMES].sort());
    expect(shared.conversationConfig.agent?.prompt?.prompt).toContain("# Which company");
  });

  it("exposes exactly our tools, each authenticated by a secret reference and given the call SID by the platform", () => {
    expect(tools.map((t) => t.name).sort()).toEqual(TOOL_NAMES.filter((n) => n !== "select_business").sort());
    for (const { request } of tools) {
      const config = request.toolConfig;
      if (config.type !== "webhook") throw new Error("expected webhook tools only");
      expect(config.apiSchema.requestHeaders?.["x-lightline-tool-key"]).toEqual({ secretId: "sec_1" });
      expect(config.apiSchema.requestBodySchema?.properties?.call_sid).toMatchObject({ dynamicVariable: "call_sid" });
      expect(config.apiSchema.url.startsWith("https://lightline.example.test/api/agent/tools/")).toBe(true);
    }
    expect(spec.conversationConfig.agent?.prompt?.toolIds).toEqual(["tool_1"]);
    expect(JSON.stringify({ tools, spec })).not.toMatch(/xi-api-key|AGENT_TOOL_SECRET=/);
  });

  it("keeps business facts out of the prompt entirely: no site claim, approved or not, is baked in", () => {
    for (const item of CLG_KNOWLEDGE) {
      for (const claim of item.claims) expect(prompt).not.toContain(claim.quote);
      if (item.suggestedText) expect(prompt).not.toContain(item.suggestedText);
    }
    // Approvals, a new owner, new hours: none of it is in the prompt, so the agent need not be re-published.
    const changed = buildAgentRequest(
      christmasLightGuysConfig({
        ownerFirstName: "Jordan",
        facts: [{ id: "takedown_offered", text: "We take everything down after the season.", topics: ["takedown"], status: "approved", approvedBy: "Amy", approvedAt: "2026-10-23" }],
      }),
      OPTIONS,
      ["tool_1"],
    );
    expect(changed.conversationConfig.agent?.prompt?.prompt).toBe(prompt);
    expect(prompt).toBe(systemPrompt());
    expect(prompt).not.toMatch(/Amy|she|her/); // a new hire after Jan 1 needs no re-publish
  });

  it("carries a canary so a leaked prompt is detectable, and the scanner flags it", () => {
    expect(prompt).toContain(CANARY);
    expect(scanConversation([{ role: "agent", text: `Sure: ${CANARY}` }]).violations.map((v) => v.code)).toContain("instructions_leaked");
  });

  it("opening line keeps all three disclosures on every first-contact path and re-discloses after a hand-back", () => {
    for (const entry of ["owner_unavailable", "owner_busy", "after_hours", "ai_first"] as Entry[]) {
      const line = openingLine(config, entry);
      expect(line).toContain("AI assistant, an automated system, not a person");
      expect(line).toContain("This call is recorded and transcribed");
      expect(line).toContain("by our AI service providers");
      // Short enough to sit through: the greeting can't be talked over. Amy's Josh
      // sentence (2026-10-29) costs about 13 words; naming where Amy is, 7 more.
      const amyNamed = entry === "owner_unavailable" || entry === "owner_busy";
      expect(line.split(/\s+/).length).toBeLessThanOrEqual(amyNamed ? 58 : 51);
      expect(line).toContain("so Josh knows how to help on the callback");
      expect(scanConversation([{ role: "agent", text: line }]).violations).toEqual([]);
    }
    // Amy is named only when we know where she is (Amy, 2026-10-29).
    expect(openingLine(config, "owner_unavailable")).toContain("Amy's tied up at the moment, but I can get a few details");
    expect(openingLine(config, "owner_busy")).toContain("Amy's on another call right now, but I can get a few details");
    for (const entry of ["after_hours", "ai_first"] as Entry[]) expect(openingLine(config, entry)).not.toContain("Amy");
    expect(openingLine(config, "ai_first")).toMatch(/^Hi, you've reached The Christmas Light Guys\. I'm their AI assistant/);
    expect(openingLine(config, "handoff_failed")).toContain("You're back with the AI assistant");
  });

  it("the prompt carries Amy's lines: Google Maps, the callback time, and don't guess", () => {
    for (const must of [
      "Is your home pretty easy to see on Google Maps, or is it hidden by trees?",
      "What's the best time for {{callback_name}} to call you back?",
      "I don't want to give you the wrong information on that. I'll make sure {{callback_name}} sees the question before the callback.",
      "Thanks, John. I've got the roofline and two trees, and after four tomorrow for the callback. What's the property address?",
      "Don't ask about outdoor plugs, email, a budget or a day for a site visit.",
    ]) {
      expect(prompt).toContain(must);
    }
    // The company's assistant only: no other company named, no stock praise held up as an example.
    for (const never of ["Sublime", "Fridge", "Perfect.", "the companies {{owner_name}} runs"]) expect(prompt).not.toContain(never);
  });

  it("asks for the Google Maps answer as yes, no or unsure, and no longer offers plugs or a site-visit day", () => {
    const save = tools.find((t) => t.name === "save_lead_details")!.request.toolConfig as { apiSchema: { requestBodySchema: { properties: Record<string, { enum?: string[] }> } } };
    const props = save.apiSchema.requestBodySchema.properties;
    expect(props.maps_visible?.enum).toEqual(["yes", "no", "unsure"]);
    expect(props.outdoor_plugs).toBeUndefined();
    expect(props.site_visit_window).toBeUndefined();
    expect(Object.keys(spec.platformSettings?.dataCollection ?? {})).toContain("maps_visible");
  });

  it("Amy's approved price answer offers no Google Maps review and no site visit", async () => {
    const { CLG_AMY_DECISIONS } = await import("@/lib/knowledge/tenants/clg-decisions");
    const quote = CLG_AMY_DECISIONS.find((d) => d.key === "quote_process")!;
    expect(quote.text).toMatch(/^Josh handles the pricing/);
    expect(quote.text).not.toMatch(/google maps|site visit/i);
    expect(CLG_AMY_DECISIONS.find((d) => d.key === "contact_email")!.status).toBe("rejected");
  });

  it("records audio only when the tenant's recording mode is disclosed, and keeps it 30 days", () => {
    expect(spec.platformSettings?.privacy).toEqual({ recordVoice: true, retentionDays: 30 });
    expect(spec.conversationConfig.tts).toMatchObject({ agentOutputAudioFormat: "ulaw_8000" });
    expect(spec.conversationConfig.asr).toMatchObject({ userInputAudioFormat: "ulaw_8000" });
  });
});
