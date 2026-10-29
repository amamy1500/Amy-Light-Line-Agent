# 0002 — Human-first call flow; DialBridged decides "answered"

- Status: accepted
- Date: 2026-10-21

## Context

Callers must reach Amy whenever she can answer, and every other outcome must
still produce a record. A forwarded call that reaches her carrier voicemail is
the classic silent loss: the caller leaves a message in her personal mailbox
and no one is alerted. Twilio reports `DialCallStatus=completed` both when Amy
talked and when a screened leg hung up, so the status string cannot tell the
two apart.

## Decision

1. Dedicated tracking numbers ring Amy with a screening whisper on her leg
   ("… press 1 to take it"). No keypress hangs up her leg.
2. A call is `owner_answered` iff Twilio sends `DialBridged=true`; the screen
   only lets her leg bridge after a keypress. Our own `owner_accepted` flag is
   kept for audit, and a disagreement is logged as `call.accept_flag_mismatch`.
3. Everything else goes to a disclosed recovery recording. A hang-up before
   any message becomes an `abandoned_call` lead. Every completed call ends
   with exactly one lead.
4. If our database fails mid-call, the same rule runs in the web tier; if the
   inbound webhook itself fails, the number's Twilio-hosted fallback records a
   message without our server.
5. The conversational voice agent is a later, flagged enhancement that falls
   back to this flow on any error.

## Consequences

- Twilio accounts upgraded after 2026-02-03 cap simultaneous calls at 2–3
  until a Business profile is approved; approval is a launch prerequisite.
- The Amy-answered leg is not recorded in V1 (California all-party consent).
- Tested by `packages/db/test/call-lifecycle.test.ts` (truth table + property
  test over callback orderings) and `apps/web/test/call-flow.test.ts`.
