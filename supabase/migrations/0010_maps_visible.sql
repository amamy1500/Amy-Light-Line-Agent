-- Whether the caller says their home is clearly visible on Google Maps
-- (yes / no / unsure). Amy, 2026-10-29: it tells Josh whether he can look at
-- the property remotely or may need to see it. Additive: one more allowed field.
alter table public.lead_fact drop constraint lead_fact_field_check;
alter table public.lead_fact add constraint lead_fact_field_check check (field in (
  'caller_name', 'customer_type', 'property_type', 'property_address', 'zip',
  'service_requested', 'job_type', 'desired_timing', 'callback_window',
  'lead_source', 'notes', 'callback_phone',
  'caller_email', 'home_size', 'outdoor_plugs', 'site_visit_window',
  'maps_visible'));
