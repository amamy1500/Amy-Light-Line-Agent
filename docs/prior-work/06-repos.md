# 06 — Open-source reuse due diligence (2026-10-20)

Data pulled 2026-10-20 via read-only `gh api` and docs pages. "Open iss." counts PRs too. Stars were not treated as quality. n8n's license text was read directly; its FAQ was not re-checked (search budget ran out).

## 1. Summary verdict

**Adopt (as a dependency or vendored code)**
- **twilio (twilio-node) 6.2.x**: TwiML builders and `validateRequest` in Next.js route handlers. This is the phase-1 core.
- **Basejump SQL (MIT)**: vendor its account, membership and role helpers plus its pgTAP tests into our Supabase migrations. Upstream code has been inactive since 2024-04.
- **Lighthouse / PageSpeed Insights** for audits. **Unlighthouse** for whole-site scans.
- **Phase-2 voice AI: pick one framework.**
  - **Pipecat (BSD-2)** is the recommended default. It runs as a Python service, keeps Twilio Media Streams, and ships an open turn-detection model (Smart Turn) plus Flows, evals and OpenTelemetry in core.
  - **LiveKit Agents (Apache-2.0)** only if we need TypeScript-native agents (agents-js) or SIP-level warm transfer at scale. Caveats: the turn-detector model license and extra infrastructure.
  - Twilio ConversationRelay, a managed option, was not evaluated here.

**Study only (patterns, no code copy)**
- **7XLabs/Aiva**: signature-helper shape. It fails open, uses a JSON-file DB and an old Next.js.
- **VapiAI/examples** (no license): scheduling, intent routing and voicemail-detection configs.
- **VapiAI/gitops**: agents as code, with simulations gating each PR.
- **twilio-labs/function-templates**: voicemail and hunt templates. Has a real `DialCallStatus` bug.
- **vercel/platforms** (no license), **nextjs/saas-starter**, **marmelab/atomic-crm** (UI worth copying, but RLS is single-tenant).

**Avoid**
- **morluto/rea**: irrelevant, and its star count is anomalous.
- **Embedding n8n**: the Sustainable Use License (SUL) forbids it.
- **Twenty, Frappe and EspoCRM code**: AGPL.
- **Self-hosted cal.diy or the Cal.com Platform product.**
- **The `pipecat-flows` package**: archived.
- **LiveKit's legacy turn-detector plugin.**
- **0-star "missed-call text-back" repos.**

## 2. Master table

| Repo | Stars | Forks | Open iss. | Last commit | Latest release | License | Verdict |
|---|---|---|---|---|---|---|---|
| pipecat-ai/pipecat | 16,655 | 2,919 | 412 | 2026-10-20 | v1.13.0 (2026-10-19) | BSD-2-Clause | **Adopt (ph.2)** |
| pipecat-ai/pipecat-flows | 627 | 118 | 13 | 2026-07-05 (archived) | v1.4.0 (2026-07-05) | BSD-2-Clause | Avoid (merged into core) |
| pipecat-ai/pipecat-examples | 398 | 136 | 3 | 2026-10-20 | — | BSD-2-Clause | Study |
| pipecat-ai/smart-turn | 1,629 | 108 | 20 | 2026-01-29 | — | BSD-2-Clause | Adopt (via Pipecat) |
| livekit/agents | 14,869 | 3,969 | 790 | 2026-10-20 | livekit-agents@1.8.8 (2026-10-15) | Apache-2.0 | Alternative |
| livekit/agents-js | 947 | 404 | 478 | 2026-10-20 | @livekit/agents@1.9.3 (2026-10-15) | Apache-2.0 | Alternative (TS) |
| livekit/sip | 485 | 260 | 71 | 2026-10-20 | none on GitHub | Apache-2.0 | Study |
| VapiAI/examples | 11 | 2 | 5 | 2026-01-16 | — | **none** | Study |
| VapiAI/gitops | 11 | 11 | 10 | 2026-10-14 | — | Apache-2.0 | Study |
| 7XLabs/Aiva | 9 | 1 | 5 | 2026-07-17 | — (pkg 0.3.0) | MIT | Study |
| twilio/twilio-node | 1,543 | 564 | 61 | 2026-10-12 | 6.2.0 (2026-10-12) | MIT | **Adopt** |
| morluto/rea | 347,435 | 87,422 | 1,486 | 2026-10-20 | rea-agents-6.7.0 (2026-10-18) | MIT | Avoid |
| usebasejump/basejump | 939 | 85 | 29 | 2026-08-06 (README); code 2024-04-15 | v2.0.3 (2024-01-14) | MIT | **Adopt (vendor SQL)** |
| vercel/platforms | 6,720 | 1,060 | 23 | 2026-07-08 | — | **none** | Study |
| nextjs/saas-starter | 16,193 | 2,738 | 57 | 2025-12-11 | — | MIT | Study |
| makerkit/nextjs-saas-starter-kit-lite | 464 | 171 | 2 | 2026-10-15 | — | MIT | Study |
| twentyhq/twenty | 58,743 | 9,632 | 125 | 2026-10-20 | v2.49.0 (2026-10-19) | AGPL-3.0 + exception + EE | API-only / avoid |
| marmelab/atomic-crm | 1,391 | 880 | 19 | 2026-10-20 | v1.6.0 (2026-09-22) | MIT | Copy UI |
| krayin/laravel-crm | 24,034 | 1,670 | 106 | 2026-10-16 | v2.2.7 (2026-10-16) | MIT | Avoid (PHP) |
| frappe/crm | 3,829 | 1,535 | 268 | 2026-10-19 | v1.88.0 (2026-10-15) | AGPL-3.0 | Avoid |
| espocrm/espocrm | 3,502 | 1,011 | 64 | 2026-10-20 | 10.0.10 (2026-10-14) | AGPL-3.0 | Avoid |
| twilio-labs/function-templates | 408 | 348 | 89 | 2026-06-30 | — | MIT | Study |
| GoogleChrome/lighthouse | 30,916 | 9,771 | 451 | 2026-10-20 | npm releases | Apache-2.0 | **Adopt** |
| harlan-zw/unlighthouse | 4,902 | 180 | 29 | 2026-10-11 | v0.19.1 (2026-10-03) | MIT | Adopt (optional) |
| sitespeedio/sitespeed.io | 5,041 | 629 | 161 | 2026-10-19 | v42.9.0 (2026-10-15) | MIT | Study |
| StJudeWasHere/seonaut | 810 | 139 | 12 | 2026-10-08 | — | MIT | Study |
| n8n-io/n8n | 208,154 | 61,200 | 1,206 | 2026-10-20 | n8n@2.45.0 (2026-10-20) | Sustainable Use License | Avoid embedding |
| calcom/cal.diy (ex-cal.com) | 49,183 | 15,393 | 1,515 | 2026-10-19 | v6.2.0 (2026-03-01) | MIT | Avoid self-host |

## 3. Per-repo detail

### 3.1 pipecat-ai/pipecat (and its org)

**Backing and adoption**
- Backed by Daily; the README says "Maintained by Daily". Pipecat Cloud is Daily's hosted runtime.
- 100+ contributors.
- Downloads: PyPI `pipecat-ai` about 330k/week; npm `@pipecat-ai/client-js` about 48k/week.
- Adoption evidence: Daily sells Pipecat Cloud commercially. The org also hosts NVIDIA and AWS co-branded repos (nemotron-*, aws-deepgram-workshop). The Pipecat Cloud page names no customers.

**Key org repos**
- smart-turn: open turn model (BSD-2 code and weights, 23 languages, about 8M params).
- pipecat-examples: includes twilio-chatbot, telnyx-chatbot, phone-chatbot, ivr-navigation and open-telemetry.
- Tooling: pipecat-flows-editor, whisker (debugger), tail (terminal UI), voice-ui-kit, pipecat-client-web.
- pipecat-flows: archived on 2026-07-05. Flows now ships in core as `pipecat.flows` (since 1.5.0, same API).

**Tests and CI**
- 369 files under `tests/`.
- Workflows: tests, coverage, python-compatibility (3.11–3.14), license-check, provider-watch.
- Built-in evals framework (`src/pipecat/evals`): scripted and simulated-caller scenarios with an LLM judge. Release scenarios include `voicemail_detection.yaml`.

**Dependencies**
- Python ≥3.11, with bounded pins (aiohttp<4, pydantic<3, openai<4, onnxruntime~=1.24).
- Provider SDKs live in extras.
- Dependabot security PRs are merged the same day.

**Components**
- Transports: daily, smallwebrtc, livekit, websocket (FastAPI), vonage, whatsapp.
- Serializers: twilio, telnyx, plivo, exotel, vonage, genesys.
- Flows: node-scoped functions and a JSON schema. Examples include `warm_transfer.py` and `multi_worker_handoff.py`.
- Function calling through LLM adapters.
- OpenTelemetry in `utils/tracing` (setup, service decorators, `turn_trace_observer`).
- `extensions/voicemail/VoicemailDetector` and `extensions/ivr/IVRNavigator`.

**Security**
- Four GHSAs in 2026:
  - Critical: pickle RCE in `LivekitFrameSerializer` (<0.0.94).
  - High: path traversal in the runner's `/files` endpoint (<1.2.0).
  - High: unauthenticated telephony `/ws` call control via an attacker-supplied Call SID (<1.4.0).
  - Medium: a publicly exposed dev runner allows unauthenticated session creation (≤1.5.0).
- The dev runner's Twilio `POST /` TwiML webhook does **not** verify `X-Twilio-Signature`. Its only protection is an optional HMAC one-time WebSocket token.
- Code search found no `RequestValidator` or `X-Twilio-Signature` in pipecat or pipecat-examples.
- `TwilioFrameSerializer` takes the Account SID and Auth Token for auto hang-up. Keep both in a secret store.
- Prompt-injection exposure: caller speech goes to an LLM that holds tools. Scope tools per Flows node.

**Reuse**
- `FastAPIWebsocketTransport` + `TwilioFrameSerializer`.
- `pipecat.flows` for structured lead capture.
- Tracing to OpenTelemetry.
- Evals harness as a regression suite.
- `LocalSmartTurnAnalyzerV3`.
- `VoicemailDetector`, but only later for outbound callbacks.

**Do not reuse**
- `pipecat.runner` in production. Write our own FastAPI entry point that validates Twilio signatures and issues signed per-call stream tokens.
- The `pipecat-ai-flows` package, and the archived quickstart and CLI repos.
- Pin pipecat-ai ≥1.6.0.

### 3.2 livekit/agents (plus agents-js and sip)

**Backing and adoption**
- Backed by LiveKit Inc.
- livekit.com names OpenAI (ChatGPT Advanced Voice), Salesforce, Oracle, Spotify, Podium and Retell AI. These are vendor claims.
- Downloads: PyPI `livekit-agents` about 1.08M/week; npm `@livekit/agents` about 497k/week.

**Tests and CI**
- 319 test files.
- Workflows: tests, ci, evals, test-stt, test-realtime, release-gate.
- 82 plugin packages.
- livekit/sip: Go, 27 `*_test.go` files, plus a test workflow.

**Concurrency and deployment**
- `AgentServer` registers with livekit-server, which dispatches jobs per room.
- Each job runs in its own process (`ipc/job_proc_executor`) or thread.
- A pool of prewarmed idle processes (`num_idle_processes`) is kept ready.
- Load control: `load_fnc`, with `load_threshold` defaulting to 0.7 in production.
- `drain_timeout` supports graceful deploys.
- Deploy to LiveKit Cloud, or self-host. Telephony on a self-host also needs livekit-server and livekit/sip.

**Telephony**
- Inbound and outbound SIP trunks, dispatch rules and DTMF.
- Cold transfer (SIP REFER) and warm transfer.
- Twilio connects either by SIP trunk or by a WebSocket "connector" (`examples/warm-transfer/twilio_connector_warm_transfer.py`).
- `beta/workflows` ships `warm_transfer`, plus name, phone, email, address, DOB and DTMF collection tasks.
- Answering-machine detection: `voice/amd` and `examples/telephony/amd.py`.
- LiveKit Phone Numbers are US-only and Cloud-only.

**Testing**
- `livekit.agents.evals` provides Judge and JudgeGroup, plus built-in judges: task_completion, tool_use, handoff, safety and others.
- `voice/run_result.py` supports assertions on a session run.
- `testing.fake_job_context`.
- Docs: text-mode unit tests run in pytest or Vitest with no room needed.

**Turn-detector license**
- Plugin code is Apache-2.0.
- The models are under the **LiveKit Model License**: use only "together with the LiveKit Agents framework", and no training of non-LiveKit models on their outputs.
- The text plugin is deprecated and will be removed in 2.0.
- `inference.TurnDetector` comes in two versions:
  - v1 runs on LiveKit Inference in the cloud. Self-hosted agents are billed beyond an allowance.
  - v1-mini runs locally on CPU and is free.

**Security**
- GHSA-q77r-q2p5-68vf: plugin API keys were logged (≤1.6.9, fixed in 1.6.10).

**Reuse**
- agents-js, if we stay TypeScript-only.
- Warm-transfer workflow design, the AMD module, and the eval judges.
- The worker load/drain model as a reference design.

**Do not reuse**
- The turn models outside LiveKit.
- A self-hosted livekit/sip for a single-business MVP. SIP/RTP operations are heavy.
- LiveKit Phone Numbers (lock-in).

### 3.3 VapiAI repositories

**Org overview**
- 50+ public repos: SDKs (several with no license file), mcp-server (MIT), cli (MIT), gitops (Apache-2.0), and a humanness-index benchmark.
- About 20 `example-*` repos are stale (2024).

**VapiAI/examples** (no license, no tests, last commit 2026-01-16)
- **healthcare_scheduling**:
  - Assistant "Amy", backed by an n8n workflow and Cal.com.
  - Tools: availability, book, cancel, reschedule, transfer and end_call.
  - Hard rule: business hours 9–5.
  - The README admits problems: it breaks with multiple bookings per caller, and test bookings pile up.
- **multi_intent_handler**:
  - The `assistant_request` webhook returns config per call. This is the multi-tenant-by-number routing pattern.
  - Once the intent is known, a `get_instructions` tool fetches an intent-specific script over HTTP.
  - `get_instructions.ts` has **no auth check**.
- **voicemail_detection**:
  - Detection is prompt-based on the transcript (`voicemailDetectionEnabled=false`).
  - Uses a voicemail tool with optional beep detection.
  - `firstMessageMode` is `assistant-waits-for-user`.

**VapiAI/gitops**
- Assistants, tools and simulations live as YAML.
- Simulation suites run on every PR.
- `docs/learnings` covers transfers and voicemail.

**Reuse (patterns only)**
- Resolve tenant config per number.
- Keep intent scripts versioned on the server and fetch them as instructions.
- Ask one question at a time.
- Gate each PR on simulations.

**Do not reuse**
- The JSON files themselves (no license).
- An n8n middle tier.
- Prompt-based voicemail detection. We are the callee, so it does not apply.

### 3.4 7XLabs/Aiva

**Basics**
- MIT, created 2026-07-12, 9 stars, no releases.
- Last commit on main: 2026-07-17 (Dependabot).

**Architecture**
- Next.js App Router.
- Turn-based Twilio loop of `<Gather input="speech">` and `<Say>`, not Media Streams.
- Claude tool loop capped at 6 iterations.
- SMS inbound route.
- Post-call summary, sentiment and action items.
- **JSON-file store** (`lib/db.ts`) and an in-memory rate limiter.

**Twilio signatures**
- Yes. `lib/twilioAuth.ts` calls `twilio.validateRequest` with `NEXT_PUBLIC_APP_URL` plus path and query.
- Applied to voice incoming, respond and status, and SMS incoming.
- **It fails open when `TWILIO_AUTH_TOKEN` is unset.**
- `/api/calls/end` relies only on the optional `DASHBOARD_TOKEN` middleware, which also fails open.

**Dependencies**
- `next` is pinned to **14.2.5**. That predates 14.2.25, the fix for CVE-2025-29927 (middleware bypass). Its dashboard auth is middleware-only, so a self-hosted deploy is bypassable.
- `react` ^19 is paired with `react-dom` ^18, a mismatch.
- `twilio` ^5.3, while the current version is 6.2.

**Tests**
- 17 `node:test` files covering pure utilities only.
- CI runs typecheck, test and build.

**Other risks**
- Tenant comes from `?businessId=` and falls back to `businesses[0]`, so a call can land on the wrong tenant.
- Caller speech reaches Claude, which holds booking tools, with no confirmation step.

**Reuse (pattern)**
- The signature-helper shape, made fail-closed.
- The TwiML `esc()` helper.
- The idea of a per-caller flood guard.
- The tool-loop cap.
- The post-call insight schema.

**Do not reuse**
- The DB, auth, tenant resolution or dependency set.

### 3.5 twilio/twilio-node

**Basics**
- Official Twilio library, MIT.
- Release 6.2.0 (2026-10-12). Releases ship about 2–3 per month.
- About 3.7M npm downloads/week.
- Written in TypeScript and ships `index.d.ts`.
- 6.x's only breaking change: Node ≥20.

**Dependencies**
- axios, jsonwebtoken, qs, dayjs, xmlbuilder, https-proxy-agent.
- 6.2.0 replaced `scmp` with `crypto.timingSafeEqual`.

**Health**
- 0 published GHSAs.
- 50 spec files plus CI.

**TwiML builders**
- `twiml.VoiceResponse`: `dial`, `number` (with a `url` for screening), `record`, `gather`, `say`, `play`, `hangup`.
- `MessagingResponse`.

**Webhook validation**
- `validateRequest(authToken, signature, url, params)`. It also tries the URL with and without the port, and normalized forms.
- `validateRequestWithBody` / `validateBody` for JSON bodies (`bodySHA256`).
- `validateIncomingRequest` / `validateExpressRequest`.
- `webhook()`, which is Express middleware.

**Reuse**
- All of the above, in Next.js route handlers: `await req.formData()`, then validate against the configured public base URL, not the `Host` header.
- Use an API Key/Secret for REST calls. Keep the Auth Token for signature checks only.

**Do not reuse**
- `webhook()` in Next.js (Express-only).

### 3.6 morluto/rea

**What it is**
- "REA: Reverse Engineer Anything": an MCP server and CLI (npm `rea-agents`) that drives Ghidra, Hopper, Frida and ADB.
- Owned by a user account, created 2026-04-14, TypeScript, MIT.
- Has Stryker mutation testing.

**Relevance**
- **None** to call capture, CRM or a SaaS.

**Signals and risks**
- 347k stars and 87k forks in about 6 months is anomalous for a niche tool. It is not a quality signal.
- Installation runs `npx`/`install.sh` and native bridges. Keep it off machines that hold Twilio or Supabase secrets.
- Reverse-engineering competitors' apps raises ToS and legal issues; its own DISCLAIMER says so.

**Verdict:** Avoid.

## 4. Shortlists

### 4.1 Multi-tenant Next.js + Supabase

1. **usebasejump/basejump** (MIT)
   - Personal and team accounts, `account_user` with owner/member roles, invitations and billing tables.
   - `SECURITY DEFINER` helpers `basejump.has_role_on_account()` and `get_accounts_with_role()` power the RLS policies.
   - 13 pgTAP test files plus CI.
   - Vendor it. Change `set search_path = public` to `''`, and wrap helper calls as `(select …)` in policies.
2. **vercel/platforms** (no license, Next 16)
   - Subdomain-to-tenant routing in `proxy.ts`, with Upstash Redis.
   - Study only.
3. **nextjs/saas-starter** (MIT)
   - Drizzle tables: teams, team_members, invitations, activity_logs. Uses Stripe.
   - **No RLS.**
4. **makerkit lite** (MIT)
   - The lite version has no teams; teams are a paid feature.

**Our model**
- `accounts` → `memberships`, and `account_id` on every row.
- RLS through Basejump-style helpers.
- A `phone_numbers → account_id` table read with the service role inside Twilio webhooks, since webhooks carry no user JWT.

### 4.2 CRM

- **twentyhq/twenty**
  - Licensing: AGPLv3 plus a "Twenty Application Exception". Apps that touch Twenty only through its REST/GraphQL APIs, webhooks or SDK may be proprietary. Files marked `/* @license Enterprise */` are commercial. twenty-ui and the SDKs are MIT.
  - 11 GHSAs, recent ones including privilege escalation via an invitation role.
  - Run it unmodified and separately, if at all. Never fork or embed it.
- **marmelab/atomic-crm**
  - MIT. React, react-admin, shadcn and Supabase.
  - 28 migrations, Edge Functions (Postmark inbound email, MCP), Vitest and Playwright.
  - **Its RLS is `using (true)` for any authenticated user**, so it is single-tenant.
  - Copy the deal kanban, contacts, notes and tasks UI, then add `account_id` and RLS.
- **krayin** (MIT, Laravel): wrong stack.
- **frappe/crm, EspoCRM**: AGPL.

Build a thin leads/pipeline module and borrow atomic-crm's UI.

### 4.3 Missed-call, voicemail and transcription

**twilio-labs/function-templates** (MIT)
- Templates: `voicemail` (country-aware greeting, then Record, then an SMS with the link), `hunt`, `forward-call`, `block-spam-calls`, `voice-ivr`.
- **Bug in `hunt.js`:** it checks `DialCallStatus === 'complete'`, but Twilio sends `completed`. Its test uses the same wrong value. Result: after an answered call ends, the flow dials the next number.
- **`voicemail/recording.js` is not `.protected`**, so Twilio Functions does not enforce the signature check on it.

**Other repos**
- TwilioDevEd call-forwarding-*: archived in 2023.
- GitHub search for missed-call text-back found only 0-star repos from Oct 2026. Skip them.

**Transcription state**
- `<Record transcribe="true">`:
  - Still documented and not deprecated.
  - **US English only.**
  - Works only on recordings of 2–120 seconds.
  - Paid.
  - Results arrive asynchronously at `transcribeCallback`. `transcribe` must now be set to true explicitly.
- Voice Intelligence:
  - Renamed Conversational Intelligence in May 2025.
  - A new Conversation Intelligence went GA on 2026-05-06: real-time, multi-channel, GenAI operators, but not HIPAA or PCI.
  - The older product is now "classic": voice-only, post-call Transcripts API from a Recording SID, per-minute billing, still supported.

**Plan**
- `<Record maxLength="120" recordingStatusCallback>` with `transcribe` for English callers in the MVP.
- Move to Conversational Intelligence (classic) operators, or an external STT, for extraction and Spanish.

**Flow design**
- `<Dial timeout≈15–18 answerOnBridge action>`.
- Treat `no-answer`, `busy`, `failed` and `canceled` as missed calls.
- The owner's carrier voicemail can pick up and show as `completed`. Defend against it with a `<Number url>` screening whisper that needs a keypress. Confirm the resulting status with a test call.

### 4.4 Audit and SEO

- **Lighthouse** (Apache-2.0): run it as a node module, or call the hosted PageSpeed Insights API to avoid running Chrome serverless.
- **Unlighthouse** (MIT, pre-1.0): whole-site scans.
- **SEOnaut** (MIT, Go): crawler rule set to study.
- **sitespeed.io** (MIT): heavy performance monitoring.
- No OSS covers local-business checks (Google Business Profile, citations, reviews). We build those.

### 4.5 n8n

- The SUL allows use only "for your own internal business purposes" or for non-commercial use. It may be distributed only free and non-commercially.
- `.ee` files need an Enterprise license.
- Using it internally for our own ops is fine.
- Using it as our customers' workflow engine needs a commercial (Embed) agreement.
- 100 published GHSAs.
- **Do not embed it.**

### 4.6 Cal.com

**What changed in 2026**
- Production code went private.
- The public repo became `calcom/cal.diy` and was relicensed from AGPL to MIT.
- Removed: Teams, Orgs, Workflows, SSO and API v1.
- Its README says it is "strictly recommended for personal, non-production use".
- 6 GHSAs, including critical auth bypasses (2025-12 and 2026-01).

**Hosted API v2**
- Bearer API keys (`cal_live_`), with OAuth recommended.
- 120 requests/minute.
- Platform (managed users) has taken no new signups since 2025-12-15.

**Verdict**
- Integrate per tenant with hosted Cal.com, or with Google Calendar directly.
- Do not self-host cal.diy.

## 5. License risk notes

- **No license means all rights reserved:** vercel/platforms, VapiAI/examples, and several Vapi SDK repos. Re-implement; don't copy.
- **AGPL:** Twenty core (its exception covers API-only apps only), Frappe CRM and EspoCRM. Never import their code into our SaaS.
- **SUL (n8n):** source-available, not OSI-approved. No commercial embedding.
- **LiveKit Model License:** the turn models may be used only with LiveKit Agents.
- **Smart Turn:** BSD-2 for both code and weights. Clean.
- **Permissive licenses:** keep the notices when vendoring Basejump SQL or atomic-crm components. Apache-2.0 projects also require keeping the NOTICE file.
- **cal.diy:** only MIT-era commits are MIT. Earlier history stays AGPL.

## 6. Sources

**GitHub REST, via `gh api`**

These four endpoints were called for each of 32 repos: `repos/{r}`, `repos/{r}/commits?per_page=1`, `repos/{r}/releases?per_page=1`, and `repos/{r}/security-advisories`. The repos were: pipecat-ai/{pipecat, pipecat-flows, pipecat-examples, smart-turn}, livekit/{agents, agents-js, sip}, VapiAI/{examples, gitops}, 7XLabs/Aiva, twilio/twilio-node, morluto/rea, usebasejump/basejump, vercel/platforms, nextjs/saas-starter, makerkit/nextjs-saas-starter-kit-lite, Razikus/supabase-nextjs-template, supabase/supabase, vercel/nextjs-subscription-payments, twentyhq/twenty, marmelab/atomic-crm, krayin/laravel-crm, frappe/crm, espocrm/espocrm, twilio-labs/function-templates, GoogleChrome/lighthouse, harlan-zw/unlighthouse, sitespeedio/sitespeed.io, StJudeWasHere/seonaut, n8n-io/n8n, calcom/cal.com (now cal.diy).

Other endpoints:
- Org listings: `orgs/pipecat-ai/repos`, `orgs/VapiAI/repos`.
- `users/morluto`, `repos/{r}/contributors`, `repos/{r}/community/profile`, `repos/{r}/license`.
- Recursive trees: `repos/{r}/git/trees/main?recursive=1` for most mandatory repos, atomic-crm and basejump.
- Search: `search/code` (pipecat and pipecat-examples, for Twilio signature use) and `search/repositories` (Twilio voicemail and missed-call queries).

Files read via `repos/{r}/contents/...`:
- pipecat: `src/pipecat/runner/run.py`, `runner/utils.py`, `serializers/twilio.py`, `pyproject.toml`, `.github/workflows/*`.
- pipecat-flows: README. smart-turn: README.
- livekit: `livekit-plugins-turn-detector/README.md` and `pyproject.toml`, `testing.py`, `evals/__init__.py`, `worker.py`; livekit/sip README and `go.mod`.
- VapiAI/examples: `assistants/*/README.md`, `get_instructions.ts`. VapiAI/gitops: README.
- Aiva: `lib/twilioAuth.ts`, `lib/db.ts`, `lib/agent/index.ts`, `lib/twiml.ts`, `middleware.ts`, `app/api/voice/incoming/route.ts`, `app/api/calls/end/route.ts`, `package.json`, `ci.yml`.
- twilio-node: `package.json`, `src/webhooks/webhooks.ts`, `UPGRADE.md`.
- morluto/rea: README, `DISCLAIMER.md`.
- basejump: `supabase/migrations/20240414161947_basejump-accounts.sql`.
- vercel/platforms: README. nextjs/saas-starter: `lib/db/schema.ts`. makerkit lite: README.
- twenty: `LICENSE`. atomic-crm: `supabase/migrations/20240730075029_init_db.sql`, README.
- function-templates: `voicemail/functions/*`, `hunt/functions/hunt.js`, `hunt/tests/hunt.test.js`.
- n8n: `LICENSE.md`. cal.diy: README, `LICENSE`.

**Package stats**
- https://api.npmjs.org/downloads/point/last-week/{twilio, @livekit/agents, @pipecat-ai/client-js}
- https://pypistats.org/api/packages/{pipecat-ai, livekit-agents}/recent

**Web pages**
- https://huggingface.co/livekit/turn-detector/blob/main/LICENSE
- https://docs.livekit.io/agents/build/turns/turn-detector/
- https://docs.livekit.io/agents/start/testing/
- https://docs.livekit.io/telephony/
- https://livekit.com/
- https://www.daily.co/products/pipecat-cloud/
- https://www.twilio.com/docs/voice/twiml/record
- https://www.twilio.com/docs/voice/twiml/dial
- https://www.twilio.com/docs/conversational-intelligence
- https://www.twilio.com/docs/conversations/intelligence/guide-classic-users
- https://www.twilio.com/en-us/changelog/real-time-conversation-intelligence-is-now-generally-available
- https://static1.twilio.com/en-us/changelog/voice-intelligence-is-now-conversational-intelligence
- https://twilio.com/docs/voice/twiml/changelog
- https://cal.com/blog/cal-diy-open-source-to-closed-source
- https://thenewstack.io/?p=22819885
- https://cal.com/docs/api-reference/v2/introduction
- https://docs.n8n.io/sitemap.md (the license FAQ pages returned 404)
