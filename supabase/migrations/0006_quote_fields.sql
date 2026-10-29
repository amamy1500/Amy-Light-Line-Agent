-- What Amy's own "Request an Estimate" form asks (thechristmaslightguys.com
-- request-a-quote.php), so a phone lead carries the same details as a web
-- one: email, home size, outdoor plugs, and when a site visit would work.
alter table public.lead_fact drop constraint lead_fact_field_check;
alter table public.lead_fact add constraint lead_fact_field_check check (field in (
  'caller_name', 'customer_type', 'property_type', 'property_address', 'zip',
  'service_requested', 'job_type', 'desired_timing', 'callback_window',
  'lead_source', 'notes', 'callback_phone',
  'caller_email', 'home_size', 'outdoor_plugs', 'site_visit_window'));
