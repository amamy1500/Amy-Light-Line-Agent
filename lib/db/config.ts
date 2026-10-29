import { parseBusinessConfig, type BusinessConfig } from "@/lib/business-rules/config";
import type { Queryable } from "./migrate";

export interface ActiveConfig {
  version: number;
  config: BusinessConfig;
}

/**
 * The business's active configuration, validated. Returns null when there is
 * none or it fails validation; callers then fall back to the safest
 * behaviour (ring the owner, capture otherwise, no AI).
 */
export async function loadActiveConfig(
  db: Queryable,
  businessId: string,
  log: (message: string, detail?: unknown) => void = () => {},
): Promise<ActiveConfig | null> {
  const { rows } = await db.query<{ version: number; config: unknown }>(
    "select version, config from public.business_config where business_id = $1 and active",
    [businessId],
  );
  const row = rows[0];
  if (!row) return null;
  try {
    return { version: row.version, config: parseBusinessConfig(row.config) };
  } catch (error) {
    log("active business config failed validation; AI disabled for this call", (error as Error).message);
    return null;
  }
}

/**
 * Saves a new config version and makes it the only active one, in one
 * statement so there is never a moment with two (or zero) active versions.
 */
export async function activateConfig(
  db: Queryable,
  input: { tenantId: string; businessId: string; config: BusinessConfig; createdBy: string },
): Promise<number> {
  const config = parseBusinessConfig(input.config);
  const { rows } = await db.query<{ version: number }>(
    "select app.activate_config($1, $2, $3::jsonb, $4) as version",
    [input.tenantId, input.businessId, JSON.stringify(config), input.createdBy],
  );
  return rows[0]!.version;
}
