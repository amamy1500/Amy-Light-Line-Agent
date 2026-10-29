-- 0001_core: tenancy, call recovery, leads, append-only event log.
--
-- Invariants this migration enforces (each has a test in packages/db/test):
--   I1  Every row carries tenant_id; staff see their tenant, a client_viewer
--       sees only rows of their own business (app.can_read).
--   I2  The event log is append-only for everyone, superusers included.
--   I3  Webhook replays are idempotent: one call row per Twilio CallSid, one
--       capture per RecordingSid, one alert per (subject, kind, contact).
--   I4  A call is owner_answered iff Twilio bridged it (DialBridged=true).
--   I5  Every completed call ends with exactly one lead (answered, message or
--       abandoned) — no branch ends without a record.
--   I6  Lead states only move forward through the funnel; terminal states are
--       final; "won" requires an amount.
-- Server code connects as the database owner (service role). Browsers never
-- write tables directly; authenticated users get SELECT under RLS plus
-- app.transition_lead.

create schema if not exists app;

-- ---------------------------------------------------------------- tables

create table public.tenant (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

create table public.business (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenant(id),
  name            text not null,
  lifecycle_stage text not null default 'prospect'
                  check (lifecycle_stage in ('prospect', 'opportunity', 'client', 'churned')),
  place_id        text,
  website         text,
  created_at      timestamptz not null default now()
);

create table public.membership (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenant(id),
  user_id     uuid not null,
  role        text not null check (role in ('owner', 'seller', 'operator', 'client_viewer')),
  business_id uuid references public.business(id),
  created_at  timestamptz not null default now(),
  unique (tenant_id, user_id),
  check (role <> 'client_viewer' or business_id is not null)
);

create table public.brand (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenant(id),
  business_id  uuid not null references public.business(id),
  name         text not null,
  domain       text,
  recovery_ask text not null
               default 'please say your name, your address, what you need, and the best time to reach you'
);

create table public.campaign (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenant(id),
  business_id uuid not null references public.business(id),
  brand_id    uuid not null references public.brand(id),
  name        text not null,
  channel     text not null check (channel in ('tv', 'web', 'print', 'postcard', 'referral', 'other')),
  created_at  timestamptz not null default now()
);

create table public.tracking_number (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenant(id),
  business_id     uuid not null references public.business(id),
  campaign_id     uuid not null references public.campaign(id),
  e164            text not null unique check (e164 ~ '^\+[1-9][0-9]{7,14}$'),
  owner_name      text not null,
  owner_ring_e164 text not null check (owner_ring_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  ring_timeout_s  int  not null default 20 check (ring_timeout_s between 5 and 60),
  ring_timezone   text not null default 'America/Chicago',
  ring_start      time not null default '08:00',
  ring_end        time not null default '20:00'
);

create table public.alert_contact (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenant(id),
  business_id uuid not null references public.business(id),
  channel     text not null check (channel in ('sms', 'email')),
  address     text not null,
  active      boolean not null default true,
  unique (business_id, channel, address)
);

create table public.lead (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenant(id),
  business_id     uuid not null references public.business(id),
  campaign_id     uuid references public.campaign(id),
  source          text not null
                  check (source in ('call_recovery', 'call_answered', 'abandoned_call', 'web_form')),
  state           text not null default 'new'
                  check (state in ('new', 'attempted', 'connected', 'qualified', 'quoted',
                                   'booked', 'won', 'lost', 'spam', 'duplicate')),
  contact_phone   text,
  contact_name    text,
  address         text,
  service_wanted  text,
  timing          text,
  callback_window text,
  notes           text,
  sms_consent     boolean not null default false,
  extracted       jsonb not null default '{}',
  attribution     jsonb not null default '{}',
  amount_cents    bigint check (amount_cents is null or amount_cents >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (state <> 'won' or amount_cents is not null)
);

create table public.call (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references public.tenant(id),
  business_id          uuid not null references public.business(id),
  campaign_id          uuid references public.campaign(id),
  tracking_number_id   uuid references public.tracking_number(id),
  twilio_call_sid      text not null unique,
  from_e164            text,
  to_e164              text,
  state                text not null default 'ringing_owner'
                       check (state in ('ringing_owner', 'owner_answered', 'recovery',
                                        'message_captured', 'abandoned')),
  after_hours          boolean not null default false,
  owner_accepted       boolean not null default false,
  dial_call_status     text,
  dial_bridged         boolean,
  recording_sid        text unique,
  recording_url        text,
  recording_duration_s int,
  transcript           text,
  transcript_status    text,
  extracted            jsonb not null default '{}',
  lead_id              uuid references public.lead(id),
  completed            boolean not null default false,
  started_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table public.event (
  id             bigint generated always as identity primary key,
  tenant_id      uuid not null references public.tenant(id),
  business_id    uuid references public.business(id),
  aggregate_type text not null,
  aggregate_id   uuid not null,
  type           text not null,
  payload        jsonb not null default '{}',
  actor_type     text not null check (actor_type in ('user', 'agent', 'system', 'webhook')),
  actor_id       text,
  causation_id   bigint references public.event(id),
  correlation_id uuid,
  occurred_at    timestamptz not null default now()
);

create table public.outbox (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenant(id),
  business_id uuid not null references public.business(id),
  lead_id     uuid references public.lead(id),
  call_id     uuid references public.call(id),
  kind        text not null check (kind in ('message', 'abandoned', 'answered', 'web_form')),
  channel     text not null check (channel in ('sms', 'email')),
  to_address  text not null,
  dedupe_key  text not null unique,
  status      text not null default 'pending' check (status in ('pending', 'sent', 'simulated', 'failed')),
  attempts    int not null default 0,
  -- Lease: a claimed alert is invisible to other senders until this passes,
  -- so two concurrent drains never send the same alert twice.
  claimed_until timestamptz,
  last_error  text,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);

create index lead_open_by_phone on public.lead (business_id, contact_phone, created_at desc);
create index call_by_lead on public.call (lead_id);
create index event_by_aggregate on public.event (aggregate_type, aggregate_id, id);
create index outbox_pending on public.outbox (created_at) where status = 'pending';

-- ---------------------------------------------------------------- I2: append-only events

create function app.reject_event_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'event log is append-only (% blocked)', tg_op using errcode = '42501';
end $$;

create trigger event_no_update_delete before update or delete on public.event
  for each row execute function app.reject_event_mutation();
create trigger event_no_truncate before truncate on public.event
  for each statement execute function app.reject_event_mutation();

create function app.emit(
  p_tenant uuid, p_business uuid, p_aggregate_type text, p_aggregate_id uuid,
  p_type text, p_payload jsonb, p_actor_type text, p_actor_id text
) returns bigint
language sql security definer set search_path = '' as $$
  insert into public.event (tenant_id, business_id, aggregate_type, aggregate_id, type, payload, actor_type, actor_id)
  values (p_tenant, p_business, p_aggregate_type, p_aggregate_id, p_type,
          coalesce(p_payload, '{}'::jsonb), p_actor_type, p_actor_id)
  returning id
$$;

-- ---------------------------------------------------------------- I1: visibility

create function app.can_read(p_tenant uuid, p_business uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.membership m
    where m.user_id = (select auth.uid())
      and m.tenant_id = p_tenant
      and (m.role <> 'client_viewer' or m.business_id = p_business)
  )
$$;

create function app.is_staff(p_tenant uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.membership m
    where m.user_id = (select auth.uid())
      and m.tenant_id = p_tenant
      and m.role <> 'client_viewer'
  )
$$;

-- ---------------------------------------------------------------- I6: lead funnel

create function app.lead_rank(p_state text) returns int
language sql immutable as $$
  select case p_state
    when 'new' then 0 when 'attempted' then 1 when 'connected' then 2 when 'qualified' then 3
    when 'quoted' then 4 when 'booked' then 5 when 'won' then 6
  end
$$;

create function app.lead_is_terminal(p_state text) returns boolean
language sql immutable as $$
  select p_state in ('won', 'lost', 'spam', 'duplicate')
$$;

create function app.lead_transition_allowed(p_from text, p_to text) returns boolean
language sql immutable as $$
  select case
    when app.lead_is_terminal(p_from) then false
    when p_to in ('lost', 'spam', 'duplicate') then true
    when app.lead_rank(p_to) is null or app.lead_rank(p_from) is null then false
    else app.lead_rank(p_to) > app.lead_rank(p_from)
  end
$$;

-- Fills lead fields from extraction without overwriting anything already set.
create function app.apply_extracted(p_lead uuid, p_fields jsonb) returns void
language sql security definer set search_path = '' as $$
  update public.lead set
    contact_name    = coalesce(contact_name,    nullif(p_fields ->> 'contactName', '')),
    address         = coalesce(address,         nullif(p_fields ->> 'address', '')),
    service_wanted  = coalesce(service_wanted,  nullif(p_fields ->> 'serviceWanted', '')),
    timing          = coalesce(timing,          nullif(p_fields ->> 'timing', '')),
    callback_window = coalesce(callback_window, nullif(p_fields ->> 'callbackWindow', '')),
    extracted       = extracted || coalesce(p_fields, '{}'::jsonb),
    updated_at      = now()
  where id = p_lead
$$;

-- Reuses an open lead from the same phone within 7 days (repeat callers are
-- one lead with several calls); otherwise creates one.
create function app.open_or_create_lead(
  p_tenant uuid, p_business uuid, p_campaign uuid, p_source text,
  p_phone text, p_initial_state text, p_actor_type text, p_actor_id text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id    uuid;
  v_state text;
begin
  if p_phone is not null then
    select id, state into v_id, v_state
      from public.lead
     where business_id = p_business
       and contact_phone = p_phone
       and not app.lead_is_terminal(state)
       and created_at > now() - interval '7 days'
     order by created_at desc
     limit 1
     for update;
  end if;

  if v_id is not null then
    perform app.emit(p_tenant, p_business, 'lead', v_id, 'lead.repeat_contact',
                     jsonb_build_object('source', p_source), p_actor_type, p_actor_id);
    if p_initial_state <> 'new' and app.lead_transition_allowed(v_state, p_initial_state) then
      update public.lead set state = p_initial_state, updated_at = now() where id = v_id;
      perform app.emit(p_tenant, p_business, 'lead', v_id, 'lead.state_changed',
                       jsonb_build_object('from', v_state, 'to', p_initial_state), p_actor_type, p_actor_id);
    end if;
    return v_id;
  end if;

  insert into public.lead (tenant_id, business_id, campaign_id, source, state, contact_phone)
  values (p_tenant, p_business, p_campaign, p_source, p_initial_state, p_phone)
  returning id into v_id;
  perform app.emit(p_tenant, p_business, 'lead', v_id, 'lead.created',
                   jsonb_build_object('source', p_source, 'state', p_initial_state, 'campaign_id', p_campaign),
                   p_actor_type, p_actor_id);
  return v_id;
end $$;

-- One alert per (subject, kind, contact); replays are no-ops (I3).
create function app.enqueue_alerts(
  p_tenant uuid, p_business uuid, p_lead uuid, p_call uuid, p_kind text
) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_count int;
begin
  insert into public.outbox (tenant_id, business_id, lead_id, call_id, kind, channel, to_address, dedupe_key)
  select p_tenant, p_business, p_lead, p_call, p_kind, ac.channel, ac.address,
         coalesce(p_call, p_lead)::text || ':' || p_kind || ':' || ac.id::text
    from public.alert_contact ac
   where ac.business_id = p_business and ac.active
  on conflict (dedupe_key) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- ---------------------------------------------------------------- call lifecycle (I3, I4, I5)

create function app.ingest_inbound_call(p_call_sid text, p_from text, p_to text, p_after_hours boolean)
returns public.call
language plpgsql security definer set search_path = '' as $$
declare
  v_tn   public.tracking_number;
  v_call public.call;
begin
  select * into v_tn from public.tracking_number where e164 = p_to;
  if not found then
    raise exception 'unknown tracking number %', p_to using errcode = 'P0002';
  end if;

  insert into public.call (tenant_id, business_id, campaign_id, tracking_number_id,
                           twilio_call_sid, from_e164, to_e164, state, after_hours)
  values (v_tn.tenant_id, v_tn.business_id, v_tn.campaign_id, v_tn.id,
          p_call_sid, p_from, p_to,
          case when p_after_hours then 'recovery' else 'ringing_owner' end, p_after_hours)
  on conflict (twilio_call_sid) do nothing
  returning * into v_call;

  if v_call.id is null then
    -- Replay of a webhook we already handled: answer with the stored call.
    select * into v_call from public.call where twilio_call_sid = p_call_sid;
    return v_call;
  end if;

  perform app.emit(v_call.tenant_id, v_call.business_id, 'call', v_call.id, 'call.received',
                   jsonb_build_object('after_hours', p_after_hours, 'campaign_id', v_call.campaign_id),
                   'webhook', p_call_sid);
  return v_call;
end $$;

create function app.mark_owner_accepted(p_parent_call_sid text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_call public.call;
begin
  select * into v_call from public.call where twilio_call_sid = p_parent_call_sid for update;
  if not found then
    return false;
  end if;
  if not v_call.owner_accepted then
    update public.call set owner_accepted = true, updated_at = now() where id = v_call.id;
    perform app.emit(v_call.tenant_id, v_call.business_id, 'call', v_call.id, 'call.owner_accepted',
                     '{}'::jsonb, 'webhook', p_parent_call_sid);
  end if;
  return true;
end $$;

create function app.resolve_dial(p_call_sid text, p_dial_call_status text, p_dial_bridged boolean)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_call     public.call;
  v_decision text;
  v_lead     uuid;
begin
  select * into v_call from public.call where twilio_call_sid = p_call_sid for update;
  if not found then
    raise exception 'unknown call %', p_call_sid using errcode = 'P0002';
  end if;

  if v_call.state <> 'ringing_owner' then
    -- Replay: repeat the decision already taken.
    return case when v_call.state = 'owner_answered' then 'owner_answered' else 'recovery' end;
  end if;

  -- I4: bridged means the owner's leg connected, which the screen only allows after a keypress.
  v_decision := case when coalesce(p_dial_bridged, false) then 'owner_answered' else 'recovery' end;

  update public.call
     set state = v_decision, dial_call_status = p_dial_call_status,
         dial_bridged = p_dial_bridged, updated_at = now()
   where id = v_call.id;

  perform app.emit(v_call.tenant_id, v_call.business_id, 'call', v_call.id, 'call.' || v_decision,
                   jsonb_build_object('dial_call_status', p_dial_call_status,
                                      'dial_bridged', p_dial_bridged,
                                      'owner_accepted', v_call.owner_accepted),
                   'webhook', p_call_sid);

  if coalesce(p_dial_bridged, false) <> v_call.owner_accepted then
    perform app.emit(v_call.tenant_id, v_call.business_id, 'call', v_call.id, 'call.accept_flag_mismatch',
                     jsonb_build_object('dial_bridged', p_dial_bridged, 'owner_accepted', v_call.owner_accepted),
                     'system', null);
  end if;

  if v_decision = 'owner_answered' then
    v_lead := app.open_or_create_lead(v_call.tenant_id, v_call.business_id, v_call.campaign_id,
                                      'call_answered', v_call.from_e164, 'connected', 'webhook', p_call_sid);
    update public.call set lead_id = v_lead where id = v_call.id;
    perform app.enqueue_alerts(v_call.tenant_id, v_call.business_id, v_lead, v_call.id, 'answered');
  end if;

  return v_decision;
end $$;

create function app.capture_recording(
  p_call_sid text, p_recording_sid text, p_recording_url text, p_duration_s int
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_call public.call;
  v_lead uuid;
begin
  select * into v_call from public.call where twilio_call_sid = p_call_sid for update;
  if not found then
    raise exception 'unknown call %', p_call_sid using errcode = 'P0002';
  end if;

  if v_call.recording_sid is not distinct from p_recording_sid then
    return v_call.state;  -- I3: duplicate delivery
  end if;

  update public.call
     set recording_sid = p_recording_sid, recording_url = p_recording_url,
         recording_duration_s = p_duration_s, updated_at = now()
   where id = v_call.id;

  if coalesce(p_duration_s, 0) < 1 or v_call.state not in ('ringing_owner', 'recovery', 'abandoned') then
    -- An empty recording is not a message; finalize_call decides abandonment.
    return v_call.state;
  end if;

  update public.call set state = 'message_captured', updated_at = now() where id = v_call.id;
  perform app.emit(v_call.tenant_id, v_call.business_id, 'call', v_call.id, 'call.message_captured',
                   jsonb_build_object('recording_sid', p_recording_sid, 'duration_s', p_duration_s,
                                      'previous_state', v_call.state),
                   'webhook', p_call_sid);

  if v_call.lead_id is null then
    v_lead := app.open_or_create_lead(v_call.tenant_id, v_call.business_id, v_call.campaign_id,
                                      'call_recovery', v_call.from_e164, 'new', 'webhook', p_call_sid);
    update public.call set lead_id = v_lead where id = v_call.id;
  else
    -- Status callback arrived first and filed this as abandoned; the message upgrades it.
    v_lead := v_call.lead_id;
    update public.lead set source = 'call_recovery', updated_at = now()
     where id = v_lead and source = 'abandoned_call';
  end if;

  perform app.apply_extracted(v_lead, v_call.extracted);
  perform app.enqueue_alerts(v_call.tenant_id, v_call.business_id, v_lead, v_call.id, 'message');
  return 'message_captured';
end $$;

create function app.attach_transcript(
  p_call_sid text, p_text text, p_status text, p_fields jsonb
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_call public.call;
begin
  select * into v_call from public.call where twilio_call_sid = p_call_sid for update;
  if not found then
    raise exception 'unknown call %', p_call_sid using errcode = 'P0002';
  end if;

  update public.call
     set transcript = p_text, transcript_status = p_status,
         extracted = extracted || coalesce(p_fields, '{}'::jsonb), updated_at = now()
   where id = v_call.id;

  if v_call.lead_id is not null then
    perform app.apply_extracted(v_call.lead_id, coalesce(p_fields, '{}'::jsonb));
  end if;

  perform app.emit(v_call.tenant_id, v_call.business_id, 'call', v_call.id, 'call.transcribed',
                   jsonb_build_object('status', p_status, 'fields', coalesce(p_fields, '{}'::jsonb)),
                   'webhook', p_call_sid);
end $$;

-- Twilio's call status callback (the call is over). Anything still waiting
-- becomes an abandoned call with a lead, so no branch ends without a record.
create function app.finalize_call(p_call_sid text, p_call_status text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_call public.call;
  v_lead uuid;
begin
  select * into v_call from public.call where twilio_call_sid = p_call_sid for update;
  if not found then
    return null;
  end if;
  if v_call.completed then
    return v_call.state;  -- I3: duplicate delivery
  end if;

  update public.call set completed = true, updated_at = now() where id = v_call.id;

  if v_call.state in ('ringing_owner', 'recovery') then
    update public.call set state = 'abandoned', updated_at = now() where id = v_call.id;
    perform app.emit(v_call.tenant_id, v_call.business_id, 'call', v_call.id, 'call.abandoned',
                     jsonb_build_object('previous_state', v_call.state, 'call_status', p_call_status),
                     'webhook', p_call_sid);
    v_lead := app.open_or_create_lead(v_call.tenant_id, v_call.business_id, v_call.campaign_id,
                                      'abandoned_call', v_call.from_e164, 'new', 'webhook', p_call_sid);
    update public.call set lead_id = v_lead where id = v_call.id;
    perform app.enqueue_alerts(v_call.tenant_id, v_call.business_id, v_lead, v_call.id, 'abandoned');
    v_call.state := 'abandoned';
  end if;

  perform app.emit(v_call.tenant_id, v_call.business_id, 'call', v_call.id, 'call.completed',
                   jsonb_build_object('call_status', p_call_status, 'final_state', v_call.state),
                   'webhook', p_call_sid);
  return v_call.state;
end $$;

-- ---------------------------------------------------------------- web form leads

create function app.create_web_lead(
  p_campaign uuid, p_name text, p_phone text, p_address text,
  p_sms_consent boolean, p_attribution jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_campaign public.campaign;
  v_lead     uuid;
begin
  select * into v_campaign from public.campaign where id = p_campaign;
  if not found then
    raise exception 'unknown campaign %', p_campaign using errcode = 'P0002';
  end if;

  v_lead := app.open_or_create_lead(v_campaign.tenant_id, v_campaign.business_id, v_campaign.id,
                                    'web_form', p_phone, 'new', 'webhook', 'web_form');
  update public.lead set
    contact_name = coalesce(contact_name, nullif(p_name, '')),
    address      = coalesce(address, nullif(p_address, '')),
    sms_consent  = sms_consent or coalesce(p_sms_consent, false),
    attribution  = attribution || coalesce(p_attribution, '{}'::jsonb),
    updated_at   = now()
  where id = v_lead;

  perform app.enqueue_alerts(v_campaign.tenant_id, v_campaign.business_id, v_lead, null, 'web_form');
  return v_lead;
end $$;

-- ---------------------------------------------------------------- outcomes (I6)

create function app.transition_lead(
  p_lead uuid, p_to text, p_actor_type text, p_actor_id text, p_amount_cents bigint
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_lead       public.lead;
  v_user       uuid := (select auth.uid());
  v_actor_type text := p_actor_type;
  v_actor_id   text := p_actor_id;
begin
  select * into v_lead from public.lead where id = p_lead for update;
  if not found then
    raise exception 'unknown lead %', p_lead using errcode = 'P0002';
  end if;

  -- A signed-in user must be staff of the lead's tenant, and is recorded as
  -- themselves whatever actor they claim. Server calls carry no user.
  if v_user is not null then
    if not app.is_staff(v_lead.tenant_id) then
      raise exception 'not allowed' using errcode = '42501';
    end if;
    v_actor_type := 'user';
    v_actor_id := v_user::text;
  end if;

  if not app.lead_transition_allowed(v_lead.state, p_to) then
    raise exception 'lead transition % -> % not allowed', v_lead.state, p_to using errcode = '22023';
  end if;
  if p_to = 'won' and p_amount_cents is null then
    raise exception 'won requires an amount' using errcode = '22023';
  end if;

  update public.lead
     set state = p_to,
         amount_cents = coalesce(p_amount_cents, amount_cents),
         updated_at = now()
   where id = p_lead;

  perform app.emit(v_lead.tenant_id, v_lead.business_id, 'lead', p_lead, 'lead.state_changed',
                   jsonb_build_object('from', v_lead.state, 'to', p_to, 'amount_cents', p_amount_cents),
                   v_actor_type, v_actor_id);
  return p_to;
end $$;

-- ---------------------------------------------------------------- RLS and grants (I1)

alter table public.tenant          enable row level security;
alter table public.business        enable row level security;
alter table public.membership      enable row level security;
alter table public.brand           enable row level security;
alter table public.campaign        enable row level security;
alter table public.tracking_number enable row level security;
alter table public.alert_contact   enable row level security;
alter table public.lead            enable row level security;
alter table public.call            enable row level security;
alter table public.event           enable row level security;
alter table public.outbox          enable row level security;

create policy tenant_read on public.tenant for select
  using (exists (select 1 from public.membership m
                  where m.tenant_id = tenant.id and m.user_id = (select auth.uid())));
create policy membership_read on public.membership for select
  using (user_id = (select auth.uid()));
create policy business_read on public.business for select
  using (app.can_read(tenant_id, id));
create policy brand_read on public.brand for select
  using (app.can_read(tenant_id, business_id));
create policy campaign_read on public.campaign for select
  using (app.can_read(tenant_id, business_id));
create policy tracking_number_read on public.tracking_number for select
  using (app.is_staff(tenant_id));
create policy alert_contact_read on public.alert_contact for select
  using (app.is_staff(tenant_id));
create policy lead_read on public.lead for select
  using (app.can_read(tenant_id, business_id));
create policy call_read on public.call for select
  using (app.can_read(tenant_id, business_id));
create policy event_read on public.event for select
  using (app.can_read(tenant_id, business_id));
create policy outbox_read on public.outbox for select
  using (app.is_staff(tenant_id));

revoke all on all tables in schema public from anon;
revoke insert, update, delete, truncate on all tables in schema public from authenticated;
grant select on all tables in schema public to authenticated;

-- Functions are executable by PUBLIC by default; security-definer writers must not be.
revoke execute on all functions in schema app from public;
grant usage on schema app to authenticated;
grant execute on function app.can_read(uuid, uuid) to authenticated;
grant execute on function app.is_staff(uuid) to authenticated;
grant execute on function app.lead_rank(text) to authenticated;
grant execute on function app.lead_is_terminal(text) to authenticated;
grant execute on function app.lead_transition_allowed(text, text) to authenticated;
grant execute on function app.transition_lead(uuid, text, text, text, bigint) to authenticated;
