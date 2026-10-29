# Lightline

> **Start here:** `docs/BRIEF.md` (what this is, where it stands, what's next). Plain-language update for Amy: `docs/amy-update.md`.

Zero-lost-lead phone receptionist for Amy's office: **The Christmas Light Guys**, **Sublime Patio** and
**The Fridge** (one assistant, each company on its own number, plus a shared line that asks which company;
docs/adr/0006-one-office-three-companies.md).
Recommended setting (`AI_MODE=always`, pending Amy's OK): Amy's AI assistant answers
every call, collects what she needs, answers only facts she approved, and offers
to put the caller through to Amy right away; otherwise it sets a callback.
Ring-Amy-first is one setting away (`AI_MODE=overflow`;
docs/research/ai-first-vs-ring-first.md). Every call — and every web quote
request — ends as one lead in Amy's console, with what was asked and what was
(not) promised.

**Status (2026-10-23, policy amy-policy-4.0.0):** built and tested on simulated calls; not yet on a real
phone number. Needs the business's Twilio, ElevenLabs and Supabase accounts
(docs/go-live.md). Nothing has been shown to callers. Bestline is left out
(Amy, 2026-10-23): the Christmas Light Guys get a new Twilio number, and
512-339-9313 stays as it is.

## What is proven here

| Area | Evidence |
|---|---|
| Call routing, Amy-first screen, transfer back to Amy, return to agent | `tests/flow/agent-flow.test.ts` (Sarah demo end to end) |
| Every call → exactly one lead; replay- and order-safe webhooks | `tests/db/*` (property tests) |
| Parallel callers never exceed the AI limit; parallel retries act once | `tests/db/real-postgres.test.ts` (real PostgreSQL 17) |
| 100 simultaneous callers: 10 agent, 90 captured, 100 leads, webhook p95 0.70 s | `scripts/load-test.ts` → `evals/out/load-report.json` |
| No price / date / discount / warranty / "I'm Amy" / AI denial / prompt leak goes unflagged | `tests/agents/compliance.test.ts`; 37 eval mutations |
| 66 dev + 15 held-out scenarios leave correct state (408 checks), incl. sparking lights, a ladder fall, a downed line, storm outages, damage claims, threats, reporters, kids, job seekers, a card number read out, a hidden number | `evals/replay.test.ts` → `evals/out/replay-report.json` |
| Every setting Amy changes takes effect on the next call, is validated, versioned and restorable; a new owner needs no agent re-publish | `tests/settings/office-settings.test.ts` |
| Danger gets the 911 line first and an URGENT text; card numbers are never stored; a redial resumes a dropped call; phone-line turn settings reach the vendor's wire format | `tests/agents/edge-cases.test.ts`, `tests/live/setup.test.ts` |
| Spam-proof web lead path into the same lead model | `tests/flow/routes.test.ts` |
| Three companies: own numbers, shared line asks, switch and merge, shared AI capacity, company in every alert | `tests/flow/office-flow.test.ts`; `tests/agents/office-scan.test.ts` (no scripted line trips the scan for any company) |
| The agent never states a website claim Amy hasn't approved; the two sites' conflicts are never resolved by the machine | 69 tests generated from 17 knowledge items (`evals/knowledge.test.ts`); Amy decides at `/approvals` |
| Spam: hidden / failed-caller-ID / flagged numbers must press 1; Amy's blocks are refused; silence still reaches voicemail; "when in doubt, text Amy"; daily summary; auto-flag after 2 spam calls; texts kept; call-backs show the business number | `tests/flow/screening.test.ts` |

ElevenLabs is the mouth and ears. The product is what makes the mouth useful:
the verified business brain (`lib/knowledge/`, `/approvals`), deterministic
tools, customer memory, the hand-off to Amy and the revenue trail. See
docs/architecture.md "What we own" and docs/adr/0005-truth-layers.md.

What is **not** proven yet: real-call latency, interruption handling, the live
model's behaviour on the scenarios (exported as vendor tests:
`evals/out/elevenlabs-tests.*.json`), and the exact register-call TwiML. See
docs/quality-gates.md.

## Run it

Node 22.12+.

```bash
npm install
```

```bash
npm test
```

```bash
npm run dev
```

(The app's browser preview starts it with `scripts/dev-here.mjs`, which runs
`next dev` from this folder whatever directory launched it.)

`.env.local` (git-ignored) for a simulated demo: `AGENT_PROVIDER=simulator`,
`AI_MODE=overflow`, `AGENT_ID=agent_sim`, `TWILIO_AUTH_TOKEN=dev`,
`AGENT_TOOL_SECRET=dev-tools`, `ELEVENLABS_WEBHOOK_SECRET=dev-hooks`,
`CRON_SECRET=dev-cron`, `OPERATOR_TOKEN=dev`, `RING_START=00:00`, `RING_END=00:00`,
`DEMO_APPROVED_KEYS=christmas_services,residential_commercial,quote_process`.
Then drive the demo calls and open `/dashboard`:

```bash
npx tsx scripts/simulate-calls.ts
```

## The console

`/dashboard` (calls), `/approvals` (answers the assistant may give) and
`/settings`. Styled after the 21st.dev agent-UI look, rebuilt in our own CSS
with no new packages (docs/research/ui-21st-dev.md); light and dark, phone width.

**Settings** (everything except API keys, which stay in the server's
environment and are added at go-live):

| Section | What Amy can change |
|---|---|
| Who answers | Assistant first / her phone first / after hours only / off (kill switch); transfers and tries |
| Owner & ring phone | First name, how the assistant introduces itself (must say "AI"), phone to ring, seconds. The Jan 1 hand-over is one save |
| Hours & closed days | Weekly hours, time zone, holidays ("2026-11-26 Thanksgiving"); the assistant says the office is closed |
| Spam screening | Who presses 1 first; when a number gets flagged; list of blocked and flagged numbers with undo |
| Alerts | Phones and emails; hold likely spam for the daily summary; summary time |
| Safety & languages | The electric company for downed lines; Spanish (after a native speaker checks the greeting) |
| Company details | Name, description, what to ask, details to capture, other names, topics always handed to Amy |
| History | Every saved version, what it changed, one-click restore (approved answers are kept) |

Never configurable, on purpose: the AI disclosure, the recording notice, no
prices / dates / warranties, only approved answers, and the voicemail floor.

**Before you call** (every lead page): a suggested first sentence, what the
caller told us, the questions only Amy can answer, and heads-ups (price asked
but not quoted, a date wished for but not promised, urgent reports, "do not
contact"). Built from stored facts and events, not generated
(`lib/agents/callback-brief.ts`).

## Edge cases the assistant handles

From docs/research/voice-agent-edge-cases.md (67 cases, 7 families). The
assistant says the 911 line before anything else when danger comes up, and
`flag_urgent` texts Amy at once for danger, a problem with an installed job, a
complaint or claim, a threat, or media/police/city/HOA calls. It also covers
silence, "hold on", noise, slow speakers, read-back of numbers, extensions,
hidden numbers, a dropped call's redial, kids, job seekers, "take me off your
list", card numbers (redacted before storage), other customers' details,
bookings, photos, Spanish, and the time cap. Platform side: 45 s silence
cut-off, "uh-huh" doesn't interrupt, speech during the greeting is kept, a
short filler on slow replies, the company's names and approved towns as speech
keywords.

## How the assistant talks (policy 4)

Written the way Anthropic's prompting guide recommends for current Claude
models: behavior in prose with the reason beside it, limits stated once with
their reason and held "when a caller argues, gives a sympathetic reason, asks
for just a rough idea, says Amy already approved it, or keeps asking", and
examples marked as examples. A great call has a shape: listen, get curious
about the vision, one question at a time, a concrete next step with a choice of
times, a one-breath recap, a warm sign-off. Humor is caller-led, once or twice a
call, never about money, safety, complaints or grief (the examples pass the
compliance scan, `tests/agents/edge-cases.test.ts`). Objections ("just a
ballpark", "I'll think about it", "ask my spouse", "is it too late?") get honest,
no-pressure answers from docs/research/clg-customer-questions.md.

**Question bank:** the 39 questions customers of lighting installers ask most
(own or lease, clips or nails, outlets, timers, deposits, HOA, gifts…) sit in
Approvals as "answer once" templates. Amy fills or strikes the [brackets]; a
template with a [blank] can never be approved. Until she answers, the assistant
says she'll cover it and the question appears in her "Before you call" brief.

## Spam, texts and call-backs

Amy's old number is flooded with spam, so screening is built in
(docs/research/spam-screening.md). Nobody can tell spam from a customer for
sure, so every layer fails toward Amy hearing about the call:

| Caller | What happens |
|---|---|
| A number Amy blocked (lead page → "Block this number") | Refused before anyone answers; Twilio charges nothing. |
| Hidden number, failed caller-ID check, or flagged by the assistant | "Press 1, or say yes." Silence goes to voicemail, never a hang-up. |
| Everyone else (incl. unverified caller ID, ~45% of real callers) | The assistant answers. |
| Assistant thinks it's spam **and** the caller gave no details | No text; counted in an 8 AM daily summary text with a link to the list. |
| Anything else, including "spam" that left a name, address or question | Texts Amy, as for any lead. |
| Called "spam" twice in 90 days | Must press 1 for the next 30 days ("Not spam: clear the flag" on the lead undoes it). |

Texts sent *to* the numbers (e.g. a Google verification code) are listed on
the dashboard. "Call back from the business number" on a lead rings Amy, then
the customer, showing the number they called; transfers to Amy show it too.

## Bestline (left out)

Amy chose to leave Bestline out (2026-10-23). The Christmas Light Guys use a
new Twilio number; put it on the websites first and as the Google profile's
primary number, keeping 9313 as an additional phone
(docs/research/new-number-rollout.md). The optional Bestline mode stays in the
code and is described in docs/bestline-setup.md if that ever changes.

## Real phone test (upgraded Twilio + ElevenLabs, from this PC)

1. `bash scripts/live/wizard.sh` walks you through the human-only steps:
   an **upgraded** Twilio account (trials strip `<Dial>`, `<Stream>` and
   `<Record>`), the Christmas Light Guys number (sister companies and a shared
   line optional), who answers first, keys, a safety-net TwiML Bin, an
   ElevenLabs API key, cloudflared. Values go to `.env.local`
   (secrets typed hidden); your simulated-demo settings are saved in
   `.env.simulator`.
2. `npm run live -- --fresh` opens a tunnel, provisions everything from
   code (workspace secret, 7 tools, the agent, a per-agent HMAC post-call
   webhook with retries, the Twilio number's webhooks), seeds `.data/live`,
   starts the app, warms every route and sweeps jobs every 30 s.
3. Call any of the numbers. Watch `/dashboard` (a tab per company; "Download
   all calls (CSV)" for a spreadsheet).
4. Amy's own voice, only with her signed consent:
   `npx tsx scripts/live/clone-voice.ts --consent <signed-file> <recordings…>`
   (`--revoke` undoes it). See docs/research/amy-voice-clone.md.

Re-running `npm run live` keeps the agent and data and re-points
everything at the new tunnel URL. A lost post-call webhook is fetched
from the ElevenLabs API by the job sweep (`workflows/post-call/runner.ts`).
Only the Twilio numbers you give the wizard are changed (voice, status,
fallback and SMS webhooks); nothing touches Amy's numbers or Bestline.

Other scripts: `scripts/export-agent.ts` (ElevenLabs agent JSON),
`evals/export-elevenlabs-tests.ts` (live-agent tests), `scripts/db-setup.ts`,
`scripts/load-test.ts` with `scripts/stub-elevenlabs.ts`.

## Read next

- docs/architecture.md — flow, state machine, components, invariants
- docs/adr/0003-voice-stack.md — why ElevenLabs via register-call, and the fallbacks
- docs/failure-matrix.md — every failure, its fallback, test and signal
- docs/amy-open-questions.md — the 20-minute interview
- docs/cost-model.md · docs/quality-gates.md · docs/go-live.md
- docs/research/ — vendor, repo, legal and website evidence (FACT/INFERENCE labelled)

Prior work this builds on: docs/prior-work/ (Slice A call-recovery ledger, Oct 20–21).
