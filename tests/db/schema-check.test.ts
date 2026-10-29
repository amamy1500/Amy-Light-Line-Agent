import { describe, expect, it } from "vitest";
import { openPglite } from "@/lib/db/pglite";
import { compareSchemas, readSchemaShape } from "@/lib/db/schema-check";

// scripts/db-check.ts compares a live database with one built from the
// migrations; these prove the comparison sees what matters.
describe("schema check", () => {
  it("two databases built from the same migrations match exactly", async () => {
    const [a, b] = await Promise.all([openPglite(), openPglite()]);
    const shape = await readSchemaShape(a);
    expect(compareSchemas(shape, await readSchemaShape(b))).toEqual([]);
    expect(shape.tables).toContain("call");
    expect(shape.indexes).toContain("call.call_open_by_line");
    expect(shape.rls).toContain("call");
    expect(shape.functions).toContain("ingest_inbound_call");
  });

  it("names a dropped index, a missing column and security switched off", async () => {
    const [built, live] = await Promise.all([openPglite(), openPglite()]);
    await live.exec(`
      drop index public.call_open_by_line;
      alter table public.incident drop column resolved_by;
      alter table public.outbox disable row level security;
      create table public.stray (id int);
    `);
    const diffs = compareSchemas(await readSchemaShape(built), await readSchemaShape(live));
    const part = (name: string) => diffs.find((d) => d.part === name);
    expect(part("indexes")?.missing).toEqual(["call.call_open_by_line"]);
    expect(part("columns")?.missing).toEqual(["incident.resolved_by text"]);
    expect(part("rls")?.missing).toContain("outbox");
    expect(part("tables")?.extra).toEqual(["stray"]);
  });
});
