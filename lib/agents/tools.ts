import { z } from "zod";
import { resolveCompany, spokenList, type CompanyOption } from "@/lib/business-rules/company-resolution";
import { approvedFacts, approvedServices, callbackName, type BusinessConfig } from "@/lib/business-rules/config";
import { transferAllowed } from "@/lib/business-rules/routing";
import {
  assignBusiness,
  beginTransfer,
  capturedFields,
  markRecordingDeclined,
  recordLeadFact,
  requestCallback,
  wrapUpSession,
  type CallContext,
  type FactField,
} from "@/lib/db/agent";
import type { Queryable } from "@/lib/db/migrate";
import { findLineByCallSid, ownerOnCall, type UrgentKind } from "@/lib/db/repo";
import { formatUsPhone, normalizeUsPhone } from "@/lib/telephony/phone";
import { callbackQuestion, dontGuessLine, MAPS_QUESTION, SAFETY_LINE } from "./lines";
import { companyNotes } from "./policy";

/**
 * The only actions the voice agent can take. Each tool:
 *  - validates its input with a strict schema (unknown keys rejected),
 *  - runs only for a live call it belongs to (the call SID comes from a
 *    dynamic variable we set, never from the model's imagination),
 *  - is idempotent per (conversation, tool, arguments) — see the gateway,
 *  - returns a small structured result with an `instruction` the agent
 *    follows, so the next spoken line is decided by policy, not improvised.
 * There is no free-form database or HTTP access.
 */

export interface ToolDeps {
  db: Queryable;
  config: BusinessConfig;
  now: Date;
  ctx: CallContext;
  /** Moves the live call to Amy's screened ring (Twilio REST in production). */
  scheduleHandoff: (callSid: string) => Promise<void>;
  /** The companies this call's line answers for, each with its active config. */
  companies: () => Promise<CompanyOption[]>;
}

/** Before a shared line's caller has said which company: business questions wait for select_business. */
const COMPANY_FIRST = {
  outcome: "ok" as const,
  body: {
    found: false,
    status: "company_unknown",
    instruction:
      "First find out which company the caller wants and call select_business. Then look this up again. Don't answer from memory.",
  },
};

export interface ToolResult {
  outcome: "ok" | "rejected";
  body: Record<string, unknown>;
}

interface ToolDefinition<S extends z.ZodType> {
  description: string;
  input: S;
  /** Call states in which the tool may run. */
  states: readonly string[];
  run(args: z.infer<S>, deps: ToolDeps): Promise<ToolResult>;
}

function define<S extends z.ZodType>(def: ToolDefinition<S>): ToolDefinition<S> {
  return def;
}

const text = (max: number) => z.string().trim().min(1).max(max);

/** "512, 322, 9100": phone numbers are read in groups, never as one long number. */
export function spokenPhone(e164: string): string {
  return formatUsPhone(e164).replace(/\((\d{3})\) (\d{3})-(\d{4})/, "$1, $2, $3");
}


/** What the assistant says after flagging, per kind. `owner` is the person who calls back. */
function urgentInstruction(kind: UrgentKind, config: BusinessConfig): string {
  const owner = config.brand.ownerFirstName;
  switch (kind) {
    case "safety":
      return (
        `If you haven't yet, say first: "${SAFETY_LINE}" Then: "Please stay away from the lights and the wires. I've sent this to ${owner} as urgent." ` +
        `If a power line is down, add: "To report a downed line, call ${config.safety.utilityName} at ${spokenPhone(config.safety.utilityPhone)}, ` +
        `or your own electric company if you're outside their area." Give no electrical advice. If they're safe, get the address and the best number for ${owner}.`
      );
    case "service_issue":
      return `Say: "Got it. I've sent this to ${owner} as urgent, so it's in front of ${owner} now." Promise no time and give no repair advice. Get the address and the best number to call back.`;
    case "complaint":
      return `Say: "I'm sorry about that. I can't handle billing or claims myself, but I've sent this to ${owner} as urgent." Admit no fault and mention no refund or amount. Get the best number to call back.`;
    case "threat":
      return `Say once, calmly: "I can't continue if this goes on." If it goes on: "I'm ending this call now." Then call finish_call with outcome abusive and end the call.`;
    case "official":
      return `Say: "I'll get this to ${owner} right away. What's the best number to reach you?" Say nothing on the company's behalf.`;
  }
}

/**
 * Words that put a question into an escalation category even when the
 * caller never says the category's name ("how much" is a price question).
 */
const CATEGORY_WORDS: Record<string, RegExp> = {
  price: /(\b(price|pricing|cost|costs|how much|quote|estimate|rates?|charge|expensive|cheap|budget)\b|\$\s?\d)/i,
  // Whole words: "dealer" is not a discount question (found by the generated knowledge tests).
  discount: /(\b(discounts?|deals?|coupons?|promo|promo code|percent off|cheaper|price match)\b|\d\s?% off)/i,
  availability: /\b(available|availability|schedule|book|booking|date|when can|how soon|this week|next week|before thanksgiving|by christmas)/i,
  warranty: /\b(warrant|guarantee|lifetime)/i,
  insurance: /\b(insur|bonded|licensed|liability)/i,
  damage: /\b(damage|broke|broken|fell|ruined|hurt|injur)/i,
  complaint: /\b(complain|unhappy|upset|terrible|refund|never showed)/i,
  payment: /\b(pay|payment|invoice|bill|billing|deposit|credit card)\b/i,
  "existing job status": /\b(my (?:install|order|job|appointment)|status|when are you coming|still waiting)/i,
};

/** True when the asked text names the topic, by category words or by the topic's own words. */
export function mentionsTopic(asked: string, topic: string): boolean {
  const pattern = CATEGORY_WORDS[topic.toLowerCase()];
  if (pattern?.test(asked)) return true;
  const words = new Set(asked.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  const needed = topic.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return needed.length > 0 && needed.every((w) => words.has(w));
}
const LIVE = ["agent_active"] as const;

const LeadDetails = z.strictObject({
  caller_name: text(80).optional(),
  customer_type: z.enum(["new", "returning", "unknown"]).optional(),
  property_type: z.enum(["residential", "commercial", "unknown"]).optional(),
  property_address: text(200).optional(),
  zip: z.string().regex(/^\d{5}$/).optional(),
  service_requested: text(200).optional(),
  job_type: z.enum(["new_installation", "reinstall_existing", "repair", "takedown", "other"]).optional(),
  desired_timing: text(120).optional(),
  callback_window: text(120).optional(),
  callback_phone: text(32).optional(),
  lead_source: text(80).optional(),
  notes: text(500).optional(),
  // Spelled back and confirmed by the caller before it is saved (see the parameter description).
  caller_email: z.string().trim().toLowerCase().email().max(120).optional(),
  home_size: text(60).optional(),
  // Amy, 2026-10-29: tells Josh whether he may need to see the property. Stored as said: yes, no or unsure.
  maps_visible: z.enum(["yes", "no", "unsure"]).optional(),
});

/** Intake fields the agent should still ask about, in the configured order. */
async function stillNeeded(deps: ToolDeps): Promise<FactField[]> {
  if (!deps.ctx.leadId) return [];
  const have = await capturedFields(deps.db, deps.ctx.leadId);
  return deps.config.intake.filter((f) => !have.has(f));
}

/** What to ask for next, in a person's words: field names are never said aloud. */
export function askFor(field: FactField, config: BusinessConfig): string {
  switch (field) {
    case "service_requested":
      return "what they're calling about";
    case "caller_name":
      return "their name";
    case "property_address":
      return "the property address, with the city";
    case "maps_visible":
      return `whether the home is easy to see on Google Maps ("${MAPS_QUESTION}")`;
    case "callback_window":
      return `the best time to call back ("${callbackQuestion(callbackName(config))}")`;
    default:
      return field.replace(/_/g, " ");
  }
}

async function saveFacts(deps: ToolDeps, facts: Partial<Record<FactField, string>>): Promise<FactField[]> {
  const leadId = deps.ctx.leadId;
  if (!leadId) return [];
  const saved: FactField[] = [];
  for (const [field, value] of Object.entries(facts) as Array<[FactField, string | undefined]>) {
    if (!value) continue;
    await recordLeadFact(deps.db, {
      leadId,
      callId: deps.ctx.callId,
      field,
      value,
      source: "caller_via_agent",
      confidence: 0.9,
      evidence: null,
    });
    saved.push(field);
  }
  return saved;
}

export const TOOLS = {
  select_business: define({
    description:
      "On a line that answers for several companies: call this as soon as the caller names a company or says what they " +
      "need, with their words. It decides which company the call is for and tells you exactly what to say. Call it " +
      "again if the caller corrects you. Never decide the company yourself.",
    input: z.strictObject({ caller_words: text(300) }),
    states: LIVE,
    async run(args, deps) {
      const options = await deps.companies();
      const owner = deps.config.brand.ownerFirstName;
      const resolution = resolveCompany(args.caller_words, options);
      if (resolution.kind === "set") {
        const { option } = resolution;
        const company = option.config.brand.spokenName;
        const assigned = await assignBusiness(deps.db, {
          callSid: deps.ctx.callSid,
          businessId: option.businessId,
          how: "caller_said",
          actor: "agent",
        });
        const have = assigned.leadId ? await capturedFields(deps.db, assigned.leadId) : new Set<string>();
        const next = option.config.intake.filter((f) => !have.has(f));
        const say =
          assigned.status === "unchanged"
            ? ""
            : assigned.status === "switched"
              ? `Say "No problem, I've moved this to ${company}. You won't need to repeat anything." `
              : `Say "Got it, ${company}." `;
        return {
          outcome: "ok",
          body: {
            status: "set",
            company,
            company_notes: companyNotes(option.config),
            still_needed: next,
            instruction: `${say}From now on follow company_notes${next[0] ? `, and ask naturally for ${askFor(next[0], option.config)}` : ""}. One question at a time.`,
          },
        };
      }
      if (resolution.kind === "ambiguous") {
        const which = spokenList(resolution.options.map((o) => o.config.brand.spokenName));
        return {
          outcome: "ok",
          body: {
            status: "ambiguous",
            instruction: `Ask one short question: "Is that with ${which}?" Then call select_business again with the answer.`,
          },
        };
      }
      const { rows } = await deps.db.query<{ n: number | string }>(
        `select count(*) as n from public.tool_call
          where call_id = $1 and tool_name = 'select_business' and output->>'status' = 'none'`,
        [deps.ctx.callId],
      );
      const names = spokenList(options.map((o) => o.config.brand.spokenName), "and");
      return {
        outcome: "ok",
        body: {
          status: "none",
          instruction:
            Number(rows[0]?.n ?? 0) === 0
              ? `Say: "This line answers for ${names}. Which one can I help with?"`
              : `Don't ask about the company again. Take a message: their name, what it's about and the best time to call back, and say ${owner} will sort out the rest.`,
        },
      };
    },
  }),

  save_lead_details: define({
    description:
      "Save what the caller has told you about themselves and the job. Call it as soon as you learn any detail, " +
      "with every field the caller actually said, even several at once. Never guess. The result lists what is still " +
      "needed; never ask again for something already saved.",
    input: LeadDetails,
    states: LIVE,
    async run(args, deps) {
      const facts: Partial<Record<FactField, string>> = { ...args };
      if (args.callback_phone) {
        const normalized = normalizeUsPhone(args.callback_phone);
        if (!normalized) {
          return {
            outcome: "rejected",
            body: { saved: [], instruction: "That callback number didn't look complete. Ask the caller to repeat it once." },
          };
        }
        facts.callback_phone = normalized;
      }
      const saved = await saveFacts(deps, facts);
      const next = await stillNeeded(deps);
      return {
        outcome: "ok",
        body: {
          saved,
          still_needed: next,
          instruction: next.length
            ? `Acknowledge briefly, then ask naturally for ${askFor(next[0]!, deps.config)}. One question at a time.`
            : `You have what ${callbackName(deps.config)} needs. Confirm the best number if you haven't, then call request_callback and wrap up.`,
        },
      };
    },
  }),

  check_service_area: define({
    description:
      "Check whether a ZIP code or city is in the service area before saying anything about coverage. " +
      "Never confirm or deny coverage on your own.",
    input: z.strictObject({ zip: z.string().regex(/^\d{5}$/).optional(), city: text(80).optional() }),
    states: LIVE,
    async run(args, deps) {
      if (args.zip) await saveFacts(deps, { zip: args.zip });
      if (deps.ctx.businessKind === "front_desk") return COMPANY_FIRST;
      const area = deps.config.serviceArea;
      const unknown = {
        outcome: "ok" as const,
        body: {
          status: "unknown",
          instruction: `Do not confirm or deny coverage. Say ${callbackName(deps.config)} will confirm the area on the callback, and keep going.`,
        },
      };
      if (area.status !== "approved" || (!args.zip && !args.city)) return unknown;
      const zipHit = args.zip !== undefined && area.zips.includes(args.zip);
      const cityHit = args.city !== undefined && area.cities.some((c) => c.toLowerCase() === args.city!.toLowerCase());
      if (zipHit || cityHit) {
        return { outcome: "ok", body: { status: "in_area", instruction: "You may say yes, that area is covered." } };
      }
      // Not on the list is not a "no": Amy decides edge cases, the lead is kept.
      return {
        outcome: "ok",
        body: {
          status: "not_listed",
          instruction: `Don't turn the caller away. Say you'll have ${callbackName(deps.config)} confirm whether the crew can get out there.`,
        },
      };
    },
  }),

  get_approved_answer: define({
    description:
      "Look up an approved answer before answering any question about the business (services, process, " +
      "policies). Only say what the result's answer says. If nothing is approved, say you don't want to give the " +
      "wrong information and that the question will be passed on, then carry on with the details.",
    input: z.strictObject({ topic: text(60), question: text(300) }),
    states: LIVE,
    async run(args, deps) {
      if (deps.ctx.businessKind === "front_desk") {
        await saveFacts(deps, { notes: `Asked: ${args.question}` });
        return COMPANY_FIRST;
      }
      const asked = `${args.topic} ${args.question}`;
      const escalate = deps.config.escalateTopics.find((t) => mentionsTopic(asked, t));
      // On an escalated topic (price, insurance…), only words Amy approved FOR
      // that topic may be said (e.g. how quotes work) — never a nearby fact.
      const eligible = approvedFacts(deps.config).filter(
        (f) => !escalate || f.topics.some((t) => mentionsTopic(t, escalate)),
      );
      // The fact whose topics the question names most wins: "is the estimate
      // free?" gets the free-estimate answer, "how much?" the quote process.
      let fact: (typeof eligible)[number] | undefined;
      let best = 0;
      for (const candidate of eligible) {
        const hits = candidate.topics.filter((t) => mentionsTopic(asked, t)).length;
        if (hits > best) [fact, best] = [candidate, hits];
      }
      if (!fact && escalate) fact = eligible[0];
      // Amy sees every question, answered or not.
      await saveFacts(deps, { notes: `Asked: ${args.question}` });
      if (fact) {
        return {
          outcome: "ok",
          body: {
            found: true,
            answer: fact.text,
            fact_id: fact.id,
            instruction: "Say this answer in your own voice. Add no numbers, dates or promises beyond it.",
          },
        };
      }
      return {
        outcome: "ok",
        body: {
          found: false,
          instruction: `Nothing on this is approved. Say: "${dontGuessLine(callbackName(deps.config))}" Do not guess, and never repeat what a website says. Then carry on with the next missing detail.`,
        },
      };
    },
  }),

  request_callback: define({
    description:
      "Create a callback once you have the caller's need. Include the time the caller prefers, in their own words (e.g. \"tomorrow after 3\").",
    input: z.strictObject({ window: text(120).optional(), reason: text(200).optional(), urgent: z.boolean().optional() }),
    states: LIVE,
    async run(args, deps) {
      const callback = callbackName(deps.config);
      if (!deps.ctx.leadId) {
        return { outcome: "rejected", body: { instruction: `Apologize and say ${callback} will call back as soon as possible.` } };
      }
      if (args.window) await saveFacts(deps, { callback_window: args.window });
      const taskId = await requestCallback(deps.db, {
        leadId: deps.ctx.leadId,
        callId: deps.ctx.callId,
        window: args.window ?? null,
        reason: args.reason ?? null,
        priority: args.urgent ? "high" : "normal",
      });
      return {
        outcome: "ok",
        body: {
          task_id: taskId,
          // Amy, 2026-10-29: never promise a call at an exact time unless it is confirmed.
          instruction: args.window
            ? `Say you've noted ${args.window} as the best time for ${callback}. Don't promise a call at that exact time.`
            : `Say you're sending this to ${callback} now. Don't promise a time.`,
        },
      };
    },
  }),

  transfer_to_amy: define({
    description:
      "Try to connect the caller to the owner live. Use when the caller asks for the owner or a person, or is ready and wants to talk now. " +
      "Pass a one-line summary (name, place, what they want). Before calling it, say you'll try them now.",
    input: z.strictObject({ summary: text(200), reason: z.enum(["caller_asked", "ready_to_buy", "complex_question"]) }),
    states: LIVE,
    async run(args, deps) {
      const owner = deps.config.brand.ownerFirstName;
      const refuse = (why: string) => ({
        outcome: "rejected" as const,
        body: {
          transferring: false,
          why,
          instruction: `Say ${owner} can't come to the phone right now, that you've saved everything so they won't have to repeat it, and ask the best time for ${owner} to call back. Then call request_callback.`,
        },
      });
      if (!transferAllowed(deps.config, deps.now, deps.ctx.transferAttempts)) {
        return refuse(deps.ctx.transferAttempts > 0 ? "already_tried" : "outside_hours");
      }
      // Already on another of our calls: ringing her call waiting only makes this caller wait.
      const line = await findLineByCallSid(deps.db, deps.ctx.callSid);
      if (line && (await ownerOnCall(deps.db, line.ownerRingE164))) {
        return {
          outcome: "rejected" as const,
          body: {
            transferring: false,
            why: "owner_busy",
            instruction: `Say ${owner} is on another call right now, that you've saved everything so they won't have to repeat it, and ask the best time for ${owner} to call back. Then call request_callback.`,
          },
        };
      }
      const started = await beginTransfer(deps.db, {
        callSid: deps.ctx.callSid,
        maxAttempts: deps.config.transfer.maxAttempts,
        note: args.summary,
      });
      if (!started) return refuse("not_available");
      await deps.scheduleHandoff(deps.ctx.callSid);
      return {
        outcome: "ok",
        body: {
          transferring: true,
          instruction: `Say "One moment while I try ${owner}." and then stop talking. If ${owner} can't pick up, you'll be back with the caller.`,
        },
      };
    },
  }),

  recording_declined: define({
    description:
      "Call immediately if the caller says they don't want to be recorded. Then offer to try the owner or a callback; do not offer a text.",
    input: z.strictObject({}),
    states: LIVE,
    async run(_args, deps) {
      await markRecordingDeclined(deps.db, deps.ctx.callSid);
      const owner = deps.config.brand.ownerFirstName;
      return {
        outcome: "ok",
        body: {
          instruction: `Say: "No problem. I won't keep a recording of this call." Then offer to try ${owner} now (if allowed) or a callback at this number. Do not offer a text message.`,
        },
      };
    },
  }),

  flag_urgent: define({
    description:
      "Call right away when the caller reports danger (sparking, smoke, fire, someone hurt, a downed power line), a problem " +
      "with lights we installed (out after a storm, a dead timer, the crew didn't come), a complaint, billing or damage " +
      "claim, a threat or abuse, or is calling from the media, police, the city or an HOA. It texts the owner now, makes " +
      "the callback urgent and tells you what to say. For danger, say the 911 line before calling it.",
    input: z.strictObject({
      kind: z.enum(["safety", "service_issue", "complaint", "threat", "official"]),
      summary: text(300),
    }),
    states: LIVE,
    async run(args, deps) {
      if (!deps.ctx.leadId) {
        return { outcome: "rejected", body: { instruction: urgentInstruction(args.kind, deps.config) } };
      }
      await saveFacts(deps, { notes: `URGENT (${args.kind.replace(/_/g, " ")}): ${args.summary}` });
      if (args.kind !== "threat") {
        await requestCallback(deps.db, {
          leadId: deps.ctx.leadId,
          callId: deps.ctx.callId,
          window: null,
          reason: `Urgent: ${args.summary}`.slice(0, 200),
          priority: "high",
        });
      }
      await deps.db.query("select app.emit($1, $2, 'call', $3, 'call.flagged_urgent', $4::jsonb, 'agent', null)", [
        deps.ctx.tenantId,
        deps.ctx.businessId,
        deps.ctx.callId,
        JSON.stringify({ kind: args.kind, summary: args.summary }),
      ]);
      // Texted now, not after the call: one alert per call and kind, past any "likely spam" hold.
      await deps.db.query(
        `insert into public.outbox (tenant_id, business_id, lead_id, call_id, kind, channel, to_address, dedupe_key, detail)
         select $1, $2, $3, $4, 'urgent', ac.channel, ac.address, $5 || ':' || ac.id::text, $6::jsonb
           from public.alert_contact ac where ac.business_id = $2 and ac.active
         on conflict (dedupe_key) do nothing`,
        [
          deps.ctx.tenantId,
          deps.ctx.businessId,
          deps.ctx.leadId,
          deps.ctx.callId,
          `${deps.ctx.callId}:urgent:${args.kind}`,
          JSON.stringify({ urgent: args.kind, summary: args.summary }),
        ],
      );
      return { outcome: "ok", body: { flagged: args.kind, instruction: urgentInstruction(args.kind, deps.config) } };
    },
  }),

  finish_call: define({
    description:
      "Always call this right before ending the call, with the outcome and a two-sentence summary for the owner. Then say goodbye and end the call.",
    input: z.strictObject({
      outcome: z.enum(["callback_requested", "transfer_attempted", "info_only", "caller_declined", "not_a_lead", "wrong_number", "spam", "abusive"]),
      summary: text(600),
    }),
    // Also allowed after a missed transfer returns the caller to a new conversation.
    states: LIVE,
    async run(args, deps) {
      await wrapUpSession(deps.db, { callSid: deps.ctx.callSid, outcome: args.outcome, summary: args.summary });
      return { outcome: "ok", body: { instruction: "Say a short, warm goodbye and end the call." } };
    },
  }),
} as const;

export type ToolName = keyof typeof TOOLS;
export const TOOL_NAMES = Object.keys(TOOLS) as ToolName[];

export function isToolName(name: string): name is ToolName {
  return Object.hasOwn(TOOLS, name);
}

/** Facts the agent may state, for building its prompt. Drafts never appear. */
export function speakableKnowledge(config: BusinessConfig): { services: string[]; facts: string[] } {
  return {
    services: approvedServices(config).map((s) => s.label),
    facts: approvedFacts(config).map((f) => f.text),
  };
}
