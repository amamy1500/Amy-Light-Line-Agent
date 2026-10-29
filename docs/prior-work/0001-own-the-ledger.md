# 0001 — Own the ledger, buy the commodity work

- Status: accepted
- Date: 2026-10-21

## Context

Amy's real asset is closing conversations (her estimate: ~90% of qualified
callers). Every platform she has used — Buildy, Merchynt, Thrive, Vendasta —
stops at "lead" or "ranking". None ties a phone call to a booked job to the
revenue it produced, which is the proof a small agency needs to sell, renew
and upsell a monthly service.

## Decision

Build only a small multi-tenant ledger: call capture, leads, outcomes,
revenue, attribution and an append-only event log, on Next.js + Postgres
(Supabase) + Twilio primitives. Buy commodity fulfilment (Google Business
Profile work from Merchynt, reviews from Thrive) and keep their data in our
tables. Start with the Christmas Light Guys phone line.

## Consequences

- One app, one database, no microservices. Two people can run it.
- Suppliers are replaceable because contacts, numbers and outcomes live with us.
- Revenue proof depends on someone recording outcomes; the inbox makes that one tap.
- Call-tracking suites (CallRail, ServiceTitan) already sell attribution; our
  edge is the bundle with recovery, evidence-backed prospecting and Amy.
