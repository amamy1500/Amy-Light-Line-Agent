import { describe, expect, it } from "vitest";
import { scanConversation } from "@/lib/agents/compliance";
import { openingLine } from "@/lib/agents/policy";
import { spokenList } from "@/lib/business-rules/company-resolution";
import type { BusinessConfig } from "@/lib/business-rules/config";
import { christmasLightGuysConfig } from "@/lib/business-rules/tenants/christmas-light-guys";
import { frontDeskConfig } from "@/lib/business-rules/tenants/front-desk";
import { sublimePatioConfig } from "@/lib/business-rules/tenants/sublime-patio";
import { theFridgeConfig } from "@/lib/business-rules/tenants/the-fridge";
import type { Entry } from "@/lib/elevenlabs/dynamic-variables";
import { forbiddenClaims } from "@/lib/knowledge/model";
import { CLG_KNOWLEDGE } from "@/lib/knowledge/tenants/christmas-light-guys";
import { SUBLIME_KNOWLEDGE } from "@/lib/knowledge/tenants/sublime-patio";
import { FRIDGE_KNOWLEDGE } from "@/lib/knowledge/tenants/the-fridge";

// Invariant: nothing the system itself scripts the agent to say can trip the
// compliance scan, with every company's unapproved claims loaded (as on a
// shared line). Found when The Fridge's "AI smart vending" marker flagged the
// AI disclosure on every call, and Sublime Patio's "Christmas lights" marker
// flagged the name "The Christmas Light Guys".

const ALL_ITEMS = [...CLG_KNOWLEDGE, ...SUBLIME_KNOWLEDGE, ...FRIDGE_KNOWLEDGE];
const COMPANIES = [christmasLightGuysConfig(), sublimePatioConfig(), theFridgeConfig()];
const NAMES = COMPANIES.map((c) => c.brand.spokenName);
const OPTIONS = {
  forbiddenClaims: forbiddenClaims(ALL_ITEMS),
  safePhrases: COMPANIES.flatMap((c) => [c.brand.spokenName, ...c.profile.aliases]),
};
const ENTRIES: Entry[] = ["owner_unavailable", "owner_busy", "after_hours", "ai_first", "handoff_failed"];

function withVoice(config: BusinessConfig, voice: BusinessConfig["ai"]["voice"]): BusinessConfig {
  return { ...config, ai: { ...config.ai, voice } };
}

const scripted: string[] = [];
for (const voice of ["stock", "owner_clone"] as const) {
  for (const config of [...COMPANIES, frontDeskConfig()]) {
    for (const entry of ENTRIES) {
      scripted.push(openingLine(withVoice(config, voice), entry, config === COMPANIES[0] ? [] : []));
    }
  }
  for (const entry of ENTRIES) scripted.push(openingLine(withVoice(frontDeskConfig(), voice), entry, NAMES));
}
for (const name of NAMES) {
  scripted.push(`Got it, ${name}.`, `No problem, I've moved this to ${name}. You won't need to repeat anything.`);
}
scripted.push(
  `This line answers for ${spokenList(NAMES, "and")}. Which one can I help with?`,
  `Is that with ${spokenList(NAMES.slice(0, 2))}?`,
  "I can't share how I'm set up, but I'm happy to help with your call.",
  "I don't want to give you the wrong answer on that. I'll make sure Amy covers it when she calls.",
  "Yes, I'm an AI assistant, not a person. I can still get everything started for you.",
);

describe("scripted wording never trips the scan, for any company", () => {
  it(`covers ${scripted.length} scripted lines`, () => {
    expect(scripted.length).toBeGreaterThan(40);
  });

  for (const line of scripted) {
    it(line.slice(0, 90), () => {
      const report = scanConversation([{ role: "agent", text: line }], [], OPTIONS);
      expect(report.violations).toEqual([]);
    });
  }
});

describe("the masking hides names, not claims", () => {
  const codes = (text: string) =>
    scanConversation([{ role: "agent", text }], [], OPTIONS).violations.map((v) => `${v.code}:${v.ref ?? ""}`);

  it("still flags a company's unapproved claim said in passing", () => {
    expect(codes("The Fridge uses AI to stock your machine.")).toContain("unapproved_claim:tf_what_we_do");
    expect(codes("Sure, we can put up Christmas lights with your patio lighting.")).toContain("unapproved_claim:sp_holiday_lighting");
  });

  it("an owner-clone greeting says it is not Amy", () => {
    const line = openingLine(withVoice(christmasLightGuysConfig(), "owner_clone"), "after_hours");
    expect(line).toContain("I sound like Amy, but I'm an automated system, not Amy and not a person.");
    expect(scanConversation([{ role: "agent", text: line }]).violations.map((v) => v.code)).not.toContain("impersonation");
  });
});
