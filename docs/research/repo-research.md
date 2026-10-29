# Repository due diligence: AI phone receptionist

- **Date:** 2026-10-22
- **Target stack:** Twilio + voice agent + Next.js/TypeScript + Supabase
- **Method:** `gh api` (REST + GraphQL), npm registry API, OSS Insight API, HN Algolia API, and read-only shallow clones.
- **Clone location:** `%TEMP%\claude\repo-audit\<repo>`
- **Safety:** No install, build, test or project script was run from any cloned repo. Files were only read or grepped.

## Evidence labels

| Tag | Meaning |
|---|---|
| **[CODE]** | OBSERVED IN CODE: read in a shallow clone or through the contents API. |
| **[API]** | FACT (API): returned by the GitHub, npm or OSS Insight APIs on 2026-10-22. |
| **[INF]** | INFERENCE: my judgement from the evidence. |
| **[OPEN]** | OPEN QUESTION: not verified. |

## Limitations

- **[API]** GitHub no longer lets you list stargazers on 2026-10-22:
  - REST `GET /repos/{o}/{r}/stargazers` returns 404 for every repo I tried (Aiva, rea, livekit/agents).
  - GraphQL `stargazers{...}` returns `totalCount: 0` with no edges, even for `torvalds/linux`. `stargazerCount` still works.
  - So the requested 100-stargazer account sample was **not possible**. I used fork-owner sampling and OSS Insight star-history data instead.
- **[INF]** "Test files" counts files under `tests/`, `spec/` or `__tests__/`, or named `*_test.*`, `*.test.*`, `*.spec.*` or `test_*`. It shows the shape of a test suite, not its coverage.
- **[INF]** "Commits in the last 90 days" uses GraphQL `history(since: 2026-07-24)`. "Human authors" is taken from the latest 100 commits in that window, with bots excluded.

---

## 1. Executive summary

1. **Nothing gives us a whole receptionist we can safely reuse.**
   - 7XLabs/Aiva is the closest functional match (Next.js + Twilio + Claude, MIT). It is a 5-day, single-author demo.
   - Its storage is a JSON file. Its Twilio signature check fails open. It has cross-tenant mutation bugs, unauthenticated SMS-broadcast and tool-executing endpoints, and it is pinned to Next 14.2.5, which has 35 advisories including the middleware auth bypass.
   - Treat it as a **feature checklist and prompt/tool-schema inspiration**, never as a base. **[CODE][API]**
2. **Reuse the official SDKs, and build the business logic ourselves.**
   - `twilio` 6.2.0 (MIT): signature validation and the TwiML `<Connect><ConversationRelay>`/`<Stream>` builders.
   - `@elevenlabs/elevenlabs-js` 2.74.0 (MIT): `conversationalAi.twilio.registerCall` and `webhooks.constructEvent`.
   - `@openai/agents-extensions` 0.21.0 (MIT): `TwilioRealtimeTransportLayer`, only if we pick OpenAI realtime.
   - Scheduling, tenancy, caller memory, callbacks and analytics are ours to build on Supabase/Postgres.
3. **Self-hosted voice frameworks (LiveKit Agents, Pipecat) are production-grade but add infrastructure.**
   - Both are Apache-2.0 / BSD-2.
   - The cost is a Python or WebRTC media plane and SIP. They are worth it only if we leave hosted voice (ElevenLabs Agents or Twilio ConversationRelay).
   - LangGraph and LangChain are unnecessary for a single-agent receptionist loop. **[INF]**
4. **morluto/rea: AVOID.**
   - It is a real, original, MIT reverse-engineering MCP server, not a fork or mirror. It was renamed from `betterBinaryMCP`.
   - It has nothing to do with telephony, voice or agents-for-calls.
   - Its 360k stars came in about 19 days after a genuine viral moment. The size is an outlier that can't be verified because stargazer enumeration is disabled.
   - It has no install-script or blob red flags. Its pitch ("inspect an app … build a version for your project") brings IP/EULA risk we don't want. **[CODE][API][INF]**

---

## 2. Master table: mandatory repos

Stars/forks/license/dates come from `GET /repos` **[API]**. Activity comes from GraphQL **[API]**. Test and CI counts come from git trees **[API]**.

| Repo | Stars / forks | License (API / file) | Created → pushed | Commits 90d / contributors | Open issues / open PRs | Releases (latest) | Test files / CI workflows | Verdict |
|---|---|---|---|---|---|---|---|---|
| [7XLabs/Aiva](https://github.com/7XLabs/Aiva) | 9 / 1 | MIT / MIT | 2026-07-12 → 2026-10-09 (dependabot only) | **0** / 3 (1 human) | 0 / 5 (all dependabot) | 0 (CHANGELOG says 0.3.0) | 16 / 1 | STUDY (inspiration only) |
| [morluto/rea](https://github.com/morluto/rea) | 360,806 / 90,553 | MIT / MIT | 2026-04-14 → 2026-10-22 | 3,608 / 286 | 980 / 672 | 38 (rea-agents-6.7.0, 2026-10-18) | 1,999+ / 32 | **AVOID** (irrelevant) |
| [livekit/agents](https://github.com/livekit/agents) | 14,891 / 3,979 | Apache-2.0 / Apache-2.0 | 2023-10-19 → 2026-10-22 | 611 / 568 | 234 / 566 | 379 (livekit-agents@1.8.8, 2026-10-15) | 360 / 13 | STUDY; reuse if self-hosting |
| [livekit/agents-js](https://github.com/livekit/agents-js) | 947 / 408 | Apache-2.0 / Apache-2.0 | 2024-04-01 → 2026-10-22 | 321 / 146 | 107 / 379 | 1,690 incl. plugins (@livekit/agents 1.9.3) | 310 / 4 | STUDY; reuse if self-hosting in TS |
| [pipecat-ai/pipecat](https://github.com/pipecat-ai/pipecat) | 16,707 / 2,937 | BSD-2-Clause / BSD-2 | 2023-12-27 → 2026-10-22 | 3,407 / 375 | 115 / 304 | 123 (v1.13.0, 2026-10-19) | 378 / 12 | STUDY; reuse if self-hosting in Python |
| [langchain-ai/langgraph](https://github.com/langchain-ai/langgraph) | 43,700 / 7,486 | MIT / MIT | 2023-08-09 → 2026-10-22 | 198 / 291 | 360 / 144 | 582 (1.2.16, 2026-10-16) | 258 / 17 | Not needed (overkill) |
| [langchain-ai/langgraphjs](https://github.com/langchain-ai/langgraphjs) | 3,370 / 613 | MIT / MIT | 2024-01-09 → 2026-10-22 | 175 / 157 | 84 / 95 | 701 (checkpoint-postgres 1.1.2, 2026-10-21) | 625 / 7 | Not needed |
| [langchain-ai/langchain](https://github.com/langchain-ai/langchain) | 148,247 / 24,881 | MIT / MIT | 2022-10-17 → 2026-10-22 | 588 / 3,746 | 545 / 118 | 1,396 (langchain 1.4.7, 2026-10-21) | 1,099 / 27 | AVOID as a dependency |
| [openai/openai-agents-python](https://github.com/openai/openai-agents-python) | 30,218 / 4,919 | MIT / MIT | 2025-03-11 → 2026-10-22 | 742 / 408 | 14 / 12 | 124 (v0.24.0, 2026-10-15) | 514 / 10 | STUDY (Twilio and SIP examples) |
| [openai/openai-agents-js](https://github.com/openai/openai-agents-js) | 3,936 / 988 | MIT / MIT | 2025-05-31 → 2026-10-21 | 418 / 128 | 11 / 4 | 92 (0.21.0, 2026-10-20) | 379 / 8 | REUSE if the voice runtime is OpenAI realtime |
| [twilio/twilio-node](https://github.com/twilio/twilio-node) | 1,543 / 564 | MIT / MIT | 2013-02-19 → 2026-10-21 | 15 / 147 (4 active humans) | 29 / 33 | 261 (6.2.0, 2026-10-12; about monthly) | 36 / 6 | **REUSE** (core dependency) |
| [VapiAI/examples](https://github.com/VapiAI/examples) | 11 / 2 | **NONE** / no LICENSE file | 2025-11-14 → 2026-06-04 | 0 / 4 | 0 / 5 | 0 | 0 / 0 | Inspiration only (no license) |
| [elevenlabs/elevenlabs-js](https://github.com/elevenlabs/elevenlabs-js) | 446 / 88 | MIT / MIT | 2023-12-12 → 2026-10-20 | 20 / 24 | 13 / 8 | 144 (v2.74.0, 2026-10-20; weekly) | 255 / 1 | **REUSE** (if ElevenLabs) |
| [elevenlabs/examples](https://github.com/elevenlabs/examples) (was elevenlabs-examples) | 631 / 286 | MIT / MIT | 2024-03-14 → 2026-10-20 | 8 / 26 | 1 / 0 | 2 (stale, 2025-01) | 0 / 1 | Low value (no Twilio example on `main`) |
| [elevenlabs/cli](https://github.com/elevenlabs/cli) | 102 / 20 | MIT / MIT | 2025-10-21 → 2026-10-22 | 28 / 12 | 4 / 5 | 38 (v1.7.0, 2026-10-20) | 64 / 3 | REUSE as a tool (agents-as-code) |
| [elevenlabs/elevenlabs-python](https://github.com/elevenlabs/elevenlabs-python) | 3,149 / 464 | MIT / MIT | 2023-03-26 → 2026-10-20 | 32 / 67 | 20 / 28 | 176 (v2.74.1) | n/a / n/a | Only if we add a Python worker |

### npm usage for context **[API]**

Monthly downloads, 2026-09-19 to 2026-10-18:

| Package | Downloads |
|---|---|
| `twilio` | 26.1M |
| `livekit-server-sdk` | 9.8M |
| `@openai/agents` | 8.4M |
| `@elevenlabs/elevenlabs-js` | 3.8M |
| `@livekit/agents` | 3.5M |
| `@openai/agents-extensions` | 1.19M |
| `rea-agents` | 549,553 |

---

## 3. BUILD vs REUSE (exact)

| # | Component | Decision | Source, license, path | Why |
|---|---|---|---|---|
| 1 | Twilio webhook signature validation | **REUSE library, wrap ourselves** | `twilio` 6.2.0, MIT: `src/webhooks/webhooks.ts`. Exports `validateRequest(authToken, header, url, params)`, `validateRequestWithBody(authToken, header, url, rawBody)` and `validateBody`. | **[CODE]** Constant-time compare (`safeCompare` → `crypto.timingSafeEqual`). Tries the URL with and without the port, then the normalized URL and the legacy querystring form. Our wrapper must **fail closed** when the token is missing and must build the URL from a pinned public origin. |
| 2 | Media WebSocket authentication (`<Stream>` / ConversationRelay WS) | **BUILD, following a reference pattern** | `openai/openai-agents-js`, MIT: `examples/realtime-twilio/server.ts`, around lines 135–200. Validates `X-Twilio-Signature` on the WS upgrade against the pinned `wss://<origin>/media-stream` and rejects any query string. Alternative: `dograh-hq/dograh`, BSD-2: `api/services/telephony/ws_auth.py::build_media_ws_url` (token in the path segment). | **[CODE]** Twilio drops the query string on `<Stream url>`, per the Dograh code comment and consistent with Twilio docs **[INF]**. Unauthenticated media sockets are a takeover vector. |
| 3 | TwiML generation | **REUSE** | `twilio` MIT: `src/twiml/VoiceResponse.ts`. `Connect` has `conversationRelay()`, `conversationRelaySession()`, `stream()`, `aiSession()`, `virtualAgent()`, `room()` and `conversation()`. `ConversationRelayAttributes` includes `ttsProvider`, `voice`, `welcomeGreeting`, `interruptible`, `dtmfDetection`, `transcriptionProvider` and `elevenlabsTextNormalization`. | **[CODE]** Typed (`index.d.ts`). It is **CommonJS only**: `tsconfig` `module: commonjs`, no `exports` or `"type":"module"`. It works from Next.js via default import / `esModuleInterop` **[INF]**. Node ≥ 20 is required since 6.0.0 (UPGRADE.md). Do not hand-roll XML strings like Aiva's `lib/twiml.ts`. |
| 4 | Voice runtime (STT, TTS, turn-taking, barge-in) | **REUSE a hosted service; do not build** | Option A: ElevenLabs Agents through `@elevenlabs/elevenlabs-js`, MIT: `src/api/resources/conversationalAi/resources/twilio/client/Client.ts` (register-call returns TwiML; outbound call). Option B: Twilio ConversationRelay (TwiML above) plus our own LLM WS server. Option C (self-host): pipecat (BSD-2) or LiveKit Agents (Apache-2.0). | **[INF]** Building voice activity detection, interruption handling and TTS streaming ourselves is a multi-month risk. Aiva's `<Gather input="speech">`/`<Say>` with Polly is turn-based and high-latency **[CODE]**. |
| 5 | Twilio Media Streams ↔ realtime model bridge | **REUSE if we choose OpenAI realtime** | `@openai/agents-extensions` 0.21.0, MIT: `packages/agents-extensions/src/TwilioRealtimeTransport.ts` (673 lines). Handles g711 µ-law, `mark`/`clear` events and interruption timing. It is exported from the package root. | **[CODE]** Tested in `packages/agents-extensions/test/TwilioRealtimeTransport*.test.ts`. |
| 6 | ElevenLabs post-call webhook verification | **REUSE with a hardening wrapper** | `@elevenlabs/elevenlabs-js` MIT: `src/wrapper/webhooks.ts` `WebhooksClient.constructEvent(rawBody, sigHeader, secret)` (**async**). | **[CODE]** Fails closed: throws when the header or secret is missing. Parses `t=…,v0=…` and enforces a 30-minute past tolerance. It does **not** reject future timestamps, and it compares with `!==` rather than in constant time. Prefer our own `timingSafeEqual` check that uses the same scheme. |
| 7 | Agent tool loop (our server side) | **BUILD** (about 150 LOC) | Pattern from Aiva, MIT: `lib/agent/index.ts` (bounded `MAX_TOOL_ITERATIONS = 6`, history window, API-error → transfer fallback) and `lib/agent/tools.ts` (tool descriptions that say *when* to call). | **[INF]** With hosted ElevenLabs, tools become server webhooks that we implement anyway. LangGraph/LangChain would add dependency churn (LangChain has 1,396 releases) for no benefit. |
| 8 | Booking / double-booking guard | **BUILD in Postgres** | Pattern from `Hiberius/whatsapp-receptionist`, MIT: `supabase/migrations/202604240001_initial_backend_mvp.sql`, about lines 408–428: `exclude using gist (tenant_id with =, tstzrange(scheduled_at, scheduled_at + duration_minutes * interval '1 minute','[)') with &&) where (status='confirmed')`. Interval math: Aiva `lib/overlap.ts` (MIT, 20 lines). | **[CODE]** A database constraint removes the TOCTOU race that Aiva has (`isSlotTaken` then `addAppointment`). Store `timestamptz` plus the business IANA timezone. |
| 9 | Multi-tenant model + RLS | **BUILD** | Pattern from the same MIT migration: `enable row level security` on all tables plus `create policy … using (tenant_id = public.current_tenant_id())` (lines ~838–871). | **[CODE]** Aiva has no tenancy. `businessId` comes from a query string and falls back to `businesses[0]` (`app/api/voice/incoming/route.ts:28`). |
| 10 | Caller memory / returning-caller context | **BUILD** | Inspiration: Aiva `lib/callerMemory.ts` (MIT). | **[CODE]** Aiva keys only on ANI and reads name, upcoming appointment and last order to any caller with that number. That is spoofable. We need a verification gate before disclosing PII. |
| 11 | Post-call insights (summary, sentiment, intent, action items) | **BUILD** (or use ElevenLabs data collection) | Schema inspiration: Aiva `lib/insights.ts` (`INSIGHT_SCHEMA`, JSON-schema structured output, idempotent on `call.summary`). | **[CODE]** Aiva fires it with `void analyzeCall(...)` after returning TwiML (`app/api/voice/respond/route.ts:108`). On serverless that work can be killed **[INF]**. Use a durable job (Supabase queue / pg_cron / Inngest). |
| 12 | Callback tasks / missed-call recovery | **BUILD** | Inspiration: Aiva `request_callback` tool → `addActionItem` + webhook. `DevCalebR/callbackcloser` matches the domain closely but is **proprietary** ("All rights reserved"): do not copy. | **[CODE]** Aiva tasks have no owner, SLA, dedupe or outbound execution. |
| 13 | Warm transfer | **BUILD on Twilio** (Conference + REST), or **REUSE** if on LiveKit | LiveKit, Apache-2.0: `agents/src/workflows/warm_transfer.ts` (1,272 lines; hold audio, SIP origination, summary to the human). Tests: `warm_transfer.test.ts` and `twilio_connector_warm_transfer*.test.ts`. Python twin: `livekit-agents/livekit/agents/beta/workflows/warm_transfer.py`. Pipecat: `examples/flows/python/warm_transfer.py`. | **[CODE]** Aiva's transfer is a cold `<Dial>` with no context handoff. |
| 14 | Voicemail / AMD (outbound callbacks) | **BUILD** using Twilio `machineDetection` | Reference: LiveKit `agents/src/voice/amd.ts` (+ `amd.test.ts`); pipecat `examples/features/features-voicemail-detection.py`. | **[INF]** Only needed for outbound recovery calls. |
| 15 | SMS confirmations / reminders | **REUSE** `twilio` `messages.create` + Twilio Advanced Opt-Out; **BUILD** templates | Aiva `lib/smsTemplates.ts` (MIT) as a copy reference. | **[CODE]** Aiva sends SMS to model-supplied numbers (toll-fraud and harassment vector) and reports "SMS confirmation sent" even when Twilio is unconfigured. |
| 16 | Outbound customer webhooks | **BUILD** (Standard-Webhooks style: id + timestamp + HMAC, retries, SSRF allow-list) | Not Aiva (`lib/webhooks.ts` is an anti-pattern). | **[CODE]** Aiva signs without a timestamp (replayable), uses one global secret, does fire-and-forget `fetch` to a tenant-controlled URL (SSRF), and never retries. |
| 17 | Dashboard auth | **REUSE** Supabase Auth | — | **[CODE]** Aiva uses a single shared `DASHBOARD_TOKEN` in a query string, compared with `===`, enforced only in middleware on Next 14.2.5 (see §4.1). |
| 18 | Analytics | **BUILD** (SQL views) | Inspiration: Aiva `lib/metrics.ts`. | **[CODE]** Aiva's `automationRate` counts every outcome except `transferred`/`missed` as "resolved by AI", including `in_progress` and callback-logged calls. That inflates the number. |
| 19 | Agent config-as-code + agent tests (ElevenLabs) | **REUSE the tool** | `elevenlabs/cli` (MIT, now Rust): `cli/elevenlabs/workflow/agents.rs`, `project.rs`, `tests.rs`, `verify.rs`. | **[CODE]** Use the CLI binary in CI; don't vendor its code. |
| 20 | Conversation evals | **BUILD** | Pattern: Aiva `scripts/eval.ts` (scripted turns + event assertions, MIT) and pipecat `evals/release/scenarios/scripted/*.yaml` (BSD-2). | **[CODE]** Aiva evals run against the real store and real SMS. Isolate ours. |
| 21 | Prompt-injection hygiene for carrier/custom params | **REUSE snippet** | `PatterAI/Patter`, MIT: `libraries/typescript/src/server.ts` `sanitizeVariables()`. Strips `__proto__`/`constructor`, removes C0/C1 controls and U+2028/9, caps at 500 chars. | **[CODE]** Small and self-contained; keep the attribution. |
| 22 | Rate limiting | **BUILD** (Redis/Upstash or Postgres) | — | **[CODE]** Aiva's limiter is per-instance (`lib/rateLimit.ts:3`) and keyed on a spoofable `x-forwarded-for`. |
| 23 | Reverse-engineering tooling | **Do not use** | morluto/rea | See §4.2. |

---

## 4. Mandatory repos in depth

### 4.1 7XLabs/Aiva (deep audit)

#### Repo facts **[API]**

- Created 2026-07-12. 287 commits, 283 of them by `dchaudhari7177`, all between 2026-07-12 and 2026-07-17.
- No commits in the last 90 days. The last meaningful commit is a 2026-07-17 merge.
- `pushed_at` 2026-10-09 is dependabot activity. 5 dependabot PRs are open (twilio 6, actions, @types/node).
- 0 issues, 0 releases. 9 stars, 1 fork.
- **[INF]** The commit burst (287 commits in about 5 days, many seconds apart) looks AI-generated.

#### Stack **[CODE]** (`package.json`)

- `next` **14.2.5**, exact pin; the lockfile also has 14.2.5.
- `react` ^19.2.7 with `react-dom` ^18.3.1. These majors don't match; a dependabot bump went half-way.
- `twilio` ^5.3.0 (lock 5.13.1), `@anthropic-ai/sdk` ^0.111.0, `typescript` ^7 (lock 7.0.2).

#### Advisories on next@14.2.5 **[API]**

- 35 GitHub advisories: 3 critical, 12 high.
- They include **CVE-2025-29927, "Authorization Bypass in Next.js Middleware"**. Aiva's only dashboard/API auth is `middleware.ts`.

#### Architecture **[CODE]**

- Next.js App Router with route handlers.
- Voice runs entirely on Twilio `<Gather input="speech">` + `<Say voice="Polly.*">` (`lib/twiml.ts`, string-built XML).
- Each caller utterance becomes `POST /api/voice/respond` → `runAgentTurn()` (Claude `claude-opus-4-8`, `thinking: adaptive`, `effort: low`, prompt caching on the system prompt) → TwiML reply.
- `/api/voice/status` finalizes calls that hung up.
- Storage is a **JSON file** (`lib/db.ts`):
  - `data/store.json` (line 27).
  - A module-level `cache` (line 30).
  - The whole file is rewritten on every mutation (line 57).
  - No locking and no transactions.
  - **[INF]** On Vercel, the deploy target in `DEPLOYMENT.md`, the filesystem outside `/tmp` is read-only, so writes would fail. Each instance would also keep its own divergent cache. **[OPEN]** Not tested.

#### Twilio webhook flow **[CODE]**

| Route | Behaviour |
|---|---|
| `/api/voice/incoming` | Verifies the signature, then rate-limits 6 calls per 10 minutes per `From` (in-memory). Looks up the returning caller by ANI and greets them by name in their last language. Upserts the call. Returns `sayAndGather`. Unknown `businessId` silently falls back to `businesses[0]` (line 28). |
| `/api/voice/respond` | Silence → re-prompt. Otherwise runs the agent turn, appends the transcript and derives the outcome from tool events. `transfer_requested` → `<Say><Dial>staffPhone</Dial>`. Hangs up when the caller's text contains a `GOODBYE_MARKERS` substring (line 18): "bye", "that's all", … This can cut a call short mid-sentence. |
| `/api/voice/status` | On terminal status: sets `endedAt`, marks `missed` if there is no transcript, and fires `analyzeCall` as fire-and-forget. |
| `/api/sms/incoming` | Signature-checked. `CANCEL` cancels the next appointment of the first business that matches the sender's number. Anything else becomes a staff task. |

#### Signature validation: does it fail open? **YES.** **[CODE]**

`lib/twilioAuth.ts:12`:

```ts
const token = process.env.TWILIO_AUTH_TOKEN;
// Dev mode: no token configured → skip validation so local testing works.
if (!token) return true;
```

- With a missing token, every voice and SMS webhook accepts forged requests.
- Good part: the URL is built from `NEXT_PUBLIC_APP_URL` + path + search (a pinned origin, not the Host header), and it uses `twilio.validateRequest`.
- **[INF]** If `NEXT_PUBLIC_APP_URL` is unset, the URL becomes relative. That makes `validateRequest`/`new URL()` throw (500) rather than return 403.

#### Agent tool loop **[CODE]** (`lib/agent/index.ts`)

- Sliding window of 24 turns, trimmed to start on a user turn.
- Loops up to 6 tool iterations. Tools run **sequentially**.
- Error handling:
  - `AuthenticationError` reads a config message aloud to the caller (leaks setup details).
  - `RateLimit`, `InternalServer` and `APIConnection` errors → apologize and `transfer_requested`.
  - `refusal` stop → canned reply.
  - Iteration cap reached → transfer.
- The system prompt (`prompt.ts`) embeds `new Date()`, open/closed state and caller context, then marks the whole block `cache_control: ephemeral`. **[INF]** Cache hits are therefore limited to the same call or day.

#### Scheduling guards **[CODE]** (`lib/agent/tools.ts`, `lib/slots.ts`, `lib/db.ts`)

Done well:

- `book_appointment` checks the regex format, rejects dates before today, and rejects closed weekdays and holidays.
- It rejects times outside opening hours (parsed from free text like "Mon–Sat 9:00–18:00").
- It **re-checks overlap at booking time with the service duration**.

Gaps:

- **Race:** `isSlotTaken` then `addAppointment` is not atomic. Concurrent calls, and instances with separate caches, can double-book.
- **Time zones:** "today" is the UTC date (`toISOString`). `isOpenNow` and `findFreeSlots` use server-local `getHours()` (`slots.ts:75`, `:96`). No business timezone exists.
- **`findFreeSlots` ignores duration.** `taken` is a set of start times (`slots.ts:87`), so it offers slots that `isSlotTaken` would reject.
- **`reschedule_appointment`** skips the opening-hours check, uses the default 30-minute duration (`tools.ts:630`), and doesn't exclude the appointment being moved.
- **`book_recurring_appointment`** skips the opening-hours check, ignores duration, and doesn't store `durationMinutes`.
- **Cross-tenant mutation:** `cancel_appointment` calls `setAppointmentStatus(id,"cancelled")` **before** checking `appt.businessId !== business.id` (`tools.ts:573–577`). `reschedule_appointment` does the same (`:636–641`). The model can mutate another tenant's appointment, and the code only reports "not found".
- **Caller authorization is missing.** `lookup_my_appointments`, `cancel_appointment` and `reschedule_appointment` trust a model-supplied `customer_phone` or `appointment_id`. They are not bound to the verified ANI.
  - Any caller can list someone else's bookings by saying their number.
  - Any caller can cancel or move those bookings.
  - The public web demo can do the same; see "Endpoint auth" below.

#### Post-call insights **[CODE]** (`lib/insights.ts`)

- One Claude call with a JSON-schema structured output: summary, sentiment, intent, resolved, language, action_items, upsell_opportunity.
- Idempotent because it skips when `call.summary` is set. It persists and emits a `call.analyzed` webhook.
- It turns every `action_item` into a staff task without deduplication.
- It runs fire-and-forget from webhooks.

#### Caller memory **[CODE]** (`lib/callerMemory.ts`)

- Scans all appointments, orders and calls of the business by exact phone string, which is O(n) per call.
- It builds "Name on file …, Upcoming appointment …, Past visits …, ⚠ no-shows …, Last order …".
- That context is injected into the prompt, and the greeting uses the first name **before any verification**. That is a PII disclosure risk under caller-ID spoofing.

#### Callback tasks **[CODE]**

- `request_callback` → `addActionItem` + `callback.requested` webhook.
- `/api/tasks` supports GET and PATCH toggling `done`. No assignee, due time or callback execution.

#### Analytics **[CODE]** (`lib/metrics.ts`, `/api/metrics`)

- Counts by sentiment, intent and language. Averages duration, capping outliers at 1 hour.
- `automationRate` is inflated (see §3 row 18).

#### Endpoint auth **[CODE]**

- `middleware.ts` protects a prefix list only when `DASHBOARD_TOKEN` is set.
- The token comes from the `?token=` query or `x-aiva-token` and is compared with `===`. The cookie stores the raw token for 30 days.
- **Not protected** (absent from `PROTECTED_PREFIXES`, line 7):

| Endpoint | Exposure |
|---|---|
| `/api/broadcast` | Sends an **arbitrary SMS message** from the business number to every customer with an appointment today or tomorrow. Unauthenticated, given a known `businessId`. |
| `/api/chat` | Public demo, rate-limited 30/min per IP via `x-forwarded-for`. Runs the **real** agent with **real tools**: lookup, cancel, book, SMS. |
| `/api/onboard` | Creates businesses. |
| `/api/metrics` | Exposes metrics. |
| `/api/reminders/run` | Unauthenticated. Idempotent, so low risk. |

- **[INF]** `vercel.json` schedules a cron on `/api/reminders/run`, which only exports `POST`. Vercel cron issues GET, so reminders would never fire on Vercel. **[OPEN]** Confirm against current Vercel docs.

#### Tests and CI **[CODE]**

- 16 files with about 76 `node:test` cases, run via `tsx`. All are pure-function unit tests: slots, overlap, ICS, rate limit, SMS templates, recurrence, `executeTool` validation paths that never touch storage, and string-`includes` TwiML tests.
- **No route tests and no signature-validation tests.**
- CI (`.github/workflows/ci.yml`): `npm ci` → typecheck → test → build on Node 22.

#### Reuse summary

| Category | Items |
|---|---|
| Legally reusable (MIT, with attribution) | Tool JSON schemas + descriptions (`lib/agent/tools.ts:23–215`). Vertical playbooks (`lib/agent/prompt.ts` `PLAYBOOKS`). `lib/overlap.ts`. `lib/ics.ts` (ICS export). `lib/smsTemplates.ts` (8-language templates). `INSIGHT_SCHEMA` (`lib/insights.ts`). The eval harness shape (`scripts/eval.ts`). |
| Inspiration only | Overall feature list: waitlist promotion on cancel, after-hours mode, language switching tool, recurring bookings, day-sheet, FAQ suggestions, digest, onboarding-from-description. |
| Do not copy | `lib/db.ts`, `lib/twilioAuth.ts` (fail-open), `middleware.ts`, `lib/webhooks.ts`, `lib/rateLimit.ts`, `lib/slots.ts` (timezone/duration bugs), the cancel/reschedule tool bodies, the `/api/broadcast` and `/api/chat` exposure, the `<Gather>`/`<Say>` voice loop, and the `void` background work. |

### 4.2 morluto/rea (objective re-investigation)

#### What it is **[CODE]**

- "REA: Reverse Engineer Anything". An MCP server plus CLI (`npx rea-agents setup`, npm package `rea-agents`) that lets coding agents inspect:
  - native binaries (Hopper, Ghidra, IDA, rizin/Cutter, objdump, GDB);
  - JS/Electron/ASAR, .NET, Android/APK (JADX), Flutter, Go/Rust binaries, firmware (binwalk/unblob), EVM, WASM;
  - web network captures, and running processes through Frida.
- About 3,974 `.ts` files under `src/` (adb, android, electron, frida, ghidra, hopper, ida, il2cpp, …).
- `server.json` registers `io.github.morluto/rea`, stdio transport.
- **No voice, telephony, Twilio or speech code.** `git grep -i twilio` → 0 hits.

#### Is it a fork, mirror or rename? **[API]**

- `fork: false`, no `parent` or `source`.
- The first commit is 2026-04-14: `"Initial commit: betterBinaryMCP - Enhanced MCP server for Hopper Disassembler"` (author `morluto`).
- `GET /repos/morluto/betterBinaryMCP` resolves to `morluto/rea`, so it is a **rename of the owner's own project**, not a mirror of a famous repo.
- History: 1 commit in April, then nothing until 2026-07-11. 674 commits in late July, 21 in August, 100 in September, **3,359 in Oct 1–22**.
- The first release was `rea-0.2.0` on 2026-07-12. The earliest fork is 2026-07-13, and there was a Show HN on 2026-07-14 (3 points).
- Owner `morluto`: account created 2020-12-22, 9,612 followers, 259 public repos. Many are forks of "awesome-*" lists, some renamed with a `rea-` prefix, which looks like list-placement marketing **[INF]**.

#### Development profile **[API]**

- Since July: 4,177 commits from 286 authors (morluto 2,182, N0zoM1z0 592, kaoru0822-kitauji 560, …).
- Co-author trailers: "Claude Opus 5.5" ×466, "Cursor Agent" ×67, `factory-droid[bot]` ×50. Branches named `codex/…`.
- Commits land at every hour UTC; Oct 13 alone had 340.
- 3.2M lines added. 1,941 merged PRs, 672 open.
- **[INF]** This is real, heavily AI-agent-driven development with a genuine contributor community.

#### Star plausibility

- **[API]** 360,806 stars on 2026-10-22. The prior audit's 347,435 on 10-20 matches OSS Insight's 347,163 for that day.
- **[API]** OSS Insight event-derived star history (flagged by OSS Insight as a *degraded, lower-bound* source): about 40 stars by 2026-10-02, then:

| Date | Stars |
|---|---|
| 10-04 | 1,547 |
| 10-08 | 25,568 |
| 10-11 | 103,638 |
| 10-13 | 206,457 |
| 10-17 | 308,994 |
| 10-22 | 360,473 |

  - Peak growth was about 52k/day on Oct 11–12.
- **[API]** A real viral event happened at the same time:
  - HN front page "REA Reverse Engineer Anything" (rea.tools): **814 points / 339 comments** on 2026-10-10.
  - A second HN post: 100 points on 10-12.
  - 404 Media article "'Reverse-Engineer Anything' Is the New Wild West of AI" on 2026-10-20.
  - The README carries a Trendshift badge.
- **[API]** Stargazer countries (OSS Insight, only about 55k with a location): CN 21.8%, US 12.4%, BR 8.3%, IN 5.8%, DE 4.2%. Nothing looks pathological.
- **[API]** Engagement per star is low compared with peers:

| Repo | Issues / stars | Watchers / stars |
|---|---|---|
| morluto/rea | 0.76% | 0.36% |
| livekit/agents | 15% | 0.70% |
| openai-agents-python | 5.3% | 0.77% |
| langgraph | 3.9% | 0.44% |

- **[API]** Fork-owner sample in place of the stargazer sample (accounts are of type User):

| Sample | n | Median account age | Created < 30 days | Zero contributions in 12 months | Zero followers |
|---|---|---|---|---|---|
| rea, newest 100 forks | 99 | 1,977 days | 6% | 2% | 56% |
| rea, forks around 10-11 00:22 (peak) | 97 | 2,312 days | 2% | 2% | 37% |
| Baseline: livekit/agents, newest | 76 | 1,552 days | 1% | 0% | 28% |
| Baseline: openai-agents-python, newest | 22 | 992 days | 9% | 0% | 50% |

  - Rea's fork owners look like ordinary, established accounts.
- **[INF]** The attention is clearly real. A jump of about 360k stars in 19 days is far beyond what an 800-point HN post normally produces, and engagement per star is low. **Some star inflation cannot be ruled out, and it cannot be proven either**, because the stargazer API is disabled. Either way, star count has no bearing on fit.

#### Supply chain **[CODE][API]**

- **Install scripts:** the repo `package.json` has no `preinstall`/`install`/`postinstall`. `prepare` runs husky only when `src/` and `node_modules/husky` exist; it doesn't run on registry installs.
- **Published `rea-agents@6.7.0` [API]:** only `prepare`. 28.6 MB unpacked, 1,775 files. **SLSA provenance attestation** present, published by GitHub Actions OIDC trusted publishing.
- **Transitive:** the optional dependency `frida@17.23.2` has `install: node scripts/install.js`, which downloads a prebuilt native binding **[API]**. `@lydell/node-pty` uses per-platform optional packages.
- **`install.sh`:** a `curl | bash` installer. It resolves the latest GitHub release over HTTPS, runs `npm install -g rea-agents@<ver>`, verifies `--version`, then runs `rea setup`. Setup **modifies agent configs** (Claude Code, Codex, Cursor MCP registration, with backups) and can optionally install Hopper.
- **Blobs and obfuscation:**
  - No compiled binaries are committed. The largest files are a 1.5 MB contributions JSON, a PNG and `.po` locale files.
  - 5 submodules point to known OSS: binwalk, unblob, wakaru, ghidra-nativeaot, jadx-headless-mcp.
  - The only very long source lines are MCP tool-description strings (`src/contracts/*ToolContracts.ts`).
  - No base64 blobs ≥ 400 chars in source.
- **Tests and CI:** about 1,999 `*.test.*` files, 32 workflows (real-tool integration jobs for Ghidra, Hopper, browser, …), Stryker mutation testing, release-please.

#### Legal / ethics

- `DISCLAIMER.md` limits use to lawful analysis.
- **[INF]** The README's headline use case (see a feature in an app → understand it → "build a version for your project") would expose us to EULA anti-RE clauses, DMCA §1201 and trade-secret claims if we used it on competitors' products (Vapi/Retell/ElevenLabs apps).

#### Verdict: **AVOID**

- Nothing in it is useful for an AI phone receptionist.
- License is MIT, so there is no legal blocker to reading it. It simply doesn't fit, and its main use case is a liability for us.
- Only if we ever build our own MCP server would its contract-first tool schemas and mutation-testing setup be a *study* reference. We don't need that now.

### 4.3 twilio/twilio-node (verified) **[CODE][API]**

- **Version:** 6.2.0, released 2026-10-12. Cadence is about monthly (6.1.2 on 09-28, 6.1.1 on 09-10, 6.1.0 on 08-11). Node ≥ 20 since 6.0.0, which UPGRADE.md says has no API breaks.
- **Dependencies:** axios, dayjs, https-proxy-agent, jsonwebtoken, qs, xmlbuilder.
- **Webhooks:** `validateRequest`, `validateRequestWithBody` (JSON bodies via the `bodySHA256` query param + `validateBody`), `validateExpressRequest`, `validateIncomingRequest`, `getExpectedTwilioSignature`, `getExpectedBodyHash` and `webhook()` (Express middleware) are all exported from `src/index.ts:74–91`. Constant-time comparison.
- **TwiML:** `VoiceResponse.Connect` has `conversationRelay()` and `stream()` as described in §3.
  - `StreamAttributes`: `url`, `track`, `statusCallback`, `name`, `audioFormat`, `sampleRate`, `connectorName`.
  - `ConversationRelayAttributes` has 27+ fields, including `elevenlabsTextNormalization`, `ttsProvider`, `voice`, `welcomeGreeting`, `dtmfDetection`, `interruptible`, `preemptible`, `transcriptionProvider`, `speechModel` and `intelligenceService`.
- **TypeScript and ESM:** types ship (`index.d.ts`). The library is CommonJS only, with no `exports` map.
- **Tests and CI:** 33 spec files under `spec/`, 6 workflows. 29 open issues, 33 open PRs. 0 GitHub advisories for `twilio@6.2.0`.
- **Use:** core dependency.

### 4.4 ElevenLabs **[CODE][API]**

- **`elevenlabs/elevenlabs-js`, v2.74.0, MIT:**
  - Mostly Fern-generated; weekly releases.
  - Runtime deps: `node-fetch` ^2, `command-exists`, `ws`.
  - Webhook helper: `client.webhooks.constructEvent(rawBody, sigHeader, secret)`, which is async (details in §3).
  - `conversationalAi.twilio` covers register-call (TwiML) and outbound-call.
  - Other resources: `phoneNumbers`, `sipTrunk`, `batchCalls`, `conversations`, `agents`, `tools`, `knowledgeBase` and `tests`.
  - 255 test files (wire tests plus `tests/custom/client.test.ts`), 1 workflow.
- **`elevenlabs/examples`** (renamed from `elevenlabs-examples`, MIT): now Next.js/Expo/Python product samples. **No Twilio or telephony example on `main`.**
- **No official ElevenLabs+Twilio example repo** exists in the `elevenlabs` org (30 repos listed). **[OPEN]** Use the docs instead.
- **`elevenlabs/cli`** (MIT, Rust, v1.7.0): agents-as-code workflow (`agents`, `project`, `tests`, `verify`, onboarding). 64 test files, 3 workflows.
- **`elevenlabs/elevenlabs-mcp`** is **archived** (2026-08-20).

### 4.5 LiveKit Agents (Python + JS) **[CODE][API]**

- **Architecture:** a worker/job model joins LiveKit rooms. `AgentSession` handles VAD, STT, LLM, TTS and turn detection through plugins. Telephony runs via LiveKit SIP (Twilio Elastic SIP trunk).
- **Telephony pieces:**
  - `beta/tools/end_call`, `send_dtmf`
  - `beta/workflows/warm_transfer` (Python and TS)
  - `voice/amd` (answering-machine detection), `voice/ivr`
  - Examples under `examples/telephony/*` and `examples/warm-transfer/*`, including `twilio_connector_warm_transfer`.
- **Plugins (JS):** elevenlabs, deepgram, openai, anthropic, cartesia and about 40 more.
- **`@livekit/agents` 1.9.3** is native ESM (`"type":"module"`).
- **Production readiness:** high. Heavy activity (611 commits in 90 days for Python), weekly releases.
- **Cost:** you operate LiveKit (cloud or self-hosted) plus SIP; the JS SDK lags Python.
- **Reuse (Apache-2.0, keep NOTICE):** warm-transfer and AMD modules, if we adopt LiveKit.

### 4.6 Pipecat **[CODE][API]**

- **Architecture:** a Python frame pipeline (transport → STT → LLM → TTS → transport).
- **Twilio:** `src/pipecat/serializers/twilio.py` (353 lines). Handles µ-law ↔ PCM at 8 kHz, sends Twilio `clear` on `InterruptionFrame`, and with `auto_hang_up` (default) ends the call via the REST `Calls/{sid}.json` on `EndFrame`. Tests: `tests/test_twilio_serializer*.py`.
- **Other features:**
  - Pipecat Flows: `src/pipecat/flows/*` for structured conversations.
  - Smart-turn ONNX model shipped in-tree.
  - DTMF and voicemail-detection examples; release evals (`evals/release/scenarios`).
- **Velocity:** 3,407 commits in 90 days. Releases every 1–3 weeks (v1.13.0 on 10-19).
- **Reuse (BSD-2):** only if we self-host a Python media worker.

### 4.7 OpenAI Agents SDK (Python + JS) **[CODE][API]**

- **JS:** `@openai/agents` 0.21.0. `agents-extensions` provides `TwilioRealtimeTransportLayer`, plus `packages/agents-realtime/src/openaiRealtimeSip.ts`.
- **Examples:**
  - `examples/realtime-twilio/server.ts` (469 lines, Fastify) is the **best signature-validation example found**:
    - Pins `TWILIO_PUBLIC_BASE_URL` to an HTTPS origin with no path, query or credentials.
    - Validates the HTTP webhook.
    - Validates the WS upgrade against `streamUrl` and `streamUrl + '/'`, and rejects any query.
  - `examples/realtime-twilio-sip/server.ts` uses `openai.webhooks.unwrap` with `OPENAI_WEBHOOK_SECRET` and **exits if the secret is missing**.
- **Python:** `examples/realtime/twilio` and `twilio_sip`, with tests (`tests/realtime/test_twilio_*`).
- **Maintenance:** issues and PRs are tightly managed (11/4 open in JS, 14/12 in Python).
- **Reuse (MIT):** the transport and the validation pattern.

### 4.8 LangGraph / LangGraph.js / LangChain **[API][INF]**

- All MIT and very active. They provide durable graph execution with Postgres checkpointers (`checkpoint-postgres` 3.2.0 on 2026-10-14; JS 1.1.2 on 2026-10-21).
- **Fit:** low. A receptionist is one agent with about 10 tools and sub-second latency budgets.
- LangChain's release churn (1,396 releases) and abstraction depth add risk without benefit.
- Reconsider LangGraph only for long-running back-office workflows (multi-day callback campaigns). Even then, Postgres jobs are likely enough.

### 4.9 VapiAI/examples **[API][CODE]**

- 35 files: Vapi `assistant.json` and tool JSON for healthcare scheduling, multi-intent, OTP SMS and voicemail detection, plus WAV recordings.
- **No license** (API 404, no LICENSE file). Last meaningful commit 2026-01-16. A `gitops` submodule points to a private SSH URL.
- **Inspiration only:** prompt and tool-shape ideas. Copying is not permitted.

---

## 5. GitHub search results

### Queries

The 14 requested queries ran with `pushed:>2026-04-01`, sorted by stars. Eight more ran by stars or updated time: `topic:ai-receptionist`, `topic:voice-agent twilio`, `ConversationRelay`, `vapi alternative`, `phone agent stars:>150`, and TS `voice agent stars:>150`. This produced about 180 unique repos. 20 were vetted by API and 10 were shallow-cloned for code checks.

### 5.1 Selected serious repos (≤12)

| Repo | Stars | License | Stack | Activity [API] | Tests / CI | What is useful | Security notes | Verdict |
|---|---|---|---|---|---|---|---|---|
| [dograh-hq/dograh](https://github.com/dograh-hq/dograh) | 5,931 | BSD-2-Clause | Python FastAPI + SQLAlchemy/Alembic + **forked pipecat** (submodule), Next.js UI | 919 commits, 70 contributors, 210 commits/90d, 57 releases (v1.49.0, 10-12) | 410 / 8 | Multi-carrier provider abstraction `api/services/telephony/providers/{twilio,telnyx,plivo,vonage,exotel,ari,…}`. Signed media-WS URL `api/services/telephony/ws_auth.py`. | **[CODE]** Twilio `RequestValidator`; fails closed on a missing header or token (`providers/twilio/provider.py:155–165, 395–410`). Media-WS token is **opt-in** ("with no secret configured this returns the exact legacy URL"). | STUDY; BSD-2 lets us reuse with attribution |
| [bolna-ai/bolna](https://github.com/bolna-ai/bolna) | 799 | MIT | Python orchestration lib (Twilio/Plivo/SIP/FreeSWITCH handlers) | 2,932 commits, 39 contributors, 156/90d, 320 releases (daily) | 185 / 5 | Telephony input/output handler split (`bolna/input_handlers/telephony_providers/twilio.py`). | **[CODE]** No signature validation in `local_setup/telephony_server/twilio_api_server.py`. `bolna/agent_manager/task_manager.py` is a **9,799-line** god file. | STUDY only |
| [PatterAI/Patter](https://github.com/PatterAI/Patter) | 1,077 | MIT | Python + TS SDKs | 159 commits, 10 contributors, **slowing** (3 commits/90d; last meaningful 08-24), 17 releases | 378 / 7 | `sanitizeVariables()`; fail-closed signature by default (`requireSignature`). | **[CODE]** HMAC-SHA1 is **hand-rolled** (`libraries/typescript/src/server.ts:532`): no port or array-param variants. Use the twilio library instead. | Borrow the snippet only |
| [allgpt-co/QuickVoice](https://github.com/allgpt-co/QuickVoice) | 494 | MIT | TS monorepo: Express 5 + Prisma 7 + BullMQ + `livekit-server-sdk` + `twilio` 6; Python AI worker; console/widget/MCP server | 355 commits, 13 contributors, 106/90d, 0 releases, 55 open issues | 221 / 8 | Closest TS "platform" shape (numbers, outbound, knowledge, console). | **[CODE]** No `validateRequest`/`X-Twilio-Signature` hits. **[OPEN]** It may rely on LiveKit SIP rather than Twilio webhooks. | STUDY for product shape |
| [XiyaoWang0519/agent-call](https://github.com/XiyaoWang0519/agent-call) | 268 | MIT | Python FastAPI, OpenAI realtime, MCP + OAuth | 143 commits, 4 contributors, 60/90d, 1 release | 47 / 3 | Validates `X-Twilio-Signature` on HTTP **and** WS (`app/security.py:170–180`, `app/routes/twilio_webhooks.py:33–36`). Owner-transfer and policy modules. | Good posture | STUDY |
| [Hiberius/whatsapp-receptionist](https://github.com/Hiberius/whatsapp-receptionist) | 27 | MIT | **Next.js 15.5 + Supabase + Anthropic + Stripe + zod** (WhatsApp, not voice) | 21 commits, 3 contributors, 3 releases (v0.2.1) | 89 + Playwright e2e / 1 | **Closest stack.** Supabase migrations with RLS on every table, `current_tenant_id()` policies, and the **gist exclusion constraint against double-booking**. | Small project; comments in Italian | BORROW the SQL patterns |
| [microsoft/call-center-ai](https://github.com/microsoft/call-center-ai) | 6,682 | Apache-2.0 | Python on Azure Communication Services | **Dormant**: last release v17.4.2 on 2025-05-27; 0 commits/90d | 8 / 2 | Claim/extraction schema ideas. | Azure-locked | STUDY only; don't adopt |
| [team-telnyx/ai](https://github.com/team-telnyx/ai) | 222 | MIT | Official Telnyx agent skills/SDK hub | 408 commits, 14 contributors, 101/90d | 97 / 5 | Second-carrier option. | — | STUDY if multi-carrier |
| [livekit-examples/agent-starter-react](https://github.com/livekit-examples/agent-starter-react) | 960 | MIT | Next.js front end for LiveKit agents | 359 commits, 14 contributors, 5/90d (deps security bump 10-19) | 0 / 1 | Web "try the receptionist" demo UI. | Keeps Next patched (15.5.27) | REUSE only if on LiveKit |
| [rasonyang/ai-native-callcenter](https://github.com/rasonyang/ai-native-callcenter) | 321 | Apache-2.0 | Go + FreeSWITCH (ESL) | 987 commits, all in the last 90 days, **single author**; 10 releases (v0.6.0) | 307 / 5 | "AI talks, code controls the call": deterministic call control. | Bus factor 1 | STUDY (concept) |
| [twilio-samples/live-translation-openai-realtime-api](https://github.com/twilio-samples/live-translation-openai-realtime-api) | 124 | MIT | TS, Twilio Flex + OpenAI realtime | Dormant since 2026-06-18 | 0 / 0 | Official Twilio realtime wiring. | — | Reference |
| [kirklandsig/AIReceptionist](https://github.com/kirklandsig/AIReceptionist) | 146 | **AGPL-3.0** | Python receptionist on OpenAI realtime | 173 commits, 2 contributors, 1 release (v0.2.0) | 57 / 1 | Intake tools, email summarizer, "production tenant" docs. | AGPL | **Inspiration only** (don't copy code into SaaS) |

### 5.2 Inspiration only (license blocks reuse)

| Repo | License | Notes |
|---|---|---|
| `DevCalebR/callbackcloser` | API: NOASSERTION. LICENSE: "Copyright (c) 2026 Caleb Rogers. All rights reserved. No permission is granted…" | Next.js + Twilio missed-call recovery; 188 commits, 71 tests; dormant since 07-15. Has a good idea: production refuses to boot unless `TWILIO_VALIDATE_SIGNATURE=true` (`lib/env.server.ts:177`). **Do not copy code.** |
| `PrabhatMattoo/DeskRoute` | AGPL-3.0 | TS, single author, 27 tests, no CI. |
| `seldonframe/seldonframe` | AGPL-3.0 | 2,853 commits, mostly one bot-like author (`fixlyai`). |
| `stoimera/Cravab` | AGPL-3.0 | Dormant since 2026-05-01, 3 tests. |

### 5.3 Notable junk / abandoned / no-license (avoid)

**No license:**

- `VapiAI/examples`
- `twilio-samples/ai-phone-agent-conversation-relay-javascript` (1 commit, 9 files; its C#/Python siblings also have no license; the PHP one is BSD-3)
- `sonnysangha/AI-Receptionist-Live-YouTube-Demo` (single day)
- `daulathussain/Multi-Tenant-AI-Voice-Receptionist-SaaS-Starter-File`
- `santmun/sofia-voice-agent` (1 day)
- `Ahmadjamil888/AI-VOICE-CALL-MVP-SAAS`
- `homgorn/real-voice-agent-free`
- `ChanchalSen09/aanya-ai-receptionist`
- `nusRying/AI-Receptionist`
- `JacksonFalgoust/AI-Receptionist`
- `jkf87/phone-agent`
- The `alphaparkinc/genpark-*` and `Alpha-Park/genpark-*` "skill" repos (also look like spam)

**Abandoned or trivial:**

- `blackdwarftech/siphon` (no tests, dormant since 05-12)
- `Hesper-Labs/owly` (stale since 04-14)
- `alibhatti59/ai-receptionist-saas` (39 files, no tests, Retell wrapper)
- `Sunona-AI-labs/sunona` (NOASSERTION)

**"Missed call recovery" results:** almost all are n8n case studies or landing pages with ≤1 star and no code or license: `dvaughnpotter-ops/*`, `yue01372/med-spa-lead-recovery`, `coldconman/hzm-ai-receptionist`, `mendhapuresiddharth-sys/missed-call-recovery-system`, `abubogale342/missed-call-recovery`, `devdanielbrandaobkp-hash/missed-call-recovery`, `siddharthpathania/engageo-website`.

**Off-topic hits:** `mrzh7/scam-with-your-friends-web`, `nesquena/hermes-webui`, `krillinai/OpenCreator`, phone-GUI agents (`kuafuai/andee`, `ShawnPana/phone-harness`).

---

## 6. Five most useful concrete files / patterns to borrow

1. **`twilio/twilio-node` `src/webhooks/webhooks.ts` (MIT), called rather than copied, wrapped in the `openai/openai-agents-js` `examples/realtime-twilio/server.ts` pattern (MIT).**
   - Pin the public origin.
   - Validate both the HTTP webhook and the WS upgrade.
   - Reject query strings.
   - Fail closed when the auth token is missing.
2. **`Hiberius/whatsapp-receptionist` `supabase/migrations/202604240001_initial_backend_mvp.sql` (MIT).**
   - `appointments_no_confirmed_overlap` gist exclusion constraint on `(tenant_id, tstzrange(...))`.
   - RLS with `current_tenant_id()` / `current_tenant_role()` policies.
3. **`7XLabs/Aiva` `lib/agent/tools.ts` + `lib/agent/index.ts` (MIT)**, after fixing the bugs.
   - Tool descriptions that state *when* to call.
   - Server-side re-validation in `book_appointment`.
   - Bounded tool loop with a transfer-to-human fallback.
   - `INSIGHT_SCHEMA` (`lib/insights.ts`) for post-call structured output.
4. **The voice-runtime adapter for whichever runtime we pick (MIT):**
   - `@elevenlabs/elevenlabs-js`: `conversationalAi.twilio` register-call + `webhooks.constructEvent` (wrap with a constant-time compare and a future-timestamp check).
   - Or `@openai/agents-extensions` `TwilioRealtimeTransport.ts`.
   - Or Twilio `<Connect><ConversationRelay>` through `VoiceResponse`.
5. **`PatterAI/Patter` `sanitizeVariables()` (MIT) and `dograh` `ws_auth.build_media_ws_url` (BSD-2).**
   - Sanitize caller and carrier-supplied variables before they reach prompts.
   - Carry the media-socket capability token in the URL path, since Twilio strips query strings, and make it **mandatory**, unlike Dograh's opt-in.
   - If we adopt LiveKit: `livekit/agents-js` `agents/src/workflows/warm_transfer.ts` (Apache-2.0).

---

## 7. Anti-patterns to avoid

1. **Fail-open webhook authentication** when the token or secret is unset (Aiva `lib/twilioAuth.ts:12`). Production must refuse to start without secrets.
2. **Media WebSocket auth that is opt-in or missing** (Dograh legacy default; QuickVoice and Bolna show no validation).
3. **Hand-rolled HMAC** for Twilio signatures (Patter). Use the official library, which handles port and normalization variants.
4. **File or in-process state:**
   - JSON-file DB with whole-file rewrites and per-instance caches (Aiva `lib/db.ts`).
   - In-memory rate limits keyed on `x-forwarded-for` (Aiva `lib/rateLimit.ts`).
5. **Check-then-insert booking** without a database constraint or transaction. That causes double-booking.
6. **Mutate-then-authorize** (Aiva `cancel_appointment`/`reschedule_appointment`) and **trusting model-supplied identifiers** (phone or appointment id) for read or write on caller data.
7. **ANI-only caller recognition that discloses PII** (name, appointments, orders) before verification.
8. **Public endpoints with side effects:**
   - Unauthenticated SMS broadcast (Aiva `/api/broadcast`).
   - A public demo that executes real tools against production data (Aiva `/api/chat`).
   - Unauthenticated cron routes.
9. **Middleware-only auth on a vulnerable framework version** (Next 14.2.5, CVE-2025-29927). Other weak auth: a shared token in the query string, `===` comparison, raw token in a cookie.
10. **Fire-and-forget (`void promise`) in serverless** for post-call analysis, SMS and webhooks. Use durable jobs with retries and idempotency keys.
11. **No timezone model:** mixing UTC `toISOString()` with server-local `getHours()`, and free-text hours parsing.
12. **Inconsistent availability logic:** free-slot search that ignores duration while booking honors it.
13. **Hang-up on goodbye-substring match**, and turn-based `<Gather>`/`<Say>` loops calling an Opus-class model per utterance (latency).
14. **Outbound webhooks without timestamp or id**, a single global secret, no retries, and tenant-controlled URLs fetched without SSRF protection.
15. **Inflated KPIs:** automation rate that counts in-progress and callback calls as "resolved".
16. **Dependency hygiene failures:** exact-pinned vulnerable framework, half-merged dependabot (React 19 + react-dom 18), months of unmerged security PRs.
17. **God files** (Bolna's 9.8k-line `task_manager.py`) and **AGPL/proprietary code** leaking into a SaaS codebase.
18. **`curl | bash` installers and tools that rewrite developer-agent configs** (rea `install.sh` / `rea setup`). Keep them out of our toolchain.

---

## 8. Open questions

- **[OPEN]** Vercel cron method (GET) versus Aiva's POST-only reminder route: confirm in current Vercel docs. This doesn't matter for us; it only explains why Aiva reminders may never fire.
- **[OPEN]** QuickVoice inbound path: does it rely on LiveKit SIP (no Twilio webhooks), or does it skip signature validation? A grep found no validation.
- **[OPEN]** Exact Twilio `<Stream url>` query-string behaviour and ConversationRelay WS signing. Verify against Twilio docs before building the media-socket auth.
- **[OPEN]** Whether ElevenLabs post-call webhooks will add a constant-time compare or future-timestamp rejection in a later SDK. Wrap it ourselves for now.
- **[OPEN]** morluto/rea star authenticity: unverifiable while GitHub disables stargazer listing. Not decision-relevant.

## 9. Reproduction notes

- **Metadata:** `gh api repos/<r>`, GraphQL `repository{issues,pullRequests,releases,defaultBranchRef.target.history(since:)}`, `gh api -i repos/<r>/contributors?per_page=1&anon=1` (from the Link header), `gh api repos/<r>/git/trees/<branch>?recursive=1`.
- **Advisories:** `gh api "/advisories?ecosystem=npm&affects=next@14.2.5"` returned 35 (3 critical, 12 high, including CVE-2025-29927). `twilio@6.2.0` returned 0.
- **rea:**
  - Star history: OSS Insight `/v1/repos/morluto/rea/stargazers/history/?per=day` and `/stargazers/countries/`.
  - npm downloads: `api.npmjs.org/downloads/range/2026-07-01:2026-10-21/rea-agents` (Jul 3,238 / Aug 1,274 / Sep 480 / Oct 1–18 549,344).
  - HN: `hn.algolia.com/api/v1/search?query=...`.
  - Fork sampling: `repos/morluto/rea/forks?sort=newest|oldest&page=150`, owners resolved via GraphQL `repositoryOwner`.
- **Clones (read-only, depth 1):** under `%TEMP%\claude\repo-audit\` — aiva, rea, twilio-node, elevenlabs-js, dograh, bolna, QuickVoice, callbackcloser, Patter, agent-call, AIReceptionist, DeskRoute, whatsapp-receptionist, ai-native-callcenter.
