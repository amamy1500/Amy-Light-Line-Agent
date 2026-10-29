-- Spam screening, the daily summary and texts to our numbers
-- (docs/research/spam-screening.md, docs/research/ai-first-vs-ring-first.md).

-- ---------------------------------------------------------------- blocked callers

-- manual: Amy blocked it; the call is rejected before anyone answers ($0).
-- auto:   the assistant judged it spam twice; it must pass the "press 1 or say
--         yes" gate, so a wrongly flagged customer can still get through.
create table public.blocked_number (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenant(id),
  e164          text not null check (e164 ~ '^\+[1-9][0-9]{7,14}$'),
  kind          text not null check (kind in ('manual', 'auto')),
  reason        text,
  blocked_until timestamptz, -- null: until unblocked
  hits          int not null default 0,
  last_hit_at   timestamptz,
  created_by    text not null,
  created_at    timestamptz not null default now(),
  unique (tenant_id, e164)
);
alter table public.blocked_number enable row level security;
create policy blocked_number_read on public.blocked_number for select using (app.is_staff(tenant_id));

-- ---------------------------------------------------------------- what the screen saw

-- Twilio's caller-ID check (STIR/SHAKEN) and the gate's result, logged on
-- every call so two weeks of real data decide whether to tighten screening.
alter table public.call add column stir_verstat text;
alter table public.call add column screened text check (screened in ('passed', 'no_response'));

-- ---------------------------------------------------------------- texts to our numbers

-- E.g. Google's verification code when the new number goes on the listing.
create table public.inbound_sms (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenant(id),
  business_id        uuid not null references public.business(id),
  tracking_number_id uuid not null references public.tracking_number(id),
  twilio_sid         text not null unique,
  from_e164          text,
  body               text not null default '' check (length(body) <= 1600),
  received_at        timestamptz not null default now()
);
alter table public.inbound_sms enable row level security;
create policy inbound_sms_read on public.inbound_sms for select using (app.is_staff(tenant_id));

-- ---------------------------------------------------------------- the daily summary

-- One text a day for calls that looked like spam or left no details, instead
-- of a text per robocall. Its numbers live in `detail`; it has no lead.
alter table public.outbox add column detail jsonb;
alter table public.outbox drop constraint outbox_kind_check;
alter table public.outbox add constraint outbox_kind_check check (kind in (
  'message', 'abandoned', 'answered', 'web_form', 'agent_lead', 'callback', 'transfer_missed', 'review', 'digest'));

alter table public.job drop constraint job_kind_check;
alter table public.job add constraint job_kind_check
  check (kind in ('post_call', 'callback_escalation', 'vendor_purge', 'daily_digest'));
