import type { AiMode, BusinessConfig } from "@/lib/business-rules/config";
import { christmasLightGuysConfig, type ConfigOverrides } from "@/lib/business-rules/tenants/christmas-light-guys";
import { frontDeskConfig } from "@/lib/business-rules/tenants/front-desk";
import { sublimePatioConfig } from "@/lib/business-rules/tenants/sublime-patio";
import { theFridgeConfig } from "@/lib/business-rules/tenants/the-fridge";
import type { KnowledgeItem, OwnerDecision } from "@/lib/knowledge/model";
import { CLG_KNOWLEDGE } from "@/lib/knowledge/tenants/christmas-light-guys";
import { CLG_QUESTION_BANK } from "@/lib/knowledge/tenants/clg-questions";

/** Everything the Christmas Light Guys' assistant may one day say: site claims, then common questions. */
const CLG_ITEMS = [...CLG_KNOWLEDGE, ...CLG_QUESTION_BANK];
import { SUBLIME_KNOWLEDGE } from "@/lib/knowledge/tenants/sublime-patio";
import { FRIDGE_KNOWLEDGE } from "@/lib/knowledge/tenants/the-fridge";
import { activateConfig } from "./config";
import { applyOwnerDecisions, decideKnowledge, listKnowledge, seedKnowledge, syncConfigFromKnowledge } from "./knowledge";
import type { Queryable } from "./migrate";

export interface ClgSeedOptions {
  ownerName: string;
  ownerRingE164: string;
  /**
   * One tracking number per ad channel, plus optionally the Christmas Light
   * Guys' own number (`main`): the one on the website, TV and QR code alike,
   * so its whisper names the company, not a channel. 512-339-9313 is never one
   * of these: Amy keeps it on her own system (2026-10-28).
   */
  numbers: { tv: string; web: string; print: string; main?: string | null };
  alertSms?: string | null;
  alertEmail?: string | null;
  /** Daily ring window; equal values ring all day. */
  ringStart?: string;
  ringEnd?: string;
  /** Days the window applies (0 = Sunday … 6 = Saturday). Default: every day. */
  ringDays?: number[];
  /** Defaults to "off": a fresh database never sends callers to an AI unasked. */
  aiMode?: AiMode;
  agentId?: string;
  /** "owner_clone" only with Amy's written consent to use her cloned voice. */
  voice?: BusinessConfig["ai"]["voice"];
  maxConcurrentSessions?: number;
  /**
   * Development demos only: approve these knowledge items with their
   * suggested wording, through the same decision path Amy uses, recorded as
   * decided by "DEMO SEED (not Amy)". Never used for a real tenant.
   */
  demoApprovedKeys?: string[];
  /** Amy's own decisions on the Christmas Light Guys' items (e.g. her email answers), with who decided. */
  ownerDecisions?: { decisions: readonly OwnerDecision[]; by: string };
  /**
   * The sister companies' own lines and the shared office line, each a
   * number we own (e.g. what Bestline forwards to). Absent → not seeded.
   */
  office?: {
    sublimePatio?: string | null;
    theFridge?: string | null;
    /** Shared line that rings Amy first (e.g. Bestline forward-all, or "app offline"). */
    sharedLine?: string | null;
    /**
     * Shared line Bestline forwards to only after Amy's phone rang and she
     * didn't answer, or was busy: the assistant answers at once.
     */
    bestlineMissed?: string | null;
    /** Other numbers the carrier forwards to only after Amy didn't answer: we never ring her again. */
    carrierRingsFirst?: string[];
  };
}

export interface ClgSeedResult {
  tenantId: string;
  businessId: string;
  campaignIds: { tv: string; web: string; print: string };
}

export interface OfficeSeedResult extends ClgSeedResult {
  sublimePatioId: string | null;
  theFridgeId: string | null;
  frontDeskId: string | null;
}

const TENANT = "McMurrough & Associates";
const BUSINESS = "Christmas Light Guys";
const CLG_ASK = "please say your name, your address, what you'd like lit, and the best time to reach you";

/** The operational settings every company and the shared line take from the seed. */
function seedOverrides(opts: ClgSeedOptions): ConfigOverrides {
  const start = opts.ringStart ?? "08:00";
  const end = opts.ringEnd ?? "20:00";
  return {
    ownerFirstName: opts.ownerName,
    aiMode: opts.aiMode ?? "off",
    voice: opts.voice ?? "stock",
    ...(opts.agentId ? { agentId: opts.agentId } : {}),
    maxConcurrentSessions: opts.maxConcurrentSessions ?? 8,
    ringHours: (opts.ringDays ?? [0, 1, 2, 3, 4, 5, 6]).map((day) => ({ day, open: start, close: end })),
    notifications: {
      sms: opts.alertSms ? [opts.alertSms] : [],
      email: opts.alertEmail ? [opts.alertEmail] : [],
    },
  };
}

/** The Christmas Light Guys config as seeded (also the source of the shared agent's prompt). */
export function seedConfig(opts: ClgSeedOptions): BusinessConfig {
  return christmasLightGuysConfig(seedOverrides(opts));
}

const one = async (db: Queryable, sql: string, params: unknown[]): Promise<string> => {
  const { rows } = await db.query<{ id: string }>(sql, params);
  return rows[0]!.id;
};

async function addAlertContacts(db: Queryable, tenantId: string, businessId: string, opts: ClgSeedOptions): Promise<void> {
  const alerts: Array<["sms" | "email", string]> = [];
  if (opts.alertSms) alerts.push(["sms", opts.alertSms]);
  if (opts.alertEmail) alerts.push(["email", opts.alertEmail]);
  for (const [channel, address] of alerts) {
    await db.query(
      "insert into public.alert_contact (tenant_id, business_id, channel, address) values ($1, $2, $3, $4)",
      [tenantId, businessId, channel, address],
    );
  }
}

async function addLine(
  db: Queryable,
  input: { tenantId: string; businessId: string; campaignId: string; e164: string; opts: ClgSeedOptions },
): Promise<string> {
  const office = input.opts.office ?? {};
  const ringOwner = input.e164 !== office.bestlineMissed && !(office.carrierRingsFirst ?? []).includes(input.e164);
  return one(
    db,
    `insert into public.tracking_number (tenant_id, business_id, campaign_id, e164, owner_name, owner_ring_e164, ring_owner)
     values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [input.tenantId, input.businessId, input.campaignId, input.e164, input.opts.ownerName, input.opts.ownerRingE164, ringOwner],
  );
}

/**
 * The Christmas Light Guys' own number (opts.numbers.main) as a "main line":
 * its whisper is "The Christmas Light Guys call." with no ad channel. Safe to
 * run again: a number already on a line is left as it is.
 */
async function ensureMainLine(db: Queryable, tenantId: string, businessId: string, opts: ClgSeedOptions): Promise<void> {
  const e164 = opts.numbers.main;
  if (!e164) return;
  const { rows: existing } = await db.query("select 1 from public.tracking_number where e164 = $1", [e164]);
  if (existing.length) return;
  const { rows: campaigns } = await db.query<{ id: string }>(
    "select id from public.campaign where business_id = $1 and channel = 'main_line' limit 1",
    [businessId],
  );
  const campaignId =
    campaigns[0]?.id ??
    (await one(
      db,
      `insert into public.campaign (tenant_id, business_id, brand_id, name, channel)
       select $1, $2, b.id, 'Christmas Light Guys line', 'main_line'
         from public.brand b where b.business_id = $2 and b.name = 'The Christmas Light Guys'
       returning id`,
      [tenantId, businessId],
    ));
  const line = await addLine(db, { tenantId, businessId, campaignId, e164, opts });
  await answersFor(db, tenantId, line, [businessId]);
}

/** Lists the companies a line answers for, in order; replays are no-ops. */
async function answersFor(db: Queryable, tenantId: string, trackingNumberId: string, businessIds: Array<string | null>): Promise<void> {
  let position = 0;
  for (const businessId of businessIds) {
    if (!businessId) continue;
    await db.query(
      `insert into public.line_business (tracking_number_id, tenant_id, business_id, position)
       values ($1, $2, $3, $4) on conflict do nothing`,
      [trackingNumberId, tenantId, businessId, position++],
    );
  }
}

/**
 * Seeds the pilot: one tenant, one business with its two public brands,
 * one campaign and tracking number per source, the alert contacts and the
 * active business configuration. Safe to run twice: an existing tenant of
 * the same name is returned as is.
 */
export async function seedChristmasLightGuys(db: Queryable, opts: ClgSeedOptions): Promise<ClgSeedResult> {
  const existing = await db.query<{ tenantId: string; businessId: string }>(
    `select t.id as "tenantId", b.id as "businessId"
       from public.tenant t join public.business b on b.tenant_id = t.id
      where t.name = $1 and b.name = $2`,
    [TENANT, BUSINESS],
  );
  const found = existing.rows[0];
  if (found) {
    // Knowledge items added in a later release (e.g. the common-question bank) reach an
    // existing office too; items already there, and Amy's decisions on them, are untouched.
    await seedKnowledge(db, { tenantId: found.tenantId, businessId: found.businessId, items: CLG_ITEMS, capturedOn: "2026-10-22" });
    // So does a main number set after the office was first made.
    await ensureMainLine(db, found.tenantId, found.businessId, opts);
    const { rows } = await db.query<{ channel: string; id: string }>(
      "select channel, id from public.campaign where business_id = $1",
      [found.businessId],
    );
    const byChannel = Object.fromEntries(rows.map((r) => [r.channel, r.id]));
    return {
      ...found,
      campaignIds: { tv: byChannel.tv!, web: byChannel.web!, print: byChannel.print! },
    };
  }

  const tenantId = await one(db, "insert into public.tenant (name) values ($1) returning id", [TENANT]);
  const businessId = await one(
    db,
    `insert into public.business (tenant_id, name, lifecycle_stage, website)
     values ($1, $2, 'client', 'https://thechristmaslightguys.com') returning id`,
    [tenantId, BUSINESS],
  );
  const clgBrand = await one(
    db,
    `insert into public.brand (tenant_id, business_id, name, domain, recovery_ask)
     values ($1, $2, 'The Christmas Light Guys', 'thechristmaslightguys.com', $3) returning id`,
    [tenantId, businessId, CLG_ASK],
  );
  await one(
    db,
    `insert into public.brand (tenant_id, business_id, name, domain, recovery_ask)
     values ($1, $2, 'The Light Guys', 'thelightguysaustintx.com', $3) returning id`,
    [tenantId, businessId, CLG_ASK],
  );

  const campaign = (name: string, channel: string) =>
    one(
      db,
      `insert into public.campaign (tenant_id, business_id, brand_id, name, channel)
       values ($1, $2, $3, $4, $5) returning id`,
      [tenantId, businessId, clgBrand, name, channel],
    );
  const campaignIds = {
    tv: await campaign("TV spot 2026", "tv"),
    web: await campaign("Seasonal landing page 2026", "web"),
    print: await campaign("Print 2026", "print"),
  };

  for (const channel of ["tv", "web", "print"] as const) {
    const line = await addLine(db, { tenantId, businessId, campaignId: campaignIds[channel], e164: opts.numbers[channel], opts });
    await answersFor(db, tenantId, line, [businessId]);
  }
  await ensureMainLine(db, tenantId, businessId, opts);

  await addAlertContacts(db, tenantId, businessId, opts);
  await activateConfig(db, { tenantId, businessId, config: seedConfig(opts), createdBy: "seed" });
  await seedKnowledge(db, { tenantId, businessId, items: CLG_ITEMS, capturedOn: "2026-10-22" });
  if (opts.ownerDecisions) {
    await applyOwnerDecisions(db, { tenantId, businessId, decisions: opts.ownerDecisions.decisions, by: opts.ownerDecisions.by });
  }
  const demo = new Set(opts.demoApprovedKeys ?? []);
  if (demo.size) {
    for (const item of await listKnowledge(db, businessId)) {
      if (!demo.has(item.key)) continue;
      if (!item.suggestedText) throw new Error(`demo approval of ${item.key} needs suggested wording`);
      await decideKnowledge(db, { itemId: item.id, status: "approved", text: item.suggestedText, value: null, by: "DEMO SEED (not Amy)" });
    }
    await syncConfigFromKnowledge(db, { tenantId, businessId, by: "DEMO SEED (not Amy)" });
  }
  return { tenantId, businessId, campaignIds };
}

interface CompanyDefinition {
  name: string;
  kind: "company" | "front_desk";
  website: string | null;
  brand: { name: string; domain: string | null; recoveryAsk: string };
  campaignName: string;
  config: BusinessConfig;
  knowledge: readonly KnowledgeItem[];
}

/**
 * One company (or the front desk), with a line when a number is given. An
 * existing company keeps its config and knowledge; a new number for it is
 * added as another line. A company with no number of its own still exists,
 * so a shared line can hand callers to it.
 */
async function seedCompany(
  db: Queryable,
  tenantId: string,
  def: CompanyDefinition,
  e164: string | null,
  opts: ClgSeedOptions,
): Promise<{ businessId: string; lineId: string | null }> {
  const { rows: found } = await db.query<{ id: string; campaignId: string | null; lineId: string | null }>(
    `select b.id,
            (select c.id from public.campaign c where c.business_id = b.id and c.channel = 'main_line' limit 1) as "campaignId",
            (select tn.id from public.tracking_number tn where tn.business_id = b.id and tn.e164 = $3) as "lineId"
       from public.business b where b.tenant_id = $1 and b.name = $2`,
    [tenantId, def.name, e164],
  );
  const existing = found[0];
  if (existing?.lineId) return { businessId: existing.id, lineId: existing.lineId };
  if (existing?.campaignId) {
    const lineId = e164 ? await addLine(db, { tenantId, businessId: existing.id, campaignId: existing.campaignId, e164, opts }) : null;
    return { businessId: existing.id, lineId };
  }
  const businessId = await one(
    db,
    `insert into public.business (tenant_id, name, lifecycle_stage, website, kind)
     values ($1, $2, 'client', $3, $4) returning id`,
    [tenantId, def.name, def.website, def.kind],
  );
  const brandId = await one(
    db,
    `insert into public.brand (tenant_id, business_id, name, domain, recovery_ask) values ($1, $2, $3, $4, $5) returning id`,
    [tenantId, businessId, def.brand.name, def.brand.domain, def.brand.recoveryAsk],
  );
  const campaignId = await one(
    db,
    `insert into public.campaign (tenant_id, business_id, brand_id, name, channel) values ($1, $2, $3, $4, 'main_line') returning id`,
    [tenantId, businessId, brandId, def.campaignName],
  );
  const lineId = e164 ? await addLine(db, { tenantId, businessId, campaignId, e164, opts }) : null;
  await addAlertContacts(db, tenantId, businessId, opts);
  await activateConfig(db, { tenantId, businessId, config: def.config, createdBy: "seed" });
  if (def.knowledge.length) await seedKnowledge(db, { tenantId, businessId, items: def.knowledge, capturedOn: "2026-10-22" });
  return { businessId, lineId };
}

/**
 * Everything one office answers for: the Christmas Light Guys, plus Sublime
 * Patio and The Fridge (on their own numbers if given), plus the shared lines
 * Bestline forwards 512-339-9313 to, which ask which company. The sister
 * companies exist whenever they have a number or a shared line can reach
 * them. Every line lists its own company first and its siblings after, so a
 * caller who named the wrong one can be moved. Safe to run twice.
 */
export async function seedOffice(db: Queryable, opts: ClgSeedOptions): Promise<OfficeSeedResult> {
  const clg = await seedChristmasLightGuys(db, opts);
  const overrides = seedOverrides(opts);
  const office = opts.office ?? {};
  const shared = [office.sharedLine, office.bestlineMissed].filter((n): n is string => Boolean(n));
  const siblings = shared.length > 0;

  const sublime = office.sublimePatio || siblings
    ? await seedCompany(db, clg.tenantId, {
        name: "Sublime Patio",
        kind: "company",
        website: "https://sublimepatio.com",
        brand: { name: "Sublime Patio", domain: "sublimepatio.com", recoveryAsk: "please say your name, your address, what project you have in mind, and the best time to reach you" },
        campaignName: "Main line",
        config: sublimePatioConfig(overrides),
        knowledge: SUBLIME_KNOWLEDGE,
      }, office.sublimePatio ?? null, opts)
    : null;
  const fridge = office.theFridge || siblings
    ? await seedCompany(db, clg.tenantId, {
        name: "The Fridge",
        kind: "company",
        website: "https://thefridgevending.com",
        brand: { name: "The Fridge", domain: "thefridgevending.com", recoveryAsk: "please say your name, where the machine is or where you'd like one, what you need, and the best time to reach you" },
        campaignName: "Main line",
        config: theFridgeConfig(overrides),
        knowledge: FRIDGE_KNOWLEDGE,
      }, office.theFridge ?? null, opts)
    : null;
  const deskDefinition: CompanyDefinition = {
    name: `${opts.ownerName}'s office line`,
    kind: "front_desk",
    website: null,
    brand: {
      name: `${opts.ownerName}'s office line`,
      domain: null,
      recoveryAsk: "please say which company you're calling about, The Christmas Light Guys, Sublime Patio or The Fridge, then your name, what you need, and the best time to reach you",
    },
    campaignName: "Shared office line",
    config: frontDeskConfig(overrides),
    knowledge: [],
  };
  const deskLines: Array<{ businessId: string; lineId: string | null }> = [];
  for (const e164 of shared) deskLines.push(await seedCompany(db, clg.tenantId, deskDefinition, e164, opts));

  const clgId = clg.businessId;
  const sublimeId = sublime?.businessId ?? null;
  const fridgeId = fridge?.businessId ?? null;
  const { rows: clgLines } = await db.query<{ id: string }>("select id from public.tracking_number where business_id = $1", [clgId]);
  for (const line of clgLines) await answersFor(db, clg.tenantId, line.id, [clgId, sublimeId, fridgeId]);
  if (sublime?.lineId) await answersFor(db, clg.tenantId, sublime.lineId, [sublimeId, clgId, fridgeId]);
  if (fridge?.lineId) await answersFor(db, clg.tenantId, fridge.lineId, [fridgeId, clgId, sublimeId]);
  for (const desk of deskLines) if (desk.lineId) await answersFor(db, clg.tenantId, desk.lineId, [clgId, sublimeId, fridgeId]);

  return { ...clg, sublimePatioId: sublimeId, theFridgeId: fridgeId, frontDeskId: deskLines[0]?.businessId ?? null };
}
