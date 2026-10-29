-- 0003_knowledge: the verified business brain and Amy's approval queue.
--
-- Invariants (tests/db/knowledge.test.ts, evals/knowledge.test.ts):
--   K1  Every claim keeps its source: brand, quote, URL and evidence id.
--   K2  An item is truth only after a person decides it; an approval always
--       records who, when, and the exact words (or the structured value).
--   K3  Decisions are append-only history: each one is an event with the
--       previous status and text, and bumps the item's version.
--   K4  The agent's facts and service area are a projection of approved
--       items (business_config is regenerated from them; never edited by hand).

create table public.knowledge_item (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenant(id),
  business_id     uuid not null references public.business(id),
  key             text not null check (key ~ '^[a-z][a-z0-9_]{1,63}$'),
  title           text not null,
  kind            text not null check (kind in ('fact', 'service_area', 'policy')),
  risk            text not null check (risk in ('low', 'high')),
  topics          text[] not null default '{}',
  caller_question text not null,
  suggested_text  text,
  status          text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  approved_text   text,
  approved_value  jsonb,
  decided_by      text,
  decided_at      timestamptz,
  version         int not null default 0,
  created_at      timestamptz not null default now(),
  unique (business_id, key),
  check (status <> 'approved' or (decided_by is not null and decided_at is not null
         and (approved_text is not null or approved_value is not null))),
  check (status <> 'rejected' or (decided_by is not null and decided_at is not null))
);

create table public.knowledge_claim (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenant(id),
  business_id  uuid not null references public.business(id),
  item_id      uuid not null references public.knowledge_item(id),
  brand        text not null check (brand in ('clg', 'tlg', 'policy')),
  value        text not null,
  quote        text not null,
  source_url   text,
  site_fact_id text,
  spoken       text not null,
  markers      text[] not null default '{}',
  position     int not null,
  captured_on  date not null,
  unique (item_id, position)
);

-- Amy decides an item. Approve needs her words (or the structured value);
-- reject needs nothing but her. Returns the new version.
create function app.decide_knowledge(
  p_item uuid, p_status text, p_text text, p_value jsonb, p_by text
) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_item public.knowledge_item;
  v_user uuid := (select auth.uid());
  v_by   text := p_by;
begin
  select * into v_item from public.knowledge_item where id = p_item for update;
  if not found then
    raise exception 'unknown knowledge item %', p_item using errcode = 'P0002';
  end if;
  if v_user is not null then
    if not app.is_staff(v_item.tenant_id) then
      raise exception 'not allowed' using errcode = '42501';
    end if;
    v_by := v_user::text;
  end if;
  if p_status not in ('approved', 'rejected', 'pending') then
    raise exception 'unknown decision %', p_status using errcode = '22023';
  end if;
  if p_status = 'approved' and nullif(btrim(p_text), '') is null and p_value is null then
    raise exception 'an approval needs the exact words' using errcode = '22023';
  end if;
  if nullif(btrim(v_by), '') is null then
    raise exception 'a decision needs a person' using errcode = '22023';
  end if;

  update public.knowledge_item set
    status         = p_status,
    approved_text  = case when p_status = 'approved' then nullif(btrim(p_text), '') end,
    approved_value = case when p_status = 'approved' then p_value end,
    decided_by     = case when p_status = 'pending' then null else v_by end,
    decided_at     = case when p_status = 'pending' then null else now() end,
    version        = version + 1
  where id = p_item;

  perform app.emit(v_item.tenant_id, v_item.business_id, 'knowledge', p_item, 'knowledge.' || p_status,
                   jsonb_build_object('key', v_item.key, 'from', v_item.status, 'previous_text', v_item.approved_text,
                                      'text', nullif(btrim(p_text), ''), 'value', p_value, 'version', v_item.version + 1),
                   'user', v_by);
  return v_item.version + 1;
end $$;

alter table public.knowledge_item  enable row level security;
alter table public.knowledge_claim enable row level security;
create policy knowledge_item_read  on public.knowledge_item  for select using (app.can_read(tenant_id, business_id));
create policy knowledge_claim_read on public.knowledge_claim for select using (app.can_read(tenant_id, business_id));

revoke all on public.knowledge_item, public.knowledge_claim from anon;
revoke insert, update, delete, truncate on public.knowledge_item, public.knowledge_claim from authenticated;
grant select on public.knowledge_item, public.knowledge_claim to authenticated;

revoke execute on all functions in schema app from public;
grant execute on function app.can_read(uuid, uuid) to authenticated;
grant execute on function app.is_staff(uuid) to authenticated;
grant execute on function app.lead_rank(text) to authenticated;
grant execute on function app.lead_is_terminal(text) to authenticated;
grant execute on function app.lead_transition_allowed(text, text) to authenticated;
grant execute on function app.transition_lead(uuid, text, text, text, bigint) to authenticated;
grant execute on function app.fact_source_rank(text) to authenticated;
grant execute on function app.decide_knowledge(uuid, text, text, jsonb, text) to authenticated;
