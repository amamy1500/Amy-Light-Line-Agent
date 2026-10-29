import { parseBusinessConfig, type ApprovedFact, type BusinessConfig } from "@/lib/business-rules/config";
import { forbiddenClaims, type Claim, type DecisionStatus, type ForbiddenClaim, type KnowledgeItem, type OwnerDecision } from "@/lib/knowledge/model";
import { activateConfig, loadActiveConfig } from "./config";
import type { Queryable } from "./migrate";

/** Inserts the tenant's knowledge items and their claims once; existing keys are left as they are. */
export async function seedKnowledge(
  db: Queryable,
  input: { tenantId: string; businessId: string; items: readonly KnowledgeItem[]; capturedOn: string },
): Promise<number> {
  let inserted = 0;
  for (const item of input.items) {
    const { rows } = await db.query<{ id: string }>(
      `insert into public.knowledge_item (tenant_id, business_id, key, title, kind, risk, topics, caller_question, suggested_text)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       on conflict (business_id, key) do nothing
       returning id`,
      [input.tenantId, input.businessId, item.key, item.title, item.kind, item.risk, item.topics, item.callerQuestion, item.suggestedText],
    );
    const id = rows[0]?.id;
    if (!id) continue;
    inserted += 1;
    for (const [position, claim] of item.claims.entries()) {
      await db.query(
        `insert into public.knowledge_claim (tenant_id, business_id, item_id, brand, value, quote, source_url, site_fact_id,
                                             spoken, markers, position, captured_on)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [input.tenantId, input.businessId, id, claim.brand, claim.value, claim.quote, claim.sourceUrl, claim.siteFactId,
         claim.spoken, claim.markers, position, input.capturedOn],
      );
    }
  }
  return inserted;
}

export interface StoredKnowledgeItem extends KnowledgeItem {
  id: string;
  version: number;
}

export async function listKnowledge(db: Queryable, businessId: string): Promise<StoredKnowledgeItem[]> {
  const { rows } = await db.query<{
    id: string; key: string; title: string; kind: KnowledgeItem["kind"]; risk: KnowledgeItem["risk"]; topics: string[];
    caller_question: string; suggested_text: string | null; status: DecisionStatus; approved_text: string | null;
    approved_value: KnowledgeItem["approvedValue"]; decided_by: string | null; decided_at: Date | null; version: number;
  }>("select * from public.knowledge_item where business_id = $1 order by created_at, key", [businessId]);
  const { rows: claims } = await db.query<{
    item_id: string; brand: Claim["brand"]; value: string; quote: string; source_url: string | null;
    site_fact_id: string | null; spoken: string; markers: string[];
  }>("select * from public.knowledge_claim where business_id = $1 order by item_id, position", [businessId]);
  return rows.map((r) => ({
    id: r.id,
    key: r.key,
    title: r.title,
    kind: r.kind,
    risk: r.risk,
    topics: r.topics,
    callerQuestion: r.caller_question,
    suggestedText: r.suggested_text,
    status: r.status,
    approvedText: r.approved_text,
    approvedValue: r.approved_value,
    decidedBy: r.decided_by,
    decidedAt: r.decided_at ? new Date(r.decided_at).toISOString() : null,
    version: r.version,
    claims: claims
      .filter((c) => c.item_id === r.id)
      .map((c) => ({
        brand: c.brand,
        value: c.value,
        quote: c.quote,
        sourceUrl: c.source_url,
        siteFactId: c.site_fact_id,
        spoken: c.spoken,
        markers: c.markers,
      })),
  }));
}

/**
 * How a tenant's calls are scanned: unapproved site claims across all of its
 * companies (on a shared line any company's claims may come up), and the
 * companies' names and aliases, which the agent must be free to say. Given
 * the call's company, the other companies' names, which it must never say
 * (Amy, 2026-10-29); a shared line's front desk names them all on purpose.
 */
export async function tenantScanOptions(
  db: Queryable,
  tenantId: string,
  businessId: string | null = null,
): Promise<{ forbiddenClaims: ForbiddenClaim[]; safePhrases: string[]; otherBusinesses: string[] }> {
  const { rows } = await db.query<{ id: string; name: string; kind: string }>(
    "select id, name, kind from public.business where tenant_id = $1",
    [tenantId],
  );
  const items: StoredKnowledgeItem[] = [];
  const namesOf = new Map<string, string[]>();
  for (const row of rows) {
    items.push(...(await listKnowledge(db, row.id)));
    const active = await loadActiveConfig(db, row.id).catch(() => null);
    namesOf.set(row.id, [row.name, ...(active ? [active.config.brand.spokenName, ...active.config.profile.aliases] : [])]);
  }
  const own = rows.find((r) => r.id === businessId);
  const ownNames = own ? namesOf.get(own.id)!.map((n) => n.toLowerCase()) : [];
  const otherBusinesses =
    own?.kind === "company"
      ? rows
          .filter((r) => r.id !== own.id && r.kind === "company")
          .flatMap((r) => namesOf.get(r.id)!)
          // A name this company also answers to ("Light Guys") is never another company's.
          .filter((name) => !ownNames.some((mine) => mine.includes(name.toLowerCase())))
      : [];
  return {
    forbiddenClaims: forbiddenClaims(items),
    safePhrases: [...new Set([...namesOf.values()].flat())],
    otherBusinesses: [...new Set(otherBusinesses)],
  };
}

/**
 * Records decisions the owner gave outside the console (e.g. by email)
 * through the same audited path as /approvals, then refreshes what the agent
 * may say. Only pending items change: a decision Amy later makes or undoes
 * in the console is never overwritten. Returns how many items it decided.
 */
export async function applyOwnerDecisions(
  db: Queryable,
  input: { tenantId: string; businessId: string; decisions: readonly OwnerDecision[]; by: string },
): Promise<number> {
  const items = new Map((await listKnowledge(db, input.businessId)).map((i) => [i.key, i]));
  let applied = 0;
  for (const decision of input.decisions) {
    const item = items.get(decision.key);
    if (!item) throw new Error(`no knowledge item "${decision.key}" for this business`);
    if (item.status !== "pending") continue;
    const text = decision.value ? decision.value.cities.join(", ") : (decision.text ?? null);
    if (decision.status === "approved" && !text) throw new Error(`approval of "${decision.key}" needs words or a value`);
    await decideKnowledge(db, { itemId: item.id, status: decision.status, text, value: decision.value ?? null, by: decision.by ?? input.by });
    applied += 1;
  }
  if (applied > 0) await syncConfigFromKnowledge(db, { tenantId: input.tenantId, businessId: input.businessId, by: input.by });
  return applied;
}

export async function decideKnowledge(
  db: Queryable,
  input: { itemId: string; status: DecisionStatus; text: string | null; value: KnowledgeItem["approvedValue"]; by: string },
): Promise<number> {
  // Suggested answers carry [blanks] only Amy can fill; approved words are spoken to callers as-is.
  if (input.status === "approved" && input.text && /\[[^\]]*\]/.test(input.text)) {
    throw new Error("Approved words still contain a [bracketed] blank");
  }
  const { rows } = await db.query<{ version: number }>(
    "select app.decide_knowledge($1, $2, $3, $4::jsonb, $5) as version",
    [input.itemId, input.status, input.text, input.value === null ? null : JSON.stringify(input.value), input.by],
  );
  return rows[0]!.version;
}

/**
 * The agent's facts and service area, projected from approved knowledge (K4).
 * Pure: the same items always give the same config section.
 */
export function projectKnowledge(items: readonly KnowledgeItem[]): Pick<BusinessConfig, "facts" | "serviceArea"> {
  const facts: ApprovedFact[] = items
    .filter((i) => i.status === "approved" && i.kind !== "service_area" && i.approvedText)
    .map((i) => ({
      id: i.key,
      text: i.approvedText!.slice(0, 400),
      topics: i.topics.length ? i.topics : [i.key],
      status: "approved" as const,
      ...(i.claims.find((c) => c.sourceUrl)?.sourceUrl ? { sourceUrl: i.claims.find((c) => c.sourceUrl)!.sourceUrl! } : {}),
      ...(i.decidedBy ? { approvedBy: i.decidedBy } : {}),
      ...(i.decidedAt ? { approvedAt: i.decidedAt } : {}),
    }));
  const area = items.find((i) => i.kind === "service_area" && i.status === "approved");
  const serviceArea: BusinessConfig["serviceArea"] = area
    ? { status: "approved", cities: area.approvedValue?.cities ?? [], zips: area.approvedValue?.zips ?? [] }
    : { status: "draft", cities: [], zips: [] };
  return { facts, serviceArea };
}

/**
 * Regenerates the active business config from the knowledge items and makes
 * it the new active version (audited). The agent reads facts live through its
 * tool, so an approval reaches the next call without re-publishing the agent.
 */
export async function syncConfigFromKnowledge(
  db: Queryable,
  input: { tenantId: string; businessId: string; by: string },
): Promise<number | null> {
  const active = await loadActiveConfig(db, input.businessId);
  if (!active) throw new Error("no active business config to update");
  const projected = projectKnowledge(await listKnowledge(db, input.businessId));
  const next = parseBusinessConfig({ ...active.config, ...projected });
  if (JSON.stringify(next.facts) === JSON.stringify(active.config.facts) && JSON.stringify(next.serviceArea) === JSON.stringify(active.config.serviceArea)) {
    return null;
  }
  return activateConfig(db, { tenantId: input.tenantId, businessId: input.businessId, config: next, createdBy: input.by });
}
