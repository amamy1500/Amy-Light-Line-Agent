import pg from "pg";
import { migrate, type Executor, type Migration, type Queryable } from "./migrate";

/**
 * TLS for anything leaving this machine (Supabase); a local database needs
 * none. Supabase's certificate chain is its own, so the link is encrypted
 * without checking the chain against the system's CAs.
 */
export function pgSsl(connectionString: string): pg.PoolConfig["ssl"] {
  return /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString) ? undefined : { rejectUnauthorized: false };
}

/**
 * Server-side Postgres (Supabase in production). The connection string must
 * be the server-only one; it is never exposed to the browser.
 */
export function openPgPool(connectionString: string): pg.Pool & Queryable {
  return new pg.Pool({ connectionString, max: 5, ssl: pgSsl(connectionString) }) as pg.Pool & Queryable;
}

/** Runs migrations on one dedicated client so BEGIN/COMMIT share a connection. */
export async function migratePg(pool: pg.Pool, list: readonly Migration[]): Promise<string[]> {
  const client = await pool.connect();
  try {
    const executor: Executor = {
      query: (sql, params) => client.query(sql, params as unknown[]) as never,
      exec: (sql) => client.query(sql),
    };
    return await migrate(executor, list);
  } finally {
    client.release();
  }
}
