-- A company's own published number (e.g. the line Bestline forwards to us),
-- as opposed to a campaign tracking number. Amy's whisper says "from the
-- main line" instead of naming an ad channel.
alter table public.campaign drop constraint campaign_channel_check;
alter table public.campaign add constraint campaign_channel_check
  check (channel in ('tv', 'web', 'print', 'postcard', 'referral', 'other', 'main_line'));

-- False when the carrier already rang the owner before forwarding to us
-- (e.g. Bestline forward-on-no-answer): ringing Amy again would only delay
-- the caller, so the AI (or capture) answers straight away.
alter table public.tracking_number add column ring_owner boolean not null default true;
