-- 0009_ops_indexes: indexes for the questions asked on every call and on the
-- System health page (app/system, lib/db/system.ts).
--
-- Hot path: every call in Amy's hours first asks "is Amy already on one of our
-- calls?" (lib/db/repo.ts ownerOnCall). Open calls are few, so a partial index
-- on them keeps that check constant-time however many calls pile up.
create index call_open_by_line on public.call (tracking_number_id, started_at) where not completed;

-- Traffic counts for the last 24 hours / 7 days.
create index call_by_started on public.call (started_at);

-- "Questions it couldn't answer": misses of one tool, newest first.
create index tool_call_by_tool on public.tool_call (tool_name, created_at);

-- Open incidents, newest first.
create index incident_open on public.incident (created_at) where resolved_at is null;
