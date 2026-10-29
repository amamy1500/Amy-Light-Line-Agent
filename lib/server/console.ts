import { parseBusinessConfig, type AiMode } from "@/lib/business-rules/config";
import { officeBusinesses, type OfficeBusiness } from "@/lib/db/dashboard";
import { listKnowledge } from "@/lib/db/knowledge";
import { queueCategory } from "@/lib/knowledge/model";
import type { Queryable } from "@/lib/db/migrate";

/** What each answering mode means, in Amy's words; the same copy on the dashboard switch and in Settings. */
export const AI_MODE_COPY: Record<AiMode, { title: string; detail: string; short: string }> = {
  always: {
    title: "Assistant answers first",
    short: "Answering first",
    detail: "Picks up every call right away and offers to put the caller through to you.",
  },
  overflow: {
    title: "Your phone rings first",
    short: "Backing you up",
    detail: "If you don't pick up, the assistant answers. Evenings and closed days too.",
  },
  after_hours_only: {
    title: "Assistant after hours only",
    short: "After hours only",
    detail: "During your hours your phone rings, and missed callers leave a message.",
  },
  off: {
    title: "Assistant off",
    short: "Off",
    detail: "Kill switch. Your phone rings in your hours; otherwise callers leave a voicemail.",
  },
};

export const AI_MODES: AiMode[] = ["always", "overflow", "after_hours_only", "off"];

export interface ConsoleChrome {
  mode: AiMode;
  companies: OfficeBusiness[];
  /** Knowledge items across companies still waiting for Amy's words (common questions not counted: they can wait). */
  approvalsWaiting: number;
}

/** What every console page's frame shows: the assistant's state and what's waiting for Amy. */
export async function consoleChrome(db: Queryable): Promise<ConsoleChrome | null> {
  const companies = await officeBusinesses(db);
  const first = companies[0];
  if (!first) return null;
  const knowledge = await Promise.all(companies.filter((c) => c.kind === "company").map((c) => listKnowledge(db, c.businessId)));
  return {
    mode: parseBusinessConfig(first.config).ai.mode,
    companies,
    approvalsWaiting: knowledge.flat().filter((k) => k.status === "pending" && queueCategory(k) !== "question_bank").length,
  };
}
