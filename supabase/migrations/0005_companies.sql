-- Several companies answered by one office: sister businesses under one
-- tenant, and a shared line whose company is learned during the call
-- (docs/research/one-number-three-businesses.md §3).

-- ---------------------------------------------------------------- business kinds

-- A front desk owns a shared line until the caller's company is known; it has
-- operating rules (AI mode, hours, capacity) but no services or facts.
alter table public.business add column kind text not null default 'company'
  check (kind in ('company', 'front_desk'));

-- ---------------------------------------------------------------- which companies a line answers for

-- In the order the agent offers them. A dedicated number lists its own
-- company first (a caller may still be switched to a sibling); the shared
-- line lists every company it answers for.
create table public.line_business (
  tracking_number_id uuid not null references public.tracking_number(id) on delete cascade,
  tenant_id          uuid not null references public.tenant(id),
  business_id        uuid not null references public.business(id),
  position           int  not null default 0,
  primary key (tracking_number_id, business_id)
);
alter table public.line_business enable row level security;
create policy line_business_read on public.line_business for select using (app.can_read(tenant_id, business_id));

-- How the call's company was decided: by the number, by what the caller said,
-- by Amy afterwards, or not at all.
alter table public.call add column business_resolution text
  check (business_resolution in ('line', 'caller_said', 'amy_assigned', 'unknown'));

-- Knowledge claims can come from the sister companies' sites.
alter table public.knowledge_claim drop constraint knowledge_claim_brand_check;
alter table public.knowledge_claim add constraint knowledge_claim_brand_check
  check (brand in ('clg', 'tlg', 'sp', 'tf', 'policy'));

-- ---------------------------------------------------------------- capacity is per vendor account

-- All companies share one ElevenLabs plan, so admission locks and counts at
-- the tenant, not the business: three companies × 8 slots must never exceed
-- the plan's concurrency (finding §3.6 #2).
create or replace function app.start_agent_session(
  p_call_sid text, p_provider text, p_agent_id text, p_agent_version text,
  p_route_reason text, p_max_sessions int, p_stale_after interval
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_call    public.call;
  v_session uuid;
  v_active  int;
  v_lead    uuid;
begin
  select * into v_call from public.call where twilio_call_sid = p_call_sid for update;
  if not found then
    raise exception 'unknown call %', p_call_sid using errcode = 'P0002';
  end if;

  -- Replay of the same hand-off: return the session already started.
  select id into v_session from public.agent_session
   where call_id = v_call.id and status = 'active' order by started_at desc limit 1;
  if v_session is not null then
    return v_session;
  end if;

  perform 1 from public.tenant where id = v_call.tenant_id for update;
  select count(*) into v_active from public.agent_session
   where tenant_id = v_call.tenant_id and status = 'active' and started_at > now() - p_stale_after;
  if v_active >= p_max_sessions then
    perform app.emit(v_call.tenant_id, v_call.business_id, 'call', v_call.id, 'agent.admission_refused',
                     jsonb_build_object('active', v_active, 'max', p_max_sessions), 'system', null);
    return null;
  end if;

  v_lead := coalesce(v_call.lead_id,
    app.open_or_create_lead(v_call.tenant_id, v_call.business_id, v_call.campaign_id,
                            'agent_call', v_call.from_e164, 'new', 'webhook', p_call_sid));
  insert into public.agent_session (tenant_id, business_id, call_id, lead_id, provider, agent_id,
                                    agent_version, route_reason)
  values (v_call.tenant_id, v_call.business_id, v_call.id, v_lead, p_provider, p_agent_id,
          p_agent_version, p_route_reason)
  returning id into v_session;

  update public.call set state = 'agent_active', route_reason = p_route_reason, lead_id = v_lead,
                         updated_at = now()
   where id = v_call.id;
  perform app.emit(v_call.tenant_id, v_call.business_id, 'call', v_call.id, 'agent.connected',
                   jsonb_build_object('session_id', v_session, 'reason', p_route_reason,
                                      'agent_version', p_agent_version), 'system', null);
  return v_session;
end $$;

create or replace function app.active_agent_sessions(p_business uuid, p_stale_after interval) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.agent_session s
   where s.tenant_id = (select b.tenant_id from public.business b where b.id = p_business)
     and s.status = 'active' and s.started_at > now() - p_stale_after
$$;

-- ---------------------------------------------------------------- assigning the company

-- Moves a call (and its lead) to the company the caller wants. Idempotent;
-- refuses a company the line doesn't answer for. When the target company
-- already has an open lead for this caller (the 7-day rule) or the lead is
-- shared with other calls, this call's facts are replayed into the target
-- lead through record_lead_fact, so provenance and source ranking still hold.
create function app.assign_business(p_call_sid text, p_business uuid, p_how text, p_actor text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_call     public.call;
  v_lead     public.lead;
  v_from     uuid;
  v_target   uuid;
  v_others   int;
  v_fact     record;
  v_status   text;
begin
  select * into v_call from public.call where twilio_call_sid = p_call_sid for update;
  if not found then
    raise exception 'unknown call %', p_call_sid using errcode = 'P0002';
  end if;
  if v_call.business_id = p_business then
    return jsonb_build_object('status', 'unchanged', 'lead_id', v_call.lead_id);
  end if;
  if not exists (select 1 from public.line_business lb
                  where lb.tracking_number_id = v_call.tracking_number_id and lb.business_id = p_business) then
    raise exception 'business % is not answered on this line', p_business using errcode = '22023';
  end if;

  v_from := v_call.business_id;
  v_status := case when exists (select 1 from public.business b where b.id = v_from and b.kind = 'front_desk')
                   then 'assigned' else 'switched' end;

  update public.call set business_id = p_business, business_resolution = p_how, updated_at = now()
   where id = v_call.id;
  update public.agent_session set business_id = p_business where call_id = v_call.id;
  update public.tool_call set business_id = p_business where call_id = v_call.id;

  if v_call.lead_id is not null then
    select * into v_lead from public.lead where id = v_call.lead_id for update;
    if v_lead.contact_phone is not null then
      select id into v_target from public.lead
       where business_id = p_business and contact_phone = v_lead.contact_phone
         and not app.lead_is_terminal(state) and created_at > now() - interval '7 days'
       order by created_at desc limit 1
       for update;
    end if;
    select count(*) into v_others from public.call where lead_id = v_lead.id and id <> v_call.id;

    if v_target is null and v_others = 0 then
      -- The lead belongs to this call alone: it moves, with everything on it.
      update public.lead set business_id = p_business, updated_at = now() where id = v_lead.id;
      update public.lead_fact set business_id = p_business where lead_id = v_lead.id;
      update public.task set business_id = p_business where lead_id = v_lead.id;
      v_target := v_lead.id;
    else
      v_target := coalesce(v_target,
        app.open_or_create_lead(v_call.tenant_id, p_business, v_call.campaign_id, v_lead.source,
                                v_lead.contact_phone, 'new', 'system', p_actor));
      for v_fact in
        select field, value, source, confidence, evidence from public.lead_fact_current
         where lead_id = v_lead.id and call_id = v_call.id
      loop
        perform app.record_lead_fact(v_target, v_call.id, v_fact.field, v_fact.value, v_fact.source,
                                     v_fact.confidence, v_fact.evidence);
      end loop;
      -- This call's open tasks follow it, unless the target already has one of that kind.
      update public.task t set lead_id = v_target, business_id = p_business, updated_at = now()
       where t.call_id = v_call.id and t.status = 'open'
         and not exists (select 1 from public.task o where o.lead_id = v_target and o.kind = t.kind and o.status = 'open');
      update public.task set status = 'cancelled', updated_at = now(), completed_at = now(), completed_by = 'assign_business'
       where call_id = v_call.id and status = 'open' and lead_id = v_lead.id;
      update public.agent_session set lead_id = v_target where call_id = v_call.id;
      update public.call set lead_id = v_target where id = v_call.id;
      if v_others = 0 then
        update public.lead set state = 'duplicate', updated_at = now() where id = v_lead.id;
      end if;
      perform app.emit(v_call.tenant_id, p_business, 'lead', v_target, 'lead.merged',
                       jsonb_build_object('from_lead', v_lead.id, 'call_id', v_call.id), 'system', p_actor);
      v_status := 'merged';
    end if;
  end if;

  perform app.emit(v_call.tenant_id, p_business, 'call', v_call.id,
                   case when v_status = 'switched' then 'call.business_switched' else 'call.business_assigned' end,
                   jsonb_build_object('from', v_from, 'to', p_business, 'how', p_how), 'system', p_actor);
  return jsonb_build_object('status', v_status, 'lead_id', v_target);
end $$;
