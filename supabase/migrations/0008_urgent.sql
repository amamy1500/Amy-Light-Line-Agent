-- 0008_urgent: an alert the assistant raises in the middle of a call.
--
-- Danger (sparking, smoke, a fall, a downed line), a problem with lights we
-- installed, a complaint or damage claim, a threat, or a call from media,
-- police, the city or an HOA texts Amy at once, ahead of the post-call
-- summary and regardless of the "likely spam" hold. What it was about lives
-- in `detail` ({kind, summary}); one per call and kind.
alter table public.outbox drop constraint outbox_kind_check;
alter table public.outbox add constraint outbox_kind_check check (kind in (
  'message', 'abandoned', 'answered', 'web_form', 'agent_lead', 'callback', 'transfer_missed', 'review', 'digest', 'urgent'));
