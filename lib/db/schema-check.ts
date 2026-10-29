import type { Queryable } from "./migrate";

/**
 * The shape of the database our code expects, read from Postgres's own
 * catalog: tables, columns (name, type, nullable), indexes, row-level
 * security and policies on the public schema, and the app.* functions that
 * make every state change. Comparing a live database with a fresh one built
 * from the migrations proves the live one is exactly what the code needs.
 */
export interface SchemaShape {
  tables: string[];
  /** "table.column type[ not null]" */
  columns: string[];
  /** "table.index" */
  indexes: string[];
  /** Tables whose row-level security is ON. */
  rls: string[];
  /** "table.policy" */
  policies: string[];
  /** app.* function names (overloads collapse to one name). */
  functions: string[];
}

const sorted = (values: string[]) => [...new Set(values)].sort();

export async function readSchemaShape(db: Queryable): Promise<SchemaShape> {
  const tables = await db.query<{ name: string }>(
    "select table_name as name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'",
  );
  const columns = await db.query<{ t: string; c: string; type: string; nullable: string }>(
    `select table_name as t, column_name as c, data_type as type, is_nullable as nullable
       from information_schema.columns where table_schema = 'public'`,
  );
  const indexes = await db.query<{ t: string; i: string }>(
    "select tablename as t, indexname as i from pg_indexes where schemaname = 'public'",
  );
  const rls = await db.query<{ name: string }>(
    `select c.relname as name from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity`,
  );
  const policies = await db.query<{ t: string; p: string }>(
    "select tablename as t, policyname as p from pg_policies where schemaname = 'public'",
  );
  const functions = await db.query<{ name: string }>(
    "select p.proname as name from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app'",
  );
  return {
    tables: sorted(tables.rows.map((r) => r.name)),
    columns: sorted(columns.rows.map((r) => `${r.t}.${r.c} ${r.type}${r.nullable === "NO" ? " not null" : ""}`)),
    indexes: sorted(indexes.rows.map((r) => `${r.t}.${r.i}`)),
    rls: sorted(rls.rows.map((r) => r.name)),
    policies: sorted(policies.rows.map((r) => `${r.t}.${r.p}`)),
    functions: sorted(functions.rows.map((r) => r.name)),
  };
}

export interface SchemaDiff {
  part: keyof SchemaShape;
  /** In the code's schema, absent from the live database. */
  missing: string[];
  /** In the live database, not made by our migrations. */
  extra: string[];
}

/** What differs between the schema the code builds and a live one; empty means identical. */
export function compareSchemas(expected: SchemaShape, actual: SchemaShape): SchemaDiff[] {
  const parts = Object.keys(expected) as Array<keyof SchemaShape>;
  return parts
    .map((part) => {
      const want = new Set(expected[part]);
      const have = new Set(actual[part]);
      return {
        part,
        missing: expected[part].filter((x) => !have.has(x)),
        extra: actual[part].filter((x) => !want.has(x)),
      };
    })
    .filter((d) => d.missing.length || d.extra.length);
}
