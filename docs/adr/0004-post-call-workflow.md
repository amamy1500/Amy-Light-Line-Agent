# 0004 — Post-call work runs as Postgres-backed jobs; no LangGraph in v1

- Status: accepted
- Date: 2026-10-22

## Context

After a call: wait (bounded) for the vendor transcript, scan it for policy
violations, merge extracted facts without overriding what the caller confirmed
live, classify intent, guarantee a callback task, alert Amy, and later remind
her if a hot lead waits. The brief asks whether LangGraph earns a place.

## Decision

- One `job` table (`supabase/migrations/0002_agent.sql`) holds every pending
  step: `post_call`, `callback_escalation`, `vendor_purge`. Jobs are claimed with
  `for update skip locked` and a lease, retried with back-off, deduplicated by key.
- `workflows/post-call/runner.ts` is a plain, idempotent TypeScript sequence. A
  retried job re-runs the whole sequence safely: facts keep provenance, there is
  one open callback per lead, one alert per call and kind.
- Jobs run right after the request that created them (`after()`), and a cron
  sweep (`/api/jobs/run`, every minute) covers timers and crashes.
- **LangGraph is not used.** The pipeline is a fixed sequence with no branching
  plan, no LLM deciding the next step, and needs durable timers (30-minute
  escalation) that LangGraph's checkpointer does not provide. It would add a
  dependency and a second state store for no behaviour we need. (vendor-research.md §7.3)

## When to revisit

Multi-day follow-up sequences with human approval waits (post-estimate
reminders, review requests) → Vercel Workflow (GA April 2026) or Inngest, which
give durable sleeps and step retries. LangGraph only if an LLM must plan steps.
