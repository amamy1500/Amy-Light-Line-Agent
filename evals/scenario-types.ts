import type { ViolationCode } from "@/lib/agents/compliance";
import type { FactField, WrapUpOutcome } from "@/lib/db/agent";
import type { UrgentKind } from "@/lib/db/repo";

import type { ToolName } from "@/lib/agents/tools";

export type { ToolName };

export type Outcome =
  | "callback_task" // lead saved, Amy has a callback task
  | "transfer_attempt" // agent tried to reach Amy (success or not, a task must exist if not)
  | "not_a_lead" // spam, vendor, wrong number: flagged, no callback task
  | "info_only"; // caller only needed an approved answer; lead still recorded

/**
 * One conversation the agent must handle. The same data drives:
 *  - the simulated-caller tests pushed to the voice vendor (needs an API key),
 *  - the local tool-trace replay that asserts database state (no key needed),
 *  - the compliance scan over every transcript the vendor run produces.
 */
export interface Scenario {
  id: string;
  /** "heldout" scenarios are never used while tuning prompts or policy. */
  split: "dev" | "heldout";
  persona: string;
  /** Instructions for the simulated caller (spoken style, goal, quirks). */
  callerBrief: string;
  openingLine: string;
  /** What the caller will say if asked. Missing fields: the caller doesn't know or won't say. */
  knows: Partial<Record<FactField, string>>;
  expect: {
    outcome: Outcome;
    /** Tools that must appear in the call. */
    tools?: ToolName[];
    /** Tools that must not appear. */
    neverTools?: ToolName[];
    /** Fields that must end up stored on the lead. */
    persisted?: FactField[];
    /** Extra violations this scenario is designed to tempt (all violations are always checked). */
    tempts?: ViolationCode[];
    /** The agent must raise this urgent alert mid-call (flag_urgent), and the owner must be texted. */
    urgent?: UrgentKind;
    /** How the agent should wrap up, when it isn't implied by the outcome. */
    finish?: WrapUpOutcome;
    /** Strings that must never be stored anywhere (transcripts, tool inputs, facts). */
    neverStored?: string[];
    /** Strings the agent must never save through a tool (the caller may still have said them). */
    neverSaved?: string[];
    /** What a correct agent does in this scenario, for the vendor's LLM judge, in plain words. */
    judge?: string;
  };
  /** "hidden": the caller hides their number, so the spam gate asks them to press 1 first. */
  callerId?: "hidden";
  /** What the agent's customer history says about this number (the returning_context variable). */
  returning?: "customer" | "contacted";
  /** Critical scenarios are repeated to measure the pass rate, not just one pass. */
  critical: boolean;
  /** Audio conditions to apply in voice runs. */
  audio?: "clean" | "tv_background" | "child_noise" | "car" | "fast_speech" | "slow_speech" | "accented";
}

/** Every violation the compliance scan knows; all are forbidden in every scenario. */
export const ALL_VIOLATIONS: readonly ViolationCode[] = [
  "price_stated",
  "discount_offered",
  "availability_promised",
  "booking_claimed",
  "warranty_claimed",
  "impersonation",
  "denied_being_ai",
  "instructions_leaked",
  "service_area_unverified",
  "remote_quote_promised",
  "site_visit_offered",
  "other_business_mentioned",
];
