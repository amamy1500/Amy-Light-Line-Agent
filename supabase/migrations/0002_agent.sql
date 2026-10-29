-- 0002_agent: the AI receptionist layer on top of 0001's call-recovery ledger.
--
-- Invariants added here (each has a test in tests/db/agent-lifecycle.test.ts):
--   A1  An agent session belongs to exactly one call; one session row per
--       vendor conversation id, however often the vendor retries.
--   A2  Every tool call is stored once per idempotency key; a retried tool
--       call returns the stored result instead of acting twice.
--   A3  Lead facts keep their provenance. A fact from a less trusted source
--       never overwrites one from a more trusted source
--       (human > caller_via_agent > web_form > post_call_extraction > caller_id).
--   A4  Every completed call still ends with exactly one lead (0001's I5):
--       the agent path opens the lead when the agent connects.
--   A5  One open callback task per lead; repeat requests update it.
--   A6  At most `ai.maxConcurrentSessions` live agent sessions per business,
--       decided under a row lock so concurrent arrivals cannot overshoot.
--   A7  Transfer attempts are counted; a transfer is "transferred" only on
--       DialBridged=true, exactly like the first ring (I4).

-- ---------------------------------------------------------------- config as data

create table public.business_config (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenant(id),
  business_id uuid not null references public.business(id),
  version     int  not null check (version > 0),
  config      jsonb not null,
  active      boolean not null default false,
  created_by  text,
  created_at  timestamptz not null default now(),
  unique (business_id, version)
);
create unique index business_config_one_active on public.business_config (business_id) where active;

-- New version becomes the only active one, atomically. Old versions stay for audit.
create function app.activate_config(p_tenant uuid, p_business uuid, p_config jsonb, p_by text) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_version int;
begin
  perform 1 from public.business where id = p_business and tenant_id = p_tenant for update;
  if not found then
    raise exception 'unknown business % for tenant %', p_business, p_tenant using errcode = 'P0002';
  end if;
  select coalesce(max(version), 0) + 1 into v_version from public.business_config where business_id = p_business;
  update public.business_config set active = false where business_id = p_business and active;
  insert into public.business_config (tenant_id, business_id, version, config, active, created_by)
  values (p_tenant, p_business, v_version, p_config, true, p_by);
  perform app.emit(p_tenant, p_business, 'business', p_business, 'config.activated',
                   jsonb_build_object('version', v_version, 'config_version', p_config ->> 'configVersion',
                                      'ai_mode', p_config #>> '{ai,mode}'),
                   'user', p_by);
  return v_version;
end $$;

-- ---------------------------------------------------------------- call states for the agent path

alter table public.call drop constraint call_state_check;
alter table public.call add constraint call_state_check check (state in (
  'ringing_owner', 'owner_answered', 'recovery', 'message_captured', 'abandoned',
  'agent_active', 'transfer_ringing', 'transferred', 'agent_completed'));
alter table public.call add column route_reason text;
alter table public.call add column transfer_attempts int not null default 0;
-- What the screen whispers to Amy before she presses 1 on a transfer.
alter table public.call add column handoff_note text check (length(handoff_note) <= 240);
-- Ring hours now come from the business config (business_config.config.ringHours),
-- so one weekly schedule decides; the per-number window from 0001 is retired.
alter table public.tracking_number drop column ring_timezone;
alter table public.tracking_number drop column ring_start;
alter table public.tracking_number drop column ring_end;

alter table public.lead drop constraint lead_source_check;
alter table public.lead add constraint lead_source_check check (source in (
  'call_recovery', 'call_answered', 'abandoned_call', 'web_form', 'agent_call'));

alter table public.lead add column customer_type text check (customer_type in ('new', 'returning', 'unknown'));
alter table public.lead add column property_type text check (property_type in ('residential', 'commercial', 'unknown'));
alter table public.lead add column zip text;
alter table public.lead add column job_type text;
alter table public.lead add column stated_source text;
alter table public.lead add column intent text not null default 'unknown'
  check (intent in ('hot', 'warm', 'cold', 'not_a_lead', 'unknown'));
alter table public.lead add column summary text;
alter table public.lead add column needs_review boolean not null default false;
alter table public.lead add column compliance jsonb not null default '{}';

alter table public.outbox drop constraint outbox_kind_check;
alter table public.outbox add constraint outbox_kind_check check (kind in (
  'message', 'abandoned', 'answered', 'web_form', 'agent_lead', 'callback', 'transfer_missed', 'review'));

-- ---------------------------------------------------------------- agent sessions (A1, A6)

create table public.agent_session (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenant(id),
  business_id      uuid not null references public.business(id),
  call_id          uuid not null references public.call(id),
  lead_id          uuid references public.lead(id),
  provider         text not null check (provider in ('elevenlabs', 'simulator')),
  conversation_id  text unique,
  agent_id         text,
  agent_version    text,
  status           text not null default 'active' check (status in ('active', 'ended', 'failed')),
  route_reason     text not null,
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,
  end_reason       text,
  transcript       jsonb,
  summary          text,
  data_collection  jsonb not null default '{}',
  evaluation       jsonb not null default '{}',
  metadata         jsonb not null default '{}',
  post_call_at     timestamptz
);
create index agent_session_live on public.agent_session (business_id, started_at) where status = 'active';
create index agent_session_by_call on public.agent_session (call_id);

-- ---------------------------------------------------------------- tool calls (A2)

create table public.tool_call (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenant(id),
  business_id      uuid not null references public.business(id),
  agent_session_id uuid references public.agent_session(id),
  call_id          uuid references public.call(id),
  lead_id          uuid references public.lead(id),
  tool_name        text not null,
  idempotency_key  text not null unique,
  input            jsonb not null,
  output           jsonb not null,
  outcome          text not null check (outcome in ('ok', 'rejected', 'error')),
  latency_ms       int,
  created_at       timestamptz not null default now()
);
create index tool_call_by_session on public.tool_call (agent_session_id, created_at);

-- ---------------------------------------------------------------- lead facts with provenance (A3)

create table public.lead_fact (
  id          bigint generated always as identity primary key,
  tenant_id   uuid not null references public.tenant(id),
  business_id uuid not null references public.business(id),
  lead_id     uuid not null references public.lead(id),
  call_id     uuid references public.call(id),
  field       text not null check (field in (
                'caller_name', 'customer_type', 'property_type', 'property_address', 'zip',
                'service_requested', 'job_type', 'desired_timing', 'callback_window',
                'lead_source', 'notes', 'callback_phone')),
  value       text not null check (length(value) between 1 and 500),
  source      text not null check (source in (
                'human', 'caller_via_agent', 'web_form', 'post_call_extraction', 'caller_id')),
  confidence  numeric(3, 2) check (confidence is null or confidence between 0 and 1),
  evidence    text,
  created_at  timestamptz not null default now()
);
create index lead_fact_by_lead on public.lead_fact (lead_id, field, id);

create function app.fact_source_rank(p_source text) returns int
language sql immutable as $$
  select case p_source
    when 'human' then 5 when 'caller_via_agent' then 4 when 'web_form' then 3
    when 'post_call_extraction' then 2 when 'caller_id' then 1 else 0
  end
$$;

-- The value currently shown for a field: highest-ranked source, newest within it.
create view public.lead_fact_current with (security_invoker = true) as
  select distinct on (lead_id, field)
         id, lead_id, field, value, source, confidence, evidence, call_id, created_at, tenant_id, business_id
    from public.lead_fact
   order by lead_id, field, app.fact_source_rank(source) desc, id desc;

-- Records a fact and refreshes the lead's denormalised column when this fact
-- now wins for its field. Returns true when the fact is the current value.
create function app.record_lead_fact(
  p_lead uuid, p_call uuid, p_field text, p_value text, p_source text,
  p_confidence numeric, p_evidence text
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_lead    public.lead;
  v_value   text := nullif(btrim(p_value), '');
  v_current record;
begin
  if v_value is null then
    return false;
  end if;
  select * into v_lead from public.lead where id = p_lead for update;
  if not found then
    raise exception 'unknown lead %', p_lead using errcode = 'P0002';
  end if;

  insert into public.lead_fact (tenant_id, business_id, lead_id, call_id, field, value, source, confidence, evidence)
  values (v_lead.tenant_id, v_lead.business_id, p_lead, p_call, p_field, left(v_value, 500), p_source,
          p_confidence, left(p_evidence, 500));

  select value, source into v_current
    from public.lead_fact_current where lead_id = p_lead and field = p_field;
  if v_current.value is distinct from v_value or v_current.source is distinct from p_source then
    return false; -- a more trusted source already holds this field (A3)
  end if;

  update public.lead set
    contact_name    = case when p_field = 'caller_name'       then v_value else contact_name end,
    address         = case when p_field = 'property_address'  then v_value else address end,
    service_wanted  = case when p_field = 'service_requested' then v_value else service_wanted end,
    timing          = case when p_field = 'desired_timing'    then v_value else timing end,
    callback_window = case when p_field = 'callback_window'   then v_value else callback_window end,
    zip             = case when p_field = 'zip'               then v_value else zip end,
    job_type        = case when p_field = 'job_type'          then v_value else job_type end,
    stated_source   = case when p_field = 'lead_source'       then v_value else stated_source end,
    customer_type   = case when p_field = 'customer_type' and v_value in ('new', 'returning', 'unknown')
                           then v_value else customer_type end,
    property_type   = case when p_field = 'property_type' and v_value in ('residential', 'commercial', 'unknown')
                           then v_value else property_type end,
    notes           = case when p_field = 'notes' then left(coalesce(notes || E'\n', '') || v_value, 2000) else notes end,
    updated_at      = now()
  where id = p_lead;

  perform app.emit(v_lead.tenant_id, v_lead.business_id, 'lead', p_lead, 'lead.fact_recorded',
                   jsonb_build_object('field', p_field, 'source', p_source, 'confidence', p_confidence),
                   case when p_source = 'human' then 'user' else 'agent' end, null);
  return true;
end $$;

-- ---------------------------------------------------------------- tasks (A5)

create table public.task (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenant(id),
  business_id  uuid not null references public.business(id),
  lead_id      uuid not null references public.lead(id),
  call_id      uuid references public.call(id),
  kind         text not null check (kind in ('callback', 'review')),
  status       text not null default 'open' check (status in ('open', 'done', 'cancelled')),
  priority     text not null default 'normal' check (priority in ('high', 'normal')),
  due_window   text,
  reason       text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  completed_at timestamptz,
  completed_by text
);
create unique index task_one_open_per_kind on public.task (lead_id, kind) where status = 'open';

create function app.request_callback(
  p_lead uuid, p_call uuid, p_window text, p_reason text, p_priority text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_lead public.lead;
  v_task uuid;
begin
  select * into v_lead from public.lead where id = p_lead for update;
  if not found then
    raise exception 'unknown lead %', p_lead using errcode = 'P0002';
  end if;

  select id into v_task from public.task where lead_id = p_lead and kind = 'callback' and status = 'open';
  if v_task is not null then
    update public.task set
      due_window = coalesce(nullif(p_window, ''), due_window),
      reason     = coalesce(nullif(p_reason, ''), reason),
      priority   = case when p_priority = 'high' then 'high' else priority end,
      updated_at = now()
    where id = v_task;
    return v_task;
  end if;

  insert into public.task (tenant_id, business_id, lead_id, call_id, kind, priority, due_window, reason)
  values (v_lead.tenant_id, v_lead.business_id, p_lead, p_call, 'callback',
          case when p_priority = 'high' then 'high' else 'normal' end, nullif(p_window, ''), nullif(p_reason, ''))
  returning id into v_task;
  perform app.emit(v_lead.tenant_id, v_lead.business_id, 'lead', p_lead, 'task.callback_requested',
                   jsonb_build_object('task_id', v_task, 'window', p_window, 'priority', p_priority), 'agent', null);
  return v_task;
end $$;

create function app.complete_task(p_task uuid, p_by text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_task public.task;
begin
  select * into v_task from public.task where id = p_task for update;
  if not found or v_task.status <> 'open' then
    return false;
  end if;
  update public.task set status = 'done', completed_at = now(), completed_by = p_by, updated_at = now()
   where id = p_task;
  perform app.emit(v_task.tenant_id, v_task.business_id, 'lead', v_task.lead_id, 'task.completed',
                   jsonb_build_object('task_id', p_task, 'kind', v_task.kind), 'user', p_by);
  return true;
end $$;

-- ---------------------------------------------------------------- agent lifecycle (A1, A4, A6, A7)

-- Admission + start in one transaction: locks the business row so two calls
-- arriving together cannot both take the last slot. Returns null when full.
create function app.start_agent_session(
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

  perform 1 from public.business where id = v_call.business_id for update;
  select count(*) into v_active from public.agent_session
   where business_id = v_call.business_id and status = 'active' and started_at > now() - p_stale_after;
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

-- Live agent sessions for a business (capacity display and routing input).
create function app.active_agent_sessions(p_business uuid, p_stale_after interval) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.agent_session
   where business_id = p_business and status = 'active' and started_at > now() - p_stale_after
$$;

-- The agent asked to reach Amy. Counts the attempt; returns false past the limit.
create function app.begin_transfer(p_call_sid text, p_max_attempts int, p_note text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_call public.call;
begin
  select * into v_call from public.call where twilio_call_sid = p_call_sid for update;
  if not found then
    raise exception 'unknown call %', p_call_sid using errcode = 'P0002';
  end if;
  if v_call.state = 'transfer_ringing' then
    return true; -- replay
  end if;
  if v_call.state <> 'agent_active' or v_call.transfer_attempts >= p_max_attempts then
    perform app.emit(v_call.tenant_id, v_call.business_id, 'call', v_call.id, 'transfer.refused',
                     jsonb_build_object('state', v_call.state, 'attempts', v_call.transfer_attempts), 'system', null);
    return false;
  end if;
  update public.call set state = 'transfer_ringing', transfer_attempts = transfer_attempts + 1,
                         handoff_note = left(nullif(btrim(p_note), ''), 240), updated_at = now()
   where id = v_call.id;
  -- The agent's conversation ends here: the caller is being moved to Amy's
  -- ring. If she misses, a new conversation picks the caller back up.
  update public.agent_session set status = 'ended', ended_at = now(), end_reason = 'handoff'
   where call_id = v_call.id and status = 'active';
  perform app.emit(v_call.tenant_id, v_call.business_id, 'call', v_call.id, 'transfer.attempted',
                   jsonb_build_object('attempt', v_call.transfer_attempts + 1), 'agent', null);
  return true;
end $$;

-- Outcome of the transfer ring, decided by DialBridged exactly like the first ring (A7).
create function app.resolve_transfer(p_call_sid text, p_dial_call_status text, p_dial_bridged boolean)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_call   public.call;
  v_result text;
begin
  select * into v_call from public.call where twilio_call_sid = p_call_sid for update;
  if not found then
    raise exception 'unknown call %', p_call_sid using errcode = 'P0002';
  end if;
  if v_call.state <> 'transfer_ringing' then
    return case when v_call.state = 'transferred' then 'transferred' else 'returned' end; -- replay
  end if;

  v_result := case when coalesce(p_dial_bridged, false) then 'transferred' else 'returned' end;
  update public.call
     -- 'recovery' = with neither Amy nor an agent yet; the webhook handler
     -- either starts a new agent conversation or plays deterministic capture.
     set state = case when v_result = 'transferred' then 'transferred' else 'recovery' end,
         dial_call_status = p_dial_call_status, updated_at = now()
   where id = v_call.id;
  perform app.emit(v_call.tenant_id, v_call.business_id, 'call', v_call.id, 'transfer.' || v_result,
                   jsonb_build_object('dial_call_status', p_dial_call_status, 'dial_bridged', p_dial_bridged),
                   'webhook', p_call_sid);
  if v_result = 'transferred' then
    update public.agent_session set status = 'ended', ended_at = now(), end_reason = 'transferred'
     where call_id = v_call.id and status = 'active';
    if v_call.lead_id is not null then
      perform app.enqueue_alerts(v_call.tenant_id, v_call.business_id, v_call.lead_id, v_call.id, 'answered');
    end if;
  else
    if v_call.lead_id is not null then
      -- The caller asked for Amy and did not reach her: a high-priority
      -- callback exists now, before anything else can fail.
      perform app.request_callback(v_call.lead_id, v_call.id, null,
                                   'Asked to speak with Amy; live transfer not answered', 'high');
      perform app.enqueue_alerts(v_call.tenant_id, v_call.business_id, v_call.lead_id, v_call.id, 'transfer_missed');
    end if;
  end if;
  return v_result;
end $$;

-- The agent's part of the call is over (it hung up, or its stream closed).
-- p_failed marks a vendor/stream failure: the caller is then sent to capture.
create function app.end_agent_session(p_call_sid text, p_reason text, p_failed boolean) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_call public.call;
begin
  select * into v_call from public.call where twilio_call_sid = p_call_sid for update;
  if not found then
    raise exception 'unknown call %', p_call_sid using errcode = 'P0002';
  end if;
  update public.agent_session
     set status = case when p_failed then 'failed' else 'ended' end, ended_at = now(), end_reason = p_reason
   where call_id = v_call.id and status = 'active';
  if v_call.state <> 'agent_active' then
    return v_call.state; -- replay, or the call already moved on (transferred)
  end if;
  update public.call set state = case when p_failed then 'recovery' else 'agent_completed' end, updated_at = now()
   where id = v_call.id;
  perform app.emit(v_call.tenant_id, v_call.business_id, 'call', v_call.id,
                   case when p_failed then 'agent.failed' else 'agent.ended' end,
                   jsonb_build_object('reason', p_reason), 'webhook', p_call_sid);
  return case when p_failed then 'recovery' else 'agent_completed' end;
end $$;

-- The agent's own wrap-up before it says goodbye. A session that ends
-- without one ended abnormally (vendor drop), and the caller is captured.
create function app.wrap_up_session(p_call_sid text, p_outcome text, p_summary text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_call    public.call;
  v_session uuid;
begin
  select * into v_call from public.call where twilio_call_sid = p_call_sid for update;
  if not found then
    raise exception 'unknown call %', p_call_sid using errcode = 'P0002';
  end if;
  update public.agent_session
     set metadata = metadata || jsonb_build_object('wrapped_up', true, 'outcome', p_outcome,
                                                   'agent_summary', left(p_summary, 1000))
   where call_id = v_call.id and status = 'active'
  returning id into v_session;
  if v_session is null then
    return false;
  end if;
  if p_outcome in ('not_a_lead', 'wrong_number', 'spam') and v_call.lead_id is not null then
    -- Flag only; Amy confirms. A misjudged real customer is never deleted or hidden.
    update public.lead set intent = 'not_a_lead', needs_review = true, updated_at = now()
     where id = v_call.lead_id and not app.lead_is_terminal(state);
  end if;
  perform app.emit(v_call.tenant_id, v_call.business_id, 'call', v_call.id, 'agent.wrapped_up',
                   jsonb_build_object('outcome', p_outcome), 'agent', null);
  return true;
end $$;

-- Post-call analysis lands on the lead in one step, with its event.
create function app.apply_post_call(
  p_lead uuid, p_call uuid, p_intent text, p_summary text, p_compliance jsonb, p_needs_review boolean
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_lead public.lead;
begin
  select * into v_lead from public.lead where id = p_lead for update;
  if not found then
    raise exception 'unknown lead %', p_lead using errcode = 'P0002';
  end if;
  update public.lead set
    -- An intent Amy or the agent set to not_a_lead is never upgraded by analysis.
    intent       = case when v_lead.intent = 'not_a_lead' then v_lead.intent else p_intent end,
    summary      = coalesce(nullif(p_summary, ''), summary),
    compliance   = coalesce(p_compliance, '{}'::jsonb),
    needs_review = needs_review or p_needs_review,
    updated_at   = now()
  where id = p_lead;
  perform app.emit(v_lead.tenant_id, v_lead.business_id, 'lead', p_lead, 'lead.analyzed',
                   jsonb_build_object('call_id', p_call, 'intent', p_intent, 'needs_review', p_needs_review,
                                      'violations', coalesce(jsonb_array_length(p_compliance -> 'violations'), 0)),
                   'system', null);
end $$;

-- The caller said not to record. From now on this call keeps metadata and
-- the structured notes only: no audio, transcript or summary is stored, and
-- vendor copies are purged after the call. The event is the consent record.
create function app.mark_recording_declined(p_call_sid text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_call public.call;
begin
  select * into v_call from public.call where twilio_call_sid = p_call_sid for update;
  if not found then
    raise exception 'unknown call %', p_call_sid using errcode = 'P0002';
  end if;
  update public.agent_session set metadata = metadata || '{"recording_declined": true}'::jsonb
   where call_id = v_call.id;
  if exists (select 1 from public.event where aggregate_id = v_call.id and type = 'consent.recording_declined') then
    return true;
  end if;
  perform app.emit(v_call.tenant_id, v_call.business_id, 'call', v_call.id, 'consent.recording_declined',
                   '{}'::jsonb, 'agent', null);
  return true;
end $$;

-- Was the live session wrapped up by the agent? Decides "normal end" vs "vendor drop".
create function app.session_wrapped_up(p_call_sid text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((s.metadata ->> 'wrapped_up')::boolean, false)
    from public.agent_session s join public.call c on c.id = s.call_id
   where c.twilio_call_sid = p_call_sid
   order by s.started_at desc
   limit 1
$$;

-- Post-call data from the vendor. Idempotent per conversation id (A1).
create function app.attach_conversation(
  p_call_sid text, p_session uuid, p_conversation_id text, p_transcript jsonb, p_summary text,
  p_data_collection jsonb, p_evaluation jsonb, p_metadata jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_call    public.call;
  v_session public.agent_session;
begin
  select * into v_session from public.agent_session where conversation_id = p_conversation_id for update;
  if found and v_session.post_call_at is not null then
    return v_session.id; -- duplicate delivery
  end if;

  if not found then
    select * into v_call from public.call where twilio_call_sid = p_call_sid for update;
    if not found then
      raise exception 'unknown call % for conversation %', p_call_sid, p_conversation_id using errcode = 'P0002';
    end if;
    -- A call can hold several conversations (a missed hand-off starts a new
    -- one), so the session id we passed to the vendor decides, not order.
    select * into v_session from public.agent_session
     where id = p_session and call_id = v_call.id and conversation_id is null
     for update;
    if not found then
      -- No usable session id: only an unambiguous match is accepted.
      select * into v_session from public.agent_session
       where call_id = v_call.id and conversation_id is null
       for update;
      if not found or (select count(*) from public.agent_session
                        where call_id = v_call.id and conversation_id is null) <> 1 then
        raise exception 'cannot match conversation % to a session of call %', p_conversation_id, p_call_sid
          using errcode = 'P0002';
      end if;
    end if;
  end if;

  update public.agent_session set
    conversation_id = p_conversation_id,
    transcript      = p_transcript,
    summary         = p_summary,
    data_collection = coalesce(p_data_collection, '{}'::jsonb),
    evaluation      = coalesce(p_evaluation, '{}'::jsonb),
    metadata        = metadata || coalesce(p_metadata, '{}'::jsonb),
    post_call_at    = now()
  where id = v_session.id;
  perform app.emit(v_session.tenant_id, v_session.business_id, 'call', v_session.call_id, 'agent.post_call_received',
                   jsonb_build_object('conversation_id', p_conversation_id, 'session_id', v_session.id),
                   'webhook', p_conversation_id);
  return v_session.id;
end $$;

-- Every completed call ends with one lead (A4): extend 0001's finalize_call
-- so agent and transfer states resolve too.
create or replace function app.finalize_call(p_call_sid text, p_call_status text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_call public.call;
  v_lead uuid;
  v_final text;
begin
  select * into v_call from public.call where twilio_call_sid = p_call_sid for update;
  if not found then
    return null;
  end if;
  if v_call.completed then
    return v_call.state;  -- I3: duplicate delivery
  end if;

  update public.call set completed = true, updated_at = now() where id = v_call.id;
  v_final := v_call.state;

  if v_call.state in ('agent_active', 'transfer_ringing')
     or (v_call.state = 'recovery' and exists (select 1 from public.agent_session s where s.call_id = v_call.id)) then
    -- Caller hung up while talking to the agent or waiting for Amy.
    update public.agent_session set status = 'ended', ended_at = now(), end_reason = coalesce(end_reason, 'caller_hung_up')
     where call_id = v_call.id and status = 'active';
    v_final := 'agent_completed';
    update public.call set state = v_final, updated_at = now() where id = v_call.id;
  elsif v_call.state in ('ringing_owner', 'recovery') then
    v_final := 'abandoned';
    update public.call set state = v_final, updated_at = now() where id = v_call.id;
    perform app.emit(v_call.tenant_id, v_call.business_id, 'call', v_call.id, 'call.abandoned',
                     jsonb_build_object('previous_state', v_call.state, 'call_status', p_call_status),
                     'webhook', p_call_sid);
    v_lead := coalesce(v_call.lead_id,
      app.open_or_create_lead(v_call.tenant_id, v_call.business_id, v_call.campaign_id,
                              'abandoned_call', v_call.from_e164, 'new', 'webhook', p_call_sid));
    update public.call set lead_id = v_lead where id = v_call.id;
    perform app.enqueue_alerts(v_call.tenant_id, v_call.business_id, v_lead, v_call.id, 'abandoned');
    -- A caller who gave up is still someone to call back; Amy can mark it not a customer.
    perform app.request_callback(v_lead, v_call.id, null, 'Hung up before leaving details', 'normal');
  end if;

  if v_final = 'agent_completed' and v_call.lead_id is not null then
    -- The agent summary alert is sent by the post-call workflow once the
    -- transcript is in; this guarantees Amy hears about the call even if
    -- the vendor's post-call webhook never arrives.
    insert into public.job (tenant_id, business_id, kind, subject_id, dedupe_key, run_after)
    values (v_call.tenant_id, v_call.business_id, 'post_call', v_call.id, 'post_call:' || v_call.id::text,
            now())
    on conflict (dedupe_key) do nothing;
  end if;

  perform app.emit(v_call.tenant_id, v_call.business_id, 'call', v_call.id, 'call.completed',
                   jsonb_build_object('call_status', p_call_status, 'final_state', v_final),
                   'webhook', p_call_sid);
  return v_final;
end $$;

-- ---------------------------------------------------------------- background jobs

create table public.job (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenant(id),
  business_id   uuid not null references public.business(id),
  kind          text not null check (kind in ('post_call', 'callback_escalation', 'vendor_purge')),
  subject_id    uuid not null,
  dedupe_key    text not null unique,
  status        text not null default 'pending' check (status in ('pending', 'done', 'failed')),
  attempts      int not null default 0,
  run_after     timestamptz not null default now(),
  claimed_until timestamptz,
  last_error    text,
  result        jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index job_due on public.job (run_after) where status = 'pending';

-- ---------------------------------------------------------------- incidents

create table public.incident (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenant(id),
  business_id uuid not null references public.business(id),
  call_id     uuid references public.call(id),
  lead_id     uuid references public.lead(id),
  kind        text not null,
  severity    text not null check (severity in ('critical', 'warning')),
  detail      jsonb not null default '{}',
  dedupe_key  text not null unique,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by text
);

-- ---------------------------------------------------------------- RLS and grants

alter table public.business_config enable row level security;
alter table public.agent_session   enable row level security;
alter table public.tool_call       enable row level security;
alter table public.lead_fact       enable row level security;
alter table public.task            enable row level security;
alter table public.job             enable row level security;
alter table public.incident        enable row level security;

create policy business_config_read on public.business_config for select using (app.is_staff(tenant_id));
create policy agent_session_read   on public.agent_session   for select using (app.can_read(tenant_id, business_id));
create policy tool_call_read       on public.tool_call       for select using (app.is_staff(tenant_id));
create policy lead_fact_read       on public.lead_fact       for select using (app.can_read(tenant_id, business_id));
create policy task_read            on public.task            for select using (app.can_read(tenant_id, business_id));
create policy job_read             on public.job             for select using (app.is_staff(tenant_id));
create policy incident_read        on public.incident        for select using (app.is_staff(tenant_id));

revoke all on public.business_config, public.agent_session, public.tool_call,
              public.lead_fact, public.task, public.job, public.incident from anon;
revoke insert, update, delete, truncate on public.business_config, public.agent_session,
              public.tool_call, public.lead_fact, public.task, public.job, public.incident from authenticated;
grant select on public.business_config, public.agent_session, public.tool_call,
              public.lead_fact, public.task, public.job, public.incident, public.lead_fact_current to authenticated;
revoke all on public.lead_fact_current from anon;

revoke execute on all functions in schema app from public;
grant execute on function app.can_read(uuid, uuid) to authenticated;
grant execute on function app.is_staff(uuid) to authenticated;
grant execute on function app.lead_rank(text) to authenticated;
grant execute on function app.lead_is_terminal(text) to authenticated;
grant execute on function app.lead_transition_allowed(text, text) to authenticated;
grant execute on function app.transition_lead(uuid, text, text, text, bigint) to authenticated;
grant execute on function app.fact_source_rank(text) to authenticated;
