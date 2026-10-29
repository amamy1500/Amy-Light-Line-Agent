# Repo scan 2: is there a repo to adopt instead of Lightline?

- **Date:** 2026-10-22 (second scan; extends `repo-research.md` §1–3, §5).
- **Question:** does any open-source repo already do what Lightline does well enough to adopt and modify?
- **Scope addition (mid-scan):** one shared number for three brands, a cloned office-manager voice, and calls forwarded from Bestline (Metaswitch). See §5.
- **Method:** `gh search repos` (≈160 queries: keywords × stars/updated × license × language, 15 topics), `gh search code` (30 queries), GraphQL activity checks, read-only shallow clones under `%TEMP%\repo-scan\`.
- **Safety:** nothing was installed, built or run from any clone. Files were only read and grepped.
- **Corpus:** 1,845 unique repos from repo search, plus code-search hits. About 60 were checked by API. 10 were cloned.

## Labels

| Tag | Meaning |
|---|---|
| **FACT** | Seen in code, in a repo file, or returned by the GitHub API today. |
| **INFERENCE** | My judgement from the evidence. |
| **OPEN** | Not verified. |

## 1. Answer

1. **Nothing beats our code for this job.** FACT: no licensed repo combines owner-first ringing, a screened hand-off, ElevenLabs Agents, an approval gate on facts, and a post-call compliance scan.
2. **The best new find is `lobbystack/lobbystack`** (MIT, Next.js + Postgres RLS, 458 test files).
   - It is the most mature open-source AI receptionist found in either scan.
   - It is built on OpenAI GPT-Live over a Twilio SIP trunk. It cannot use ElevenLabs or a cloned voice without rewriting its core. FACT: `packages/agent-core/src/live/session.ts:8-9`.
   - Its transfer is a cold SIP REFER. "Ring the owner first" is left to the carrier's forward-on-no-answer.
   - Verdict: **REUSE A MODULE** (Diversion parsing) and **STUDY** (operations patterns). Do not adopt.
3. **Keep our code. Borrow three small things.** See §4.
4. **The scope addition changes the architecture more than any repo does.** Brand must be known before the agent speaks. A Bestline forward carries the same number for all three brands. See §5.

## 2. Ranked table (new candidates)

Score: 10 criteria × 0–2 = 20.

- **R1** Twilio PSTN inbound.
- **R2** Owner first + screened hand-off.
- **R3** Grounding: no invented prices or dates.
- **R4** ElevenLabs Agents / cloned voice.
- **R5** Persistence and multi-tenancy.
- **R6** Webhook signature check, fail-closed.
- **R7** Tests and CI.
- **R8** Maintenance (90-day commits, humans).
- **R9** Permissive license file.
- **R10** Fit with Next.js/TypeScript.

Lightline's own code would score 18 or more on this rubric. R8 and R9 don't apply to it.

| # | Repo | License (file) | Voice runtime | 90d commits / humans* / open issues | Tests / CI | Score | Verdict |
|---|---|---|---|---|---|---|---|
| 1 | [lobbystack/lobbystack](https://github.com/lobbystack/lobbystack) | MIT | OpenAI `gpt-live-1` via Twilio Elastic SIP trunk | 129 / 3 (`lobbystack`, `morencyr`, `devresponse`) / 3 | 458 files; CI runs typecheck, build, tests, `db:verify-rls`, Playwright e2e, CodeQL | **15** | REUSE A MODULE + STUDY |
| 2 | [hkjarral/AVA-AI-Voice-Agent-for-Asterisk](https://github.com/hkjarral/AVA-AI-Voice-Agent-for-Asterisk) | MIT | Asterisk ARI; ElevenLabs/OpenAI/Deepgram/Google providers | 86 / 7 / 17; v7.6.4 (10-17) | 196 pytest files; CI, CodeQL, Trivy | **14** | STUDY |
| 3 | [twilio/twilio-agent-connect-typescript](https://github.com/twilio/twilio-agent-connect-typescript) | MIT (Twilio Inc.) | ConversationRelay or Media Streams + OpenAI realtime | 17 / 3 / 7; v2.4.0 (09-21) | 44 files; CI lint, tsc, test, build | **13** | STUDY (REUSE only if we move to ConversationRelay) |
| 4 | [fonoster/fonoster](https://github.com/fonoster/fonoster) | MIT | Self-hosted CPaaS (Routr SIP, own media) + Autopilot | 787 / **1** (`psanders`) / 26 | 109 files; 9 workflows | 12 | AVOID as base; STUDY |
| 5 | [COSS-India/VoicEra](https://github.com/COSS-India/VoicEra) | Apache-2.0 | Python, Indian-language telephony | 177 / 6 / 4 | 88 pytest files; **no CI workflows** | 8 | AVOID |
| 6 | [Sainigurnoor511/frontdesk-ai](https://github.com/Sainigurnoor511/frontdesk-ai) | Apache-2.0 | LiveKit or AssemblyAI, **browser only** | 307 / 1 / 0 | 86 files; 3 workflows | 8 | AVOID (cannot take phone calls) |
| 7 | [C4rohan/Lampline](https://github.com/C4rohan/Lampline) | Apache-2.0 | Pipecat; Twilio, Telnyx or jambonz | 108 / 1 / 5; **created 2026-10-19** | 41 pytest files; CI | 7 | STUDY (phone evals idea only) |
| 8 | [bobbylkchao/ai-phone-agent](https://github.com/bobbylkchao/ai-phone-agent) | MIT | Amazon Connect + OpenAI SIP | 9 / 1 / 0 | 27 files | 6 | AVOID (wrong carrier) |
| 9 | [djoudad292/ai-virtual-receptionist](https://github.com/djoudad292/ai-virtual-receptionist) | MIT | **Chat and browser speech only** | 104 / 2 / 0 | — | 5 | AVOID |
| 10 | [getphoneflow/phoneflow](https://github.com/getphoneflow/phoneflow) | Apache-2.0 | Visual flow builder, SIP credentials | 114 / 1 / 0 | **0 tests, no CI** | 5 | AVOID |

\* FACT (API): humans = distinct non-bot authors in the latest ≤100 commits since 2026-07-24.

### Checked but not shortlisted

- **FACT:** These are licensed but dormant or toy-sized:
  - [jcllobet/missedcall-agent](https://github.com/jcllobet/missedcall-agent) (MIT, 20 commits, last push 2026-05-03). It is the only licensed repo found with **ring a human first, "Press 1 to accept", AI fallback** on Twilio (`voice-agent/twilio-functions/functions/voice.js:159-172`). It is a hackathon project (Pipecat Cloud + Slack). It confirms our pattern; nothing to take.
  - `vocodedev/vocode-core` (MIT): last push 2024-11.
  - `twilio-labs/call-gpt`: last push 2024-12.
  - `openai/openai-realtime-twilio-demo`: last push 2024-12.
  - `fixie-ai/community-center-receptionist`: last push 2025-01.
  - `neural-maze/realtime-phone-agents-course`: last push 2026-01.
- **FACT:** No license file, so inspiration only:
  - [rbangueses/twilio-elevenlabs-call-handoff-blueprint](https://github.com/rbangueses/twilio-elevenlabs-call-handoff-blueprint). Its README says it "intentionally uses ElevenLabs `register-call` and a custom ElevenLabs webhook tool" instead of native `transfer_to_number`, and it redirects the parent call. That is the same design as our `transfer_to_amy` → REST redirect → `/handoff` (ADR 0003). **INFERENCE:** independent confirmation of our choice.
  - `deshartman/simple-conversation-relay`, `kumouri/ai-call-screener`, `chendren/elevenlabs-sip-refer`, and about 30 single-author "AI receptionist" apps from code search (for example `MichaelMakhoul/phondo`, `Makooff/qwillio`, `AraGhah/TradeCatch`, `cranzoid/Pizza62Sol`). All lack a license or are `NOASSERTION`.
- **FACT:** Platforms, not receptionists:
  - `jambonz/jambonz-feature-server` (MIT CPaaS).
  - `somleng/somleng` (MIT, Twilio-compatible CPaaS, 2 humans).
  - `VoiceBlender/voiceblender` (MIT Go SIP platform).
  - `TEN-framework/ten-framework` (license `NOASSERTION`).
  - `pipecat-ai/pipecat-examples` (BSD-2; `phone-chatbot/daily-pstn-warm-transfer`, but on Daily PSTN).
- **FACT:** Eval tools worth a look later:
  - [ServiceNow/eva](https://github.com/ServiceNow/eva) (MIT, 12 humans, 169 commits/90d).
  - [voicetestdev/voicetest](https://github.com/voicetestdev/voicetest) (Apache-2.0, 1 human).
- **Earlier list re-checked by API:** nothing material changed since this morning.
  - Aiva still has 0 commits in 90 days.
  - Dograh shipped v1.49.0 on 10-12. QuickVoice is active (111 commits / 5 humans).

## 3. Shortlisted repos

### 3.1 lobbystack/lobbystack: REUSE A MODULE + STUDY

Clone `55a7dcb` (2026-10-22). Stack: Next.js, Postgres + Drizzle, Redis + BullMQ, pnpm monorepo, Node ≥ 26.

- **Telephony and latency**
  - FACT: Phone calls go Twilio Elastic SIP trunk → OpenAI SIP. OpenAI posts `live.transport.incoming` to the admin app, and a worker holds a sideband WebSocket that answers delegated tool calls. Sources: `docs/adr/0008-gpt-live-voice.md`, `docs/voice/runtime.md:5-30`.
  - FACT: Latency tactics:
    - Some tools answer directly, without a second model call.
    - The caller hears "still checking" after 4 s.
    - Requests run in order, and a superseded request becomes background facts. Source: `runtime.md:24-30`.
- **Transfer**
  - FACT: Transfer is a **cold SIP REFER** to one number, sent after the agent announces it (`runtime.md:116, 145-151`).
  - FACT: There is no screen, whisper or accept key.
  - FACT: Owner-first ringing is delegated to the carrier: the business forwards "Calls you miss" to its LobbyStack number (`mintlify/getting-started/forward-calls.mdx`, 51 carriers).
- **Grounding**
  - FACT: Hours, services, closures, transfer policies and booking rules are structured and authoritative. RAG is only for unstructured knowledge (`docs/adr/0005-structured-facts-over-rag.md`).
  - FACT: The prompt says "Never state availability, prices or policies you haven't looked up" (`packages/agent-core/src/instructions.ts:80-81`). A service price is quoted exactly or not at all (`:136-137`).
  - FACT: There is **no approval gate**. The business summary is AI-written from knowledge sources unless an operator wrote one, and hours are AI-extracted from source passages (`runtime.md:22`).
  - FACT: There is no post-call compliance scan. A grep for one in `packages/agent-core` and `packages/domain` found nothing.
  - **INFERENCE:** weaker than our "approved facts only" layer and compliance scanner.
- **Persistence, tenancy and secrets**
  - FACT: 119 SQL migrations. 29 `ENABLE ROW LEVEL SECURITY` statements, plus `FORCE ROW LEVEL SECURITY` (`packages/db/migrations/0002_rls.sql:100-119`).
  - FACT: Separate DB roles (`lobbystack_app`, `_worker`, `_dispatcher`, `_readonly`). CI runs `pnpm db:verify-rls` (`.github/workflows/ci.yml:123-124`).
  - FACT: Caller PINs are stored as salted scrypt hashes (`runtime.md:40`).
- **Signatures**
  - FACT: Twilio signatures go through `twilio.validateRequest` and return `false` when the token or header is missing, so the check fails closed (`packages/providers/src/twilio/webhookSecurity.ts:12-20`; used at `apps/admin/app/api/webhooks/twilio/voice/route.ts:28-32`).
  - FACT: OpenAI webhooks are checked with `client.webhooks.unwrap`, which returns 400 on a bad signature (`apps/admin/app/api/webhooks/openai/live/route.ts:28-32`).
- **Reliability patterns worth studying**
  - FACT: Minute reservation before accepting a call; SIP 486 when out of minutes (`runtime.md:89`).
  - FACT: Redis attach lock per call. The worker drains on SIGTERM for up to 31 min. A crash-recovery job re-attaches orphaned calls every minute (`runtime.md:167-200`).
- **Maintenance**
  - FACT: 401 commits since 2026-03-10. 129 commits in 90 days. 3 open issues.
  - FACT: Authors are `lobbystack`, `morencyr` and `devresponse`. Several commits carry `Co-Authored-By` trailers.
  - FACT: Recent commits point site links at a GitLab mirror.
  - **INFERENCE:** bus factor of about 2, and development may be moving to GitLab.
- **Score:** 15/20.
- **Why not adopt**
  - It has no ElevenLabs and no voice clone: `DEFAULT_VOICE = "marin"`, `LIVE_MODEL = "gpt-live-1"`.
  - It has no screened owner hand-off.
  - It has no approval gate.
  - It would mean replacing a tested system (334 tests) with a different voice runtime.
- **Reuse (MIT, keep the notice)**
  - `phonesFromSipHeader()` and the dialled-number order Diversion → To → P-Called-Party-ID (`apps/admin/app/api/webhooks/openai/live/route.ts:16-18, 38-47`). It is small; copy with attribution, or rewrite.
  - Pattern only: the carrier-by-carrier forwarding guide, including "Calls you miss" versus "All calls" (`mintlify/getting-started/forward-calls.mdx:12-20`). Useful for the Bestline conversation.

### 3.2 hkjarral/AVA-AI-Voice-Agent-for-Asterisk: STUDY

Clone `42ace44` (2026-10-20). Python, Asterisk/FreePBX ARI, Docker, admin UI.

- **Screened transfer**
  - FACT: Warm transfer plays music on hold to the caller, sends a TTS or AI briefing to the destination, and waits for DTMF **1 = accept, 2 = decline** (`src/tools/telephony/attended_transfer.py:2-8, 34-36`).
  - FACT: Other tools are blocked while a transfer is pending (`src/tools/context.py:85-187`).
  - **INFERENCE:** the closest open-source match to our screened hand-off, on a different stack.
- **ElevenLabs**
  - FACT: There is an `elevenlabs_agent` full-agent provider, connected by signed URL (`src/providers/elevenlabs_agent.py:216, 258`; `docs/Provider-ElevenLabs-Setup.md`).
- **Multi-brand**
  - FACT: The agent is chosen per call from the `AI_AGENT` channel variable, which the dialplan sets (`docs/Configuration-Reference.md:127-131`). So "IVR, then a per-brand AI agent" is native.
- **Gaps**
  - FACT: Agents live in SQLite (`agents.db`). There is no multi-tenant database.
  - FACT: It needs an Asterisk host. Twilio would only be a SIP trunk.
- **Maintenance**
  - FACT: 3,557 commits, 7 humans in 90 days, 54 releases, CodeQL and Trivy in CI.
- **Verdict:** STUDY. Use it as a reference for the screened-transfer state machine. Revisit only if we ever take SIP directly from Bestline.

### 3.3 twilio/twilio-agent-connect-typescript (TAC): STUDY; REUSE if we leave ElevenLabs register-call

Clone `e3ded3e` (2026-10-14). Official Twilio SDK (`twilio-agent-connect` on npm), Node ≥ 22.13, Fastify.

- **Signatures**
  - FACT: Every TAC webhook route runs `validateRequestSignature` and returns 403 on failure (`packages/server/src/lib/server.ts:265-284`).
  - FACT: The ConversationRelay WebSocket upgrade is also signature-checked and closed with 1008 (`:440-464`).
  - FACT: `authToken` is `z.string().min(1)` at config time (`packages/core/src/types/config.ts:110`), so it fails closed at boot.
- **Hand-off**
  - FACT: `createStudioHandoffTool` sends the call to a Studio Flow or Flex (`getting_started/examples/handoff/src/index.ts`). It is a cold hand-off with no screen.
- **Forwarded calls**
  - FACT: Types include `forwardedFrom` (ConversationRelay setup) and `ForwardedFrom` (voice webhook) (`packages/core/src/types/crelay.ts:142, 691`).
- **Not a receptionist**
  - FACT: There is no database, booking or business-facts layer. Memory and knowledge are Twilio's paid services.
- **Verdict:** STUDY. If we ever replace ElevenLabs register-call with ConversationRelay (a Lightline ADR 0003 "swap the mouth"), use TAC as the transport. Don't copy it.

### 3.4 fonoster/fonoster: AVOID as base

- FACT: MIT, TypeScript, 8,146 stars. 787 commits in 90 days, all by one human (`psanders`).
- FACT: It is mid-rebuild. `docs/try-the-new-platform.md` describes "the rebuilt Fonoster" voice path (Routr → Roomr → AppBridge → hosted Autopilot).
- FACT: Autopilot transfer is a blind dial to one configured number (`mods/autopilot/src/session/Agent.ts:515-548`). Its knowledge base is S3 documents.
- **INFERENCE:** replacing Twilio with a self-hosted SIP platform adds a media plane we don't need.
- OPEN: whether Autopilot supports ElevenLabs voices.

### 3.5 The rest (brief)

- **VoicEra.** FACT: there is no Twilio signature validation; a grep of `apps/` found none. FACT: there is no `.github/workflows`. It is India-focused (Vobiz/Plivo).
- **frontdesk-ai.** FACT: the README answers "Can it answer real phone calls?" with "Not yet" (`README.md:413-415`). It has the closest stack to ours (Next.js 16 + Supabase RLS), but no phone path.
- **Lampline.** FACT: created 2026-10-19, with 163 stars in 3 days and 1 author. It validates Twilio, Telnyx and jambonz signatures (`engine/src/vpengine/server.py:1578`, `jambonz.py:62-76`). Its idea: an AI "Test Caller" that phones the agent and grades the call. **INFERENCE:** worth copying as an idea for our evals. Its Google Voice browser bridge is a ToS risk; don't use it.
- **ai-virtual-receptionist, ai-phone-agent, phoneflow.** FACT: chat-only; Amazon Connect-only; no tests. Not relevant.

## 4. Build vs borrow (delta to `repo-research.md` §3)

| # | Item | Decision | Source and license | Why |
|---|---|---|---|---|
| 24 | Read the forwarding number on Bestline-forwarded calls | **BUILD** (≈20 LOC) | Twilio `ForwardedFrom` param; pattern from LobbyStack `route.ts:38-47` (MIT) | FACT: Lightline has no `ForwardedFrom`/`Diversion` handling today (grep of `lib/`, `app/`). It is needed for the "already rang Amy at Bestline" flag in `docs/bestline-options.md`. |
| 25 | Owner screened hand-off | **KEEP ours** | Reference: AVA `attended_transfer.py` (MIT) | FACT: AVA confirms the accept/decline DTMF model. Nothing to replace. |
| 26 | Admission / capacity | **KEEP ours**; study LobbyStack minute reservation + Redis attach lock | `docs/voice/runtime.md:89, 167-200` (MIT) | INFERENCE: our row-locked admission covers the same need for one tenant. |
| 27 | Black-box phone evals | **STUDY later** | Lampline Evals idea; `ServiceNow/eva` (MIT) | INFERENCE: catches regressions that unit tests can't (latency, barge-in). |

## 5. Scope addition: one number, three brands, cloned voice, Bestline forwarding

### 5.1 Multi-brand receptionist on one number

- FACT: No licensed repo found does "one shared number → router → per-brand agent" end to end.
  - The "multi-tenant receptionist" and "ivr ai receptionist" searches returned only unlicensed single-author apps (for example `HiddenDevelop/hybrid-ivr-ai-receptionist`, `komalyousaf830/ai-receptionist-system`).
- FACT: The patterns that exist:
  - **One number per business.** LobbyStack resolves the business from the dialled number with `app.resolve_business_by_phone` (`packages/db/migrations/0003_resolvers.sql:1`).
  - **IVR or dialplan, then a per-brand agent.** AVA sets `AI_AGENT` per call.
  - **ElevenLabs-native router.** `elevenlabs-js` has `AgentWorkflowRequestModel` (nodes and edges), `WorkflowOverrideAgentNodeModelInput` and `TransferToAgentToolConfigInput` (`src/api/types/`). So a router agent that hands off to sub-agents exists in the platform.
- OPEN: whether `transfer_to_agent` and workflows behave the same on calls that start through `convai/twilio/register-call`. Verify in the ElevenLabs docs before relying on it.
- **INFERENCE (recommendation):** decide the brand before the agent speaks, not with an LLM router. In order of preference:
  1. **Bestline auto-attendant ("1 lights, 2 patio, 3 fridge")** forwarding each option on no answer to its **own Twilio number**. Twilio's `To` then names the brand. Our per-number config handles the rest with no new routing code. Depends on `docs/bestline-options.md` Q7.
  2. **Our own Twilio `<Gather>` menu** in `/api/voice/inbound`, then register-call with that brand's agent ID or dynamic variables. About one route and one config field.
  3. An ElevenLabs router agent with `transfer_to_agent`. It adds a model hop, latency and misroute risk on every call.
- **Architecture impact (INFERENCE):** the tenant model needs a **brand** level under one line: brand facts, approvals, greeting, compliance rules and lead tagging. Sublime Patio and The Fridge have no approved facts, so they should stay message-only until Amy approves facts, as `docs/bestline-options.md` already says.

### 5.2 ElevenLabs Agents with SIP trunking or agent-to-agent transfer

- FACT: The ElevenLabs SDK supports SIP-trunk numbers (`sipTrunk/client/Client.ts`).
- FACT: It supports `transfer_to_number` with `PhoneNumberTransferCustomSipHeadersItem` and `SipUriTransferDestination`.
- FACT: It supports agent workflows (types listed in §5.1).
- FACT: Repos using these are unlicensed or trivial:
  - `chendren/elevenlabs-sip-refer` (no license; SIP REFER between ElevenLabs agents).
  - `579550/elevenlabs-sip-gateway` (no license; AWS Chime + FreeSWITCH).
  - `Jitendra2603/sip-gateway` (MIT, 3 commits, Kamailio + RTPEngine).
- FACT: The strongest related artifact is the unlicensed Twilio + ElevenLabs hand-off blueprint (§2). It deliberately avoids native transfer, as we do.
- **INFERENCE:** no strong hit. Our register-call + webhook tool + REST redirect remains the documented-by-others path.

### 5.3 Calls forwarded from another carrier or PBX

- **Strong hit: LobbyStack.**
  - FACT: It routes forwarded calls by SIP `Diversion`, then `To`, then `P-Called-Party-ID`, trying every number. Its code comment says "a forwarded call can carry several Diversions, the first of which may be the business's old line" (`route.ts:38-47`).
  - FACT: Its docs cover forward-on-no-answer per carrier.
  - Gap: it is SIP-trunk-specific. On our Twilio PSTN number, the equivalent is Twilio's `ForwardedFrom` webhook parameter (typed in TAC `crelay.ts:691`).
- FACT: SIP and PBX bridges to AI:
  - AVA (Asterisk, MIT).
  - [wiringai/mod_earshot](https://github.com/wiringai/mod_earshot) (FreeSWITCH module, MIT, 2 humans, v0.4.1).
  - [aicc2025/sip-to-ai](https://github.com/aicc2025/sip-to-ai) (Apache-2.0, 3 humans).
  - [thevoiceguy/siphon-ai](https://github.com/thevoiceguy/siphon-ai) (Apache-2.0, Rust, 1 human).
  - `agentvoiceresponse/avr-infra` (MIT, dormant since 2026-06).
- FACT: "Metaswitch" searches returned only admin scripts and conference repos. No repo integrates a Metaswitch or MaX UC line with an AI agent.
- **INFERENCE:** we don't need SIP. Bestline forward-on-no-answer to a Twilio PSTN number is enough. Two things matter:
  - **The caller's own number survives the forward.** This is Bestline question 5.
  - **We read `ForwardedFrom`, so we skip ringing Amy a second time.** This is the `bestline-options.md` "already rang Amy" flag.
- OPEN: whether Metaswitch sends a Diversion header that Twilio surfaces as `ForwardedFrom`. Test with one forwarded call.
- **Architecture impact:** with one Bestline line, `ForwardedFrom` is the same for all three brands. It tells us *that* Bestline forwarded, not *which* brand. See §5.1.

### 5.4 Cloned voice in a phone agent

- FACT: No repo has code specific to a cloned voice. It is a `voice_id` on the ElevenLabs agent.
  - AVA and Lightline both take the voice from the ElevenLabs agent config.
  - LobbyStack can't do it: it uses OpenAI preset voices (`session.ts:9`).
  - TAC/ConversationRelay: OPEN whether ElevenLabs custom or cloned voice IDs are accepted.
- FACT: Voice-clone repos in the search results (`debpalash/VoiceStudio` AGPL, `jamiepine/voicebox` MIT, RVC) are studios, not phone agents.
- **INFERENCE:** a cloned voice is a config change in our agent spec. It does not change our code architecture. It does raise consent and disclosure work:
  - The office manager's written consent and ElevenLabs voice verification.
  - The AI disclosure in the opening line, so callers aren't misled that the agent is the real person.
- OPEN: check these against `docs/research/legal-compliance.md` before go-live.

## 6. Reproduction

- **Search:** `gh search repos "<q>" --sort stars|updated [--updated ">=2026-05-01"] [--license mit|apache-2.0|bsd-2-clause|bsd-3-clause] [--language typescript|python] [--stars ">=15"]`. Topics: ai-receptionist, voice-agent(s), voice-ai, phone-agent, ai-phone-agent, twilio-voice, conversational-ai, voice-assistant, telephony, receptionist, missed-calls, voicebot, twilio.
- **Code search:**
  - `convai/twilio/register-call`, `registerCall conversationalAi`, `register_call twilio elevenlabs`.
  - `ConversationRelay` (ts, py, js), `missed call text back`, `receptionist validateRequest`.
  - `press 1 to accept twilio`, `transfer_to_agent elevenlabs`, `transfer_to_number sip_refer`, `sip_trunk elevenlabs`.
  - `ForwardedFrom receptionist|elevenlabs`, `Diversion elevenlabs|audiosocket`, `SipHeader_Diversion`, `CalledVia twilio`, `voice_clone twilio agent`.
  - Two queries failed with HTTP 503 ("too many shards"): `receptionist twilio` (ts and py).
- **Activity:** GraphQL `history(since: "2026-07-24")`, with bot authors excluded by name pattern.
- **Clones (depth 1, read only):** `%TEMP%\repo-scan\{lobby, tac, ava, fonoster (sparse), lamp, voicera, fdai, avr, bpa, pflow}`.
