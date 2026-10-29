import type { FactField, FactSource } from "@/lib/db/agent";
import type { Intent } from "@/lib/db/dashboard";
import type { Channel } from "@/lib/db/repo";

export const INTENT_LABEL: Record<Intent, string> = {
  hot: "Ready to talk",
  warm: "Interested",
  cold: "Just asking",
  not_a_lead: "Not a customer?",
  unknown: "Hung up early",
};

export const FIELD_LABEL: Record<FactField, string> = {
  caller_name: "Name",
  customer_type: "New or returning",
  property_type: "Home or business",
  property_address: "Address",
  zip: "ZIP",
  service_requested: "Wants",
  job_type: "Job",
  desired_timing: "Timing",
  callback_window: "Call back",
  lead_source: "Heard about us",
  notes: "Notes",
  callback_phone: "Other number",
  caller_email: "Email",
  home_size: "Home size (sq ft)",
  outdoor_plugs: "Outdoor plugs",
  site_visit_window: "Site visit could be",
  maps_visible: "Visible on Google Maps",
};

export const SOURCE_LABEL: Record<FactSource, string> = {
  human: "Amy",
  caller_via_agent: "caller, live",
  web_form: "web form",
  post_call_extraction: "from transcript",
  caller_id: "caller ID",
};

export const CHANNEL_LABEL: Record<Channel, string> = {
  tv: "TV",
  web: "Website",
  print: "Print",
  postcard: "Postcard",
  referral: "Referral",
  other: "Other",
  main_line: "Main line",
};

/** Event types as a sentence Amy can read on the timeline; unknown types show as-is in engineering mode only. */
export const EVENT_LABEL: Record<string, string> = {
  "call.received": "Call came in",
  "call.owner_accepted": "Amy pressed 1",
  "call.owner_answered": "Amy took the call",
  "call.recovery": "Amy didn't pick up",
  "agent.connected": "Assistant answered",
  "agent.admission_refused": "Assistant busy: message taken instead",
  "agent.wrapped_up": "Assistant wrapped up",
  "agent.ended": "Assistant hung up",
  "agent.failed": "Assistant dropped: message offered",
  "agent.post_call_received": "Transcript received",
  "transfer.attempted": "Caller asked for Amy",
  "transfer.dial_started": "Ringing Amy",
  "transfer.transferred": "Put through to Amy",
  "transfer.returned": "Amy missed it: back to assistant",
  "transfer.refused": "Transfer not available",
  "task.callback_requested": "Callback requested",
  "task.completed": "Callback done",
  "call.message_captured": "Message left",
  "call.abandoned": "Caller hung up",
  "call.completed": "Call ended",
  "lead.created": "Lead created",
  "lead.repeat_contact": "Called again",
  "lead.state_changed": "Status changed",
  "lead.analyzed": "Call reviewed",
  "consent.recording_declined": "Caller declined recording",
  "consent.vendor_copy_deleted": "Vendor copy deleted",
};
