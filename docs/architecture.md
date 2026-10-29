# Lightline architecture (v1 pilot)

## One sentence

The Christmas Light Guys' own Twilio number rings Amy first; if she doesn't
press a key, an ElevenLabs agent answers with narrow tools into Postgres;
anything that fails falls back to a recorded message; every call ends as one
lead in Amy's console.

## The decision this rests on (Amy, 2026-10-28)

```text
CHRISTMAS LIGHT GUYS ONLY                         EVERYTHING ELSE
new site · TV ad · QR code                        512-339-9313 (Sublime Patio, The Fridge,
        │                                          The Light Guys, a fourth company)
        ▼                                                   │
Twilio +1 737-339-8333 (bought 2026-10-28)                  ▼
        │                                         Amy's own forwarding, texts, voicemail
        ▼                                         NOT TOUCHED by Lightline
Lightline (this app)
```

512-339-9313 is never ported, forwarded or configured here. The multi-company
shared-line code (ADR 0006) stays in place but is not used for launch. Only
the 737 number goes on the new Christmas site, the TV ad and the QR code, and
only after real test calls pass, the app is on always-on hosting, and Twilio's
fallback URL is set (all checked on `/system`). The old PHP site keeps its
current phone number through the season so its #2 ranking isn't disturbed.

## What we own

ElevenLabs is the mouth and ears. Everything that makes the mouth useful is ours:

| Part | What it is | Where |
|---|---|---|
| Verified business brain | Knowledge items with every site claim, its source, conflicts detected; only Amy's approved words are truth | `lib/knowledge/`, `/approvals`, ADR 0005 |
| Deterministic tools | 7 narrow, validated, idempotent, audited tools; the agent reads the brain live through them | `lib/agents/tools.ts`, `gateway.ts` |
| Customer memory | Leads with provenance-ranked facts; returning-caller context | `lead_fact`, `returningCallerSummary` |
| Human hand-off | Amy first; screened, whispered transfer back; callback before anything can fail | `lib/server/voice.ts`, ADR 0003 |
| Revenue trail | Call → lead → callback → outcome → won $, by campaign | `lead`, `task`, `event`, console |
| Safety net | Post-call scan for prices, dates, identity, leaks and unapproved claims | `lib/agents/compliance.ts` |

Swap the mouth (Retell, ConversationRelay) and all of this stays.

## Call flow

```text
caller ──► Twilio number (737-339-8333, "main line") ──► POST /api/voice/inbound
              │ spam gate (blocked → refused; hidden / failed caller ID → "press 1 or say yes")
              │ config.ai.mode + ring hours + capacity (lib/business-rules/routing.ts)
              │ Amy already on one of our calls? (ownerOnCall) ─► agent, entry owner_busy
              ├─ ring_owner ─► <Dial answerOnBridge callerId=737…><Number url=/screen> Amy </Number></Dial>
              │                   screen: "The Christmas Light Guys call. Press any key to take it."
              │                   (any key; her voicemail presses none, so it never takes a caller)
              │                   └─► /dial-result: DialBridged=true ─► Amy talks; lead "connected";
              │                                     "You took a call from …" text + email
              │                                     otherwise ─► routeAfterOwner
              ├─ agent ──────► start_agent_session (row-locked admission)
              │                 → ElevenLabs register-call (4 s budget, circuit breaker)
              │                 → <Connect action=/agent-ended><Stream …/></Connect>
              │                    agent ⇄ POST /api/agent/tools/:tool (secret header, strict schema)
              │                    transfer_to_amy ─► REST redirect ─► /handoff
              │                        <Dial><Number url=/screen?stage=handoff> whisper summary
              │                        ├─ any key ─► transferred (refused while Amy is on another call)
              │                        └─ missed ─► high-priority callback + new agent conversation
              │                 /agent-ended: wrapped up ─► hang up · dropped ─► apology + message
              └─ capture ────► disclosed recording ─► /recording, /transcript (rules extraction)
Twilio status callback ─► finalize_call: every completed call has exactly one lead
ElevenLabs post-call webhook (HMAC) ─► attach transcript ─► post_call job:
   compliance scan ─► facts (never over caller-confirmed) ─► intent ─► callback task ─► Amy alert
   hot lead still waiting after 30 min ─► reminder
```

Fallback without our server at all: the number's Twilio-hosted fallback TwiML
Bin records a message (docs/prior-work/fallback-twiml-bin.xml).

## Call state machine (database `call.state`)

| From | Event | To |
|---|---|---|
| — | inbound, ring hours | `ringing_owner` |
| — | inbound, not ringing Amy | `recovery` (then agent or capture) |
| `ringing_owner` | `DialBridged=true` | `owner_answered` |
| `ringing_owner` | anything else | `recovery` |
| `recovery` | agent admitted | `agent_active` |
| `recovery` | message recorded | `message_captured` |
| `agent_active` | `transfer_to_amy` allowed | `transfer_ringing` |
| `transfer_ringing` | `DialBridged=true` | `transferred` |
| `transfer_ringing` | not bridged | `recovery` (+ high-priority callback) → `agent_active` again or capture |
| `agent_active` | stream ends after wrap-up | `agent_completed` |
| `agent_active` | stream ends without wrap-up | `recovery` (apology + message) |
| any live state | caller hangs up (status callback) | `agent_completed` or `abandoned`, with a lead and a callback |

Each transition is one SQL function call that also writes an append-only event.

## Components

| Path | Responsibility |
|---|---|
| `lib/business-rules/` | Tenant config schema (zod), routing, transfer and quiet-hours rules, tenant #1 config |
| `lib/telephony/` | TwiML builders, Twilio signature check (fails closed), REST redirect |
| `lib/elevenlabs/` | register-call client, HMAC webhook verify, payload schema, dynamic variables, agent spec |
| `lib/agents/` | Tool registry + gateway, Amy Policy (prompt, opening line, canary), compliance scan, intent, connector, circuit breaker |
| `lib/db/` | Typed wrappers over SQL functions; dashboard read models; config versions |
| `workflows/post-call/` | Durable post-call jobs |
| `app/api/` | Webhooks (voice, tools, ElevenLabs), web leads, kill switch, cron sweep |
| `app/dashboard`, `app/leads/[id]` | Amy's console (server-rendered, no client JS beyond forms) |
| `app/christmas-lights-austin` | Campaign landing page; same lead model, same approved facts |
| `supabase/migrations/` | Schema, RLS, invariants (0001 call ledger, 0002 agent layer) |
| `evals/` | 54 dev + 12 held-out scenarios, replay harness, vendor test export |

## Data model

Postgres (PGlite in development, hosted Postgres in production; same SQL). Every
state change is a SQL function in `supabase/migrations/` that writes its row and
an append-only `event` in one transaction. RLS on every table.

| Table | One row per | Key columns | Indexes that matter |
|---|---|---|---|
| `tenant`, `business`, `brand`, `campaign` | office, company, public name, ad channel | `campaign.channel` (tv, web, print, main_line) | |
| `tracking_number` | number callers dial | `e164`, `owner_ring_e164`, `ring_timeout_s`, `ring_owner` | unique `e164` |
| `business_config` | config version | `config` (zod-validated JSON: hours, AI mode, facts…), `active` | one active per business |
| `call` | Twilio call | `twilio_call_sid` (unique), `state`, `route_reason`, `owner_accepted`, `dial_bridged`, `completed`, `lead_id` | open calls per line (0009, the "Amy busy?" check); `started_at` (0009); `lead_id` |
| `agent_session` | ElevenLabs conversation | `status`, `route_reason`, `transcript`, `summary` | live sessions (capacity); by call |
| `tool_call` | agent action | `tool_name`, `idempotency_key` (unique), `input`, `output`, `outcome` | by session; by tool + time (0009, unanswered questions) |
| `lead` | customer | `contact_phone`, `state`, `intent`, `compliance`, `needs_review` | open lead by phone (returning callers) |
| `lead_fact` | detail learned | `field`, `value`, `source` (provenance-ranked) | by lead + field |
| `task` | callback to make | `kind` (callback, review), `status`, `priority`, `due_window` | one open per lead and kind |
| `outbox` | alert to send | `kind`, `channel`, `to_address`, `status`, `attempts`, `last_error` | pending queue; unique `dedupe_key` |
| `job` | background work | `kind` (post_call, callback_escalation, daily_digest…), `status`, `run_after` | due jobs |
| `incident` | something that failed | `kind`, `severity`, `resolved_at` | open, newest first (0009) |
| `event` | anything that happened | `type`, `actor_type`, `payload` | by aggregate |
| `knowledge_item`, `knowledge_claim` | sentence the agent may say, and its source | `status` (pending/approved), `approved_text` | unique key per business |
| `alert_contact` | inbox or phone that gets alerts | `channel`, `address`, `active` | |
| `blocked_number`, `inbound_sms`, `line_business` | spam block, text to our number, company on a shared line | | |

## Operating it: `/system` (System health)

One page answers "is it ready, and is anything wrong?" without changing a
setting (`app/system/page.tsx`, `lib/db/system.ts`, `lib/server/readiness.ts`):
readiness checks for every part a call needs (secrets shown only as set/unset),
where each number rings and where alerts go, traffic for 24 h and 7 days, open
incidents, failed or waiting alerts, stuck jobs, tool errors, the questions the
assistant had no approved answer for, and the latest events.

## Invariants (tested)

I1 tenant isolation · I2 append-only events · I3 replay-safe webhooks · I4 answered
⇔ bridged · I5/A4 every completed call ends with exactly one lead · I6 forward-only
outcomes · A1 one session per conversation, matched by our session id · A2 one
stored result per tool-call key, also under parallel retries (real-Postgres test) ·
A3 a less trusted fact never overwrites a more trusted one · A5 one open callback per
lead · A6 agent sessions never exceed the limit under parallel arrivals (real
Postgres, 60 callers / 10 slots) · A7 transfer counts only when bridged ·
K1 every claim keeps its source · K2 truth only after a person decides, with
exact words · K3 decisions are append-only history · K4 the agent's facts and
service area are a projection of approved items.
