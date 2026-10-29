/** Anything that can run a parameterised query: pg Pool/Client, PGlite, or a transaction. */
export interface Queryable {
  query<R = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: R[] }>;
}

/** A Queryable that can also run multi-statement SQL scripts. */
export interface Executor extends Queryable {
  exec(sql: string): Promise<unknown>;
}

export interface Migration {
  id: string;
  sql: string;
}

/**
 * Applies pending migrations in order, each in its own transaction, and
 * records them in app.schema_migration. Returns the ids it applied.
 * Production Supabase projects may apply the same .sql files with the
 * Supabase CLI instead; both paths use one source of truth.
 */
export async function migrate(db: Executor, list: readonly Migration[]): Promise<string[]> {
  await db.exec(`
    create schema if not exists app;
    create table if not exists app.schema_migration (
      id text primary key,
      applied_at timestamptz not null default now()
    );
  `);
  const { rows } = await db.query<{ id: string }>("select id from app.schema_migration");
  const done = new Set(rows.map((r) => r.id));
  const applied: string[] = [];

  for (const migration of list) {
    if (done.has(migration.id)) continue;
    if (!/^[A-Za-z0-9_-]+$/.test(migration.id)) {
      throw new Error(`Invalid migration id ${migration.id}`);
    }
    await db.exec("begin");
    try {
      await db.exec(migration.sql);
      await db.query("insert into app.schema_migration (id) values ($1)", [migration.id]);
      await db.exec("commit");
    } catch (error) {
      await db.exec("rollback");
      throw new Error(`Migration ${migration.id} failed: ${(error as Error).message}`, { cause: error });
    }
    applied.push(migration.id);
  }
  return applied;
}
