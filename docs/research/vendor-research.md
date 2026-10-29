# Voice-stack vendor research: Lightline AI receptionist

- Date: 2026-10-22.
- Scope: inbound AI receptionist for a small Austin TX Christmas-lighting business.
- Status: research input. Not a decision record.
- ElevenLabs Agents is verified separately. Its cells say "per elevenlabs.md".

## 0. How to read this

| Label | Meaning |
|---|---|
| FACT | Read today on an official page (pricing, docs, changelog, status page, official repo). |
| VENDOR CLAIM | Vendor's own performance or marketing statement. |
| INFERENCE | Our reasoning from facts. All matrix scores are INFERENCE. |
| OPEN QUESTION | Could not verify. Must be tested or asked. |

- Every price came from a live page on 2026-10-22. None came from memory.
- Sections 1-10 are the synthesis. Appendices A-E hold the raw evidence, one row per claim, each with a URL.
- The web-search budget ran out late in the session. Remaining checks used direct page fetches. A few items stayed OPEN.

Use case recap:
- Dedicated Twilio number we own. Our webhook rings Amy first with a press-1 screen.
- No bridge: the call goes to an AI agent. It collects 3-6 lead facts and calls typed server tools.
- It can transfer back to Amy (warm, screened if possible). It must never invent prices or dates.
- ~100-400 seasonal calls. TV-ad bursts of 20-100 simultaneous calls.
- One TypeScript/Next.js engineer.
- Priorities: reliability > naturalness > speed > control > cost > novelty.

---

## 1. Bottom line

### 1.1 Ranked top 3

The top 3 are the same under every weighting tried (section 5.3). Their order is not stable. Treat 1-3 as a near-tie decided by tests (section 10).

| Rank | Stack | Weighted score /100 | One-line reason | Label |
|---|---|---|---|---|
| 1 | **Retell** (register-phone-call + `<Dial><Sip>`) | 76.5 | Best independent workflow reliability (Cekura pass³ 75.6%). Hosted, fast to ship. 20 free concurrent lines plus burst mode. But its native transfers are off in our topology. | INFERENCE from FACTs in 5.4 |
| 2 | **LiveKit Agents (Node) + LiveKit Cloud** | 76.0 | Only first-party warm transfer with summary that ships in Node. TS-native SDK, Vitest tests, OTel traces. Ship plan caps at 20 concurrent; bursts need Scale ($500/mo). | INFERENCE from FACTs in 5.4 |
| 3 | **Twilio ConversationRelay + our TS LLM loop** | 73.3 | Fewest vendors in the call path. Ring-Amy-first, whisper and return-to-agent are plain TwiML. Lowest lock-in, cheapest bursts. We build the LLM loop, tools and evals. | INFERENCE from FACTs in 5.4 |

ElevenLabs Agents is not ranked. Its benchmark cells are strong (section 9). The rest is per elevenlabs.md.

### 1.2 Why not the others

| Stack | Explicit reasons not to use it | Label | Source |
|---|---|---|---|
| Vapi | Worst 2026 record: Feb 23 "37,806 calls dropped". May 21 ~4 h outage. Oct 2-9 SIP degradations. | FACT | https://status.vapi.ai/incidents/2026-02/2026-04 ; https://status.vapi.ai/incidents/2026-05/2026-07 |
| | At the limit, calls fail immediately with no ring and no queue. Free plan has 4 lines. Extra lines are $10/mo each. | FACT | https://docs.vapi.ai/calls/troubleshoot-call-errors ; https://vapi.ai/pricing |
| | Cekura pass³ 59.8% and infra-clean 82.9%. Both are second-worst of 8. | FACT | https://benchmarks.cekura.ai/voice-agent-workflows |
| | Unverified whether built-in transfers work on provider-bypass calls. Bypass is the only way to keep our webhook in front. | OPEN QUESTION | https://docs.vapi.ai/calls/call-handling-with-vapi-and-twilio |
| Pipecat (+ Cloud) | Server framework is Python only. JS packages are client SDKs. That means a second language for a solo TS engineer. | FACT | https://github.com/pipecat-ai/pipecat ; https://docs.pipecat.ai/api-reference/client/js/overview |
| | Twilio WebSocket path has "No advanced call center features like transfers". | FACT | https://docs.pipecat.ai/pipecat/telephony/overview |
| | 50 sessions per deployment, then HTTP 429. Cold starts ~10 s. Lowest Cekura naturalness (3.74). | FACT | https://docs.pipecat.ai/deployment/pipecat-cloud/fundamentals/scaling ; https://benchmarks.cekura.ai/voice-agent-workflows |
| OpenAI Realtime / GPT-Live over SIP | No OpenAI doc covers `<Dial><Sip>` from a Twilio webhook. GPT-Live requires SRTP. Path untested. | OPEN QUESTION / FACT | https://developers.openai.com/api/docs/guides/voice-sip |
| | REFER semantics undocumented. No first-party eval or per-turn latency tooling. TS Agents SDK 0.21.0 is pre-1.0. Twilio adapter is beta. | FACT | https://developers.openai.com/api/docs/guides/realtime-sip ; https://openai.github.io/openai-agents-js/extensions/twilio/ |
| | Speech-to-speech gives no text hop to filter invented prices or dates before speech. | INFERENCE | n/a |
| | 429 `slow_down` on "rapid traffic increase", even within limits. Bad fit for TV spikes. | FACT | https://developers.openai.com/api/docs/guides/rate-limits |
| Telnyx AI Assistants | No Telnyx doc shows a Twilio-originated SIP call into an assistant. "TLS encrypted calls are not allowed for subdomain calls." | FACT / OPEN QUESTION | https://developers.telnyx.com/api-reference/texml-applications/creates-a-texml-application.md |
| | Its excellent warm transfer would dial Amy from Telnyx while the Twilio leg stays up. Untested hairpin. | INFERENCE | https://developers.telnyx.com/docs/inference/ai-assistants/warm-transfer-acceptance.md |
| | Lowest Cekura interruption score of 8 (4.63/5). Voice engine rounds each call up to 60 s. Aug 10 dead-air incident in all regions. | FACT | https://benchmarks.cekura.ai/voice-agent-workflows ; https://telnyx.com/pricing/conversational-ai ; https://status.telnyx.com/history |
| | Strongest runner-up (66.3). Revisit only if we port the number to Telnyx. | INFERENCE | n/a |
| Ultravox (now Inworld) | Pay-as-you-go hard cap of 5 concurrent. Pro is $100/mo "when billed yearly". | FACT | https://docs.ultravox.ai/gettingstarted/concurrency.md ; https://www.ultravox.ai/pricing |
| | On Twilio, `coldTransfer` "will immediately end the Ultravox call regardless of whether the transfer succeeds". | FACT | https://docs.ultravox.ai/telephony/call-transfers.md |
| | Testing docs marked "Under Construction". Acquired by Inworld 2026-09-30. No independent benchmark. | FACT | https://docs.ultravox.ai/agents/testing-and-debugging.md ; https://inworld.ai/blog/inworld-acquires-ultravox |
| Deepgram Voice Agent | Concurrency 45 (PAYG) / 60 (Growth). 100+ is Enterprise only. | FACT | https://developers.deepgram.com/reference/api-rate-limits.md |
| | No built-in transfer. We host and run the Twilio media bridge. Twilio guide is Python. | FACT | https://developers.deepgram.com/docs/inbound-telephony-agent ; https://developers.deepgram.com/docs/twilio-and-deepgram-voice-agent.md |
| | Call data is "Retained to improve our models" unless `mip_opt_out` is set. Dense TTS incidents Sep-Oct 2026. | FACT | https://developers.deepgram.com/trust-security/your-data.md ; https://status.deepgram.com/history.rss |
| Bland | Can't keep our webhook in front except by PSTN-forwarding to a Bland number. SIP is Enterprise-gated and TLS/SRTP only. | FACT / INFERENCE | https://docs.bland.ai/enterprise-features/SIP-integration.md |
| | Warm transfer is Enterprise-only. Its failure path is voicemail, not return-to-agent. | FACT | https://docs.bland.ai/tutorials/warm-transfer.md |
| | Highest price ($0.12-0.14/min). Oct 19 inbound-connect failure. Oct 14 "agent silence". | FACT | https://www.bland.ai/pricing ; https://status.bland.ai/history.rss |

### 1.3 Other headlines

| Topic | Finding | Label | Source |
|---|---|---|---|
| Account concurrency (all stacks) | Upgraded accounts without an approved Primary Customer Profile "have reduced concurrency". "An approved Business Primary Customer Profile removes limited concurrency." Get it approved before the season. | FACT | https://www.twilio.com/docs/api/errors/10004 |
| | Reported caps: 2 with no profile, 3 with an Individual profile. Applies to accounts upgraded on or after 2026-02-03. Seen in a search snippet; the page returned 403. | FACT (snippet) / OPEN QUESTION | https://support.twilio.com/hc/en-us/articles/223180028 |
| Orchestration | Vercel Workflow (GA 2026-04-16) plus typed structured-output LLM calls. Runner-up Inngest. LangGraph does not earn its place. | FACT (GA) / INFERENCE (pick) | https://vercel.com/blog/a-new-programming-model-for-durable-execution |
| Vercel plan | Hobby is "restricted to non-commercial personal use only". Pro is required: $20/mo with $20 usage credit. | FACT | https://vercel.com/docs/limits/fair-use-guidelines ; https://vercel.com/docs/plans/pro-plan |
| Supabase plan | Free projects pause after 7 days of low activity. Off-season would pause the DB. Pro ($25) cannot be paused. | FACT | https://supabase.com/docs/guides/platform/free-project-pausing |
| Voice WebSocket host | Vercel WebSockets are Public Beta and close at function max duration (800 s on Pro). ConversationRelay does not auto-reconnect. Use a small always-on host (Fly ~$3.69/mo) for any socket. | FACT / INFERENCE | https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections ; https://www.twilio.com/docs/voice/conversationrelay/websocket-messages |

---

## 2. Corrections to the 2026-10-20 notes

| Item | 2026-10-20 note | 2026-10-22 finding | Label | Source |
|---|---|---|---|---|
| Twilio CR price | $0.07/min + $0.0085 inbound | Unchanged. Page says "Pricing current as of August 2026". | FACT | https://www.twilio.com/en-us/voice/pricing/us |
| CR STT/TTS cost | (implied included) | CR pricing page: "$0.07", and "Voice costs are calculated separately". No STT/TTS line items. Inclusion of Deepgram/ElevenLabs cost is not stated. | FACT / OPEN QUESTION | https://www.twilio.com/en-us/products/conversational-ai/pricing |
| CR STT default | Deepgram/Google | Deepgram is the default (`nova-3-general`, `flux`). Google `telephony` available. TTS: ElevenLabs default, Google, Amazon Polly. | FACT | https://www.twilio.com/docs/voice/twiml/connect/conversationrelay |
| CR concurrency | (none) | Error 64109: rejected when "the maximum number of concurrent sessions was temporarily reached". No number published. | FACT | https://www.twilio.com/docs/api/errors/64109 |
| CR WS drop | (none) | "we don't reconnect, and the call disconnects with a `failed` status". Docs say to restore by returning new `<Connect><ConversationRelay>` TwiML with the same callSid. | FACT | https://www.twilio.com/docs/voice/conversationrelay/websocket-messages |
| Retell prices | $0.055 + $0.015 telephony (BYO none) + TTS $0.015 (EL $0.04-0.10) + LLM; 20 free, $8 | Unchanged. Custom telephony/SIP is "no charge". | FACT | https://www.retellai.com/pricing |
| Retell burst | (none) | Burst mode: limit = min(3× base, base+300). Over-limit calls cost +$0.10/min for the whole call. Inbound waits ~40 s, then goes to `fallback_number`. | FACT | https://docs.retellai.com/deploy/concurrency |
| Retell transfer in our topology | (none) | Dial-to-SIP: "you will not be able to use Retell's transfer call feature". Build your own via a custom function. | FACT | https://docs.retellai.com/deploy/custom-telephony |
| Vapi free plan | (10 concurrent) | 4 concurrent on the free plan. Core $29/mo has 10. Extra lines $10/mo. HIPAA $2,000/mo. | FACT | https://vapi.ai/pricing |
| OpenAI gpt-realtime-2.1 | $32/$64 per 1M audio tokens | Confirmed. Cached audio input $0.40. | FACT | https://developers.openai.com/api/docs/pricing |
| OpenAI gpt-live-1 | $0.05/min | Confirmed, "billed per second". Backend model and tool use are billed separately. | FACT | https://developers.openai.com/api/docs/models/gpt-live-1 |
| OpenAI REFER = cold | REFER = cold | Not confirmed. Docs only say `target_uri` goes into Refer-To and "The downstream system handles the rest". With Twilio `referUrl` + `answerOnBridge=true`, the caller stays with the AI if the target does not answer. | FACT (doc text) / INFERENCE | https://developers.openai.com/api/docs/guides/voice-sip ; https://www.twilio.com/docs/voice/api/refer-to-twilio |
| Benchmarks | EL 1,424 / Vapi 1,558 / Retell 1,740 / Telnyx 1,296 ms; Cekura Retell 75.6 / EL 69.5 / Vapi 59.8 | All numbers match. New: Bland 1,520 ms. Cekura adds LiveKit 70.7, Telnyx 68.3, GPT Realtime 64.6, Pipecat 63.4, Gemini Live 30.5. | FACT | https://openbenchmarks.com/voice-agent-latency ; https://benchmarks.cekura.ai/voice-agent-workflows |

---

## 3. The shared front door (applies to every stack)

All stacks below can sit behind the same Twilio webhook. The AI route lives in the `<Dial action>` handler.

| Step | Mechanism | Label | Source |
|---|---|---|---|
| 1. Ring Amy | `<Dial timeout="15" action="/after-amy"><Number url="/screen">AMY</Number></Dial>`. `<Number url>` runs TwiML on Amy's leg before bridging. Use `<Gather>` for press-1. | FACT | https://www.twilio.com/docs/voice/twiml/number |
| 2. Detect no bridge | The action URL receives `DialCallStatus` (no-answer, busy, completed...) and `DialBridged`. Returned TwiML takes over the call. | FACT | https://www.twilio.com/docs/voice/twiml/dial |
| 3. Route to AI | `/after-amy` returns the vendor TwiML (table below). | INFERENCE (composition) | below |
| 4. Fail over | If the vendor rejects (API 429, SIP error), `/after-amy` or the next action URL returns a fallback: a second vendor, CR, or voicemail + SMS to Amy. | INFERENCE | https://www.twilio.com/docs/voice/twiml/dial ; https://www.twilio.com/docs/voice/twiml/sip |
| 5. Transfer back | Either vendor REFER caught by Twilio `referUrl`, or our server updates the live call with new TwiML. `answerOnBridge=true` keeps the caller with the AI if the target does not answer (REFER path). | FACT | https://www.twilio.com/docs/voice/api/refer-to-twilio |

| Vendor | What `/after-amy` returns | Transfer back to Amy in this topology | Label | Source |
|---|---|---|---|---|
| Twilio CR | `<Connect action="/after-ai"><ConversationRelay url="wss://..."/></Connect>` | Agent sends `end` + `handoffData`. `/after-ai` returns `<Dial><Number url="/whisper">`. No answer: return a new CR session with context. | FACT | https://www.twilio.com/docs/voice/conversationrelay/websocket-messages |
| Retell | Call `POST /v2/register-phone-call`, then `<Dial><Sip>sip:{call_id}@sip.retellai.com</Sip></Dial>`. Dial within 5 min. | Native transfer off. DIY: custom function → our server → Twilio REST update. Return-to-agent = register a fresh call. | FACT / INFERENCE | https://docs.retellai.com/deploy/custom-telephony |
| LiveKit | `<Dial><Sip username password>sip:NUMBER@SIP_HOST;transport=tcp</Sip></Dial>`. Doc allows this "via another mechanism, such as a webhook". | "This method doesn't support SIP REFER". Warm transfer dials Amy via an outbound trunk, so it may not need REFER. Must test. | FACT / INFERENCE | https://docs.livekit.io/telephony/accepting-calls/inbound-twilio.md ; https://docs.livekit.io/agents/prebuilt/tasks/warm-transfer/ |
| Vapi | `POST /call` with `phoneCallProviderBypassEnabled:true`. Return `phoneCallProviderDetails.twiml`. | Built-in transfers on bypass calls unverified. | FACT / OPEN QUESTION | https://docs.vapi.ai/calls/call-handling-with-vapi-and-twilio |
| OpenAI SIP | `<Dial answerOnBridge="true" referUrl="/refer"><Sip>sip:PROJECT@sip.api.openai.com;transport=tls;secure=true</Sip></Dial>` | `/refer` endpoint → Twilio `referUrl` → `<Dial><Number url="/screen">`. Untested end to end. | INFERENCE / OPEN QUESTION | https://developers.openai.com/api/docs/guides/realtime-sip |
| Telnyx | `<Dial><Sip>sip:ai@OURSUB.sip.telnyx.com</Sip></Dial>` into a TeXML app with `<AIAssistant>`. | Telnyx warm transfer would hairpin from Telnyx. Untested. | INFERENCE | https://developers.telnyx.com/docs/voice/programmable-voice/texml-verbs/aiassistant.md |
| Ultravox | Create call (`medium: {twilio:{}}`), return `<Connect><Stream url="joinUrl"/>`. | Cold transfer ends the AI call. Warm is DIY via conference. | FACT | https://docs.ultravox.ai/telephony/telephony-platforms.md ; https://docs.ultravox.ai/telephony/call-transfers.md |
| Deepgram VA | `<Connect><Stream>` to our own bridge server. | Fully DIY. | FACT | https://developers.deepgram.com/docs/twilio-and-deepgram-voice-agent.md |
| Bland | `<Dial>` over PSTN to a Bland number, or Enterprise SIP. | Warm transfer Enterprise-only. | FACT / INFERENCE | https://docs.bland.ai/enterprise-features/SIP-integration.md |

Guardrail for "never invent prices or dates" (INFERENCE):
- Prices and dates come only from tool results backed by Supabase.
- Stacks with a text hop (CR, LiveKit, Retell custom LLM) allow a deterministic pre-speech filter. It blocks any `$` amount or date not present in a tool result.
- Speech-to-speech stacks (OpenAI Realtime, Ultravox) rely on prompts and evals only.

---

## 4. Vendor summary

All-in per-minute figures exclude Amy's ring time and the transfer leg. Estimates are INFERENCE from the FACT unit prices cited.

| Vendor | Est. AI $/min (our topology) | Concurrency; behavior at limit | TS fit | 2026 incident highlights | Sources |
|---|---|---|---|---|---|
| Twilio CR | ~$0.087 ($0.0085 inbound + $0.07 CR + ~$0.008 LLM) | No number published; 64109 rejects on surges. | Node helper + samples; no TS CR SDK. We write the loop. | Aug 3: CR Deepgram STT "hard down" ~2h43m (Google STT fine). | https://www.twilio.com/en-us/voice/pricing/us ; https://status.twilio.com/incidents/r1sv7wjc2vq0 |
| Retell | ~$0.091 (inbound + $0.004 SIP + $0.055 + $0.015 TTS + $0.008 GPT 5 mini) | 20 free, $8/line; burst ×3 at +$0.10/min; ~40 s wait then fallback (number-based calls). Registered calls undocumented. | `retell-sdk` (TS); custom-telephony example is TS. | ~11 incidents, 20 min-2 h. Sep 16 ~22% of calls. | https://www.retellai.com/pricing ; https://docs.retellai.com/deploy/concurrency ; https://status.retellai.com/history.rss |
| LiveKit (Ship) | ~$0.045 + $50/mo (session + SIP minutes included to 5,000) | Ship 20, Scale 50→600. "new operations ... fail". No queue. | `@livekit/agents` 1.9.3 (Oct 15). Node WarmTransferTask (v1.5+). | 25 incidents Aug 6-Oct 20. Oct 16 SIP 69 min. Aug 17 failed SIP transfers ~60 min. | https://livekit.com/pricing ; https://docs.livekit.io/home/cloud/quotas-and-limits/ ; https://status.livekit.io/history.rss |
| Vapi | ~$0.10-0.14 + plan + $10/line | Free 4, Core 10. Fails immediately. | `@vapi-ai/server-sdk`. | Worst: Feb 23, Feb 25, May 21, Oct SIP. | https://vapi.ai/pricing ; https://status.vapi.ai/ |
| Pipecat Cloud | ~$0.03-0.04 + Twilio | 50/deployment; 429. ~10 s cold start. | Python server only. | Daily Feb 18 inbound SIP 4.4 h. No Pipecat Cloud status page found. | https://www.daily.co/pricing/pipecat-cloud/ ; https://status.daily.co/history.rss |
| OpenAI gpt-realtime-2.1 | ~$0.05-0.07 + Twilio SIP | TPM limits (200k at Build tier); `slow_down` 429. GPT-Live: 50/300/500 concurrent by tier. | `@openai/agents` 0.21.0. | Realtime/Audio listed Oct 21, Oct 6, Sep 17, Jul 25. | https://developers.openai.com/api/docs/pricing ; https://status.openai.com/history.rss |
| Telnyx | ~$0.06 (vendor) + Twilio legs; 60-s rounding | 500 on PAYG; behavior at limit undocumented. | `telnyx` npm 7.27.0, typed. | Aug 10 dead air / drops, all regions. | https://telnyx.com/pricing/conversational-ai ; https://status.telnyx.com/history |
| Ultravox | $0.05 + $0.005 SIP/stream | PAYG hard cap 5; Pro no hard cap but may 429. | REST; browser client only. | 4 incidents Feb-Apr. | https://www.ultravox.ai/pricing ; https://status.ultravox.ai/feed.rss |
| Deepgram VA | $0.075 (incl. LLM) + Twilio + Media Streams | 45 / 60; 100+ Enterprise. 429. | `@deepgram/sdk` typed; Twilio guide Python. | Flux TTS errors Sep 25, Oct 3, 5, 8, 14. | https://deepgram.com/pricing ; https://status.deepgram.com/history.rss |
| Bland | $0.12-0.14 | Start 10, Build 50 ($299), Scale 100 ($499, billing doc only). | REST; no typed SDK found. | Oct 19 inbound failing; Oct 14 agent silence. | https://www.bland.ai/pricing ; https://docs.bland.ai/platform/billing.md |
| ElevenLabs Agents | Openbenchmarks lists $0.0794/min | per elevenlabs.md | per elevenlabs.md | per elevenlabs.md | https://openbenchmarks.com/voice-agent-latency |

---

## 5. Weighted decision matrix

### 5.1 Weights

Tiers follow reliability > naturalness > speed > control > cost > novelty. "Speed" covers both latency and time to ship. One criterion was added: 2026 track record. It belongs to the reliability tier.

| # | Criterion | Tier | Weight | 5 means |
|---|---|---|---|---|
| 1 | Twilio integration (ring-Amy-first, we keep the number) | Reliability | 10 | Documented, native, no feature loss |
| 2 | Fallback control | Reliability | 9 | Every failure returns control to our TwiML fast |
| 3 | Concurrency / burst (20-100) | Reliability | 9 | 100 concurrent cheaply, defined behavior at limit |
| 4 | Tool reliability | Reliability | 9 | Typed tools, timeouts, auth, strong benchmark |
| 5 | 2026 track record (added) | Reliability | 8 | Few, short incidents on our path |
| 6 | Transfer quality | Reliability | 8 | Warm, screened, return-to-agent, in our topology |
| 7 | Human context handoff | Reliability | 7 | Summary/whisper to Amy before bridge |
| 8 | Test tooling | Reliability | 6 | Simulated calls, suites, CI |
| 9 | Observability | Reliability | 6 | Per-turn latency, traces, webhooks |
| 10 | Natural conversation | Naturalness | 7 | Top benchmark naturalness |
| 11 | Interruption | Naturalness | 6 | Top benchmark interruption + rich controls |
| 12 | Latency | Speed | 5 | Lowest independent latency |
| 13 | Implementation speed (1 TS engineer) | Speed | 5 | Days, all TypeScript |
| 14 | Code ownership | Control | 3 | Prompts, tools, loop in our repo |
| 15 | Lock-in (5 = least) | Control | 3 | Swap vendor in days |
| 16 | Cost | Cost | 2 | Cheapest at our volume incl. bursts |
| 17 | Voice cloning | Novelty | 1 | Custom voice supported |

Tier totals: reliability 72, naturalness 13, speed 10, control 6, cost 2, novelty 1. Sum 104.
Score = Σ(weight × cell) / (5 × 104) × 100.

### 5.2 Scores (1-5; all INFERENCE from evidence in 5.4)

| # | Criterion (w) | Twilio CR | Retell | LiveKit | Telnyx | Pipecat | OpenAI SIP | Ultravox | Vapi | Deepgram VA | Bland | ElevenLabs Agents |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Twilio integration (10) | 5 | 4 | 4 | 2 | 4 | 3 | 5 | 4 | 3 | 1 | per elevenlabs.md |
| 2 | Fallback control (9) | 4 | 4 | 4 | 3 | 3 | 3 | 4 | 3 | 4 | 2 | per elevenlabs.md |
| 3 | Concurrency (9) | 3 | 4 | 3 | 5 | 3 | 3 | 2 | 2 | 2 | 3 | per elevenlabs.md |
| 4 | Tool reliability (9) | 4 | 5 | 4 | 4 | 3 | 3 | 3 | 2 | 3 | 3 | 4 provisional (pass³ 69.5%) per elevenlabs.md |
| 5 | Track record (8) | 3 | 3 | 2 | 3 | 2 | 3 | 3 | 1 | 2 | 2 | per elevenlabs.md |
| 6 | Transfer quality (8) | 4 | 3 | 4 | 3 | 1 | 3 | 2 | 3 | 2 | 2 | per elevenlabs.md |
| 7 | Human context handoff (7) | 5 | 4 | 5 | 4 | 2 | 3 | 3 | 3 | 3 | 3 | per elevenlabs.md |
| 8 | Test tooling (6) | 2 | 4 | 4 | 4 | 4 | 1 | 1 | 5 | 1 | 5 | per elevenlabs.md |
| 9 | Observability (6) | 3 | 5 | 5 | 3 | 4 | 2 | 2 | 4 | 3 | 4 | per elevenlabs.md |
| 10 | Natural conversation (7) | 3 | 4 | 4 | 3 | 2 | 4 | 3 | 3 | 3 | 3 | 5 provisional (naturalness 4.47, best) per elevenlabs.md |
| 11 | Interruption (6) | 4 | 5 | 5 | 2 | 5 | 4 | 3 | 3 | 4 | 3 | 5 provisional (4.96) per elevenlabs.md |
| 12 | Latency (5) | 3 | 2 | 2 | 5 | 3 | 4 | 3 | 3 | 3 | 3 | 5 provisional (1.27 s mean, 1,424 ms p50) per elevenlabs.md |
| 13 | Implementation speed (5) | 2 | 4 | 3 | 3 | 1 | 3 | 4 | 4 | 2 | 3 | per elevenlabs.md |
| 14 | Code ownership (3) | 5 | 2 | 5 | 2 | 5 | 3 | 2 | 2 | 4 | 1 | per elevenlabs.md |
| 15 | Lock-in (3) | 5 | 2 | 4 | 3 | 5 | 2 | 2 | 2 | 4 | 1 | per elevenlabs.md |
| 16 | Cost (2) | 4 | 4 | 3 | 4 | 5 | 4 | 4 | 3 | 4 | 1 | per elevenlabs.md |
| 17 | Voice cloning (1) | 3 | 3 | 3 | 3 | 3 | 2 | 3 | 3 | 2 | 3 | per elevenlabs.md |
| | **Weighted /100** | **73.3** | **76.5** | **76.0** | **66.3** | **60.4** | **59.6** | **59.0** | **58.7** | **56.2** | **51.7** | not scored |

Voice-cloning cells are low-confidence. Voice cloning was not verified for any vendor in this pass (OPEN QUESTION). Weight 1 makes it immaterial.

### 5.3 Sensitivity

| Stack | Our weights | Equal weights | Reliability tier only | Without added track-record row |
|---|---|---|---|---|
| Retell | 76.5 (1) | 72.9 (2-3) | 79.7 (1) | 77.9 (2) |
| LiveKit | 76.0 (2) | 75.3 (1) | 76.7 (2) | 79.0 (1) |
| Twilio CR | 73.3 (3) | 72.9 (2-3) | 75.0 (3) | 74.4 (3) |
| Telnyx | 66.3 (4) | 65.9 (4) | 68.3 (4) | 66.9 (4) |
| Pipecat | 60.4 | 64.7 | 57.5 | 62.1 |
| OpenAI SIP | 59.6 | 58.8 | 55.0 | 59.6 |
| Ultravox | 59.0 | 57.6 | 58.3 | 59.0 |
| Vapi | 58.7 | 58.8 | 58.3 | 61.9 |
| Deepgram VA | 56.2 | 57.6 | 52.2 | 57.5 |
| Bland | 51.7 | 50.6 | 52.5 | 52.7 |

Read (INFERENCE):
- The top-3 set never changes. Telnyx is always 4th.
- Order inside the top 3 flips with weights. Gaps are 1-3 points. That is inside scoring noise.
- So the decision should come from the section 10 tests, not the matrix.

### 5.4 Per-cell evidence

#### Twilio ConversationRelay

| # | Score | Evidence | Label | Source |
|---|---|---|---|---|
| 1 | 5 | Native TwiML. `<Number url>` screen, `<Dial action>` fallback, `<Connect><ConversationRelay>`. | FACT | https://www.twilio.com/docs/voice/twiml/number ; https://www.twilio.com/docs/voice/twiml/connect/conversationrelay |
| 2 | 4 | `<Connect action>` gets `HandoffData`, `SessionStatus`. Unexpected WS drop: "we don't reconnect", call fails; docs say restore with new CR TwiML. Whether the action URL fires on a drop is unclear. | FACT / OPEN QUESTION | https://www.twilio.com/docs/voice/conversationrelay/websocket-messages |
| 3 | 3 | No published CR limit. 64109 rejects on "sudden surge". Inbound not CPS-limited. | FACT | https://www.twilio.com/docs/api/errors/64109 ; https://www.twilio.com/docs/glossary/cps |
| 4 | 4 | Tools run in our WS server: our timeouts, auth, Zod types. No benchmark. | FACT (architecture) / INFERENCE | https://www.twilio.com/docs/voice/conversationrelay |
| 5 | 3 | Aug 3 Deepgram STT hard down 2h43m. Sep 12 ~2.8 h errors (aggregator only). Twilio is in every stack's path anyway. | FACT / OPEN QUESTION | https://status.twilio.com/incidents/r1sv7wjc2vq0 |
| 6 | 4 | `end` → action URL → `<Dial><Number url=/whisper>`; no answer → new CR session. AI is off-line during the consult. | FACT / INFERENCE | https://www.twilio.com/docs/voice/conversationrelay/websocket-messages |
| 7 | 5 | Our code writes the summary. `<Number url>` speaks it to Amy before bridging. | FACT (TwiML) / INFERENCE | https://www.twilio.com/docs/voice/twiml/number |
| 8 | 2 | No native simulation or test suite found. We can unit-test our loop in Vitest. | OPEN QUESTION / INFERENCE | https://www.twilio.com/docs/voice/conversationrelay |
| 9 | 3 | Voice Insights CR summary splits Network/STT/Application/TTS latency. Advanced features $0.0024/min. No OTEL export. | FACT | https://www.twilio.com/docs/voice/voice-insights/conversation-relay-summary |
| 10 | 3 | ElevenLabs Flash voices. Not in any independent benchmark. | FACT / INFERENCE | https://www.twilio.com/docs/voice/twiml/connect/conversationrelay |
| 11 | 4 | `interruptSensitivity`, `ignoreBackchannel`, `speechTimeout`, Flux `eotThreshold`, `preemptible`. | FACT | https://www.twilio.com/docs/voice/twiml/connect/conversationrelay |
| 12 | 3 | p50 491 ms / p95 713 ms "internal benchmarks". Our LLM adds to this. | VENDOR CLAIM | https://www.twilio.com/en-us/products/conversational-ai/conversationrelay |
| 13 | 2 | We build the LLM loop, tool dispatch, guard, evals, transcript store, and run a WS host. | INFERENCE | n/a |
| 14 | 5 | Prompts, tools, LLM all in our repo. | INFERENCE | n/a |
| 15 | 5 | Only TwiML and the WS protocol are Twilio-specific. | INFERENCE | n/a |
| 16 | 4 | ~$0.087/min. Burst capacity has no list fee. | INFERENCE from FACT prices | https://www.twilio.com/en-us/voice/pricing/us |
| 17 | 3 | ElevenLabs is a TTS provider. Custom/cloned voice IDs unverified. | OPEN QUESTION | https://www.twilio.com/docs/voice/conversationrelay |

#### Retell (dial-to-SIP)

| # | Score | Evidence | Label | Source |
|---|---|---|---|---|
| 1 | 4 | Register Phone Call + `<Dial><Sip>`. Documented, TS example. Loses inbound webhook and native transfer. | FACT | https://docs.retellai.com/deploy/custom-telephony |
| 2 | 4 | Register is an API call before routing, so a 429 is visible before the caller is moved. SIP failure reaches our `<Dial action>`. | FACT (429 listed) / INFERENCE | https://docs.retellai.com/api-references/register-phone-call |
| 3 | 4 | 20 free, $8/line, burst ×3 at +$0.10/min. Registered-call behavior at limit undocumented. | FACT / OPEN QUESTION | https://docs.retellai.com/deploy/concurrency |
| 4 | 5 | Custom functions: timeout 1-600 s, `max_retry`, HMAC `X-Retell-Signature`, JSON Schema. Cekura pass³ 75.6% (best). | FACT | https://docs.retellai.com/build/single-multi-prompt/custom-function ; https://benchmarks.cekura.ai/voice-agent-workflows |
| 5 | 3 | ~11 incidents, mostly 20 min-2 h. May 2026 concurrency miscalculation (community post). | FACT | https://status.retellai.com/history.rss ; https://community.retellai.com/t/calls-returning-concurrency-limit-reached/2859 |
| 6 | 3 | Native warm/agentic/whisper transfers unavailable on dial-to-SIP. DIY via Twilio REST works. | FACT / INFERENCE | https://docs.retellai.com/deploy/custom-telephony |
| 7 | 4 | The custom function can carry an LLM-written summary. We speak it via `<Number url>`. | INFERENCE | https://docs.retellai.com/build/single-multi-prompt/custom-function |
| 8 | 4 | Test cases, batch tests, `POST /create-batch-test` for CI. Text-only. Custom-LLM agents can't be simulated. | FACT | https://docs.retellai.com/test/batch-test-simulation |
| 9 | 5 | Per-call latency e2e/asr/llm/tts with p50-p99, public log URL, webhooks. | FACT | https://docs.retellai.com/api-references/get-call |
| 10 | 4 | Cekura naturalness 4.36 (2nd tier). | FACT | https://benchmarks.cekura.ai/voice-agent-workflows |
| 11 | 5 | Cekura interruption 5.00 (best). `interruption_sensitivity`, backchannel controls. | FACT | https://benchmarks.cekura.ai/voice-agent-workflows ; https://docs.retellai.com/api-references/create-agent |
| 12 | 2 | Openbenchmarks p50 1,740 ms (slowest of 5). Cekura mean 2.21 s. | FACT | https://openbenchmarks.com/voice-agent-latency |
| 13 | 4 | Hosted agent. We build webhook, register call, tools, DIY transfer. | INFERENCE | n/a |
| 14 | 2 | Agent config lives in Retell. Custom LLM WS is possible but loses simulation tests. | FACT / INFERENCE | https://docs.retellai.com/test/batch-test-simulation |
| 15 | 2 | Proprietary agent JSON. No export feature documented. | INFERENCE | https://docs.retellai.com/api-references/create-agent |
| 16 | 4 | ~$0.091/min, $0 fixed. | INFERENCE from FACT prices | https://www.retellai.com/pricing |
| 17 | 3 | ElevenLabs/Cartesia voices listed. Cloning unverified. | FACT / OPEN QUESTION | https://www.retellai.com/pricing |

#### LiveKit Agents (Node) + LiveKit Cloud

| # | Score | Evidence | Label | Source |
|---|---|---|---|---|
| 1 | 4 | `<Dial><Sip>` from a webhook is documented. That path "doesn't support SIP REFER". | FACT | https://docs.livekit.io/telephony/accepting-calls/inbound-twilio.md |
| 2 | 4 | Quota hit: "new operations ... fail". Turn detector falls back to local model. SIP failure reaches our `<Dial action>`. | FACT | https://docs.livekit.io/home/cloud/quotas-and-limits/ |
| 3 | 3 | Ship 20 sessions, 20 Inference connections. Scale 50, up to 600 ($500/mo). | FACT | https://livekit.com/pricing |
| 4 | 4 | Tools are TS functions in our agent. Cekura pass³ 70.7%, task completion 95.1%. | FACT | https://github.com/livekit/agents-js ; https://benchmarks.cekura.ai/voice-agent-workflows |
| 5 | 2 | 25 incidents in ~11 weeks. Oct 16 SIP 69 min. Aug 17 failed SIP transfers ~60 min. | FACT | https://status.livekit.io/history.rss |
| 6 | 4 | Node `WarmTransferTask` (v1.5+, stable). Ringing timeout: "the caller conversation resumes". Needs outbound trunk. Decline path not stated. | FACT / OPEN QUESTION | https://docs.livekit.io/agents/prebuilt/tasks/warm-transfer/ |
| 7 | 5 | Human gets conversation history (`chatCtx`); transfer agent "summarizes the call". | FACT | https://docs.livekit.io/telephony/features/transfers/warm.md |
| 8 | 4 | Vitest unit tests; LLM-simulated callers with judge and `--pass-rate`. | FACT | https://docs.livekit.io/agents/build/testing/ ; https://docs.livekit.io/testing/simulations/ |
| 9 | 5 | OTel spans per turn (`eou_wait`, `llm_node`, `tts_node`), Node supported. Cloud-only. | FACT | https://docs.livekit.io/deploy/observability/ |
| 10 | 4 | Cekura naturalness 4.36. | FACT | https://benchmarks.cekura.ai/voice-agent-workflows |
| 11 | 5 | Cekura 4.97. Adaptive interruption, `minWords`, false-interruption resume. | FACT | https://docs.livekit.io/agents/build/turns/ |
| 12 | 2 | Cekura mean response 2.59 s (2nd slowest). Not in Openbenchmarks. | FACT | https://benchmarks.cekura.ai/voice-agent-workflows |
| 13 | 3 | TS SDK 1.9.3. We also set up SIP trunks, dispatch rules, Cloud deploy. | FACT / INFERENCE | https://github.com/livekit/agents-js/releases |
| 14 | 5 | Agent code is ours. Apache-2.0. | FACT | https://github.com/livekit/agents-js/blob/main/LICENSE |
| 15 | 4 | Self-hostable server. Observability and hosted turn detection tie to Cloud. | FACT / INFERENCE | https://livekit.com/pricing |
| 16 | 3 | ~$0.045/min + $50/mo. Bursts need Scale $500/mo. | INFERENCE from FACT prices | https://livekit.com/pricing |
| 17 | 3 | Cartesia/ElevenLabs via plugins; cloning unverified. | OPEN QUESTION | https://livekit.com/pricing/inference |

#### Telnyx AI Assistants

| # | Score | Evidence | Label | Source |
|---|---|---|---|---|
| 1 | 2 | SIP subdomain "from anyone". No TLS on subdomain calls. No Twilio-source doc. | FACT / OPEN QUESTION | https://developers.telnyx.com/api-reference/texml-applications/creates-a-texml-application.md |
| 2 | 3 | TeXML `<Connect action>` returns `Reason`. Limit behavior undocumented. | FACT / OPEN QUESTION | https://developers.telnyx.com/docs/voice/programmable-voice/texml-verbs/aiassistant.md |
| 3 | 5 | "500 concurrent calls" on PAYG. | FACT | https://telnyx.com/pricing/conversational-ai |
| 4 | 4 | Webhook tools, async, test API. Cekura task completion 97.6%, pass³ 68.3%. | FACT | https://developers.telnyx.com/docs/inference/ai-assistants/no-code-voice-assistant |
| 5 | 3 | Aug 10 dead air/drops all regions. History before late July not visible. | FACT / OPEN QUESTION | https://status.telnyx.com/history |
| 6 | 3 | Native warm transfer with accept/decline and return-to-agent. Fronted by Twilio it hairpins. | FACT / INFERENCE | https://developers.telnyx.com/docs/inference/ai-assistants/warm-transfer-acceptance.md |
| 7 | 4 | `warm_transfer_instructions` handoff message. | FACT | same |
| 8 | 4 | AI Tests, versions, canary splits. | FACT | https://developers.telnyx.com/docs/inference/ai-assistants/version-testing-traffic-distribution.md |
| 9 | 3 | Event stream WS. No per-turn latency fields. | FACT | https://developers.telnyx.com/docs/inference/ai-assistants/conversation-event-stream.md |
| 10 | 3 | Cekura naturalness 4.21. | FACT | https://benchmarks.cekura.ai/voice-agent-workflows |
| 11 | 2 | Cekura interruption 4.63 (lowest of 8). | FACT | same |
| 12 | 5 | Openbenchmarks p50 1,296 ms (best). Cekura mean 1.82 s. | FACT | https://openbenchmarks.com/voice-agent-latency |
| 13 | 3 | Typed SDK; cross-carrier SIP must be proven. | FACT / INFERENCE | https://developers.telnyx.com/docs/development/sdk/node.md |
| 14 | 2 | Assistant config proprietary. | INFERENCE | n/a |
| 15 | 3 | Imports from Vapi/ElevenLabs/Retell; number stays on Twilio. | FACT / INFERENCE | https://developers.telnyx.com/docs/inference/ai-assistants/importing.md |
| 16 | 4 | ~$0.06/min + Twilio legs; 60-s rounding. | FACT / VENDOR CLAIM | https://telnyx.com/pricing/conversational-ai |
| 17 | 3 | Unverified. | OPEN QUESTION | n/a |

#### Rejected stacks (condensed per-cell evidence)

| Stack | Cell scores 1-17 | Key evidence | Label | Sources |
|---|---|---|---|---|
| Pipecat | 4,3,3,3,2,1,2,4,4,2,5,3,1,5,5,5,3 | `<Connect><Stream>` to Pipecat Cloud. No transfers on Twilio WS. 50/deployment then 429. Python-only server. Evals + OTel strong. Cekura pass³ 63.4%, naturalness 3.74, interruption 4.97, mean 1.97 s. BSD-2. $0.01/min hosting. | FACT | https://docs.pipecat.ai/pipecat/telephony/overview ; https://docs.pipecat.ai/deployment/pipecat-cloud/fundamentals/scaling ; https://github.com/pipecat-ai/pipecat ; https://benchmarks.cekura.ai/voice-agent-workflows |
| OpenAI SIP | 3,3,3,3,3,3,3,1,2,4,4,4,3,3,2,4,2 | `<Dial><Sip>` path undocumented. `/refer` exists. 429 + `slow_down`. No eval tooling. Cekura pass³ 64.6%, naturalness 4.25, interruption 4.98, mean 1.58 s. ZDR eligible. | FACT / OPEN QUESTION | https://developers.openai.com/api/docs/guides/realtime-sip ; https://developers.openai.com/api/docs/guides/rate-limits ; https://developers.openai.com/api/docs/guides/your-data |
| Ultravox | 5,4,2,3,3,2,3,1,2,3,3,3,4,2,2,4,3 | Cleanest Twilio fit (REST + `<Connect><Stream>`). PAYG cap 5; 429 at create. Cold transfer ends AI call. Testing "Under Construction". No benchmark. | FACT | https://docs.ultravox.ai/telephony/telephony-platforms.md ; https://docs.ultravox.ai/gettingstarted/concurrency.md ; https://docs.ultravox.ai/telephony/call-transfers.md |
| Vapi | 4,3,2,2,1,3,3,5,4,3,3,3,4,2,2,3,3 | Provider bypass works. Fails immediately at limit. Best evals/simulations with CI example. Cekura pass³ 59.8%, infra-clean 82.9%, mean 3.08 s. Worst incident record. | FACT | https://docs.vapi.ai/calls/call-handling-with-vapi-and-twilio ; https://docs.vapi.ai/test/test-suites ; https://status.vapi.ai/ |
| Deepgram VA | 3,4,2,3,2,2,3,1,3,3,4,3,2,4,4,4,2 | DIY bridge. 45/60 cap. No transfer. Client-side `LatencyReport`. Retains data by default. No benchmark. | FACT | https://developers.deepgram.com/docs/voice-agent-observability.md ; https://developers.deepgram.com/trust-security/your-data.md |
| Bland | 1,2,3,3,2,2,3,5,4,3,3,3,3,1,1,1,3 | PSTN forward or Enterprise SIP. Warm transfer Enterprise-only. Rich evals/canary. Openbenchmarks p50 1,520 ms. Highest price, highest lock-in. | FACT | https://docs.bland.ai/enterprise-features/SIP-integration.md ; https://docs.bland.ai/agents/evaluations.md ; https://openbenchmarks.com/voice-agent-latency |
| ElevenLabs Agents | per elevenlabs.md | Openbenchmarks p50 1,424 ms, p95 1,768 ms. Cekura pass³ 69.5%, task completion 91.5%, infra-clean 100%, interruption 4.96, naturalness 4.47 (best), mean 1.27 s (fastest). | FACT | https://openbenchmarks.com/voice-agent-latency ; https://benchmarks.cekura.ai/voice-agent-workflows |

---

## 6. Monthly cost model: top 3 stacks

### 6.1 Unit prices

| Item | Unit price | Label | Source |
|---|---|---|---|
| Twilio inbound, US local | $0.0085/min | FACT | https://www.twilio.com/en-us/voice/pricing/us |
| Twilio SIP interface (`<Dial><Sip>` leg) | $0.0040/min | FACT | same |
| Twilio ConversationRelay | $0.07/min | FACT | https://www.twilio.com/en-us/products/conversational-ai/pricing |
| Twilio local number | $1.15/mo | FACT | https://www.twilio.com/en-us/voice/pricing/us |
| Twilio outbound (leg to Amy) | $0.014/min | FACT | same |
| OpenAI gpt-5-mini | $0.25 in / $0.025 cached / $2.00 out per 1M tokens | FACT | https://developers.openai.com/api/docs/pricing |
| Retell voice infra | $0.055/min | FACT | https://www.retellai.com/pricing |
| Retell TTS (platform/Cartesia) | $0.015/min (ElevenLabs Flash $0.04) | FACT | same |
| Retell LLM GPT 5 mini | $0.008/min | FACT | same |
| Retell custom telephony | $0 | FACT | same |
| Retell extra concurrency | $8/line/mo | FACT | same |
| Retell burst surcharge | +$0.10/min on over-limit calls | FACT | https://docs.retellai.com/deploy/concurrency |
| LiveKit Ship | $50/mo; 5,000 agent-session min + 5,000 third-party SIP min included; then $0.01 / $0.004 | FACT | https://livekit.com/pricing |
| LiveKit Scale | $500/mo; 50,000 min included | FACT | same |
| LiveKit Inference STT Nova-3 | $0.0048/min | FACT | https://livekit.com/pricing/inference |
| LiveKit Inference TTS Cartesia Sonic 3 | $50 per 1M characters | FACT | same |
| LiveKit Inference gpt-5-mini | $0.25 / $2.00 per 1M | FACT | same |
| Cartesia audio density | "750-800 credits" (characters) per audio minute | FACT | https://cartesia.ai/pricing |
| Deepgram Nova-3 (CR sensitivity) | $0.0048/min (promotional) | FACT | https://deepgram.com/pricing |
| ElevenLabs Flash (CR sensitivity) | $0.04 per 1K characters | FACT | https://elevenlabs.io/pricing/api |
| Fly.io shared-cpu-1x 512 MB (CR socket host) | $3.69/mo | FACT | https://docs.fly.io/about/pricing |

### 6.2 Assumptions (INFERENCE)

- `m` = AI minutes per month.
- LLM: $0.008/min for gpt-5-mini. This is Retell's list price for the same model. Our own token estimate is lower (~$0.004: 4 turns/min × 4,000 input tokens, 75% cached, 300 output tokens).
- TTS characters: agent talks 50% of the time × 775 chars/min = 388 chars per AI minute.
- LiveKit TTS = 388 × $50/1M = $0.0194/min.
- Excluded for all stacks: Amy ring time, transfer leg ($0.014/min), recording ($0.0025/min), SMS, platform baseline (section 8).

### 6.3 Formulas

| Stack | Variable $/min | Fixed $/mo | Formula |
|---|---|---|---|
| Twilio CR | 0.0085 + 0.07 + 0.008 = **0.0865** | 3.69 (Fly) | 0.0865·m + 3.69 |
| Retell | 0.0085 + 0.004 + 0.055 + 0.015 + 0.008 + 0 = **0.0905** | 0 | 0.0905·m |
| LiveKit Ship | 0.0085 + 0.004 + 0.0048 + 0.0194 + 0.008 = **0.0447** (LK session and SIP minutes included ≤ 5,000) | 50 | 0.0447·m + 50 |

### 6.4 Results (normal concurrency)

| AI min/mo | Twilio CR | Retell | LiveKit Ship |
|---|---|---|---|
| 100 | $12.34 | $9.05 | $54.47 |
| 500 | $46.94 | $45.25 | $72.35 |
| 1,000 | $90.19 | $90.50 | $94.70 |
| 5,000 | $436.19 | $452.50 | $273.50 |

### 6.5 Burst capacity for ~100 simultaneous calls (peak months)

| Stack | Extra cost | How | Label | Source |
|---|---|---|---|---|
| Twilio CR | $0 list | Approved Business Primary Customer Profile. Ask Twilio to confirm CR headroom (64109). Maybe Fly 1 GB ($6.70). | FACT / OPEN QUESTION | https://www.twilio.com/docs/api/errors/10004 ; https://www.twilio.com/docs/api/errors/64109 |
| Retell | Option A: 80 lines × $8 = $640/mo. Option B: 14 lines × $8 = $112/mo (base 34 → burst limit 102) + $0.10/min on minutes above 34. | Burst limit = min(3× base, base+300). Registered-call behavior unverified. | FACT (rule) / INFERENCE (math) | https://docs.retellai.com/deploy/concurrency |
| LiveKit | +$450/mo (Scale $500 instead of Ship $50). | Scale starts at 50 concurrent; raise via dashboard up to 600. | FACT | https://livekit.com/pricing |

Peak month at 1,000 AI min with 100-call burst capacity (INFERENCE):
- CR ≈ $90.19.
- Retell ≈ $90.50 + $112 = $202.50, plus burst surcharge on overflow minutes.
- LiveKit Scale ≈ 0.0447 × 1,000 + 500 = $544.70.

### 6.6 Sensitivity

| Case | Effect | Label |
|---|---|---|
| CR STT/TTS billed separately (Nova-3 + ElevenLabs Flash) | +$0.0203/min → CR $0.1068/min: $14.37 / $57.09 / $110.49 / $537.69 | OPEN QUESTION (inclusion) / INFERENCE (math) |
| Retell with ElevenLabs Flash voice ($0.04) | $0.1155/min: $11.55 / $57.75 / $115.50 / $577.50 | FACT (price) / INFERENCE |
| LLM at our own estimate ($0.004) | −$0.004/min on CR and LiveKit | INFERENCE |

---

## 7. Post-call orchestration (not the speech loop)

Pipeline: transcript → extract → confidence checks → score → task → notify Amy → attribution → follow-up timers.

### 7.1 Comparison

| Tool | Durability | Retries / idempotency | Timers / HITL | Cost at 400-2,000 runs/mo | Next.js fit | License | Sources |
|---|---|---|---|---|---|---|---|
| **Vercel Workflow** | Event log; "replays execution deterministically". GA 2026-04-16. | 3 retries/step; `FatalError`, `RetryableError`; stable `stepId` key. No atomic dedupe on `start()`. | `sleep()` no max; hooks; race hook vs sleep. | ~$1-3 (≈56 events/run × $0.02/1K) on top of Pro | Native: same repo, same deploy | Apache-2.0 | https://vercel.com/docs/workflows/concepts ; https://vercel.com/docs/workflows/pricing ; https://workflow-sdk.dev/docs/foundations/idempotency |
| Inngest | Step memoization + replay | 4 retries/step; event id and function idempotency keys (24 h) | `step.sleep` up to 1 yr; `waitForEvent` with match; `cancelOn` | $0 (Free 50k executions; we need ~6.4k-38k) | Strong (`/api/inngest` + Vercel integration) | SDK Apache-2.0; server SSPL | https://www.inngest.com/pricing ; https://www.inngest.com/docs/learn/how-functions-are-executed |
| Trigger.dev | CRIU checkpoint; retry restarts task, subtasks cached | Idempotency keys, 30-day TTL | `wait.for/until`; waitpoint tokens | ~$1-5 | Runs on Trigger.dev infra; second deploy | Apache-2.0 | https://trigger.dev/docs/how-it-works ; https://trigger.dev/pricing |
| Temporal TS | Event-sourced replay; strict determinism | Activity retries; workflow ID dedupe | Durable timers; signals/updates | ~$0.44-2.20 Cloud + worker host | Poor: workers can't run on Vercel | MIT | https://docs.temporal.io/cloud/pricing ; https://docs.temporal.io/evaluate/serverless-workers |
| LangGraph JS | Checkpoint per super-step; no auto-resume | Opt-in node `retryPolicy`; no idempotency guidance | No durable sleep; `interrupt()` "waits indefinitely" | $0 lib + a scheduler; Platform ~$39 (Plus seat) | Library fits in a function | MIT lib; self-hosted server needs Enterprise | https://docs.langchain.com/oss/javascript/langgraph/interrupts ; https://www.langchain.com/pricing ; https://docs.langchain.com/langsmith/deploy-to-self-hosted-overview |
| OpenAI Agents SDK | None built in | None | Tool approvals; serialize `RunState` | $0 lib | Library only | MIT (0.21.0, pre-1.0) | https://openai.github.io/openai-agents-js/guides/human-in-the-loop/ |

### 7.2 Recommendation

Use **Vercel Workflow** with plain typed LLM calls (structured outputs + Zod). Runner-up: **Inngest**. (INFERENCE)

| Pipeline stage | Implementation | Label |
|---|---|---|
| Start | Call-ended webhook inserts `calls(call_sid UNIQUE)` in Supabase. Start the run only on a fresh insert. This covers the missing dedupe. | INFERENCE (gap is FACT: https://workflow-sdk.dev/docs/api-reference/workflow-api/start) |
| Extract | One `'use step'` LLM call with a Zod schema and per-field confidence. | INFERENCE |
| Confidence checks, score | Plain TypeScript. Low confidence flags the lead for Amy. | INFERENCE |
| Task, notify Amy | Steps. Use `stepId` as the idempotency key for SMS/email. | FACT (pattern): https://workflow-sdk.dev/docs/foundations/idempotency |
| Attribution | Step matching call time to ad-burst windows. | INFERENCE |
| Timers | Race a "callback logged" hook against `sleep('2h')` → re-notify. `sleep('3 days')` → follow-up. | FACT (pattern): https://workflow-sdk.dev/docs/foundations/hooks |

Choose Inngest instead if we want first-class `cancelOn`, `waitForEvent` with match, debounce or throttle. Free trace history is only 24 h. (FACT: https://www.inngest.com/pricing)

### 7.3 Does LangGraph earn its place?

**No.** (INFERENCE from the FACTs below.)

| Point | Label | Source |
|---|---|---|
| The pipeline is a fixed sequence, not an agent loop. | INFERENCE | n/a |
| No durable sleep in the OSS library. Platform cron is recurring only. | FACT | https://docs.langchain.com/langsmith/cron-jobs |
| Crash recovery means re-invoking with the same `thread_id`. Nothing restarts it for us. | FACT | https://docs.langchain.com/oss/javascript/langgraph/fault-tolerance |
| `interrupt()` waits indefinitely. No timeout. | FACT | https://docs.langchain.com/oss/javascript/langgraph/interrupts |
| Self-hosting the server requires an Enterprise plan. | FACT | https://docs.langchain.com/langsmith/deploy-to-self-hosted-overview |
| It can run inside one durable step. A retry then re-runs the whole graph unless we add PostgresSaver keyed by `call_id`. Only worth it if a stage becomes a real agent loop. | INFERENCE | https://docs.langchain.com/oss/javascript/langgraph/checkpointers |

---

## 8. Platform costs

| Platform | Choice | Key facts | Fixed $/mo | Label | Sources |
|---|---|---|---|---|---|
| Vercel | Pro, pin `iad1` | Hobby is non-commercial only. Pro $20 incl. 1 seat + $20 usage credit. Fluid max duration Pro 800 s (1,800 s beta), Hobby 300 s. Pro 5 regions. Pro cron per minute. WebSockets Public Beta since 2026-06-22. Spend-limit pause takes all projects offline: use alerts only. | 20 | FACT / INFERENCE | https://vercel.com/docs/limits/fair-use-guidelines ; https://vercel.com/docs/plans/pro-plan ; https://vercel.com/docs/functions/limitations ; https://vercel.com/docs/spend-management |
| Supabase | Pro, Micro, us-east-1 | Free pauses after 7 days of low activity. Pro $25 incl. $10 compute credit (Micro). Micro: 60 direct, 200 pooler clients. Pro: 7-day daily backups. PITR ~$100/mo for 7 days and needs Small compute. Spend cap on by default. SOC2/HIPAA Team ($599) and up. | 25 | FACT | https://supabase.com/pricing ; https://supabase.com/docs/guides/platform/compute-and-disk ; https://supabase.com/docs/guides/platform/backups |
| Sentry | Developer (free) | 5k errors, 5M spans, 50 replays, 1 user, 30-day lookback. Team $29/mo. `@sentry/nextjs` supports Next.js 14+. | 0 | FACT | https://sentry.io/pricing/ ; https://docs.sentry.io/platforms/javascript/guides/nextjs/ |
| OpenTelemetry | `@vercel/otel` → Grafana Cloud Free or Honeycomb Free | `instrumentation.ts` + `registerOTel`. Vercel trace drains are Pro-only at $0.50/GB. Grafana Free: 50 GB traces, 14-day retention. Honeycomb Free: 20M events/mo. | 0 | FACT | https://nextjs.org/docs/app/guides/open-telemetry ; https://vercel.com/docs/drains ; https://grafana.com/pricing/ ; https://www.honeycomb.io/pricing |
| Resend | Free off-season; Pro in peak | Free: 3,000/mo, 100/day, 3 domains, 10 req/s. Pro $20 for 50k. | 0 / 20 | FACT | https://resend.com/pricing ; https://resend.com/docs/knowledge-base/account-quotas-and-limits |
| Twilio SMS + 10DLC | Low-Volume Standard brand + low-volume mixed campaign | SMS $0.0083/segment + carrier fee $0.0035-0.005. Brand $4.50 + vetting $15 one-time. Campaign $1.50/mo. | 1.50 | FACT | https://www.twilio.com/en-us/sms/pricing/us ; https://support.twilio.com/hc/en-us/articles/1260803965530-Pricing-and-Fees-for-A2P-10DLC-Service |
| Twilio number | US local | $1.15/mo | 1.15 | FACT | https://www.twilio.com/en-us/voice/pricing/us |
| Socket host (CR only) | Fly.io shared-cpu-1x 512 MB, iad | $3.69/mo. Alternatives: Render $7 (no max WS duration), Railway Hobby $5. | 3.69 | FACT | https://docs.fly.io/about/pricing ; https://render.com/docs/websocket ; https://docs.railway.com/networking/public-networking/specs-and-limits |

Baseline (INFERENCE): ~$47.65/mo off-season. ~$67.65/mo in peak with Resend Pro. Add $3.69 for the CR stack. Excludes usage.

---

## 9. Independent benchmarks

| Benchmark | Operator and conflicts | Method | Date | Label | Source |
|---|---|---|---|---|---|
| Openbenchmarks voice-agent latency | "Backed by Y Combinator". "We sell evals as a service, and many partners are also customers." Telnyx cites it in marketing. | 550 PSTN calls, ~430 turns per platform, TTFAB from recordings. Vendor-default stacks. | Generated 2026-08-01 | FACT | https://openbenchmarks.com/voice-agent-latency ; https://openbenchmarks.com/about |
| Cekura voice-agent workflows | Sells voice-agent QA. Lists LiveKit, Pipecat, ElevenLabs, Cartesia, Retell, Vapi as partners. | 8 configs × 82 scenarios × 3 runs. Providers chose their own settings. pass³ = all 3 runs pass. | "Last updated Oct 12, 2026" | FACT | https://benchmarks.cekura.ai/voice-agent-workflows ; https://www.cekura.ai/ |

| Platform | OB p50 / p95 ms | Cekura pass³ | Task completion | Infra clean | Interruption /5 | Naturalness /5 | Mean response |
|---|---|---|---|---|---|---|---|
| Retell | 1,740 / 2,259 | 75.6% | 93.9 | 98.4 | 5.00 | 4.36 | 2.21 s |
| LiveKit | n/a | 70.7% | 95.1 | 99.2 | 4.97 | 4.36 | 2.59 s |
| ElevenLabs | 1,424 / 1,768 | 69.5% | 91.5 | 100.0 | 4.96 | 4.47 | 1.27 s |
| Telnyx | 1,296 / 1,856 | 68.3% | 97.6 | 100.0 | 4.63 | 4.21 | 1.82 s |
| GPT Realtime | n/a | 64.6% | 92.7 | 95.5 | 4.98 | 4.25 | 1.58 s |
| Pipecat | n/a | 63.4% | 94.2 | 97.2 | 4.97 | 3.74 | 1.97 s |
| Vapi | 1,558 / 2,008 | 59.8% | 97.6 | 82.9 | 4.73 | 4.08 | 3.08 s |
| Bland | 1,520 / 2,248 | n/a | n/a | n/a | n/a | n/a | n/a |
| Gemini Live | n/a | 30.5% | 87.8 | 72.4 | 4.97 | n/a | 3.05 s |

All FACT from the two URLs above. Neither benchmark covers Twilio CR, Deepgram VA or Ultravox. Openbenchmarks' Vapi row (382/432 usable) conflicts with its own methodology text (FACT).

---

## 10. Open questions and prove-it tests

### 10.1 Tests to run before committing (INFERENCE)

| Stack | Test | Pass condition |
|---|---|---|
| All | Submit and get approval for the Twilio Business Primary Customer Profile. | No 10004 at 25+ concurrent test calls. |
| Retell | `/after-amy` → register-phone-call → `<Dial><Sip>`. | Agent answers < 2 s after Amy's timeout. |
| Retell | DIY transfer: custom function → Twilio `calls(sid).update` → `<Dial><Number url=/whisper>`. Amy declines → re-register with context. | Caller never dropped. Amy hears summary. |
| Retell | Exceed concurrency with registered calls. | Clear 429 or fast SIP failure → our fallback. |
| LiveKit | `<Dial><Sip>` from `/after-amy`. Node `WarmTransferTask` over a Twilio Elastic outbound trunk. Amy declines. | Caller returns to agent on decline and on timeout. |
| LiveKit | 21st call on Ship. | Fast SIP failure → our fallback. |
| Twilio CR | Kill the WS mid-call. | `<Connect action>` fires and a new CR session resumes. |
| Twilio CR | Ask Twilio: CR concurrency limit; whether $0.07 includes STT/TTS. | Written answer. |
| All | 50 scripted calls with price/date bait questions. | Zero invented prices or dates. |

### 10.2 Unverified items

| Item | Label | Where checked |
|---|---|---|
| Numeric CR concurrency limit behind 64109. | OPEN QUESTION | https://www.twilio.com/docs/api/errors/64109 |
| Whether CR's $0.07 includes Deepgram/ElevenLabs cost. | OPEN QUESTION | https://www.twilio.com/en-us/products/conversational-ai/pricing |
| Whether `<Connect action>` fires on an unexpected CR WebSocket drop. | OPEN QUESTION | https://www.twilio.com/docs/voice/conversationrelay/websocket-messages |
| Exact Twilio account-concurrency numbers (help article returned 403). | OPEN QUESTION | https://support.twilio.com/hc/en-us/articles/223180028 |
| Retell concurrency behavior for registered calls; whether Retell emits REFER on dial-to-SIP. | OPEN QUESTION | https://docs.retellai.com/deploy/custom-telephony |
| LiveKit warm transfer on decline (timeout path is documented). Whether LiveKit REFER reaches Twilio `referUrl` on the TwiML path. | OPEN QUESTION | https://docs.livekit.io/agents/prebuilt/tasks/warm-transfer/ |
| Whether LiveKit lets us switch Ship ↔ Scale month to month. | OPEN QUESTION | https://livekit.com/pricing |
| Vapi transfers on bypass calls; tool timeout; whether importing a number rewrites its webhook. | OPEN QUESTION | https://docs.vapi.ai/calls/call-handling-with-vapi-and-twilio |
| OpenAI `<Dial><Sip>` with SRTP from Twilio; HIPAA page (403); SIP fee. | OPEN QUESTION | https://developers.openai.com/api/docs/guides/voice-sip |
| Telnyx behavior at concurrency limit; incidents before late July 2026. | OPEN QUESTION | https://status.telnyx.com/history |
| Voice cloning support for every vendor. | OPEN QUESTION | not researched |
| Full Twilio 2026 incident history (JS-rendered page). | OPEN QUESTION | https://status.twilio.com/history |
| Hume EVI, Sierra, Synthflow not evaluated (search budget). Cartesia Line only priced ($0.06/min agent). | OPEN QUESTION | https://docs.cartesia.ai/pricing.md |
| Inngest: do sleeps/waits bill as executions? Vercel Pro included credit vs Workflow meters. | OPEN QUESTION | https://www.inngest.com/pricing ; https://vercel.com/docs/workflows/pricing |
| Sentry free-quota reset period. Axiom free-plan commercial terms. Fly WebSocket support in current docs. | OPEN QUESTION | https://sentry.io/pricing/ ; https://axiom.co/pricing ; https://fly.io/blog/websockets-and-fly/ |

---

# Appendices: raw evidence

Each appendix is the researcher's evidence table, one claim per row, with label and URL. Gathered 2026-10-22.


## Appendix A. Twilio ConversationRelay, Vapi, Retell


Researched 2026-10-22. Primary sources only. Labels:
FACT = read on an official page. VENDOR CLAIM = vendor self-reported performance or marketing.
INFERENCE = my reasoning. OPEN QUESTION = could not verify.
"(snippet)" = text came from a search-result summary of the official page; the page itself was not opened.

Corrections vs 2026-10-20 notes:
- Twilio: prices unchanged. Default STT is now **Deepgram** (Google only for accounts that used CR before 2025-09-12). Google, Amazon Polly and ElevenLabs TTS listed. A **CR concurrency rejection error (64109)** exists.
- Retell: prices unchanged. New details: **burst mode** (+$0.10/min), a ~40 s inbound wait-then-fallback, and **no built-in transfer on dial-to-SIP calls**.
- Vapi: the free "No Success Package" plan now includes **4** concurrent calls, not 10. Core is $29/mo with 10. Extra lines cost $10/line/mo. HIPAA costs $2,000/mo.

---

### 1. Twilio ConversationRelay (CR)

| Field | Finding | Label | Source URL |
|---|---|---|---|
| Price: CR | $0.07/min. | FACT | https://www.twilio.com/en-us/voice/pricing/us ("Pricing current as of August 2026") |
| Price: inbound | $0.0085/min local inbound. Local number $1.15/mo. | FACT | same |
| Price: STT/TTS | No separate STT/TTS line items for CR. Possibly bundled in the $0.07, but nothing says so. | INFERENCE / OPEN QUESTION | same; https://www.twilio.com/docs/voice/conversationrelay/voice-configuration (no pricing text) |
| Price: LLM | BYO. You call OpenAI/Anthropic yourself and pay them directly. | FACT (architecture) | https://www.twilio.com/docs/voice/conversationrelay |
| Free tier | Trial account only. No CR-specific credits found. | OPEN QUESTION | https://www.twilio.com/en-us/products/conversational-ai/conversationrelay |
| Plan minimum | None. Pay as you go. | FACT | https://www.twilio.com/en-us/voice/pricing/us |
| STT providers | Deepgram (default; `nova-3-general` or `nova-2-general`; `flux` supports `eotThreshold`). Google (`telephony`). | FACT | https://www.twilio.com/docs/voice/twiml/connect/conversationrelay (dateModified 2026-09-30) |
| TTS providers | ElevenLabs (default; Flash 2/2.5), Google, Amazon Polly. | FACT | same; https://www.twilio.com/docs/voice/conversationrelay |
| Concurrency: CR | No numeric limit documented. Error **64109**: "The call was rejected because the maximum number of concurrent sessions was temporarily reached." Cause given: "sudden surge in call volume." Fix: retry, or contact Support if it recurs. | FACT | https://www.twilio.com/docs/api/errors/64109 (2026-09-30) |
| Concurrency: account | Error **10004**: a new call would exceed the account's active-call limit. Inbound and outbound calls both count. Trial accounts, and some upgraded accounts without an approved Primary Customer Profile, have reduced concurrency. An approved **Business** profile removes the limit. | FACT | https://www.twilio.com/docs/api/errors/10004 (2026-06-09) |
| Concurrency table | Trial 5. No approved profile 2. Individual profile 3. Business profile unlimited. Applies to accounts upgraded on or after **2026-02-03**. | FACT (snippet; direct fetch returned 403) | https://support.twilio.com/hc/en-us/articles/223180028 |
| CPS | 1 CPS default for API-created outbound calls. "Inbound calls and <Dial> calls are not limited by CPS." | FACT | https://www.twilio.com/docs/glossary/cps (2026-07-20); https://www.twilio.com/docs/voice/limitations-and-edge-cases (2026-10-01) |
| Raising limits | Approved Business Primary Customer Profile in Trust Hub, or contact Support. No price stated. | FACT | https://www.twilio.com/docs/api/errors/10004 |
| Twilio integration | Native TwiML: `<Connect action=...><ConversationRelay url="wss://..."/></Connect>`. You must accept the AI/ML features addendum in Voice settings. | FACT | https://www.twilio.com/docs/voice/conversationrelay/onboarding (2026-09-25) |
| **Ring Amy first** | Fully native. (1) Webhook returns `<Dial timeout action=/after-amy><Number url=/screen>Amy</Number></Dial>`. (2) `<Number url>` runs TwiML on Amy's side after she answers, before bridging, and can use `<Gather>`/`<Hangup>` to decline. (3) The `<Dial action>` receives `DialCallStatus` (`no-answer`, `busy`, `completed`…) and `DialBridged`. Whatever TwiML you return takes control of the call. (4) Return `<Connect><ConversationRelay>`. | FACT (each piece) | https://www.twilio.com/docs/voice/twiml/number (2026-06-22); https://www.twilio.com/docs/voice/twiml/dial (2026-09-07) |
| Ring Amy first: caveat | Branch on `DialBridged`/`DialCallStatus`. A declined screen or voicemail then never bridges. | INFERENCE | https://www.twilio.com/docs/voice/twiml/dial |
| Transfer mechanism | The app sends `end` with `handoffData`. Twilio posts to the `<Connect action>` URL with `HandoffData`, `SessionStatus` and `SessionDuration`. You return `<Dial>` to Amy. | FACT | https://www.twilio.com/docs/voice/conversationrelay/websocket-messages (2026-09-30); https://www.twilio.com/docs/voice/twiml/connect/conversationrelay |
| Transfer types | Anything TwiML can do. Cold: `<Dial><Number>`. Screened + whisper: `<Number url>` says the summary and gathers press-1. Conference: `<Dial><Conference>` (from $0.0018/participant-min). | FACT (TwiML) + INFERENCE (composition) | https://www.twilio.com/docs/voice/twiml/number; https://www.twilio.com/en-us/voice/pricing/us |
| Return to agent | `<Dial action>` fires on no-answer. Return a new `<Connect><ConversationRelay>` with context in `<Parameter>`. Twilio documents re-issuing `<Connect><ConversationRelay>` with the same callSid to recover a dropped session. | FACT (re-connect supported) + INFERENCE (use for fallback) | https://www.twilio.com/docs/voice/conversationrelay/websocket-messages |
| SIP REFER | Not needed. The whole flow is Twilio-side. | INFERENCE | n/a |
| Interruption controls | `interruptible` (default `any`). `interruptSensitivity` (default `high`). `welcomeGreetingInterruptible`. `preemptible`. `ignoreBackchannel` (default false). `speechTimeout` (`auto` or 600-5000 ms). `eotThreshold` 0.5-0.9 (default 0.8; Deepgram flux only). `reportInputDuringAgentSpeech` (default `none`). `interrupt` message reports `utteranceUntilInterrupt` and `durationUntilInterruptMs`. | FACT | https://www.twilio.com/docs/voice/twiml/connect/conversationrelay; websocket-messages |
| Testing / eval | No native simulated-call or test-suite tooling found. You build it yourself. | OPEN QUESTION | https://www.twilio.com/docs/voice/conversationrelay (no testing section) |
| Observability | Voice Insights CR call summary splits latency into Network, STT, Application and TTS. Events API: `stt_latency`, `tts_latency`, `first_token_received`, `interrupt`, `preempted`. The CR Insights dashboard requires Voice Insights Advanced Features ($0.0024/min) and is not HIPAA eligible. Recording $0.0025/min. Transcripts via `intelligenceService` (Conversation Intelligence: $0.027/min streaming). No OTEL export found. | FACT (snippet) + FACT (prices) | https://www.twilio.com/docs/voice/voice-insights/conversation-relay-summary; https://www.twilio.com/docs/voice/voice-insights/api/call/details-conversation-relay-events; https://www.twilio.com/docs/voice/voice-insights/conversation-relay-insights-dashboard; https://www.twilio.com/en-us/voice/pricing/us |
| Tool calls | None from Twilio. Your WebSocket server owns the LLM loop, tools, auth and timeouts. Full control and full responsibility. | FACT (architecture) + INFERENCE | https://www.twilio.com/docs/voice/conversationrelay |
| Security of WS | The server must validate `X-Twilio-Signature` on the handshake. | FACT | https://www.twilio.com/docs/voice/conversationrelay/onboarding |
| Data retention | Transcripts are not kept by Twilio unless you use Conversation Intelligence. ElevenLabs TwiML `<Say>` logs are reviewable for up to 30 days. | FACT (snippet) / FACT | https://www.twilio.com/docs/conversation-intelligence-classic/conversation-relay-integration; https://www.twilio.com/docs/voice/conversationrelay |
| HIPAA | "Conversation Relay is a HIPAA Eligible Service when configured properly." Needs a BAA. HIPAA accounts require the Security or Enterprise Edition through Sales. Edition price not found. | FACT / FACT (snippet) / OPEN QUESTION | https://www.twilio.com/docs/voice/twiml/connect/conversationrelay; https://www.twilio.com/docs/iam/twilio-editions/hippa |
| SOC 2 | SOC 2 Type 2 covering all Services, plus ISO 27001/27017/27018. | FACT (snippet) | https://www.twilio.com/en-us/legal/security-overview; https://security.twilio.com/ |
| Lock-in | Lowest of the three. Prompts, tools and LLM live in your code. Only TwiML and the WS protocol are Twilio-specific. | INFERENCE | n/a |
| TypeScript | Official `twilio` Node helper. Samples are Node/Fastify (`twilio-samples/conversationrelay-elevenlabs-openai`, `twilio-samples/cr-flowiseai` ~33% TS). No first-party TS CR SDK. | FACT (snippet) | https://github.com/twilio-samples/conversationrelay-elevenlabs-openai; https://github.com/twilio-samples/cr-flowiseai |
| Latency | p50 491 ms, p95 713 ms, "internal benchmarks". | VENDOR CLAIM | https://www.twilio.com/en-us/products/conversational-ai/conversationrelay |
| 2026 incidents | **Aug 3**: CR Deepgram nova-2/nova-3 STT "hard down", ~2h43m (09:47-12:30 PDT). Google STT and Deepgram flux were unaffected. | FACT | https://status.twilio.com/incidents/r1sv7wjc2vq0 |
| | **Sep 12**: errors across Real-Time Transcriptions, CR and `<Gather>` with Deepgram, ~2.8 h, US1. | OPEN QUESTION (aggregator only; official page not found) | https://isdown.app/status/twilio/incidents/653657-errors-impacting-real-time-transcriptions-conversation-relay-gather-voice-twiml |
| | **Aug 28**: Voice REST API US1. "A small set of call modifications did not work", ~5h12m. | FACT | https://status.twilio.com/incidents/ysyjhrfhgx53 |
| | **Jul 5-6**: call failures from Twilio numbers to US and Spain, including emergency calls, ~11 h. | FACT | https://status.twilio.com/incidents/z84w0wl1n4q6 |
| | **May 11-13**: audio degradation, subset of US numbers to T-Mobile US, ~53 h. **May 14**: US audio degradation, ~2h42m. | FACT | https://status.twilio.com/incidents/l7jwqcvb7v33; https://status.twilio.com/incidents/v0c0pktz89x4 |
| | Full 2026 history list not retrievable. The history page is JS-rendered, and the RSS feed and API show only recent items. | OPEN QUESTION | https://status.twilio.com/history |

**Deal-breakers / standouts**
- Standout: ring-Amy-first, screened warm transfer, whisper and return-to-agent are all plain TwiML. No vendor bridging and no SIP.
- Standout: cheapest platform fee. Lowest lock-in. One vendor (Twilio) in the call path.
- Risk: a 64109 surge rejection exists, but there is no published number. Ask Twilio for the CR limit before TV-ad bursts.
- Risk: Deepgram dependency (Aug 3 hard-down). Keep a Google STT fallback config ready.
- Risk: you build tools, eval, guardrails and the transcript store yourself. That is a heavy lift for one engineer.
- Account-level: get the **Business Primary Customer Profile approved**. Otherwise concurrency may be capped at 2-3 calls. This applies to all three vendors, since our Twilio number is the entry point.

---

### 2. Vapi

| Field | Finding | Label | Source URL |
|---|---|---|---|
| Plans | **No Success Package**: $0 to start, pre-paid, "$0.05/min Vapi hosting", $5 free credits, 4 concurrent calls, 1 number, 14-day retention. **Core**: $29/mo, 10 concurrent, 30-day retention, ZDR included. **Pro**: "10% of Vapi hosting fee, $999/mo minimum", 30 concurrent, 180-day retention, 99% uptime SLA. **Premier**: custom, 99.9% SLA. | FACT | https://vapi.ai/pricing (no date; © 2026) |
| Platform fee on Core | Not stated per minute for Core. | OPEN QUESTION | https://vapi.ai/pricing |
| Provider costs | "Models pass-through at cost", "no markup". Deepgram $0.0095-0.0099/min. OpenAI $0.0077-0.0452/min. ElevenLabs $0.0146-0.0238/min. Vapi Telephony/SIP free. Twilio inbound $0.008/min, outbound $0.014/min. Calculator: 1,000 min ≈ $82-129/mo. | FACT | https://vapi.ai/pricing |
| BYO keys | Provider keys can be added under Integrations: "you won't be charged when using that provider through Vapi… charged directly by the provider." Custom LLM: any OpenAI-compatible endpoint (`provider: custom-llm`). | FACT | https://docs.vapi.ai/customization/provider-keys; https://docs.vapi.ai/customization/custom-llm/using-your-server |
| Twilio cost when BYO Twilio | Twilio bills inbound directly ($0.0085/min). Vapi's $0.008 figure applies to its own pass-through. | INFERENCE | https://www.twilio.com/en-us/voice/pricing/us |
| Concurrency | Slots by package. Legacy orgs: 10. "Each call occupies one slot." When full: "can't… accept an inbound call until a slot opens". API shows `concurrencyBlocked: true`. | FACT | https://docs.vapi.ai/calls/call-concurrency |
| At limit | Error `call.start.error-subscription-concurrency-limit-reached`. Caller experience: "Call failed immediately — no ring." No native queue. Vapi suggests your own Twilio `<Enqueue>` queue with Redis counters. | FACT | https://docs.vapi.ai/calls/troubleshoot-call-errors; https://docs.vapi.ai/calls/call-queue-management |
| Raise limit | Add-on "Additional concurrency $10 / line / month", any package. 100 lines ≈ $1,000/mo. | FACT / INFERENCE (math) | https://vapi.ai/pricing |
| Twilio integration | (a) Import a Twilio number with SID and Auth Token. The doc does not say whether the voice webhook is overwritten. (b) BYO SIP trunk: Elastic SIP Trunk origination to `sip:NUMBER@<credential_id>.sip.vapi.ai`, inbound gateways matched by numeric IP. (c) **Provider bypass** (below). | FACT / OPEN QUESTION (webhook overwrite) | https://docs.vapi.ai/phone-numbers/import-twilio; https://docs.vapi.ai/advanced/sip/twilio |
| **Ring Amy first** | Documented pattern. Our webhook keeps the number. After Amy's `<Dial>` returns no-answer, the server `POST https://api.vapi.ai/call` with `{phoneNumberId, assistantId, customer:{number}, phoneCallProviderBypassEnabled:true}`. It returns `phoneCallProviderDetails.twiml` unchanged to Twilio, or applies it with `calls(sid).update({twiml})`. | FACT (mechanism) + INFERENCE (Amy-first composition) | https://docs.vapi.ai/calls/call-handling-with-vapi-and-twilio; https://docs.vapi.ai/calls/call-queue-management |
| Bypass details | Exact TwiML returned (probably `<Connect><Stream>`, which would add Twilio Media Streams at $0.0044/min) is unverified. So is whether built-in `transferCall` works on bypass calls. | OPEN QUESTION | https://docs.vapi.ai/api-reference/calls/create (1.1M-char page; field not reached) |
| Transfer modes | `blind-transfer` (default). `blind-transfer-add-summary-to-sip-header` (Vapi/BYO SIP only). Warm: `warm-transfer-say-message`, `-say-summary`, `-twiml`, `-wait-for-operator-to-speak-first-and-then-say-message/summary` (Twilio only). `warm-transfer-experimental` (assistant-based). | FACT | https://docs.vapi.ai/call-forwarding; https://docs.vapi.ai/tools/transfer-call/warm-transfer |
| Screened transfer | `warm-transfer-experimental`: caller on hold, and a transfer assistant talks to the operator. It calls `transferSuccessful` only after the operator accepts. `transferCancel` returns the caller. Works on Twilio numbers (phone destinations), Vapi numbers and BYO SIP. | FACT | https://docs.vapi.ai/calls/assistant-based-warm-transfer |
| Fallback | Busy or no-answer rolls back to `fallbackPlan` (`message`, `endCallEnabled:false` keeps the assistant). `maxDurationSeconds` default 120. `silenceTimeoutSeconds` default 30. Blind transfer on Twilio: "a busy or unanswered call ends." | FACT | https://docs.vapi.ai/calls/assistant-based-warm-transfer; https://docs.vapi.ai/call-forwarding |
| Conference | The Twilio guide's DIY pattern: `calls(sid).update` puts the caller in a `<Conference>` and `calls.create` dials the specialist. No-answer handling is left as a TODO. | FACT | https://docs.vapi.ai/calls/call-handling-with-vapi-and-twilio |
| SIP REFER vs Twilio | Not explained in the docs. | OPEN QUESTION | https://docs.vapi.ai/call-forwarding |
| Interruption | `startSpeakingPlan.waitSeconds` (default 0.4). `smartEndpointingPlan`: LiveKit, Vapi, Deepgram Flux, Assembly, custom server, or off (default). `stopSpeakingPlan.numWords`; `voiceSeconds` (default 0.2); `backoffSeconds` (default 1). `backgroundSound` default "office" on phone. | FACT | https://docs.vapi.ai/customization/speech-configuration |
| Testing | Evals: scripted, with exact/regex/AI-judge/tool-call checks. Simulations: AI tester in chat or voice, grouped in suites. A GitHub Actions CI example runs Evals via the API. | FACT (snippet) | https://docs.vapi.ai/test/test-suites; https://docs.vapi.ai/observability/evals-advanced; https://docs.vapi.ai/observability/simulations-overview |
| Observability | Call logs with a Latency Summary: per-turn ms for transcriber, endpointing, LLM, voice and transport. Recordings, including separate tracks and pcap. Server events: `status-update`, `end-of-call-report`, `transcript`, `speech-update`, `user-interrupted`, `transfer-update`, `tool-calls`. Langfuse traces integration. No OTEL found. | FACT (snippet) / FACT | https://docs.vapi.ai/observability/logs/call-logs; https://docs.vapi.ai/server-url/events; https://docs.vapi.ai/providers/observability/langfuse |
| Tool calls | Function tools with a JSON Schema `function.parameters` and `server.url`. Response `{"results":[{"toolCallId","result"/"error"}]}`, HTTP 200 only, flat strings. Spoken messages: request-start, complete, failed, delayed. Async Mode toggle. Timeout set in the dashboard; default/max not documented. Also an `apiRequest` tool type. | FACT / OPEN QUESTION (timeout) | https://docs.vapi.ai/tools/custom-tools |
| Tool auth | Custom Credentials: Bearer (custom header), OAuth2 client-credentials, HMAC (secret, algorithm, signature header, optional timestamp). Legacy `X-Vapi-Secret`. Caveat for orgs created on or after 2026-09-23: credentials are attached only when the server URL comes from org config, not from inline `POST /call` assistants. | FACT | https://docs.vapi.ai/server-url/server-authentication |
| assistant-request | Must respond within "7.5 seconds end-to-end" (not configurable). Can return `assistantId`, `assistant`, `destination` (immediate transfer) or `error`. | FACT | https://docs.vapi.ai/server-url/events |
| Retention / ZDR | 14/30/180 days by plan. ZDR on Core and above. | FACT | https://vapi.ai/pricing |
| HIPAA | $2,000/month add-on with BAA, org-level, dashboard only. **Mutually exclusive with ZDR.** Recordings and transcripts are still stored in HIPAA storage. | FACT | https://vapi.ai/pricing; https://docs.vapi.ai/security-and-privacy/hipaa |
| SOC 2 | "SOC 2 Type II-attested". | VENDOR CLAIM | https://docs.vapi.ai/faq |
| Lock-in | Assistant configs are JSON via the API. Custom LLM endpoint possible. No open-source runtime found. | INFERENCE | https://docs.vapi.ai/customization/custom-llm/using-your-server |
| TypeScript | Official `@vapi-ai/server-sdk` (Fern-generated). Twilio integration samples are JS/Express, not TS. | FACT | https://github.com/VapiAI/server-sdk-typescript; https://docs.vapi.ai/calls/call-handling-with-vapi-and-twilio |
| 2026 incidents (status page) | **Jan 19**: calls not connecting (Daily channel). **Jan 21-Feb 3**: Gemini rate limiting. **Feb 23**: Daily channel, ~55 min, "37,806 calls dropped". **Feb 25**: Daily channel, ~8.5 h, ~19,527 calls failed. **Mar 19-21**: elevated call failures (`worker-died`). **Apr 14**: SIP infrastructure outage. **Apr 16**: inbound calls dropped ~2 h. **May 21**: "Voice calls dropped and dashboard unavailable", ~4h07m, critical (DB connection exhaustion). **Aug 19**: increased call failures (API down 1h10m, SIP down 50 min). **Oct 2, 6, 8-9**: SIP outbound/BYO SIP degradations, up to 12h18m. Many smaller items. | FACT | https://status.vapi.ai/incidents/2025-11/2026-01; https://status.vapi.ai/incidents/2026-02/2026-04; https://status.vapi.ai/incidents/2026-05/2026-07; https://status.vapi.ai/ |

**Deal-breakers / standouts**
- Standout: best built-in screened warm transfer (`warm-transfer-experimental`) with documented return-to-assistant fallback.
- Standout: strong eval/simulation tooling with a CI example. Per-turn latency breakdown.
- Risk: the 2026 status record has several multi-hour, five-figure call-drop incidents. That is the worst reliability record of the three.
- Risk: at the limit, inbound calls **fail immediately** with no queue. The free plan has only 4 lines. Bursts need paid lines or a DIY Twilio queue.
- Risk: whether built-in transfers work on `phoneCallProviderBypassEnabled` calls is unverified. You may need DIY Twilio transfers.

---

### 3. Retell AI

| Field | Finding | Label | Source URL |
|---|---|---|---|
| Voice infra | $0.055/min ("Retell Voice Infra"). | FACT | https://www.retellai.com/pricing (no date; © 2026) |
| Telephony | $0.015/min on Retell Twilio/Telnyx numbers. **Custom telephony / SIP trunking: no charge.** Retell numbers $2/mo. | FACT | same |
| TTS | $0.015/min for Retell platform, Cartesia, OpenAI, Minimax, Fish and Inworld voices. ElevenLabs: Flash $0.04, Multilingual v2 $0.06, Turbo v4 / v3 Conversational $0.08, v3 / v4 $0.10. | FACT | same |
| LLM (Standard / Fast tier, per min) | GPT 4.1 mini $0.0128 / $0.0192. GPT 4.1 nano $0.0032. GPT 5 mini $0.008 / $0.016. GPT 5 nano $0.0016. GPT 5.4 mini $0.024 / $0.048. GPT 5.4 nano $0.0064. GPT 6 Luna $0.0032. Claude 4.5 Haiku $0.025. Claude 5.5 Haiku $0.0032. Claude 5 / 5.5 Sonnet $0.064. Gemini 3.0 Flash $0.016. Gemini 3.1 Flash Lite $0.008. Gemini 3.6 Flash $0.024. Gemini 3.5 Flash $0.048. "Custom LLM" option. | FACT | same |
| S2S | GPT Realtime mini $0.07. GPT Realtime 2/2.1 $0.38. | FACT | same |
| Add-ons | Knowledge base +$0.005/min. Advanced denoising +$0.005. Guardrails +$0.005. PII removal +$0.01. AI QA $0.10/min after 100 free. | FACT | same |
| Free | $10 credits. 20 concurrent calls free. | FACT | same |
| Concurrency | 20 included. "$8.00/Concurrency/month". Enterprise "starting at 50+". | FACT | same; https://docs.retellai.com/deploy/concurrency |
| Burst mode | Admin toggle. Burst limit = min(3× limit, limit+300). Over-limit calls cost **+$0.10/min for the entire call**. With 20 base, burst to 60. | FACT / INFERENCE (math) | https://docs.retellai.com/deploy/concurrency |
| At limit (inbound) | Calls wait ~40 s for a slot, then transfer to the number's `fallback_number`. Without one: ends `concurrency_limit_reached`. Outbound is rejected unless burst is on. Reserved inbound capacity is available. | FACT | https://docs.retellai.com/deploy/concurrency |
| At limit (register-phone-call) | Not documented. The endpoint lists 429 "TooManyRequests". The ~40 s wait and `fallback_number` are number-based features and likely don't apply to dial-to-SIP. | OPEN QUESTION / INFERENCE | https://docs.retellai.com/api-references/register-phone-call |
| Twilio integration | (a) Elastic SIP trunk: origination `sip:sip.retellai.com`, termination = your Twilio trunk URI, import the number. Our webhook is bypassed. (b) **Dial to SIP URI** via Register Phone Call. | FACT | https://docs.retellai.com/deploy/twilio; https://docs.retellai.com/deploy/custom-telephony |
| **Ring Amy first** | Documented. Our Twilio webhook calls `POST /v2/register-phone-call` (`agent_id`, `from_number`, `to_number`, `direction`, `metadata`, `retell_llm_dynamic_variables`) and gets a `call_id`. It returns `<Dial><Sip>sip:{call_id}@sip.retellai.com</Sip></Dial>`. Must dial within 5 min or the call ends `registered_call_timeout`. Retell's example is "Typescript Node". Put this in the `<Dial action>` handler after Amy's no-answer. | FACT (mechanism) + INFERENCE (Amy-first) | https://docs.retellai.com/deploy/custom-telephony; https://docs.retellai.com/api-references/register-phone-call |
| Legacy SIP host | `sip:5t4n6j0wnrl.sip.livekit.cloud` retired 09/30/2026. Use `sip.retellai.com`. | FACT (snippet) | https://docs.retellai.com/deprecation-notice/overview |
| **Transfer on dial-to-SIP** | **Not available.** "Retell's transfer feature is not available" for dial-to-SIP. Call ending must also be handled by you. Build a custom function that drives the transfer through Twilio. | FACT | https://docs.retellai.com/deploy/custom-telephony |
| DIY transfer path | Custom function → our server → Twilio REST `calls(parentSid).update` with `<Dial action><Number url=/whisper>Amy</Number></Dial>`. The SIP leg drops. If Amy doesn't answer, the `<Dial action>` re-registers a fresh Retell call with context. A second option: Twilio `<Dial referUrl>` catches a SIP REFER (posts `ReferTransferTarget`). With `answerOnBridge=true` the caller "stays with the original agent" if the target doesn't answer. Whether Retell emits REFER on dial-to-SIP calls is unknown. | INFERENCE + FACT (Twilio REFER) / OPEN QUESTION (Retell REFER) | https://www.twilio.com/docs/voice/api/refer-to-twilio (2026-08-19); https://www.twilio.com/docs/voice/twiml/dial |
| Transfer types (on Retell/imported numbers) | Cold: SIP INVITE (default) or SIP REFER. Warm: agent waits, **whisper** to the destination only, three-way debrief. **Agentic warm**: transfer agent with Bridge/Cancel tools. Cancel returns the caller to the main agent. "Action on Timeout": cancel or bridge. Custom hold music. | FACT | https://docs.retellai.com/build/single-multi-prompt/transfer-call |
| SIP headers | Twilio ignores custom SIP headers on REFER. | FACT | https://docs.retellai.com/build/telephony/sip-headers |
| Inbound webhook | Lets you override agent, set dynamic vars, or reject. 10 s timeout, 3 attempts. **Does not apply to dial-to-SIP.** No forward option. | FACT | https://docs.retellai.com/features/inbound-call-webhook |
| Interruption | `interruption_sensitivity` 0-1 (default 1). `responsiveness` 0-1 (default 1). `enable_dynamic_responsiveness`. `enable_backchannel`, `backchannel_frequency` (default 0.8), `backchannel_words`. `denoising_mode` (default `noise-cancellation`). `stt_mode` fast/accurate/custom. `custom_stt_config.endpointing_ms`. | FACT | https://docs.retellai.com/api-references/create-agent (spec rev 2026-10-22) |
| Testing | Test cases (scenario + success criteria + mocks). Batch tests with pass rate. API `POST /create-batch-test`, usable for CI. Text-only simulation. **Custom-LLM agents cannot be simulation-tested.** Billed per message (~$0.001-0.05). | FACT (snippet) / FACT | https://docs.retellai.com/test/batch-test-simulation; https://docs.retellai.com/test/testing-pricing |
| Observability | Call object `latency.{e2e, asr, llm, tts, knowledge_base, s2s, llm_websocket_network_rtt}` with p50/p90/p95/p99/min/max/values. `transcript_with_tool_calls`. `recording_url`, multi-channel and scrubbed versions. `public_log_url` with per-turn latency. `call_cost.product_costs`. Webhooks: `call_started/ended/analyzed`, `transfer_*`. Alerting. No OTEL found. | FACT | https://docs.retellai.com/api-references/get-call |
| Tool calls | Custom function: GET/POST/PUT/PATCH/DELETE. Custom headers and query params. JSON Schema params (`const` = fixed). Timeout default 120,000 ms, range 1,000-600,000. "Talk While Waiting". `max_retry` 0-5. Result capped at 15,000 chars. Not cancelled on interrupt. `X-Retell-Signature` HMAC-SHA256 (`v={ts},d={hex}`, 5-min window). | FACT | https://docs.retellai.com/build/single-multi-prompt/custom-function; https://docs.retellai.com/features/secure-webhook |
| Retention | `data_storage_setting`: `everything` (default), `everything_except_pii`, `basic_attributes_only` (no transcripts/recordings/logs). `data_storage_retention_days` 1-730 (unset = indefinite). Signed URLs. Post-call PII scrub. | FACT | https://docs.retellai.com/api-references/create-agent |
| HIPAA / SOC 2 | Self-sign BAA online. "SOC 2 Type 1 and Type 2", HIPAA, GDPR, and ISO 27001 on the homepage. The pricing table checkmarks did not render. | VENDOR CLAIM / OPEN QUESTION | https://www.retellai.com/blog/enterprise-voice-ai-compliance-guide; https://www.retellai.com/pricing |
| Lock-in | Agent JSON via the API. Custom LLM over WebSocket lets you keep prompts and tool logic in your code. No export feature documented. | FACT (API) / INFERENCE | https://docs.retellai.com/api-references/create-agent |
| TypeScript | `retell-sdk` (Apache-2.0, Stainless-style). The custom-telephony example is TS/Node. | FACT | https://github.com/RetellAI/retell-typescript-sdk; https://docs.retellai.com/deploy/custom-telephony |
| 2026 incidents (status RSS) | **Jan 9** outbound degradation ~2 h. **Feb 10** calls failing to start plus "concurrency stuck", ~8 min. **Feb 20** Telnyx SIP degradation ~2h15m. **Mar 15** custom-LLM calls failing to start ~2h15m (bad release). **May 28** calls not picked up in time ~1.5 h. **Jun 22** GPT-4o calls unavailable ~2 h. **Jun 24** partial outage, incoming and ongoing calls. **Jul 29** inbound not connecting ~50 min. **Aug 7** some inbound failing ~30 min. **Sep 5** web/phone call disruption ~1h10m. **Sep 16** call disruption ~20 min, "about 22% of calls". | FACT | https://status.retellai.com/history.rss |
| Extra incident | May 2026: concurrency miscalculated, many `concurrency_limit_reached` errors. Not in the RSS feed. | FACT (community post, not status page) | https://community.retellai.com/t/calls-returning-concurrency-limit-reached/2859 |

**Deal-breakers / standouts**
- Standout: register-phone-call plus `<Dial><Sip>` is a clean, documented ring-Amy-first path, and the telephony fee is $0.
- Standout: best documented overflow (~40 s wait, `fallback_number`, burst mode). 20 free lines. Rich per-call latency percentiles. Granular retention controls.
- **Deal-breaker risk:** in the ring-Amy-first (dial-to-SIP) mode, **Retell's warm, agentic and whisper transfers are unavailable**. Transfer back to Amy must be DIY through Twilio. Retell's best transfer features only work if Retell owns the number (elastic trunk), and that loses our ring-Amy-first webhook.
- Risk: concurrency behavior for registered calls is undocumented. Custom-LLM agents can't use simulation tests.

---

### Twilio base prices

All FACT. "Pricing current as of August 2026".

| Item | Price | Source |
|---|---|---|
| US local number | $1.15/mo | https://www.twilio.com/en-us/voice/pricing/us |
| US toll-free number | $2.15/mo | same |
| Inbound local | $0.0085/min | same |
| Inbound toll-free | $0.0220/min | same |
| Outbound local (Dial leg to Amy's cell) | $0.0140/min | same |
| Call recording | $0.0025/min, storage $0.0005/min-mo | same |
| ConversationRelay | $0.07/min | same |
| Media Streams | $0.0044/min | same |
| SIP interface (`<Dial><Sip>` legs) | $0.0040/min; $0.1000/REFER | same |
| Conference | from $0.0018/participant-min | same |
| Voice Insights Advanced | $0.0024/min | same |
| Conversation Intelligence transcription | $0.024 (batch) / $0.027 (streaming) per min | same |
| AMD | $0.0075/call | same |
| Elastic SIP Trunking origination (US local) | $0.0034/min (toll-free $0.0130) | https://www.twilio.com/en-us/sip-trunking/pricing/us |
| Elastic SIP Trunking termination | 48 states $0.0100/min. Alaska $0.0862. High-cost $0.0620. Toll-free $0.0011. | same |
| SIP trunk extras | "Unlimited Call Concurrency: Included". Secure trunking included. Recording $0.0025/min. Emergency $0.75/mo per number. | same |
| CPS | 1 CPS default for API outbound. Inbound and `<Dial>` not CPS-limited. | https://www.twilio.com/docs/glossary/cps |
| Max call duration | 4 hours | https://www.twilio.com/docs/voice/limitations-and-edge-cases |
| Account concurrency | Unlimited only with an approved Business Primary Customer Profile (accounts upgraded on or after 2026-02-03). Otherwise reduced (2-3). | https://www.twilio.com/docs/api/errors/10004; https://support.twilio.com/hc/en-us/articles/223180028 (snippet) |

Rough per-AI-minute stacks. All INFERENCE. Amy leg excluded.
- CR: $0.0085 + $0.07 + LLM (gpt-5-mini ≈ <$0.01) ≈ **$0.08-0.09/min**.
- Retell (dial-to-SIP): $0.0085 + $0.004 SIP + $0.055 + $0.015 TTS + $0.008 (GPT 5 mini) ≈ **$0.09/min**. Burst calls add $0.10.
- Vapi (bypass): $0.0085 + $0.05 + ~$0.01 STT + $0.015-0.024 TTS + $0.008-0.045 LLM (+ $0.0044 if Media Streams) ≈ **$0.10-0.14/min**, plus plan and line fees.

### LLM token prices

All FACT. Per 1M tokens, Standard tier.

| Model | Input | Cached input | Output | Source |
|---|---|---|---|---|
| gpt-6-luna | $0.10 | $0.01 | $0.50 | https://developers.openai.com/api/docs/pricing (redirect from platform.openai.com/docs/pricing; no date) |
| gpt-5.6-luna | $0.20 | $0.02 | $1.20 | same |
| gpt-5.4-mini | $0.75 | $0.075 | $4.50 | same |
| gpt-5.4-nano | $0.20 | $0.02 | $1.25 | same |
| gpt-5-mini | $0.25 | $0.025 | $2.00 | same |
| gpt-5-nano | $0.05 | $0.005 | $0.40 | same |
| gpt-4.1-mini | $0.40 | $0.10 | $1.60 | same |
| gpt-4.1-nano | $0.10 | $0.025 | $0.40 | same |
| gpt-4o-mini | $0.15 | $0.075 | $0.60 | same |
| Claude Haiku 5.5 (≤100K prompt) | $0.10 | $0.01 (hit) | $0.50 | https://platform.claude.com/docs/en/about-claude/pricing |
| Claude Haiku 4.5 | $1.00 | $0.10 (hit) | $5.00 | same |
| Claude Sonnet 5 / 5.5 | $2.00 | $0.20 / $0.10 (hit) | $10.00 | same |

Notes: Anthropic US-only inference (`inference_geo`) is 1.1× (FACT, same page). The OpenAI page says priority processing was renamed "Fast mode" on 2026-07-30.

### Could not verify (OPEN QUESTIONS)
- Numeric ConversationRelay concurrency limit behind error 64109.
- Whether CR's $0.07 includes the ElevenLabs TTS and Deepgram STT cost.
- Vapi: the TwiML returned for bypass calls, whether built-in transfers work on bypass calls, the tool timeout default/max, and whether importing a Twilio number rewrites its voice URL.
- Retell: concurrency handling for register-phone-call calls, and whether Retell sends SIP REFER on dial-to-SIP calls.
- Full Twilio 2026 incident list (history page is JS-rendered). Twilio Security Edition price. The help.twilio.com concurrency article returned 403.
- The web-search budget ran out near the end. Later checks used direct page fetches only.

---

## Appendix B. LiveKit, Pipecat, OpenAI Realtime / GPT-Live over SIP


Research date: 2026-10-22. Sources are official pages only, fetched today.
Labels: FACT = read on an official page. VENDOR CLAIM = vendor's own performance or marketing claim. INFERENCE = my reasoning. OPEN QUESTION = could not verify.
Most pages show no "last updated" date. Exceptions are noted in the rows.

### Shared Twilio mechanism (applies to all three vendors)

This is how "ring Amy first, then hand the live call to the agent" works.

| Field | Finding | Label | Source URL |
|---|---|---|---|
| Dial action fallback | `<Dial action=...>` makes Twilio "continue the initial call after the dialed party hangs up". The flow continues with the TwiML your action URL returns. `DialCallStatus` is passed (no-answer, busy, and so on). | FACT | https://www.twilio.com/docs/voice/twiml/dial |
| Dial timeout | Default 30 s. Minimum 5 s, maximum 600 s. Twilio adds a 5 s buffer. | FACT | https://www.twilio.com/docs/voice/twiml/dial |
| Pattern | Webhook returns `<Dial timeout="15" action="/after-amy"><Number url="/screen">Amy</Number></Dial>`. If Amy does not press 1, `/after-amy` returns the agent TwiML: `<Dial><Sip>` for LiveKit or OpenAI, or `<Connect><Stream>` for Pipecat, the LiveKit connector, or the OpenAI Agents SDK. | INFERENCE (built from the documented primitives above) | https://www.twilio.com/docs/voice/twiml/dial |
| REFER on a `<Dial><Sip>` leg | If the SIP side sends REFER, Twilio posts to `referUrl` with `ReferTransferTarget`. `referUrl` must be on the initial call's `<Dial>`. It works for `<Sip>`, `<Number>` and `<Client>`, but not for Conference or Queue. | FACT | https://www.twilio.com/docs/voice/api/refer-to-twilio |
| answerOnBridge with REFER | With `answerOnBridge=true`, the transferor leg (the AI) stays up until the target answers. If the target does not answer, "UserA's call will stay connected with AgentA". This gives return-to-agent on failure. | FACT | https://www.twilio.com/docs/voice/api/refer-to-twilio |
| `<Connect action>` | When `<Connect>` ends, Twilio requests its action URL. The docs do not say whether a server-closed stream ends `<Connect>`. | FACT / OPEN QUESTION | https://www.twilio.com/docs/voice/twiml/connect |
| SRTP on `<Dial><Sip>` | Append `;secure=true` to the SIP URI for TLS plus SRTP. Twilio offers only one crypto suite, AES_CM_128_HMAC_SHA1_80. | FACT | https://www.twilio.com/docs/voice/api/secure-media |
| `<Sip>` transport | UDP, TCP or TLS. TLS uses port 5061. | FACT | https://www.twilio.com/docs/voice/twiml/sip |
| Elastic SIP Trunk versus webhook | LiveKit presents TwiML `<Dial><Sip>` "instead of" Elastic SIP Trunking. Numbers on a trunk route straight to the origination URI, so the ring-Amy-first webhook needs the Programmable Voice path. | FACT (LiveKit wording) / INFERENCE (exclusivity) | https://docs.livekit.io/telephony/start/providers/twilio.md |

### LiveKit (Agents framework, LiveKit Cloud, LiveKit SIP)

| Field | Finding | Label | Source URL |
|---|---|---|---|
| Plans | Build $0/mo. Ship "starting at" $50/mo. Scale "starting at" $500/mo. Enterprise is custom. No last-updated date. "Free through Oct 31" promos appear without a year. | FACT | https://livekit.com/pricing |
| Agent session minutes | Included minutes: Build 1,000, Ship 5,000, Scale 50,000. Overage $0.01/min. | FACT | https://livekit.com/pricing |
| Third-party SIP minutes (Twilio trunk or `<Dial><Sip>`) | Included minutes: Build 1,000, Ship 5,000 then $0.004/min, Scale 50,000 then $0.003/min. | FACT | https://livekit.com/pricing |
| Twilio connector (Media Streams) | Concurrent calls: Build 5. Ship 20 at $0.004/min. Scale 100 at $0.003/min. | FACT | https://livekit.com/pricing |
| LiveKit numbers | One free US local number. Extra numbers $1/mo. US local inbound $0.01/min after included minutes (Ship 100, Scale 1,000). Toll-free number $2/mo, inbound $0.02/min. | FACT | https://livekit.com/pricing |
| Observability and recordings | Session recordings: Ship 5,000 min, then $0.005/min. Observability events: Ship 500k, then $0.00003/entry. | FACT | https://livekit.com/pricing |
| Simulations | Text $0.02/turn, audio $0.05/turn on Ship and Scale. Marked "Free through Oct 31". | FACT | https://livekit.com/pricing |
| Turn detection / adaptive interruption | Free for agents hosted on LiveKit Cloud. Self-hosted agents pay $0.50 and $1.20 per 1,000 requests after an allowance. | FACT | https://livekit.com/pricing |
| Example all-in per-minute rate | Pricing calculator (phone call): session $0.0100, telephony $0.0100, LLM $0.0014, STT $0.0075, TTS $0.0090, observability $0.0100. Total **$0.0479/min**. The page does not name the plan. Twilio's own charges are excluded. | FACT (vendor calculator) | https://livekit.com/pricing |
| Inference STT (Build/Ship versus Scale) | Deepgram Nova-3 mono $0.0048 / $0.0042. Flux $0.0065 / $0.0057. AssemblyAI Universal-Streaming $0.0025. Cartesia Ink Whisper $0.0030 / $0.0023. All per minute. | FACT | https://livekit.com/pricing/inference |
| Inference TTS, per 1M characters | Cartesia Sonic 3/3.5/3.6 $50 / $37.50. Deepgram Aura-2 $30 / $27. Inworld TTS 2.0 $25 / $15. Rime Mist v3 $30 / $20. No ElevenLabs listed. | FACT | https://livekit.com/pricing/inference |
| Inference LLM, per 1M tokens (in / cached / out) | gpt-4.1-mini $0.40 / $0.10 / $1.60. gpt-5-mini $0.25 / $0.025 / $2.00. gpt-4o-mini $0.15 / $0.075 / $0.60. | FACT | https://livekit.com/pricing/inference |
| Inference realtime | GPT Realtime 2.1 audio $32 in / $64 out per 1M tokens. GPT-Live 1 $0.05/min. Same as OpenAI list prices. | FACT | https://livekit.com/pricing/inference |
| Concurrent agent sessions | Build 5. Ship 20. Scale "up to 600" (starts at 50, raise via dashboard). | FACT | https://livekit.com/pricing |
| Inference concurrency | Build 5, Ship 20, Scale 50 connections per model type. LLM on Build: 100 RPM and 600k TPM, and "new requests fail" at the limit. | FACT | https://livekit.com/pricing ; https://docs.livekit.io/home/cloud/quotas-and-limits/ |
| Behavior at the limit | "When a quota is reached, new operations of that kind fail until conditions allow them again." No queuing is described. Turn detection falls back to local `v1-mini`. Adaptive interruption falls back to VAD. Page render timestamp 2026-10-22. | FACT | https://docs.livekit.io/home/cloud/quotas-and-limits/ |
| Burst fit (20 to 100 calls) | Ship caps at 20 concurrent sessions and 20 Inference connections. A TV burst of 20 to 100 calls needs Scale ($500/mo plus a limit request). Calls over the cap will fail rather than queue. | INFERENCE | https://livekit.com/pricing |
| Cold starts | Build: scale-to-zero, cold start "adds 10 to 20 seconds". "On paid plans (Ship and Scale), production agents stay warm." Instant rollback is paid-only. | FACT | https://docs.livekit.io/deploy/agents/managing-deployments/ |
| Cloud versus self-host | Cloud: one CLI command, autoscaling "up to the limits of your plan", encrypted secrets, log drains. Node.js Dockerfile template exists (node:24-slim, pnpm). Build limit 10 min, upload limit 1 GB. Self-host: the server and agents are open source. | FACT | https://docs.livekit.io/agents/ops/deployment/ ; https://docs.livekit.io/deploy/agents/builds/ |
| Twilio path A: TwiML `<Dial><Sip>` | `<Dial><Sip username password>sip:NUMBER@SIP_HOST;transport=tcp</Sip></Dial>`. Can be returned "via another mechanism, such as a webhook". Needs an inbound trunk and a dispatch rule. LiveKit says: "This method doesn't support SIP REFER or outbound calls." | FACT | https://docs.livekit.io/telephony/accepting-calls/inbound-twilio.md |
| Twilio path B: Elastic SIP Trunk | Origination URI `sip:<SIP endpoint>;transport=tcp`. Termination URI is used for outbound. Transfers must be enabled on the Twilio trunk. | FACT | https://docs.livekit.io/telephony/start/providers/twilio.md ; https://docs.livekit.io/telephony/features/transfers/cold.md |
| Twilio path C: connector (Media Streams) | Server calls `ConnectTwilioCall` (inbound) and returns `<Connect><Stream url=connect_url>`. LiveKit Cloud only. LiveKit "recommends Elastic SIP Trunking" over it. Node.js examples exist. | FACT | https://docs.livekit.io/telephony/connectors/twilio.md |
| Ring Amy first | Use path A or C from our `/after-amy` action URL. Path A is the doc-blessed webhook route. | FACT (webhook allowed) / INFERENCE (fallback chaining) | https://docs.livekit.io/telephony/accepting-calls/inbound-twilio.md |
| Transfer back to Amy on path A | LiveKit says REFER is unsupported on path A. Twilio docs say REFER on a `<Dial><Sip>` leg goes to `referUrl`. Whether LiveKit's `TransferSIPParticipant` REFER reaches Twilio's `referUrl` is unverified. Must be tested. Fallback: our server uses Twilio REST to redirect the parent call to new TwiML. | OPEN QUESTION | https://docs.livekit.io/telephony/accepting-calls/inbound-twilio.md ; https://www.twilio.com/docs/voice/api/refer-to-twilio |
| Cold transfer | `TransferSIPParticipant` sends SIP REFER. Node: `api.sip.transferSipParticipant`. The caller leaves the room and the agent session ends. `ringing_timeout` defaults to 30 s; on timeout "the caller stays in the room". | FACT | https://docs.livekit.io/telephony/features/transfers/cold.md |
| Warm transfer | The caller is put on hold. A TransferAgent dials the human in a consultation room, "summarizes the call to the manager", then moves the human in. If there is no answer, the agent returns to the caller. Needs an **outbound trunk** (Twilio Elastic termination). | FACT | https://docs.livekit.io/telephony/features/transfers/warm.md |
| WarmTransferTask in Node | The task page says Node.js v1.5+ has `WarmTransferTask` in the stable `workflows` namespace (Python: `beta.workflows`). On `ringing_timeout` "the task completes with a ToolError and the caller conversation resumes". The telephony guide shows the Node box unchecked, so the two docs conflict. | FACT (task page) / OPEN QUESTION (conflict) | https://docs.livekit.io/agents/prebuilt/tasks/warm-transfer/ ; https://docs.livekit.io/telephony/features/transfers/warm.md |
| Turn detection | `inference.TurnDetector()` is the default. Node: `turnDetection: new inference.TurnDetector()`. VAD-only mode is available (Silero). | FACT | https://docs.livekit.io/agents/build/turns/ |
| Interruption controls | Adaptive interruption is the default on Cloud. Other controls: `allowInterruptions:false` per say/generateReply, `min_duration`, `min_words`, `falseInterruptionTimeout` (ms in Node), `resumeFalseInterruption`. `min_delay`/`max_delay` are fixed endpointing. **Dynamic endpointing is Python only.** | FACT | https://docs.livekit.io/agents/build/turns/ |
| Testing | Unit tests "in pytest or Vitest" check messages, tool calls and handoffs turn by turn. Agent Simulations use an LLM simulated user, in text or audio, with an LLM judge and `--pass-rate`. Node requires `@livekit/agents` 1.6.0+. | FACT | https://docs.livekit.io/agents/build/testing/ ; https://docs.livekit.io/testing/simulations/ |
| Observability | Agent insights put transcripts, traces, logs, metrics and recordings on one timeline. OTel spans: `user_turn`, `eou_wait`, `agent_turn`, `llm_node`, `function_tool`, `tts_node`. Per-turn E2E, LLM TTFT, TTS TTFB and EOT. Node.js is supported. OTel export to Langfuse and others. **Cloud-only**, not for a fully self-hosted setup. Retention not stated. | FACT | https://docs.livekit.io/deploy/observability/ ; https://docs.livekit.io/reference/agents/session-traces/ |
| Tool-call model | Function tools are code in the agent process (Node `llm.tool`). They can call our HTTP API with our own auth. README: "Native MCP support". | FACT (README) / INFERENCE (HTTP pattern) | https://github.com/livekit/agents-js ; https://docs.livekit.io/telephony/features/transfers/cold.md |
| HIPAA / BAA | BAA only on Scale, Enterprise or the Startup program. Approval is not guaranteed and not every feature is covered. Third-party plugins and self-hosting are excluded. DPA is standard on all plans. | FACT | https://docs.livekit.io/deploy/admin/hipaa/ ; https://livekit.com/pricing |
| TS maturity | `@livekit/agents` **1.9.3** (released 15 Oct) with plugins in lockstep. Python `livekit-agents` 1.8.8 also 15 Oct. Node 1.0 shipped August 2025. The README lists "only the following plugins" (about 25). The FAQ states the parity goal as "working towards feature parity". | FACT | https://github.com/livekit/agents-js/releases ; https://github.com/livekit/agents/releases ; https://docs.livekit.io/reference/migration-guides/v0-migration/nodejs/ |
| Lock-in | Apache-2.0 agents-js. Server is open source and can be self-hosted. Observability, connectors and Cloud-hosted turn detection pricing tie you to Cloud. | FACT (license) / INFERENCE | https://github.com/livekit/agents-js/blob/main/LICENSE |
| 2026 incidents | The RSS feed covers only Aug 6 to Oct 20, 2026: 25 incidents. SIP-related: Oct 16 degraded SIP in US West (69 min). Aug 17 failed SIP transfers in US East (about 60 min). Sep 2 one-way audio on LiveKit Phone Numbers. Aug 7 US West to US Central calls failing (15 min). Sep 15 SIP API latency (minutes). Also Oct 19 Chicago API failures (about 34 min). Aug 26 Inference errors in US East (7 min). | FACT | https://status.livekit.io/history.rss |

**Deal-breakers / standouts**
- Standout: the only vendor with a first-party warm transfer plus summary and return-to-agent. It ships in Node.
- Standout: a TypeScript-native 1.x SDK, Vitest tests, Node simulations and Node OTel traces.
- Risk: Ship caps at 20 concurrent sessions and 20 Inference connections. TV bursts need Scale ($500/mo) or the overflow fails.
- Risk: the TwiML ring-Amy-first path officially lacks REFER. Warm transfer needs an outbound Elastic trunk. Transfer back on path A needs a test.
- Risk: 5+ SIP or telephony incidents in about 11 weeks (Aug to Oct 2026), one of them failed transfers.

### Pipecat (open source) and Pipecat Cloud (Daily)

| Field | Finding | Label | Source URL |
|---|---|---|---|
| Hosting price | agent-1x (0.5 vCPU, 1 GB) $0.01/min active, $0.0005/min reserved. agent-2x $0.02 / $0.001. agent-3x $0.03 / $0.0015. No plan fee is listed. | FACT | https://www.daily.co/pricing/pipecat-cloud/ |
| Reserved cost | One always-on agent-1x is about $21.60/month (0.0005 × 43,200 min). | INFERENCE | https://www.daily.co/pricing/pipecat-cloud/ |
| Transport and telephony | Websocket (Twilio): "billed by your provider". Daily SIP $0.003 to $0.02/min. Daily PSTN $0.018/min. SIP REFER $0.20/event, and original call minutes keep accruing during a transfer. Twilio: "billed by Twilio". | FACT | https://www.daily.co/pricing/pipecat-cloud/ |
| Krisp VIVA | Free up to 10k min/month, then $0.0015/min. | FACT | https://www.daily.co/pricing/pipecat-cloud/ |
| STT, LLM, TTS | Not billed by Pipecat Cloud. You pay providers directly, unless you have enterprise bundled billing. | FACT | https://www.daily.co/pricing/pipecat-cloud/ |
| Estimated all-in rate | $0.01 hosting + Nova-3 $0.0048 + small LLM about $0.001 + TTS about $0.015 to $0.02 (agent speaks about 50%) gives about **$0.03 to $0.04/min**, plus Twilio voice and Media Streams. | INFERENCE | (component URLs below) |
| Concurrency | The pricing page says "unlimited". The docs say the default is **50 active sessions per deployment** in Daily-hosted regions. More needs a request form. | FACT (both; the docs are more specific) | https://www.daily.co/pricing/pipecat-cloud/ ; https://docs.pipecat.ai/deployment/pipecat-cloud/fundamentals/active-sessions |
| Behavior at the limit | At pool capacity the start request gets **429** "Rate limit exceeded". There is no queue. | FACT | https://docs.pipecat.ai/deployment/pipecat-cloud/fundamentals/scaling |
| Cold starts | About 10 s best case. Buffer instances arrive in about 30 s. "If no instance is ready within about 2 minutes, the session is dropped." `min-agents` keeps warm instances, billed at the reserved rate. For spikes of "tens or hundreds of calls per second", raise `min-agents`. | FACT | https://docs.pipecat.ai/deployment/pipecat-cloud/fundamentals/scaling |
| Session limits | Default max 7,200 s per session, configurable from 60 to 14,400 s. | FACT | https://docs.pipecat.ai/deployment/pipecat-cloud/fundamentals/active-sessions |
| Twilio path A: Media Streams | `<Stream url="wss://api.pipecat.daily.co/ws/twilio">` with `<Parameter name="_pipecatCloudServiceHost" value="AGENT.ORG"/>`. 8 kHz PCM. `TwilioFrameSerializer` hangs up through Twilio REST by default. With `auto_hang_up=False`, "your TwiML document" ends the call. | FACT | https://docs.pipecat.ai/deployment/pipecat-cloud/guides/telephony/twilio-websocket ; https://docs.pipecat.ai/pipecat/telephony/twilio-websockets |
| Twilio path B: Daily SIP | Our webhook returns hold music. The bot gets `on_dialin_ready` and redirects the Twilio call to `<Dial><Sip>{daily_sip_uri}</Sip></Dial>` through Twilio REST. `<Pause>` is not recommended. | FACT | https://docs.pipecat.ai/pipecat/telephony/twilio-daily-sip |
| Ring Amy first | Path A: `/after-amy` returns `<Connect action="/after-ai"><Stream ...pipecat cloud...></Connect>`. Path B: `/after-amy` returns hold music while our server starts a Daily room and bot. Both are driven by our own webhook. | INFERENCE (docs show TwiML Bin or own `/call` webhook, not after a `<Dial>`) | https://docs.pipecat.ai/pipecat/telephony/twilio-daily-sip ; https://www.twilio.com/docs/voice/twiml/dial |
| Transfers on Twilio Media Streams | Twilio WebSocket: "No advanced call center features like transfers or reconnects." You build it yourself: Twilio REST call update, or `<Connect action>` returning a `<Dial>` to Amy. | FACT (limitation) / INFERENCE (DIY) | https://docs.pipecat.ai/pipecat/telephony/overview |
| Transfers on Daily | Cold transfer via SIP REFER (`sipRefer`; Daily leaves the call). Anchored transfer via `sipCallTransfer`, billed on both legs. The warm transfer example (Flows) briefs the human while the caller hears hold music, and is "DailyTransport only". Return-to-agent on failure is not documented. | FACT / OPEN QUESTION (return-to-agent) | https://docs.daily.co/docs/guides/features/dial-in-dial-out/transfers ; https://docs.pipecat.ai/pipecat-flows/examples |
| Turn detection | `LocalSmartTurnAnalyzerV3` (ONNX, CPU, under 100 ms, 23 languages) is the default stop strategy. Smart Turn `stop_secs` default 3.0. | FACT / VENDOR CLAIM (latency) | https://docs.pipecat.ai/api-reference/server/utilities/turn-detection/smart-turn-overview |
| Interruption controls | `enable_interruptions` (default True). `MinWordsUserTurnStartStrategy(min_words)` while the bot speaks. Krisp interruption-prediction strategy. `SpeechTimeoutUserTurnStopStrategy` 0.6 s. `EagerUserTurnStopStrategy`. | FACT | https://docs.pipecat.ai/api-reference/server/utilities/turn-management/user-turn-strategies |
| Structured flows | Pipecat Flows: YAML graph or programmatic. Handlers are Python. | FACT | https://docs.pipecat.ai/pipecat-flows/examples |
| Testing | Pipecat Evals: YAML scenarios run with `pipecat eval run`. Checks: `text_contains`, function calls with arguments, `within_ms` latency budgets, interruptions, DTMF, and an LLM judge. Simulated callers. Text or audio mode. Python CLI. | FACT | https://docs.pipecat.ai/pipecat/fundamentals/evaluations/overview |
| Observability | OTel: `setup_tracing()` plus `enable_tracing=True`. Spans: conversation, then turn, then STT/LLM/TTS. `metrics.ttfb`, token counts and TTS character counts. Any OTLP exporter. Whisker debugger. Pipecat Cloud dashboard features not verified. | FACT / OPEN QUESTION (cloud dashboard) | https://docs.pipecat.ai/server/utilities/opentelemetry ; https://github.com/pipecat-ai/whisker |
| Tool-call model | LLM function calls are handled in Python. HTTP to our Next.js API is DIY. | INFERENCE | https://docs.pipecat.ai/pipecat-flows/examples |
| TypeScript | **No official TS/Node server SDK.** The server framework is Python (min 3.11, recommended 3.12+). JS packages (`@pipecat-ai/client-js` and others) are client SDKs only. | FACT | https://github.com/pipecat-ai/pipecat ; https://docs.pipecat.ai/api-reference/client/js/overview |
| Maturity | Pipecat **v1.13.0** (19 Oct). Releases about weekly. v1.10.0 had breaking changes (OpenAI 3 SDK, httpx2, TLS trust store). | FACT | https://github.com/pipecat-ai/pipecat/releases |
| HIPAA / BAA | Email help@daily.co to enable HIPAA controls and sign a single BAA covering Pipecat Cloud, Daily WebRTC and transcription. "No application data is logged" with HIPAA on. Daily's Video SDK pricing lists "Healthcare (HIPAA + BAA): $500/month". It is unclear whether that fee applies to Pipecat Cloud. | FACT / OPEN QUESTION | https://docs.pipecat.ai/pipecat-cloud/security/hipaa ; https://www.daily.co/pricing/video-sdk/ |
| Lock-in | BSD-2-Clause and fully self-hostable. Pipecat Cloud is optional. | FACT | https://github.com/pipecat-ai/pipecat |
| 2026 incidents | status.daily.co has 13 incidents in 2026, through Jun 11. SIP/PSTN: Jan 13 (SignalWire, about 44 min), Jan 15 dial-out (about 39 min), **Feb 18 inbound SIP/PSTN 480s (about 4.4 h)**, Mar 23 inbound (about 58 min). No incidents Oct 8 to 22. **Pipecat Cloud is not a component** on status.daily.co, and its official status page was not found. | FACT / OPEN QUESTION | https://status.daily.co/history.rss ; https://status.daily.co/ |

**Deal-breakers / standouts**
- Deal-breaker for a solo TS engineer: the server side is Python only. That means a second language, deploy pipeline and test stack.
- Risk: the Twilio Media Streams path has no transfer feature. Warm transfer examples are Daily-transport only.
- Risk: the 50-session pool per deployment returns 429 at the cap. Cold starts of about 10 s or more need paid reserved instances for TV bursts.
- Standout: the cheapest hosting ($0.01/min) and full control. Evals with latency budgets and OTel are strong.

### OpenAI Realtime API / GPT-Live over SIP

| Field | Finding | Label | Source URL |
|---|---|---|---|
| Current realtime models | gpt-realtime-2.1, gpt-realtime-2.1-mini, gpt-realtime-2, gpt-realtime-1.5, gpt-realtime-mini, gpt-realtime. Plus **gpt-live-1** on a separate Live endpoint. No last-updated date. | FACT | https://developers.openai.com/api/docs/pricing |
| gpt-realtime-2.1 price | Audio $32 in / $0.40 cached / **$64 out** per 1M tokens. Text $4 / $0.40 / $24. The 2026-10-20 note is **confirmed**. | FACT | https://developers.openai.com/api/docs/pricing ; https://developers.openai.com/api/docs/models/gpt-realtime-2.1 |
| gpt-realtime-2.1-mini price | Audio $10 / $0.30 / $20. Text $0.60 / $0.06 / $2.40. | FACT | https://developers.openai.com/api/docs/pricing |
| gpt-live-1 price | **$0.05/min**, "billed per second". Backend model and tool usage are billed separately. The 2026-10-20 note is **confirmed**. | FACT | https://developers.openai.com/api/docs/models/gpt-live-1 |
| Token rates | User audio is 1 token per 100 ms (about 600/min). Assistant audio is 1 token per 50 ms (about 1,200/min). The whole conversation is resent on each response, and caching is best-effort. | FACT | https://developers.openai.com/api/docs/guides/realtime-costs |
| Estimated gpt-realtime-2.1 rate | With a 50/50 talk split: 300 tokens in × $32/M ($0.0096) + 600 tokens out × $64/M ($0.0384), about $0.048/min. Add cached context and instructions: about **$0.05 to $0.07/min**, plus Twilio. Mini is about $0.015 to $0.02/min. | INFERENCE | https://developers.openai.com/api/docs/pricing |
| SIP fee | No SIP-specific line on the pricing page. | OPEN QUESTION | https://developers.openai.com/api/docs/pricing |
| SIP connector (Realtime) | Trunk target `sip:$PROJECT_ID@sip.api.openai.com;transport=tls`. Webhook `realtime.call.incoming` (with `call_id` and `sip_headers`). `POST /v1/realtime/calls/{id}/accept`, `/reject` (default 603), `/refer` (`target_uri`), `/hangup`. Sideband `wss://api.openai.com/v1/realtime?call_id=`. TLS on port 5061. SRTP over UDP to 4 listed CIDRs. | FACT | https://developers.openai.com/api/docs/guides/realtime-sip |
| SIP connector (GPT-Live) | Webhook `live.transport.incoming` (`live.call.incoming` deprecated). `/v1/live/sessions/{id}/accept`, `reject`, `refer`, `hangup`. Sideband `/attach`. "GPT-Live requires SRTP". Outbound needs org enablement. Outbound limits: 3 min ringing, 2 h connected. | FACT | https://developers.openai.com/api/docs/guides/voice-sip |
| REFER = cold transfer? | The docs do not say blind or attended. They say only that `target_uri` goes into Refer-To and "The downstream system handles the rest of the call flow". The 2026-10-20 "REFER = cold" note is therefore **not confirmed by the docs**. With Twilio `referUrl` plus `answerOnBridge=true`, the caller stays with the AI until Amy answers, so it behaves warm-ish with return-to-agent. | FACT (doc silence) / INFERENCE (Twilio behavior) | https://developers.openai.com/api/docs/guides/voice-sip ; https://www.twilio.com/docs/voice/api/refer-to-twilio |
| Twilio Elastic SIP Trunk | The official Twilio tutorial (2025-08-29) sets the origination URI `sip:project-id@sip.api.openai.com;transport=tls`. It does not mention SRTP or REFER. | FACT | https://www.twilio.com/en-us/blog/developers/tutorials/product/openai-realtime-api-elastic-sip-trunking |
| TwiML `<Dial><Sip>` to OpenAI | No OpenAI doc mentions it. Twilio `<Sip>` supports TLS, and `;secure=true` enables SRTP. Feasible, but the end-to-end path is undocumented. | OPEN QUESTION (needs a test) | https://developers.openai.com/api/docs/guides/voice-sip ; https://www.twilio.com/docs/voice/api/secure-media |
| Ring Amy first | `/after-amy` returns `<Dial answerOnBridge="true" referUrl="/refer"><Sip>sip:proj_x@sip.api.openai.com;transport=tls;secure=true</Sip></Dial>`. Our webhook accepts `realtime.call.incoming`. A REFER posts to `/refer`, which returns `<Dial><Number url="/screen">Amy</Number></Dial>`. Alternative: `<Connect><Stream>` to our own WS server running the Agents SDK `TwilioRealtimeTransportLayer`. That needs a long-lived WS host, which is not Vercel serverless. | INFERENCE | (rows above) ; https://openai.github.io/openai-agents-js/extensions/twilio/ |
| Twilio Agent Connect | A Twilio post (2026-09-10) says Agent Connect has a native GPTLiveProvider over Media Streams, with Python and TS examples. No TwiML routing or transfer detail. | VENDOR CLAIM | https://www.twilio.com/en-us/blog/developers/twilio-openai-gpt-live-1-api-resources |
| Rate limits (gpt-realtime-2.1) | Build tier: 400 RPM / 200k TPM. Launch: 10,000 / 4M. Grow: 20,000 / 15M. **No concurrent-session limit is documented.** Tiers: Build ($5 credit), Launch ($100), Grow ($500). | FACT | https://developers.openai.com/api/docs/models/gpt-realtime-2.1 ; https://developers.openai.com/api/docs/guides/rate-limits |
| Concurrency (gpt-live-1) | Concurrent sessions: Build 50, Launch 300, Grow 500. Free tier is not supported. | FACT | https://developers.openai.com/api/docs/models/gpt-live-1 |
| Behavior at the limit | Returns 429 with `Retry-After`. Also `slow_down` 429 on "rapid traffic increase", even within limits. | FACT | https://developers.openai.com/api/docs/guides/rate-limits |
| Burst fit | 100 concurrent calls at Build tier (200k TPM) would likely hit TPM, because context is resent. Buying $100 of credits for the Launch tier is cheap insurance. The `slow_down` risk on TV spikes remains. | INFERENCE | https://developers.openai.com/api/docs/guides/rate-limits |
| Session limits | Realtime session max 60 min. | FACT | https://developers.openai.com/api/docs/guides/realtime-conversations |
| Tool calling | Function tools are set via `session.tools`. The model emits `function_call`. We return `function_call_output`, then `response.create`. Over SIP, the sideband WS (server side) runs the tools, which then call our HTTP API. | FACT / INFERENCE (sideband usage) | https://developers.openai.com/api/docs/guides/realtime-conversations |
| MCP | `type:"mcp"`, `server_label`, `server_url`, `authorization` or `headers`, `allowed_tools`, `require_approval`. "MCP tools are executed by the Realtime API itself." The client must send a follow-up `response.create`. | FACT | https://developers.openai.com/api/docs/guides/realtime-mcp |
| GPT-Live tools | GPT-Live delegates reasoning and tools to a backend: Responses delegation (OpenAI-run) or client delegation (our service). The app runs its own function tools. | FACT | https://developers.openai.com/api/docs/guides/live |
| VAD / interruption | `server_vad` (`threshold`, `prefix_padding_ms`, `silence_duration_ms`) and `semantic_vad` (`eagerness` low, medium, high or auto; auto equals medium). `create_response` and `interrupt_response`. | FACT | https://developers.openai.com/api/docs/guides/realtime-vad |
| SIP VAD caveat | "SIP call acceptance only supports a subset of Realtime turn-detection fields". `threshold`, `prefixPaddingMs` or `silenceDurationMs` make `buildInitialConfig()` throw. | FACT | https://openai.github.io/openai-agents-js/guides/voice-agents/transport/ |
| TS Agents SDK | `@openai/agents` **0.21.0** (20 Oct), pre-1.0. `RealtimeAgent`/`RealtimeSession`. `OpenAIRealtimeSIP` transport attaches by `callId`. `TwilioRealtimeTransportLayer` in `@openai/agents-extensions` is marked "still in beta". GPT-Live support in the SDK was not found. | FACT / OPEN QUESTION (GPT-Live) | https://github.com/openai/openai-agents-js/releases ; https://openai.github.io/openai-agents-js/extensions/twilio/ |
| Testing / eval | No Realtime-specific test framework was found in the docs reviewed. | OPEN QUESTION | n/a |
| Observability | Usage appears in `response.done.usage`. The sideband WS sees all events. The Playground has a Logs tab. No per-turn latency traces are documented. | FACT / OPEN QUESTION (traces) | https://developers.openai.com/api/docs/guides/realtime-costs |
| Data retention | `/v1/realtime`: not used for training, 30-day abuse monitoring, no app state, **ZDR eligible**. `/v1/live/sessions`: session storage is off by default and ZDR eligible. | FACT | https://developers.openai.com/api/docs/guides/your-data |
| HIPAA / BAA | The data-controls page does not address BAA for Realtime. The HIPAA help article returned 403. A search snippet says `/v1/realtime` is listed as HIPAA-eligible under a BAA. | OPEN QUESTION | https://help.openai.com/en/articles/20001069-hipaa-eligible-products-and-functionality |
| Lock-in | The model and SIP endpoint are proprietary. The telephony side (Twilio) and tool HTTP API stay ours. Switching means rebuilding the voice layer. | INFERENCE | n/a |
| 2026 incidents | The feed is truncated and only shows back to Jul 25, 2026. Nine incidents list Realtime, Audio or Voice. Those listing **Realtime/Audio** are Oct 21 ("Degraded performance in ChatGPT, Codex, and APIs"), Oct 6, Sep 17, and Jul 25 (two). No durations are stated in the feed. | FACT / OPEN QUESTION (Jan to Jul 2026) | https://status.openai.com/history.rss |

**Deal-breakers / standouts**
- Standout: the least infrastructure. Twilio `<Dial><Sip>` goes to OpenAI, a webhook handles accept, a sideband WS runs tools, and Twilio `referUrl` handles transfer back to Amy. Everything is HTTP and TypeScript-friendly.
- Standout: GPT-Live gives a fixed $0.05/min and documented concurrency (50 even at the Build tier).
- Risk: REFER semantics are undocumented, and `<Dial><Sip>` with SRTP to OpenAI is untested. Prove it with a test call.
- Risk: no first-party eval or per-turn latency tooling. The TS SDK is pre-1.0 and the Twilio adapter is beta.
- Risk: speech-to-speech models are less controllable for "never invent prices/dates". Needs strict tool-only answers plus evals.

### Component unit prices (STT/TTS)

| Component | Unit price | Label | Source URL |
|---|---|---|---|
| Deepgram Nova-3 mono streaming | PAYG **$0.0048/min** (was $0.0077). Growth $0.0042. Marked "Limited-time promotional rates on streaming", no end date. | FACT | https://deepgram.com/pricing |
| Deepgram Nova-3 multilingual | PAYG $0.0058/min. Growth $0.0050. | FACT | https://deepgram.com/pricing |
| Deepgram Flux English | PAYG **$0.0065/min** (was $0.0077). Growth $0.0057. Promotional. | FACT | https://deepgram.com/pricing |
| Deepgram Flux multilingual | PAYG $0.0078/min. Growth $0.0068. | FACT | https://deepgram.com/pricing |
| Deepgram terms | $200 free credit. PAYG streaming concurrency up to 150 (WSS). Growth requires "$4K+ / year". | FACT | https://deepgram.com/pricing |
| Deepgram Aura-2 TTS | $0.030 per 1k characters PAYG. $0.027 on Growth. | FACT | https://deepgram.com/pricing |
| Cartesia plans | Pro $5/mo (100K credits). Startup $49 (1.25M). Scale $299 (8M). Monthly. | FACT | https://cartesia.ai/pricing |
| Cartesia Sonic TTS | "1 credit equals 1 character". "One minute of audio generation requires 750-800 credits". Overage per 1M credits: Pro $65, Startup $45, Scale $38. | FACT | https://cartesia.ai/pricing |
| Cartesia effective rate | Startup: about $39/1M characters, about $0.03 per audio minute. Overage about $0.034 per audio minute. | INFERENCE | https://cartesia.ai/pricing |
| Cartesia concurrency (TTS) | Free 2, Pro 3, Startup 5, Scale 15. A 20-to-100-call burst needs Enterprise or another TTS provider. | FACT / INFERENCE | https://cartesia.ai/pricing |
| Cartesia BAA | "DPAs and BAAs" are listed under Enterprise only. | FACT | https://cartesia.ai/pricing |
| ElevenLabs Flash / Turbo | **$0.04 per 1K characters**, shown as "~$0.04/minute". Same rate on all tiers. | FACT | https://elevenlabs.io/pricing/api |
| ElevenLabs v2 Multilingual / v3 / v4 | $0.08 per 1K characters. v4 Turbo $0.04. | FACT | https://elevenlabs.io/pricing/api |
| ElevenLabs plans | Starter $6. Creator $22. Pro $99. Scale $299. Business $990. Concurrency is not stated for TTS. | FACT | https://elevenlabs.io/pricing/api |
| LiveKit Inference STT | Nova-3 $0.0048 / $0.0042 (Scale). Flux $0.0065 / $0.0057. Same as Deepgram direct. | FACT | https://livekit.com/pricing/inference |
| LiveKit Inference TTS | Cartesia Sonic 3.x $50 per 1M characters ($37.50 on Scale). Aura-2 $30 / $27. Inworld 2.0 $25 / $15. No ElevenLabs. | FACT | https://livekit.com/pricing/inference |
| LiveKit Inference LLM | gpt-4.1-mini $0.40 / $1.60 per 1M (in / out). gpt-5-mini $0.25 / $2.00. | FACT | https://livekit.com/pricing/inference |

---

## Appendix C. Telnyx, Deepgram Voice Agent, Ultravox, Bland, other options, benchmarks


Research date: 2026-10-22. Sources were official vendor pages, docs, and status feeds, read live.
Labels: FACT = read on an official page. VENDOR CLAIM = vendor's own performance or marketing claim.
INFERENCE = my reasoning. OPEN QUESTION = could not verify.
Web search budget ran out late in the session. Items marked OPEN QUESTION were not searched further.

Use case: Twilio number we own. Our webhook rings Amy first (`<Dial><Number url=screen>`). If she does not bridge, an AI agent takes the live call.

Shared Twilio facts used below:
- FACT: `<Dial action>` is requested after the dialed call ends. It carries `DialCallStatus` (completed, busy, no-answer, failed, canceled). Twilio then runs the returned TwiML on the caller's leg. https://www.twilio.com/docs/voice/twiml/dial
- FACT: `<Dial><Sip>` supports UDP/TCP/TLS (`transport=tls`, default port 5061). Custom `X-` headers go as URI query params (URI < 255 chars, headers < 1024 chars). The action callback gets `DialSipResponseCode`. The page does not mention SRTP. https://www.twilio.com/docs/voice/twiml/sip
- INFERENCE: every vendor below can sit behind the existing "ring Amy first" TwiML. Put the AI hand-off TwiML in the `<Dial action>` handler, where it runs when `DialCallStatus != completed` or the screen was declined.

---

### Telnyx AI Assistants (Voice AI)

| Field | Finding | Label | Source URL |
|---|---|---|---|
| Voice engine price | $0.05/min. Covers orchestration, STT (Deepgram models and Telnyx STT), and TTS (Telnyx Ultra, NaturalHD, Rime, Inworld, and others). | FACT | https://telnyx.com/pricing/conversational-ai (redirects to /pricing/voice-ai-agents) |
| Billing rounding | The voice engine is rounded **per call to 60-second increments**. Telnyx says actual charges "can be higher, especially for short calls." | FACT | https://telnyx.com/pricing/conversational-ai |
| LLM price | Billed per token, separately. Kimi on Telnyx GPUs is "typically ~$0.006/min" (estimate assumes ~6k prompt tokens/min). Anthropic and OpenAI models are passed through at list rates. | FACT (rate) / VENDOR CLAIM (per-min estimate) | https://telnyx.com/pricing/conversational-ai |
| Telephony price | Voice-agent carrier cost from $0.0032/min (local inbound US). SIP trunking inbound from $0.0032/min. Inbound SIP URI calls from unidentifiable sources (`unrestricted`) are $0.002/min. Recording is $0.002/min. Conference is $0.002 per participant per minute. | FACT | https://telnyx.com/pricing/conversational-ai ; https://developers.telnyx.com/docs/voice/sip-trunking/features/sip-uri-calling.md |
| All-in estimate | "≈ $0.06/min" = $0.05 + $0.0032 + $0.0064. With our Twilio front end, add Twilio's inbound and SIP-egress legs (not priced here). | VENDOR CLAIM / INFERENCE | https://telnyx.com/pricing/conversational-ai |
| Plans | Pay as you go is $0. Growth has a $2,000/mo minimum spend (15% off). Enterprise has a $5,000/mo minimum. | FACT | https://telnyx.com/pricing/conversational-ai |
| Page date | Structured data shows dateModified 2026-10-01. No visible "last updated" date. | FACT | same |
| Concurrency | Pay as you go: "500 concurrent calls, 100 API req/s". Enterprise has "unlimited rate limits". | FACT (pricing page) | https://telnyx.com/pricing/conversational-ai |
| Behavior at limit | Not documented. The rate-limit doc says Voice limits are in product guides, and I found none. | OPEN QUESTION | https://developers.telnyx.com/docs/development/api-fundamentals/reliability/rate-limiting.md |
| Twilio path (no port) | Telnyx Voice API/TeXML apps and FQDN connections support `sip_subdomain` with `sip_subdomain_receive_settings: from_anyone`. In Telnyx's words, the subdomain "can be called from any SIP endpoint by using the SIP URI sip:@example.sip.telnyx.com". "TLS encrypted calls are not allowed for subdomain calls." | FACT | https://developers.telnyx.com/api-reference/texml-applications/creates-a-texml-application.md ; https://developers.telnyx.com/api-reference/fqdn-connections/create-an-fqdn-connection.md |
| TeXML AI verb | `<Connect action="..."><AIAssistant id="assistant-..."/></Connect>`. When the conversation ends, the action URL gets a `Reason` (e.g. `service_error`) and can return a `<Dial>` fallback. | FACT | https://developers.telnyx.com/docs/voice/programmable-voice/texml-verbs/aiassistant.md |
| Ring-Amy-first mechanism | Twilio webhook: `<Dial action=/after-amy><Number url=/screen>Amy</Number></Dial>`. On failure: `<Dial action=/after-ai><Sip>sip:ai@OURSUB.sip.telnyx.com?X-Lead-Source=tv</Sip></Dial>`. Telnyx TeXML app then returns `<Connect><AIAssistant id=…>`. If Telnyx rejects, the `DialSipResponseCode` in `/after-ai` lets us fall back to voicemail. | INFERENCE (built from the FACT rows above; not tested end to end; no Telnyx doc covers Twilio as the source) | URLs above |
| Passing lead context | `X-` SIP headers map to dynamic variables (`X-Full-Name` becomes `{{full_name}}`). A `dynamic_variables_webhook_url` is POSTed at conversation start (default timeout 1.5 s, up to 10 s). Precedence: API, then SIP headers, then webhook, then defaults. | FACT | https://developers.telnyx.com/docs/inference/ai-assistants/dynamic-variables.md |
| Alternative path | Port the number to Telnyx and rebuild ring-Amy-first in TeXML (Twilio-compatible verbs). TeXML `<Number url>` screening parity is unverified. | INFERENCE / OPEN QUESTION | https://developers.telnyx.com/docs/voice/programmable-voice/texml-verbs/dial.md |
| Number porting required? | No for the SIP-subdomain path. Yes if Telnyx should own the number. | INFERENCE | — |
| Transfers | Built-in Transfer and "SIP Refer" tools (named targets), Handoff between assistants, Send DTMF. | FACT | https://developers.telnyx.com/docs/inference/ai-assistants/no-code-voice-assistant |
| Warm transfer | **Warm Transfer Acceptance**: the assistant consults the destination on a private leg while the caller hears ringback. It delivers a handoff message (`warm_transfer_instructions`) and asks whether they will take the call. On accept, the call bridges and the assistant leaves. On decline, hang-up, or timeout (`timeout_secs` default 60), **the assistant returns to the caller** with the reason. Acceptance is conversational, not by keypress. Works for `ai_assistant_start` conversations only. Optional `bridge_beep`. Voicemail detection on transfer ends the transfer before the consult. | FACT | https://developers.telnyx.com/docs/inference/ai-assistants/warm-transfer-acceptance.md |
| Transfer to Amy when fronted by Twilio | A Telnyx transfer dials Amy from Telnyx (hairpin), with Telnyx outbound cost and the Twilio leg still up. Or SIP REFER back to Twilio (Twilio `<Sip>` supports `referUrl`). Neither is tested. | INFERENCE / OPEN QUESTION | https://www.twilio.com/docs/voice/twiml/dial |
| Barge-in / interruption | `interruption_settings` (enable, `start_speaking_plan`, `wait_seconds`). For `deepgram/flux` STT, end of turn uses `eot_threshold`, `eot_timeout_ms`, `eager_eot_threshold`. A speaking plan and noise suppression are in the portal. | FACT | https://developers.telnyx.com/api-reference/assistants/create-an-assistant.md |
| Tools | Webhook tools (configurable headers, params, dynamic variables; integration secrets), async tools, filler messages, per-caller credentials, MCP servers, client-side tools. A "Test Assistant Tool" API exists. | FACT | https://developers.telnyx.com/docs/inference/ai-assistants/no-code-voice-assistant ; https://developers.telnyx.com/public/llms/ai/assistants.txt |
| Testing / eval | AI Tests (success criteria per assistant) plus test API. Versions (up to 10), traffic rules, **canary % splits**, rollback. Scenario simulation goes through the Coval integration. Import from Vapi, ElevenLabs, and Retell. | FACT | https://developers.telnyx.com/docs/inference/ai-assistants/version-testing-traffic-distribution.md ; https://developers.telnyx.com/docs/inference/ai-assistants/importing.md |
| Observability | Conversation Event Stream: a WebSocket to our server per conversation carrying transcripts, tool calls/results, hangup cause, and transfer completed/failed. Also Conversations API and AI Insights. **No per-turn latency fields documented.** | FACT | https://developers.telnyx.com/docs/inference/ai-assistants/conversation-event-stream.md |
| Data retention | `privacy_settings.data_retention` toggles conversation history and insights storage. `pii_redaction` setting. Account-level recording settings apply separately. | FACT | https://developers.telnyx.com/api-reference/assistants/create-an-assistant.md |
| HIPAA | "HIPAA included in every plan" (pricing page). A Telnyx article says PHI must use Telnyx-hosted models (I did not open the guide). Not needed for our use case. | VENDOR CLAIM / OPEN QUESTION | https://telnyx.com/pricing/conversational-ai |
| TypeScript | Official TS/Node SDK `telnyx` (npm 7.27.0, ships `index.d.ts`). Typed webhooks with ED25519 verification. | FACT | https://developers.telnyx.com/docs/development/sdk/node.md ; https://registry.npmjs.org/telnyx/latest |
| Lock-in | Medium. Assistant config is proprietary, but Telnyx imports from Vapi, ElevenLabs, and Retell. The SIP-subdomain path keeps the number on Twilio. | INFERENCE | — |
| Incidents 2026 (visible) | Feed covers only ~2026-07-27 to 2026-10-22 (175 entries, mostly maintenance). Voice/AI items: 10 Aug "Calls experiencing one-way/dead air audio, call drops and missing call recordings" (all regions incl. US). 10 Aug "Deepgram Flux High Latency". 19 Aug "AI Assistants with Data Locality Australia Failing". 27 Aug "Ultra voices not available, affecting Assistant creation". 10–11 Sep "Issues affecting call audio quality" (incl. Ashburn, San Jose, Chicago). 28 Jul 503s on number/SIP config endpoints. Roughly weekly Voice API/TeXML maintenance windows. | FACT | https://status.telnyx.com/history ; https://status.telnyx.com/history.atom |
| Incidents Jan–Jul 2026 | Not visible in the feed or history page. | OPEN QUESTION | https://status.telnyx.com/history |

**Deal-breakers / standouts**
- Standout: built-in warm transfer with private consult, accept/decline, and **return-to-agent on decline or timeout**. This is the closest native fit to "transfer back to Amy, screened."
- Standout: 500 concurrent calls on pay as you go covers 100-call TV bursts on paper. Lowest p50 in Openbenchmarks (1,296 ms). 100% infra-clean in Cekura.
- Standout: canary/version traffic splits and a typed TS SDK.
- Risk: no Telnyx doc shows a Twilio-originated SIP call into an assistant. The SIP-subdomain path must be tested, including transfers back out.
- Risk: 60-second per-call rounding inflates cost on short calls.
- Risk: the Aug 10 incident (dead air, call drops, all regions). Status history before late July is not visible.

---

### Deepgram Voice Agent API

| Field | Finding | Label | Source URL |
|---|---|---|---|
| Price (Pay as you go / Growth) | Standard $0.075 / $0.068. Standard BYO TTS $0.065 / $0.051. Custom BYO LLM $0.065 / $0.059. BYO LLM+TTS $0.050 / $0.041. Advanced $0.163 / $0.146. Advanced BYO TTS $0.122 / $0.110 per min. | FACT | https://deepgram.com/pricing |
| Billing basis | "calculated based on websocket connection time". Some per-hour figures do not equal per-min × 60 (e.g., Growth Standard). | FACT | https://deepgram.com/pricing |
| What's bundled | STT, LLM, and TTS in one price. The **Standard** tier includes e.g. gpt-5.4-mini, gpt-5-mini, claude-haiku-4-5, gemini-3.5-flash. **Advanced** includes gpt-5.5, claude-sonnet-5, claude-sonnet-4-6, gemini-3-pro-preview. Groq and Bedrock require BYO endpoint. | FACT | https://developers.deepgram.com/docs/voice-agent-llm-models.md |
| Telephony | Not included. Twilio inbound and Media Streams are billed by Twilio. We also host the bridge server. | FACT (no telephony in price) / INFERENCE (cost) | https://developers.deepgram.com/docs/twilio-and-deepgram-voice-agent.md |
| Growth plan | "commitment (starting at $4k/year)". Overage is the Growth rate +10%. | FACT | https://deepgram.com/pricing |
| Concurrency | Voice Agent: Pay as you go **45** (all regions). Growth **60** (NA), 45 elsewhere. Enterprise "Starting at 100". Limits are per project. Splitting projects to evade limits violates ToS. Pay as you go and Growth cannot raise limits. Defaults were tripled from 15 on 2026-02-11. | FACT | https://developers.deepgram.com/reference/api-rate-limits.md ; https://developers.deepgram.com/docs/working-with-concurrency-rate-limits.md ; https://deepgram.com/learn/tripling-default-concurrency-to-power-the-voice-ai-economy |
| Behavior at limit | General guide: "the API will return a 429: Too Many Requests error". It recommends a client-side queue and backoff. The guide does not mention Voice Agent WebSocket specifically. | FACT (general) / OPEN QUESTION (Voice Agent WS specifics) | https://developers.deepgram.com/docs/working-with-concurrency-rate-limits.md |
| Twilio integration | DIY media bridge. TwiML `<Connect><Stream url=wss://OUR_HOST/media>` (bidirectional). Our server opens one Voice Agent WS per call and relays mulaw 8 kHz both ways. On `UserStartedSpeaking`, it sends Twilio `clear`. The guide is Python only. | FACT | https://developers.deepgram.com/docs/twilio-and-deepgram-voice-agent.md ; https://developers.deepgram.com/docs/inbound-telephony-agent |
| Hosted SIP / native Twilio | None documented. Inbound guides cover Twilio (bridge) and Plivo only. | FACT | https://developers.deepgram.com/docs/inbound-telephony-agent |
| Ring-Amy-first mechanism | Fully ours. `/after-amy` returns `<Connect><Stream>` to our bridge. If Deepgram returns 429, the bridge can play a message or redirect to voicemail with Twilio REST. | INFERENCE | https://www.twilio.com/docs/voice/twiml/dial |
| Hosting implication | Needs a long-lived WebSocket server, which Vercel-style serverless functions are not. One TS engineer must run it. | INFERENCE | — |
| Transfers | **None built in.** The only call-control example is a custom `end_call` function. Transfer is DIY: a function calls our server, then Twilio REST `calls.update` with `<Dial>` Amy and `<Number url>` screen. Warm and conference flows are ours to build. Return-to-agent: re-`<Connect><Stream>` and start a new session seeded with the `History` message. | FACT (none built in) / INFERENCE (design) | https://developers.deepgram.com/docs/inbound-telephony-agent ; https://developers.deepgram.com/docs/voice-agent-history.md |
| Barge-in / turn-taking | Flux EOT params (`eot_threshold`, `eager_eot_threshold`, `eot_timeout_ms`), `UpdateListen` mid-session, speculative replies. `defer_until_eot` holds side-effecting functions until the turn is confirmed. `FunctionCallCancelled` fires when the user barges in. | FACT | https://developers.deepgram.com/docs/voice-agents-function-calling.md ; https://developers.deepgram.com/llms.txt |
| Tool-call model | Client-side (our app gets `FunctionCallRequest` over the WS and returns `FunctionCallResponse`) or server-side (`functions[].endpoint` with `url`, `method`, `headers`; Deepgram calls it). Server-side timeouts are not documented. | FACT / OPEN QUESTION (timeouts) | https://developers.deepgram.com/docs/configure-voice-agent.md |
| Testing / eval | Playground and template apps. No hosted test or eval suite found. | FACT (playground) / INFERENCE (no eval suite) | https://developers.deepgram.com/docs/voice-agent |
| Observability | Client-side only. The dashboard "does not give you per-session, turn-by-turn observability". The server emits a per-turn `LatencyReport` (STT/LLM/TTS breakdown). "There is no separate logging API". Usage logs are kept 90 days. | FACT | https://developers.deepgram.com/docs/voice-agent-observability.md |
| Data retention | **By default, audio, transcripts, agent context, and synthesized audio are "Retained to improve our models."** `"mip_opt_out": true` in Settings gives zero retention. No price change for opt-out is mentioned. A third-party LLM in `think` follows its own terms. | FACT | https://developers.deepgram.com/trust-security/your-data.md |
| HIPAA | BAA "for Enterprise customers handling ePHI". SOC 2 Type 2. | FACT | https://deepgram.com/pricing |
| TypeScript | `@deepgram/sdk` (npm 5.15.0, typed). There is a "Build a Voice Agent with JavaScript" guide, but the Twilio guide is Python. | FACT | https://registry.npmjs.org/@deepgram/sdk/latest ; https://developers.deepgram.com/docs/build-a-voice-agent-javascript.md |
| Lock-in | Low. Twilio stays ours. BYO LLM and TTS are possible. Swapping vendors means rewriting the bridge. | INFERENCE | — |
| Incidents 2026 | RSS covers 2026-06-17 to 2026-10-14. Voice Agent: 23 Jun "Voice Agent third-party provider Instability (Anthropic LLMs)". 18 Jun and 21 Jul Gemini LLM errors in Voice Agent. STT: 7 Jul Flux STT 5xx, 24 Aug streaming STT errors, 28 Sep Flux STT latency (US). TTS: Flux TTS errors 25 Sep, 3, 5, 8, and 14 Oct; Aura-2 13 Oct. 24 Jul AWS us-west-2 event. 30 Sep "Elevated API errors". | FACT | https://status.deepgram.com/history.rss |

**Deal-breakers / standouts**
- Deal-breaker (as-is): 45/60 concurrency caps below the 100-call TV burst. Enterprise is needed for ≥100.
- Deal-breaker for a one-engineer team: no built-in transfer and no hosted observability. We must build and run a WebSocket bridge.
- Risk: data is retained for model training by default. Set `mip_opt_out`.
- Risk: dense Flux TTS incident cluster in Sep–Oct 2026, right before the season.
- Standout: maximum control and cheapest BYO tiers. Per-turn `LatencyReport`.
- Not in either independent benchmark.

---

### Ultravox (now owned by Inworld)

| Field | Finding | Label | Source URL |
|---|---|---|---|
| Ownership | Inworld acquired Ultravox (post dated 2026-09-30). "Your agents keep running as usual", "no migration or code change required". Built-in voices moved to Inworld Realtime TTS-2 at no added cost. Roadmap is to "share more… in the coming weeks". Support is now support@inworld.ai. | FACT | https://inworld.ai/blog/inworld-acquires-ultravox ; https://www.ultravox.ai/ ; https://docs.ultravox.ai/gettingstarted/faq.md |
| Per-minute price | $0.05/min on Pay as you go and Pro. Homepage says "(including TTS)". First 30 min free. Billed per 6-second "deciminute". | FACT | https://www.ultravox.ai/pricing ; https://docs.ultravox.ai/gettingstarted/faq.md |
| LLM | The Ultravox speech-native model is in the per-minute rate. "Threads" (parallel side-agents) cost $2.00/1M input and $15.00/1M output tokens. | FACT (threads price) / INFERENCE (main model included) | https://www.ultravox.ai/pricing ; https://docs.ultravox.ai/agents/threads.md |
| SIP fee | 0.5¢/min (Pay as you go), 0.48¢/min (Pro), on top of call minutes. A bridged transfer bills SIP at double the rate while both legs are up. | FACT | https://www.ultravox.ai/pricing ; https://docs.ultravox.ai/telephony/sip.md |
| Plans | Pay as you go $0. **Pro $100/mo "when billed yearly"** ("PRICES MARKED AS ANNUAL RATE"). Enterprise custom. The Scale plan is "no longer offered" (move to Inworld Growth). Page published Oct 9, 2026. | FACT | https://www.ultravox.ai/pricing ; https://docs.ultravox.ai/gettingstarted/concurrency.md |
| Pro monthly billing option | Unclear whether Pro can be paid monthly. | OPEN QUESTION | https://www.ultravox.ai/pricing |
| Concurrency | Pay as you go: **hard cap 5**. Pro: no hard cap, "subject to infrastructure limits under extreme load". Priority concurrency is Enterprise only. | FACT | https://docs.ultravox.ai/gettingstarted/concurrency.md |
| Behavior at limit | Rejected, not queued. Immediate **HTTP 429** with `Retry-After`. Priority accounts get 503 below their priority count. Pro may also get 429 if "we might not have compute available". | FACT | https://docs.ultravox.ai/gettingstarted/concurrency.md |
| Twilio integration | (a) Custom: our webhook creates the call (`medium: {twilio:{}}`) and returns `<Connect><Stream url="JOIN_URL"/></Connect>`. (b) Native: import Twilio credentials and point the number at `https://app.ultravox.ai/api/agents/{id}/telephony_xml`. That mode replaces our webhook. | FACT | https://docs.ultravox.ai/telephony/telephony-platforms.md |
| Ring-Amy-first mechanism | Use custom mode. `/after-amy` calls Ultravox Create Call (agent + templateContext), then returns `<Connect><Stream url=joinUrl>`. On 429, return voicemail TwiML. Twilio streams straight to Ultravox, so we host no media bridge. | INFERENCE (composition of FACTs) | https://docs.ultravox.ai/telephony/telephony-platforms.md ; https://docs.ultravox.ai/gettingstarted/concurrency.md |
| SIP alternative | INVITE to `agent_{agent_id}@{account_sip_domain}`. Uses an IP allowlist (`allowedCidrRanges`, IPv4) or registration. `X-` headers become template context (JSON-parsed). No Twilio example. | FACT | https://docs.ultravox.ai/telephony/sip.md |
| Transfers on Twilio medium | Built-in `coldTransfer` works with imported credentials, but "invoking the tool will immediately end the Ultravox call regardless of whether the transfer succeeds" (**no return-to-agent**). Blind and attended transfers are custom via Twilio REST and Conference. The attended flow puts the caller on hold, dials the human with a whisper of the reason, and the **human presses a key to join**. A TS example exists: `ultravox-examples/telephony/twilio-call-transfer-ts`. | FACT | https://docs.ultravox.ai/telephony/call-transfers.md |
| Transfers on SIP medium | `coldTransfer` (REFER default, or INVITE bridge). If unanswered or declined, "the caller will be returned to the AI agent". Warm transfer: the agent briefs the human first. The human accepts or rejects. On reject, the agent returns to the caller. `TRY_REFER` falls back to a bridge. | FACT | https://docs.ultravox.ai/telephony/call-transfers.md ; https://docs.ultravox.ai/telephony/sip.md |
| Call stages | Supported. Tools can return a new-stage response type (prompt, voice, and tools change mid-call). | FACT | https://docs.ultravox.ai/agents/call-stages.md ; https://docs.ultravox.ai/tools/custom/changing-call-state.md |
| Barge-in / VAD | Multi-model VAD with tunable parameters. Background-noise and background-speaker filtering. | FACT | https://docs.ultravox.ai/noise/understanding-vad.md |
| Tool-call model | HTTP tools (durable or temporary), async tools, client tools. Auth uses `queryApiKey`, `headerApiKey`, or `httpAuth` (Bearer). Tokens are passed per call in `selectedTools[].authTokens`, not stored on the tool. A Test Tool API exists. Timeouts are not stated on the auth page. | FACT / OPEN QUESTION (timeouts) | https://docs.ultravox.ai/tools/custom/authentication.md ; https://docs.ultravox.ai/api-reference/tools/tools-test-post.md |
| Testing / eval | The "Testing & Debugging" page is marked "[Under Construction]". No eval or simulation suite found. There is an unlimited playground. | FACT | https://docs.ultravox.ai/agents/testing-and-debugging.md ; https://www.ultravox.ai/pricing |
| Observability | REST APIs for call messages, stages, tools, call events, recordings, and SIP logs. Signed webhooks with retries. Concurrency-usage API. Per-turn latency metrics are not documented. | FACT / OPEN QUESTION (per-turn latency) | https://docs.ultravox.ai/llms.txt ; https://docs.ultravox.ai/webhooks/overview.md |
| Data retention | "Call data is retained until you delete it". Deletion is via API. `retentionPolicy` auto-delete is Enterprise only. | FACT | https://docs.ultravox.ai/gettingstarted/faq.md |
| HIPAA | BAA "on an Enterprise plan". | FACT | https://docs.ultravox.ai/gettingstarted/faq.md |
| TypeScript | REST API (fetch from Next.js). `ultravox-client` npm 0.6.0 is a browser client with no bundled `types` field. There is a TS transfer example repo. | FACT | https://registry.npmjs.org/ultravox-client/latest ; https://docs.ultravox.ai/apps/sdks.md |
| Lock-in | Medium. Proprietary model and agent config. Ownership change adds roadmap uncertainty. | INFERENCE | — |
| Incidents 2026 | 2 Feb "Intermittent Elevated Latency". 13–14 Feb "Direct outbound telephony calls fail to connect". 4 Mar "Ultravox v0.6 degraded". 7 Apr "Call Webhooks not Firing" (~3 h of updates). None listed after April. The status page says 100% uptime for Call Creation and Inference (~90 days). | FACT | https://status.ultravox.ai/feed.rss ; https://status.ultravox.ai/ |

**Deal-breakers / standouts**
- Standout: the cleanest fit for "our webhook first, then AI". One REST call plus `<Connect><Stream>`, with no media server. 429 at create time gives a clean fallback point.
- Deal-breaker on Pay as you go: hard cap of 5 concurrent. Pro ($100/mo, billed yearly) removes the hard cap, with no guarantee under load.
- Risk: the Twilio-medium cold transfer drops the AI even if Amy does not answer. Warm transfer on Twilio is DIY via conference. Native return-to-agent needs the SIP medium.
- Risk: acquisition by Inworld (2026-09-30). Docs show some stale pages ("Under Construction").
- Not in either independent benchmark.

---

### Bland AI

| Field | Finding | Label | Source URL |
|---|---|---|---|
| Price (pricing page) | Start: $0 platform fee, $0.14/min, $0.05/transfer-min, 10 concurrent, 100 calls/day. Build: $299/mo, $0.12/min, $0.04/transfer-min, 50 concurrent, 2,000/day. Enterprise: custom. | FACT | https://www.bland.ai/pricing |
| Price (billing doc) | Rates are "effective Dec 5, 2025". The doc also lists **Scale $499, $0.11/min, $0.03 transfer, 100 concurrent, 5,000/day, 1,000/hr**. The pricing page does not show Scale. | FACT (discrepancy) | https://docs.bland.ai/platform/billing.md |
| What's bundled | LLM, TTS, STT, and telephony in one per-minute line item. Prorated per second. $0.015 minimum per outbound or failed attempt on Bland telephony. BYOT (own Twilio) transfers are free. Warm-transfer proxy-agent time is billed at the per-minute rate. | FACT / VENDOR CLAIM (bundling) | https://docs.bland.ai/platform/billing.md ; https://docs.bland.ai/llms.txt |
| Hourly caps | Start 100, Build 1,000, Scale 1,000. Hitting a cap means "calls get rejected". | FACT | https://docs.bland.ai/platform/billing.md |
| Behavior at concurrency limit | Not stated for Start, Build, or Scale. For the Agent Phone plan, "a new inbound call hears a busy message". | FACT (Agent Phone) / INFERENCE (likely the same on other plans) / OPEN QUESTION | https://docs.bland.ai/platform/agent-phone-plan |
| BYO Twilio | Generate `encrypted_key` from the Twilio SID and token. Import numbers (`POST /v1/inbound/insert`) and attach them to an agent. Whether Bland rewrites the Twilio number's voice webhook is **not documented**. | FACT / OPEN QUESTION | https://docs.bland.ai/tutorials/custom-twilio.md ; https://docs.bland.ai/agents/dispatch.md |
| SIP | Entitlement-gated ("contact support to enable it for your Enterprise organization"). **TLS-only on TCP 5061, SRTP media**, mutual IP allowlisting. The provider catalog does not list Twilio. | FACT | https://docs.bland.ai/enterprise-features/SIP-integration.md ; https://docs.bland.ai/agents/sip.md |
| Ring-Amy-first mechanism | (a) Simplest: `/after-amy` returns `<Dial>` to a **Bland-purchased number** ($15/mo) over PSTN. This adds a Twilio outbound leg and we lose context passing unless the caller ID is preserved. (b) SIP: Twilio `<Dial><Sip transport=tls>` to `us2.sip.bland.ai:5061`. This needs the Enterprise SIP entitlement, and Twilio SRTP support plus IP allowlisting are unverified. (c) BYOT import probably hands the webhook to Bland, which would break our flow. | INFERENCE / OPEN QUESTION | https://docs.bland.ai/agents/dispatch.md ; https://docs.bland.ai/enterprise-features/SIP-integration.md |
| Transfers | Cold: Transfer Call node or the "Transfer Active Call" API (call leg replaced with `<Dial>`, no announcement). SIP REFER for calls that arrived over SIP. **Warm transfer requires an Enterprise account.** It has hold music, a dynamic or static briefing to the human (`{{call_summary}}`), and optional human-AI conversation before merge. If the human does not answer or the hold timeout hits (30–3600 s), it falls back to **voicemail handling** (end with message or continue in pathway). | FACT | https://docs.bland.ai/tutorials/warm-transfer.md ; https://docs.bland.ai/api-v1/post/calls-active-transfer.md ; https://docs.bland.ai/agents/sip.md |
| Barge-in | `interruption_threshold` (call-level) and `interruptionThreshold` per pathway node. Events `interrupt.early` / `interrupt.late`. | FACT | https://docs.bland.ai/llms-full.txt |
| Tool-call model | Webhook tools (GET/POST only) with URL, query, auth, headers, body, and `{{vars}}`. Named secrets. "Agent speech" filler while a tool runs. Custom code tools. Pathway webhook nodes. Post-call webhooks with HMAC signing (JWT on Enterprise). | FACT | https://docs.bland.ai/agents/tools.md ; https://docs.bland.ai/tutorials/webhook-signing.md |
| Testing / eval | Evaluations (LLM judges, test cases, passing run as a promotion gate), Testbed (replay a turn), Scenarios, Standards (node-level regression), Alerts. Version-controlled releases and canary deploys for Enterprise. | FACT | https://docs.bland.ai/agents/evaluations.md ; https://docs.bland.ai/tutorials/standards.md ; https://docs.bland.ai/enterprise-features/infrastructure-and-releases.md |
| Observability | Pathway call event timeline (transcripts, node transitions, tool/webhook invoke/result/error, interrupts). Dispositions to webhook. Alerts. | FACT | https://docs.bland.ai/tutorials/pathway-call-events.md |
| Data retention | Org property `recording_lifespan_days` (1–1825, or -1). Dispositions skip calls past the retention window. | FACT | https://docs.bland.ai/api-v1/patch/org_properties |
| HIPAA | The pricing FAQ says "HIPAA compliant with a signed BAA". The comparison table lists BAA on Enterprise only. | FACT / VENDOR CLAIM | https://www.bland.ai/pricing |
| Latency claim | "sub-400ms response latency", "up to 1 million concurrent calls". | VENDOR CLAIM | https://docs.bland.ai/llms.txt |
| TypeScript | REST API, CLI, and MCP server. Node.js code samples. No dedicated typed call SDK found. | FACT / INFERENCE | https://docs.bland.ai/sdks/cli.md |
| Lock-in | High. Proprietary pathways, Bland-owned stack, and Bland numbers. | INFERENCE | — |
| Incidents 2026 | 19 Oct "Inbound calls failing to connect" (US, ~8 min, database slowdown). 14 Oct "LLM outage – Widespread agent silence" (upstream inference provider; outbound dispatch blocked and queued; ~1 h). 5 Oct variable-extraction failures (~1 h). 25 Sep missing agent audio (BTTS V3). 14 Sep and 14 Jul LLM latency. 27 Aug voice latency. 5 Jun STT partial outage. 15 May degraded warm transfers. 13 Apr API timeouts. 25 Mar US DB outage. 1 Mar DB downtime. 4 Feb inbound voice fallbacks plus API/DB outage. 28 Jan API/DB outage. | FACT | https://status.bland.ai/history.rss |

**Deal-breakers / standouts**
- Deal-breaker: warm transfer is Enterprise-only, and its failure path is voicemail, not return-to-agent.
- Deal-breaker: no documented way to keep our Twilio webhook in front except PSTN-forwarding to a Bland number. SIP is Enterprise-gated and TLS/SRTP-only.
- Risk: most 2026 incidents of the four, including inbound connect failures (19 Oct) and "agent silence" (14 Oct), weeks before peak season.
- Cost: highest per-minute rate. Build $299/mo for 50 concurrent, so a 100 burst needs Scale ($499) or Enterprise.
- Standout: richest built-in testing, eval, and canary tooling of the four.
- Openbenchmarks p50 1,520 ms / p95 2,248 ms. Not in the Cekura benchmark.

---

### Other options considered

| Option | Decision | Reason | Label | Source URL |
|---|---|---|---|---|
| Cartesia Line | Not deep-dived | $0.06/min agent + $0.014/min with a Cartesia number. Integration overview lists "Cartesia number, Twilio number, or SIP trunk". Concurrency, transfer, and Twilio-inbound details are unverified. Not in either benchmark. Not clearly superior. | FACT (price) / OPEN QUESTION | https://docs.cartesia.ai/pricing.md ; https://docs.cartesia.ai/line/integrations/overview |
| Google Gemini Live API | Excluded | Cekura pass³ 30.5%, infra-clean 72.4%. Worst of 8 on reliability. | FACT (benchmark) | https://benchmarks.cekura.ai/voice-agent-workflows |
| OpenAI GPT Realtime | Excluded here (see Appendix B) | Cekura pass³ 64.6%. DIY telephony. | FACT (benchmark) | same |
| Hume EVI | Excluded | Only third-party pricing found (search budget exhausted before reaching official pages). Telephony and concurrency unverified. | OPEN QUESTION | — |
| Sierra, Synthflow | Not evaluated | Not researched in this pass (search budget). | OPEN QUESTION | — |
| LiveKit, Pipecat | Out of scope (frameworks; see Appendix B) | Cekura pass³ 70.7% (LiveKit), 63.4% (Pipecat). | FACT (benchmark) | same |

---

### Independent benchmarks

#### Openbenchmarks: Voice Agents Latency

| Field | Finding | Label | Source URL |
|---|---|---|---|
| Operator | "Openbenchmarks" / "OpenBenchmarks Labs". "Backed by Y Combinator". No named people or legal entity. Contact: founders@openbenchmarks.com. | FACT | https://openbenchmarks.com/about ; https://github.com/openbenchmarks-labs/voice-agent-latency |
| Conflicts | "We sell evals as a service, and many partners are also customers." "Nobody pays to be included, ranked or removed." It does not sell a voice-agent product. The operator provisions the agents itself ("the ids in config/vendors.yaml are ours"). Telnyx heavily cites this benchmark in its own marketing. | FACT / INFERENCE | https://openbenchmarks.com/about ; https://github.com/openbenchmarks-labs/voice-agent-latency ; https://telnyx.com/resources/voice-ai-latency-benchmark |
| Method | A caller robot dials over real PSTN from Plivo and reads a fixed script. TTFAB is measured from a dual-channel recording with Silero VAD plus an energy refinement and a cross-check. No platform timestamps. Turns failing quality gates are discarded. Endpointing is pinned to 0.1 s on Telnyx, Vapi, and Retell. Bland and ElevenLabs have no equivalent setting. Stacks are **vendor defaults, not pinned**. Recording-path overhead is not subtracted. Regions are not stated. | FACT | https://openbenchmarks.com/voice-agent-latency |
| Sample / date | 550 calls. 2,158 measured turns, 2,078 usable. About 430 turns per platform. Leaderboard generated 2026-08-01. Last call placed 2026-08-01 01:26 UTC. | FACT | https://github.com/openbenchmarks-labs/voice-agent-latency |
| Results (p50 / p95 / cost per min / usable turns) | Telnyx **1,296** / 1,856 / $0.0500 / 419/432. ElevenLabs **1,424** / 1,768 / $0.0794 / 429/432. **Bland 1,520 / 2,248 / $0.1408 / 429/432 (new)**. Vapi **1,558** / 2,008 / $0.0836 / 382/432. Retell **1,740** / 2,259 / $0.1341 / 419/430. | FACT | https://openbenchmarks.com/voice-agent-latency |
| Previously recorded numbers | Match exactly (ElevenLabs 1,424, Vapi 1,558, Retell 1,740, Telnyx 1,296). | FACT | same |
| Caveats | The Vapi row (382/432) conflicts with the methodology text ("345 usable of 391"), and the page does not reconcile them. Retell endpointing is "our claim rather than a verified fact". Deepgram, Ultravox, LiveKit, Pipecat, and OpenAI are **not included**. | FACT | https://github.com/openbenchmarks-labs/voice-agent-latency |

#### Cekura: Voice Agent Workflows

| Field | Finding | Label | Source URL |
|---|---|---|---|
| Operator | Cekura (cekura-ai GitHub). Methodology credited to Luis Ojeda. "Last updated Oct 12, 2026", "frozen v1 release". | FACT | https://benchmarks.cekura.ai/voice-agent-workflows |
| Conflicts | Cekura sells voice-agent testing, QA, and observability ("The reliability layer for voice agents"). It lists **LiveKit, Pipecat, ElevenLabs, Cartesia, Retell AI, Vapi** as partners. Retell (#1), LiveKit (#2), and ElevenLabs (#3) are partners. Telnyx is not listed as a partner. It does not sell a voice-agent platform. | FACT / INFERENCE | https://www.cekura.ai/ |
| Method | 8 configurations, 82 scenarios, 3 retained repeats each, 246 calls per configuration (1,968 total). Providers chose their own models and settings. All got the same prompt, tools, and test data. Pass requires a 5/5 Expected Outcome. Non-connects stay in the denominator. **pass³** = share of the 82 scenarios passed on all 3 runs. | FACT | https://benchmarks.cekura.ai/voice-agent-workflows |
| Results (pass³ / task completion / infra clean / interruption /5 / naturalness /5 / mean response) | Retell **75.6%** / 93.9 / 98.4 / 5.00 / 4.36 / 2.21 s. **LiveKit 70.7%** / 95.1 / 99.2 / 4.97 / 4.36 / 2.59 s. ElevenLabs **69.5%** / 91.5 / 100.0 / 4.96 / 4.47 / 1.27 s. **Telnyx 68.3%** / 97.6 / 100.0 / 4.63 / 4.21 / 1.82 s. **GPT Realtime 64.6%** / 92.7 / 95.5 / 4.98 / 4.25 / 1.58 s. **Pipecat 63.4%** / 94.2 / 97.2 / 4.97 / 3.74 / 1.97 s. Vapi **59.8%** / 97.6 / 82.9 / 4.73 / 4.08 / 3.08 s. **Gemini Live 30.5%** / 87.8 / 72.4 / 4.97 / n/a / 3.05 s. | FACT | https://benchmarks.cekura.ai/voice-agent-workflows |
| Previously recorded numbers | Match (Retell 75.6, ElevenLabs 69.5, Vapi 59.8). | FACT | same |
| Not included | Deepgram, Ultravox, Bland. | FACT | same |
| Caveat | Telnyx has the lowest interruption score of all 8 (4.63/5; next lowest Vapi 4.73). That may matter for callers who barge in a lot. | FACT (score) / INFERENCE (impact) | same |

#### Cross-benchmark read (INFERENCE)
- Telnyx is the only vendor in my group that appears in both. It has the lowest latency p50 and 100% infra-clean, but mid-pack on pass³ and the lowest interruption score.
- Bland is mid-pack on latency and has no workflow-reliability data.
- Deepgram and Ultravox have no independent data. Run our own test calls (e.g., 50 scripted calls per vendor) before deciding.

---

## Appendix D. Post-call orchestration


Research date: 2026-10-22. Sources: official docs, pricing pages, npm registry, GitHub repos.

Labels:
- **FACT**: read on an official page.
- **VENDOR CLAIM**: a vendor's marketing or comparison statement.
- **INFERENCE**: my reasoning.
- **OPEN QUESTION**: could not verify.

### Scale assumptions (used for every cost row)

| Field | Value | Label | Source URL |
|---|---|---|---|
| Runs per month (R) | 400 to 2,000 (one per inbound call, spiky) | INFERENCE (from brief) | n/a |
| Steps per run (S) | ~15 (extract, confidence, score, task, notify, attribution, follow-ups) | INFERENCE (from brief) | n/a |
| Timers per run (T) | ~3 (2h re-notify, day-3 follow-up, one more) | INFERENCE (from brief) | n/a |
| Active compute per run | ~60 s (mostly waiting on LLM and HTTP I/O) | INFERENCE | n/a |
| Excluded | LLM token costs, SMS/email costs, Supabase | INFERENCE | n/a |

---

### 1. LangGraph JS (langgraphjs)

| Field | Finding | Label | Source URL |
|---|---|---|---|
| Version / license | `@langchain/langgraph` 1.5.2, MIT. | FACT | https://registry.npmjs.org/@langchain/langgraph/latest |
| Repo license | langgraphjs repo is MIT. | FACT | https://github.com/langchain-ai/langgraphjs |
| Checkpoint granularity | "LangGraph creates a checkpoint at each super-step boundary." | FACT | https://docs.langchain.com/oss/javascript/langgraph/checkpointers |
| Pending writes | Writes from nodes that succeeded in a failed super-step are stored. They are not re-run on resume. | FACT | https://docs.langchain.com/oss/javascript/langgraph/checkpointers |
| Durability modes | `exit` (persist only when run exits), `async` (persist while next step runs; small crash risk), `sync` (persist before next step). | FACT | https://docs.langchain.com/oss/javascript/langgraph/checkpointers |
| Durable-execution page | Old `/durable-execution` URL now serves the persistence page. | FACT | https://docs.langchain.com/oss/javascript/langgraph/durable-execution |
| Resume after crash | You can "restart your graph from the last successful step". Docs show resume via `invoke(null, config)` with the same `thread_id`. | FACT | https://docs.langchain.com/oss/javascript/langgraph/fault-tolerance |
| Automatic resume | Nothing in the OSS library restarts a crashed run by itself. Your code must detect and re-invoke. | INFERENCE (docs are silent) | https://docs.langchain.com/oss/javascript/langgraph/fault-tolerance |
| Replay side effects | Nodes after the checkpoint re-execute, "including any LLM calls, API requests". | FACT | https://docs.langchain.com/oss/javascript/langgraph/checkpointers |
| Retries | Opt-in `retryPolicy` per node. Defaults: maxAttempts 3, initialInterval 500 ms, backoffFactor 2, maxInterval 128 s, jitter on. | FACT | https://docs.langchain.com/oss/javascript/langgraph/fault-tolerance |
| Idempotency | No idempotency guidance on checkpointer or fault-tolerance pages. | FACT (absence) | https://docs.langchain.com/oss/javascript/langgraph/checkpointers |
| Postgres checkpointer | `@langchain/langgraph-checkpoint-postgres` 1.1.2, MIT. Lives in langgraphjs monorepo. Depends on `pg`. | FACT | https://registry.npmjs.org/@langchain/langgraph-checkpoint-postgres/latest |
| Postgres checkpointer setup | `PostgresSaver.fromConnString(...)`, call `setup()` before first use to create tables. | FACT (official reference, read via search excerpt) | https://reference.langchain.com/javascript/modules/_langchain_langgraph-checkpoint-postgres.html |
| Postgres caveats | `thread_id` under 255 chars. Checkpoints accumulate; prune them. | FACT | https://docs.langchain.com/oss/javascript/langgraph/persistence |
| Supabase pooler fit | Not verified with Supavisor transaction mode. | OPEN QUESTION | n/a |
| Interrupts (HITL) | `interrupt()` pauses; resume with `new Command({ resume })`. Needs checkpointer and same thread ID. | FACT | https://docs.langchain.com/oss/javascript/langgraph/interrupts |
| Interrupt re-execution | "the runtime restarts the entire node from the beginning". Code before `interrupt()` re-runs. | FACT | https://docs.langchain.com/oss/javascript/langgraph/interrupts |
| Interrupt timeout | Graph "waits indefinitely until you resume". No timeout or scheduled resume documented. | FACT | https://docs.langchain.com/oss/javascript/langgraph/interrupts |
| Durable sleep / timers | None in OSS library. "Re-notify in 2h" needs an external scheduler. | INFERENCE (not in any page read) | https://docs.langchain.com/oss/javascript/langgraph/interrupts |
| Cron (platform only) | LangSmith Deployment has cron jobs. Recurring only, UTC. No one-off delayed run documented. | FACT | https://docs.langchain.com/langsmith/cron-jobs |
| Platform pricing: plan | Deployment is "N/A" on Developer. Plus is $39/seat/month. | FACT | https://www.langchain.com/pricing |
| Platform pricing: deployments | Plus includes "1 free Serverless (Small) deployment". More deployments are metered in LSUs ($1/LSU). | FACT | https://www.langchain.com/pricing |
| Platform pricing: meters | Runtime compute 0.0675 LSU/vCPU-hr. Runtime memory 0.0090 LSU/GiB-hr. DB compute 0.177 LSU/vCPU-hr. DB memory 0.025 LSU/GiB-hr. Billed per second. | FACT | https://www.langchain.com/pricing |
| Per-node-execution pricing | Not on current pricing page. Old per-node / per-uptime-minute model no longer listed. | FACT (absence) | https://www.langchain.com/pricing |
| Serverless deployments | "scale to zero when idle"; intended for "background agents". | FACT | https://www.langchain.com/pricing |
| Self-host: plan | "Self-hosted deployments require an Enterprise plan." Needs license key. | FACT | https://docs.langchain.com/langsmith/deploy-to-self-hosted-overview |
| Self-host: standalone server | Requires `LANGGRAPH_CLOUD_LICENSE_KEY`, Postgres, and Redis. Calls `beacon.langchain.com` for license checks. | FACT | https://docs.langchain.com/langsmith/deploy-standalone-server |
| Self-host: serverless | "Do not run standalone servers in serverless environments." | FACT | https://docs.langchain.com/langsmith/deploy-standalone-server |
| Inside Vercel functions | Library works. Each invocation must finish within function maxDuration: 300 s Hobby; 800 s on Pro. | FACT (limits) / INFERENCE (fit) | https://vercel.com/docs/functions/limitations |
| Cost at our scale | OSS + PostgresSaver: $0 extra, but you still need a scheduler. LangSmith Deployment: about $39/month (1 Plus seat, free Small serverless deployment). | INFERENCE | https://www.langchain.com/pricing |
| Lock-in | Library is MIT. The platform server needs a license. Cron and auto-resume are platform-only. | INFERENCE | https://docs.langchain.com/langsmith/deploy-standalone-server |
| Ops burden (1 engineer) | Medium. You add your own scheduler, crash detection, and resume, plus checkpoint pruning. | INFERENCE | n/a |

### 2. OpenAI Agents SDK for JS/TS (`@openai/agents`)

| Field | Finding | Label | Source URL |
|---|---|---|---|
| Version / license | `@openai/agents` 0.21.0 (pre-1.0), MIT. | FACT | https://registry.npmjs.org/@openai/agents/latest |
| Features | Agents, handoffs, guardrails, tracing, sessions, human in the loop, realtime agents. | FACT | https://github.com/openai/openai-agents-js |
| Tools / MCP | Function tools, hosted tools, and MCP server classes. | FACT | https://openai.github.io/openai-agents-js/ |
| Built-in durability | None documented. No Temporal or durable-execution integration in the SDK docs. | FACT (absence) | https://openai.github.io/openai-agents-js/ |
| HITL | `needsApproval` on tools. Run pauses and returns `interruptions`. Use `state.approve()` / `state.reject()`, then `runner.run(agent, state)`. | FACT | https://openai.github.io/openai-agents-js/guides/human-in-the-loop/ |
| Pause across restarts | Serialize with `result.state.toString()`. Restore with `RunState.fromString(agent, s)`. Store "in application-controlled storage, such as a server-side database." | FACT | https://openai.github.io/openai-agents-js/guides/human-in-the-loop/ |
| Snapshot security | Snapshot is not authenticated. Only load trusted snapshots. | FACT | https://openai.github.io/openai-agents-js/guides/human-in-the-loop/ |
| Timers / retries / idempotency | Not part of the SDK. | INFERENCE | https://openai.github.io/openai-agents-js/ |
| Temporal integration | `@temporalio/openai-agents` for TS is "Pre-release". Agent loop runs in the Workflow. Model calls run as Activities. | FACT | https://docs.temporal.io/develop/typescript/integrations/openai-agents |
| Cost at our scale | $0 library. Model tokens only. | INFERENCE | n/a |
| Next.js / Vercel fit | Runs in any Node function. Durability must come from elsewhere. | INFERENCE | n/a |
| Fit for this pipeline | Low. The pipeline is a fixed sequence, not a multi-agent loop. | INFERENCE | n/a |

### 3. Inngest

| Field | Finding | Label | Source URL |
|---|---|---|---|
| SDK version / license | `inngest` 4.25.0, Apache-2.0. | FACT | https://registry.npmjs.org/inngest/latest |
| Server license | Server and CLI under SSPL. Converts to Apache 2.0 "on the third anniversary" of each release. | FACT | https://github.com/inngest/inngest/blob/main/LICENSE.md |
| Step memoization | "Inngest resumes a run by replaying your handler and returning saved step results." | FACT | https://www.inngest.com/docs/learn/how-functions-are-executed |
| Code outside steps | "Code outside a step can run again each time the handler replays." | FACT | https://www.inngest.com/docs/learn/how-functions-are-executed |
| v4 checkpointing | Default in TS SDK v4: steps run back to back in one handler. Falls back to one request per step on retries or parallel steps. | FACT | https://www.inngest.com/docs/learn/how-functions-are-executed |
| Retries | Default "four retries after the initial attempt". Each `step.run()` has its own counter. Max 20 in v4. Backoff with jitter. | FACT | https://www.inngest.com/docs/features/inngest-functions/error-retries/retries |
| Non-retriable errors | `NonRetriableError` stops retries. `RetryAfterError` sets the next retry time. | FACT | https://www.inngest.com/docs/features/inngest-functions/error-retries/retries |
| Idempotency: event | An event `id` dedupes for 24 hours. | FACT | https://www.inngest.com/docs/guides/handling-idempotency |
| Idempotency: function | `idempotency` CEL key: one run per unique value per 24 hours. | FACT | https://www.inngest.com/docs/guides/handling-idempotency |
| Idempotency: external calls | Use a stable operation key, not a per-attempt ID. | FACT | https://www.inngest.com/docs/guides/handling-idempotency |
| Sleep | `step.sleep()` / `step.sleepUntil()` up to 1 year, capped by plan max run length. | FACT | https://www.inngest.com/docs/usage-limits/inngest |
| Sleep resources | "A sleep or event wait pauses the run without keeping your function process active." | FACT | https://www.inngest.com/docs/learn/inngest-steps |
| Wait for event (HITL) | `step.waitForEvent(id, { event, timeout, match / if })` returns `Promise<null \| EventPayload>`. | FACT | https://www.inngest.com/docs/reference/functions/step-wait-for-event |
| Cancellation | `cancelOn` up to 5 events, with `match` or `if` and optional `timeout`. Can cancel a sleeping run. Takes effect between steps. | FACT | https://www.inngest.com/docs/features/inngest-functions/cancellation/cancel-on-events |
| Bulk cancel | Dashboard and REST `POST /v1/cancellations`. | FACT | https://www.inngest.com/docs/guides/cancel-running-functions |
| Flow control | Concurrency (with keys), throttle, rate limit, debounce. | FACT (official docs, read via search excerpt) | https://www.inngest.com/docs/guides/concurrency |
| Platform limits | 1,000 steps/function. 4 MiB step output. 32 MiB run state. | FACT | https://www.inngest.com/docs/usage-limits/inngest |
| Vercel integration | Official integration syncs app on each deploy. Endpoint at `/api/inngest` exporting GET/POST/PUT. Set `maxDuration`. | FACT | https://www.inngest.com/docs/deploy/vercel |
| Preview deploys | Vercel Deployment Protection may need a bypass key. | FACT | https://www.inngest.com/docs/deploy/vercel |
| Pricing: Free | $0. 50k executions. 5 concurrent steps. 30-day max run. 24-hour trace history. | FACT | https://www.inngest.com/pricing |
| Pricing: Pro | From $99/month. 1M executions. 100 concurrent steps. 7-day traces. | FACT | https://www.inngest.com/pricing |
| Execution definition | "A single durable function run or step execution". 5 `step.run()` = 6 executions. | FACT | https://www.inngest.com/pricing |
| Over quota (Free) | "execution pauses once you hit the free quota, and you'll need to upgrade to resume." | FACT | https://www.inngest.com/pricing |
| Do sleeps/waits count? | Not stated. | OPEN QUESTION | https://www.inngest.com/pricing |
| Over concurrency (Free) | Queuing behavior not stated on pricing page. | OPEN QUESTION | https://www.inngest.com/pricing |
| Cost at our scale | R x (S+1) = 6,400 to 32,000. Worst case with T counted: 7,600 to 38,000. Under 50k Free. $0 + tiny Vercel compute. Pro ($99) only if you need longer traces or more concurrency. | INFERENCE | https://www.inngest.com/pricing |
| Self-host | Single binary `inngest start`. SQLite default; optional Postgres and external Redis. No guaranteed support. | FACT | https://www.inngest.com/docs/self-hosting |
| AgentKit | `@inngest/agent-kit` 0.13.2, Apache-2.0. Not needed for a fixed pipeline. | FACT (version) / INFERENCE (fit) | https://registry.npmjs.org/@inngest/agent-kit/latest |
| Lock-in | SDK code is Inngest-specific. Self-host escape hatch exists (SSPL). | INFERENCE | https://github.com/inngest/inngest |
| Ops burden | Low on Cloud. One more vendor account, keys, and sync. | INFERENCE | n/a |

### 4. Trigger.dev

| Field | Finding | Label | Source URL |
|---|---|---|---|
| Platform license | Apache License 2.0. | FACT | https://raw.githubusercontent.com/triggerdotdev/trigger.dev/main/LICENSE |
| SDK version / license | `@trigger.dev/sdk` 4.7.6, MIT. | FACT | https://registry.npmjs.org/@trigger.dev/sdk/latest |
| Where code runs | Tasks run on Trigger.dev infra (Cloud or self-hosted), not on Vercel. App calls `tasks.trigger`. | FACT | https://trigger.dev/docs/how-it-works |
| Durability mechanism | CRIU checkpoint of the whole process during waits. Restored into a new environment. | FACT | https://trigger.dev/docs/how-it-works |
| Retry granularity | "When retried, it starts from the beginning, but leverages cached results for completed subtasks." | FACT | https://trigger.dev/docs/how-it-works |
| Implication | Per-step memoization needs subtasks or idempotent code. | INFERENCE | https://trigger.dev/docs/how-it-works |
| Retries config | Defaults in `trigger.config`; per-task `retry`. `retry.onThrow()`, `retry.fetch()`. `AbortTaskRunError` stops retries. | FACT | https://trigger.dev/docs/errors-retrying |
| Idempotency keys | Same key returns the existing run. Default TTL 30 days. Scopes: run, attempt, global. Failed runs clear the key. | FACT | https://trigger.dev/docs/idempotency |
| Waits | `wait.for` / `wait.until`. Examples up to 1 year. Waits accept idempotency keys. | FACT | https://trigger.dev/docs/wait-for |
| Wait billing | "a wait longer than 5 seconds does not count towards compute usage." Concurrency slot freed at 60 s. | FACT | https://trigger.dev/docs/wait-for |
| Checkpoint threshold conflict | How-it-works says waits under 60 s don't checkpoint. Pricing says >5 s is free. | FACT (both pages) | https://trigger.dev/docs/how-it-works |
| HITL | Waitpoint tokens: `wait.createToken({ timeout })`, `wait.forToken()`. Complete via SDK or HTTP POST to token URL. Timeout returns `ok: false`. | FACT | https://trigger.dev/docs/wait-for-token |
| Run TTL | Cloud enforces max 14-day TTL. It limits queue wait only, not run lifetime. | FACT | https://trigger.dev/docs/limits |
| Competitor claim | Workflow SDK page says Trigger.dev has a "14-day maximum run lifetime". Conflicts with the limits page. | VENDOR CLAIM | https://workflow-sdk.dev/docs/comparisons/workflow-sdk-vs-trigger-dev |
| Pricing: plans | Free $0 ($5 credit). Hobby $10 ($10 credit). Pro $50 ($50 credit). | FACT | https://trigger.dev/pricing |
| Pricing: compute | Micro $0.0000169/s. Small 1x (default) $0.0000338/s. | FACT | https://trigger.dev/pricing |
| Pricing: invocation | $0.000025 per run ($0.25 per 10k). | FACT | https://trigger.dev/pricing |
| Free plan limits | 20 prod concurrency. 10 schedules. 1-day log retention. | FACT | https://trigger.dev/docs/limits |
| Cost at our scale | Compute R x 60 s x $0.0000338 = $0.81 to $4.06. Invocations with subtasks R x 16 x $0.000025 = $0.16 to $0.80. About $1 to $5: Free credit at the low end, Hobby $10 at the top. | INFERENCE | https://trigger.dev/pricing |
| LLM I/O billing | Time a running task waits on an LLM HTTP call is likely billed compute. Only `wait.*` pauses are free. | INFERENCE | https://trigger.dev/docs/wait-for |
| Next.js fit | `/trigger` folder in repo. Separate deploy via CLI, GitHub Actions, or Vercel integration. `syncVercelEnvVars` extension. | FACT | https://trigger.dev/docs/guides/frameworks/nextjs |
| Self-host | Docker Compose or Helm. Checkpoints not available self-hosted. No dedicated support. | FACT | https://trigger.dev/docs/open-source-self-hosting |
| Ops burden | Low on Cloud. Second deploy target and a second runtime to debug. | INFERENCE | n/a |

### 5. Vercel Workflow (Workflow SDK, "use workflow" / "use step")

| Field | Finding | Label | Source URL |
|---|---|---|---|
| Status | "Vercel Workflows is generally available on April 16" (2026). Beta started Oct 2025. | FACT | https://vercel.com/blog/a-new-programming-model-for-durable-execution |
| SDK version / license | `workflow` 5.2.3, Apache-2.0. v5 is latest; v4 is maintenance. | FACT | https://registry.npmjs.org/workflow/latest |
| Repo license | vercel/workflow is Apache-2.0. | FACT | https://github.com/vercel/workflow |
| Durability model | Event log of inputs/outputs. On crash or deploy, "replays execution deterministically from where it stopped." | FACT | https://vercel.com/docs/workflows/concepts |
| Steps | `'use step'` gives built-in retries. Each step compiles into an isolated route. | FACT | https://vercel.com/docs/workflows/concepts |
| Retries | "steps retry up to 3 times on arbitrary errors". `maxRetries`, `FatalError`, `RetryableError({ retryAfter })`. | FACT | https://workflow-sdk.dev/docs/foundations/errors-and-retries |
| Step idempotency | Stable `stepId` across retries via `getStepMetadata()`. "Use it as the idempotency key when calling third-party APIs." | FACT | https://workflow-sdk.dev/docs/foundations/idempotency |
| Run dedupe | No atomic dedupe key on `start()`. Docs suggest hook-token conflicts or a durable request record. | FACT | https://workflow-sdk.dev/docs/api-reference/workflow-api/start |
| Sleep | `sleep('7 days')` consumes no compute. Max sleep duration: no limit. Max run duration: no limit. | FACT | https://vercel.com/docs/workflows/pricing |
| Hooks (HITL) | `defineHook()`, `hook.create({ token })`, resume from a route with `hook.resume(token, payload)`. | FACT | https://vercel.com/docs/workflows/concepts |
| Timeout pattern | "Race a hook against `sleep()` to stop waiting after a deadline." Docs example sends a reminder each time the timer wins. | FACT | https://workflow-sdk.dev/docs/foundations/hooks |
| Race caveat | "`Promise.race` doesn't cancel" the losing step. Pass an `AbortSignal` into the step. | FACT | https://workflow-sdk.dev/cookbook/common-patterns/timeouts |
| Webhooks | `createWebhook()` exposes a public URL. Token is the only auth; verify requests (e.g. HMAC). | FACT | https://workflow-sdk.dev/docs/foundations/hooks |
| Concurrency control | No first-class concurrency key. "Enforce in steps / at the publisher." | FACT (vendor docs) | https://workflow-sdk.dev/docs/comparisons/workflow-sdk-vs-trigger-dev |
| Concurrency roadmap | Native concurrency controls and a lock primitive listed for Workflows 5 roadmap. | VENDOR CLAIM | https://vercel.com/blog/a-new-programming-model-for-durable-execution |
| Skew protection | Runs stay on the deployment that created them. Rollback does not stop old runs. | FACT | https://vercel.com/docs/workflows/concepts |
| Pricing: events | Hobby 50k/month included. On-demand $0.02 per 1K events. | FACT | https://vercel.com/docs/workflows/pricing |
| Pricing: data | Data written: 1 GB on Hobby, then $0.50/GB. Data retained: $0.50/GB-month (not on Hobby). | FACT | https://vercel.com/docs/workflows/pricing |
| Event counting | A step makes 3 events (created, started, completed). A sleep makes 2. A hook makes at least 2. | FACT | https://workflow-sdk.dev/docs/how-it-works/event-sourcing |
| Other meters | Function compute at normal rates. Queue ops at $0.60 per 1M (iad1). | FACT | https://vercel.com/docs/pricing/regional-pricing/iad1 |
| Queue ops per step | Not documented. | OPEN QUESTION | https://vercel.com/docs/queues/pricing |
| Limits | 10,000 steps/run. 25,000 events/run. 50 MB payload. 240 s max replay time. | FACT | https://vercel.com/docs/workflows/pricing |
| Hobby restriction | Hobby is "non-commercial, personal use only". A business needs Pro ($20/developer seat/month). | FACT | https://vercel.com/docs/plans/hobby |
| Pro included credit | Not checked. | OPEN QUESTION | n/a |
| Cost at our scale | ~56 events/run (3 run + 45 step + 6 sleep + 2 hook). R x 56 = 22,400 to 112,000 events = $0.45 to $2.24. Data and queue ops add cents. About $1 to $3/month on top of Vercel Pro. | INFERENCE | https://vercel.com/docs/workflows/pricing |
| Portability ("Worlds") | Official worlds: Local, Postgres (`@workflow/world-postgres`), Vercel. Plus many community worlds. | FACT | https://raw.githubusercontent.com/vercel/workflow/main/worlds-manifest.json |
| Postgres World caveats | Uses graphile-worker. Needs a long-lived worker process. "not compatible with Vercel deployments". "not optimized for scale, speed, or security". | FACT | https://workflow-sdk.dev/docs/deploying/world/postgres-world |
| Postgres World in production | "a Postgres reference implementation that real customers run in production". | VENDOR CLAIM | https://vercel.com/blog/a-new-programming-model-for-durable-execution |
| Next.js fit | Native: same repo, same deploy, Vercel dashboard observability. | FACT (features) / INFERENCE (fit) | https://vercel.com/docs/workflows |
| Lock-in | SDK is Apache-2.0. Managed world is Vercel-only. Leaving means running Postgres World plus a worker. | INFERENCE | https://workflow-sdk.dev/docs/deploying/world/postgres-world |
| Ops burden | Lowest of all options on Vercel. No new vendor. | INFERENCE | n/a |

### 6. Temporal TypeScript SDK

| Field | Finding | Label | Source URL |
|---|---|---|---|
| SDK version / license | `@temporalio/workflow` 1.24.0, MIT. | FACT | https://registry.npmjs.org/@temporalio/workflow/latest |
| Repo licenses | sdk-typescript MIT. temporal server MIT. | FACT | https://github.com/temporalio/sdk-typescript ; https://github.com/temporalio/temporal |
| Determinism | Workflows run in a sandbox. `Math.random()`, `Date`, `setTimeout()` replaced with deterministic versions. I/O must go through Activities. | FACT | https://docs.temporal.io/develop/typescript/workflows/basics |
| Timers | Durable timers via `sleep()`. Resolve even if a Worker was down when time elapsed. | FACT | https://docs.temporal.io/develop/typescript/timers |
| HITL | Signals (async), Queries (read), Updates (sync, with validator). `condition()` waits; timeout pattern shown. | FACT | https://docs.temporal.io/develop/typescript/message-passing |
| Worker runtime | "strongly discourage running Temporal Workers in anything except authentic Node.js". Node 20/22/24. | FACT | https://github.com/temporalio/sdk-typescript |
| Serverless Workers | Lambda and Cloud Run in Public Preview (TS supported). Vercel not listed. | FACT | https://docs.temporal.io/evaluate/serverless-workers |
| Vercel fit | Workers must be long-running Node outside Vercel. Vercel only hosts the client. | INFERENCE | https://docs.temporal.io/evaluate/serverless-workers |
| Cloud plans | Developer: no base fee; "10% of usage spend". Business: greater of $500/month or 10%. | FACT | https://docs.temporal.io/cloud/pricing |
| Action price | Developer $50 per 1M actions. | FACT | https://docs.temporal.io/cloud/pricing |
| What counts | Workflow start, each Activity start or retry, Timer, Signal, Query, Update, Heartbeat (if it reaches server). | FACT | https://docs.temporal.io/cloud/actions |
| Storage | Active $0.042/GB-hr. Retained $0.00105/GB-hr. | FACT | https://docs.temporal.io/cloud/pricing |
| Credits | New users get $150 for 90 days. | FACT | https://temporal.io/pricing |
| Cost at our scale | ~20 actions/run. R x 20 = 8k to 40k actions = $0.40 to $2.00, +10% = $0.44 to $2.20/month. Plus worker hosting. | INFERENCE | https://docs.temporal.io/cloud/pricing |
| Worker hosting cost | Not priced here (separate host). | OPEN QUESTION | n/a |
| Self-host | Needs Temporal Service + DB. Postgres/MySQL/SQLite supported for visibility. Elasticsearch recommended beyond "a few" executions. | FACT | https://docs.temporal.io/self-hosted-guide/visibility |
| LangGraph plugin | Official LangGraph plugin is Python only, experimental. Not on TS integrations list. | FACT | https://docs.temporal.io/develop/typescript/integrations/ |
| Ops burden | Highest. Worker fleet, versioning, determinism discipline, second deploy target. | INFERENCE | n/a |

---

### Comparison table

| Tool | Durability | Retries / idempotency | Timers | HITL | Cost at our scale (per month) | Next.js / Vercel fit | License |
|---|---|---|---|---|---|---|---|
| LangGraph JS (OSS) | Checkpoint per super-step. No auto-resume. | Opt-in node retryPolicy. No idempotency keys. | None native. Platform has cron only. | `interrupt()`; waits forever, no timeout. | $0 library; needs a scheduler. Platform about $39 (Plus seat). | Library OK inside maxDuration. Platform server not serverless. | MIT (lib); Enterprise license to self-host server |
| OpenAI Agents SDK | None built-in. RunState serializable. Temporal TS plugin pre-release. | None built-in. | None. | Tool approvals; serialize state to DB. | $0 library | Fine as a library | MIT |
| Inngest | Step memoization and replay. | 4 retries/step default. Event id and function idempotency keys (24h). | `step.sleep` / `sleepUntil` up to 1 yr (plan cap). `cancelOn`. | `step.waitForEvent` with timeout and match. | $0 (Free 50k executions covers 6.4k to 38k). Pro $99. | Strong: serve route + Vercel integration | SDK Apache-2.0; server SSPL to Apache after 3 yrs |
| Trigger.dev | CRIU process checkpoint. Retry restarts task; subtasks cached. | Configurable retries. Idempotency keys, 30-day TTL. | `wait.for` / `wait.until`, free when >5 s. | Waitpoint tokens with timeout and callback URL. | About $1 to $5 (Free $5 credit or Hobby $10) | Code in repo, runs on Trigger.dev infra; separate deploy | Apache-2.0 platform; MIT SDK |
| Vercel Workflow | Event-sourced deterministic replay. GA since Apr 16, 2026. | 3 retries/step default. Stable `stepId` key. No atomic start dedupe. | `sleep()`, no max. | Hooks / webhooks; race with `sleep`. | About $1 to $3 on top of Vercel Pro | Native: same repo and deploy | Apache-2.0 |
| Temporal (TS) | Event-sourced replay; strict determinism sandbox. | Activity retry policies. Workflow ID dedupe. | Durable `sleep()`. | Signals, Updates, Queries. | About $0.44 to $2.20 Cloud + worker host | Poor: workers must run outside Vercel | MIT |

---

### Recommendation

#### Pick: Vercel Workflow + plain typed LLM calls. Runner-up: Inngest.

| Reason | Detail | Label |
|---|---|---|
| Reliability | GA since April 2026. Durable steps, retries, crash and deploy replay. | FACT: https://vercel.com/blog/a-new-programming-model-for-durable-execution |
| Simplicity | Same repo, same `git push`, same dashboard. No second vendor or deploy target. | INFERENCE |
| Timers fit | "If no callback in 2h, re-notify" = race a hook against `sleep('2h')`. Day-3 follow-up = `sleep('3 days')`. | FACT (pattern): https://workflow-sdk.dev/docs/foundations/hooks |
| Cost | About $1 to $3/month above the Vercel Pro seat you already need. | INFERENCE: https://vercel.com/docs/workflows/pricing |
| Control / exit | Apache-2.0 SDK. Postgres World is a reference exit path, needing a worker. | FACT: https://workflow-sdk.dev/docs/deploying/world/postgres-world |

Gaps and mitigations:

| Gap | Mitigation | Label |
|---|---|---|
| No atomic run dedupe on `start()` | Insert `calls(call_id UNIQUE)` in Supabase first. Start the workflow only on a fresh insert. | INFERENCE |
| No concurrency keys | Not needed at 400 to 2,000 runs/month. Add a step-level guard later if needed. | INFERENCE |
| Duplicate SMS on retry | Pass `stepId` as idempotency key, or check a `notifications` row before sending. | FACT: https://workflow-sdk.dev/docs/foundations/idempotency |
| Young product (GA 6 months) | Keep Supabase as the system of record. The workflow only orchestrates. | INFERENCE |

Choose **Inngest instead** if any of these matter more:
- First-class `cancelOn`, `waitForEvent` with match, debounce, throttle. FACT: https://www.inngest.com/docs/features/inngest-functions/cancellation/cancel-on-events
- Orchestration off Vercel's platform, with a single-binary self-host option. FACT: https://www.inngest.com/docs/self-hosting
- Watch: Free trace history is only 24 hours. Pro jumps to $99/month. FACT: https://www.inngest.com/pricing

Not recommended here:
- **Temporal**: best engine, but workers can't live on Vercel. Too much ops for one engineer. INFERENCE.
- **Trigger.dev**: solid. But it adds a second runtime and deploy, and retries restart the whole task unless you use subtasks. INFERENCE from https://trigger.dev/docs/how-it-works
- **OpenAI Agents SDK**: an agent-loop library, not an orchestrator. No durability. INFERENCE.

#### Does LangGraph earn its place?

**No.** INFERENCE, based on the facts below.

| Point | Detail | Label |
|---|---|---|
| Pipeline shape | Fixed linear DAG: extract, check, score, task, notify, attribute, timers. No agent loop or branching tool use. | INFERENCE |
| No timers | OSS LangGraph has no durable sleep. Platform cron is recurring only. | FACT: https://docs.langchain.com/langsmith/cron-jobs |
| No auto-resume | Crash recovery means re-invoking with `thread_id`. You still need a supervisor. | FACT: https://docs.langchain.com/oss/javascript/langgraph/fault-tolerance |
| HITL has no timeout | `interrupt()` "waits indefinitely". | FACT: https://docs.langchain.com/oss/javascript/langgraph/interrupts |
| Platform cost and lock | Deployment needs Plus ($39/seat). Self-host needs Enterprise license. | FACT: https://www.langchain.com/pricing |
| Better alternative | One `'use step'` per LLM call with a Zod schema (structured output). Confidence checks and scoring stay plain TypeScript. Each step is retried and memoized by the engine. | INFERENCE |

#### Can LangGraph run inside a durable step engine?

| Option | Detail | Label |
|---|---|---|
| Whole graph in one step | Works. On step retry, the whole graph re-runs unless you add PostgresSaver with a deterministic `thread_id` (e.g. `call_id`). | INFERENCE |
| Each node as a step | Possible by calling step functions from nodes. Two replay systems stacked. Fragile. | INFERENCE |
| Official integration | Temporal's LangGraph plugin exists for Python only (experimental). No TS integration listed. | FACT: https://docs.temporal.io/develop/typescript/integrations/ |
| Verdict | Only worth it if a future step becomes a true agent (e.g. an open-ended lead-research loop). Then run it as one step. | INFERENCE |

#### Open questions

| Question | Label |
|---|---|
| Does Inngest bill `step.sleep` / `waitForEvent` as executions? | OPEN QUESTION |
| What happens to Inngest Free runs above 5 concurrent steps? | OPEN QUESTION |
| How many Vercel Queue operations does one workflow step use? | OPEN QUESTION |
| How much usage credit does Vercel Pro include? | OPEN QUESTION |
| Does PostgresSaver work through Supabase's transaction pooler? | OPEN QUESTION |
| What does a Temporal worker host cost (outside Vercel)? | OPEN QUESTION |
| Trigger.dev checkpoint threshold: 5 s (pricing) vs 60 s (how-it-works)? | OPEN QUESTION |
| Which LangSmith trace allowance (5k or 10k) belongs to which plan? | OPEN QUESTION |

---

## Appendix E. Platform costs


Researched 2026-10-22. Official vendor pages only.

Labels:
- **FACT**: read on an official page today.
- **VENDOR CLAIM**: vendor marketing or blog statement.
- **INFERENCE**: my reasoning from facts.
- **OPEN QUESTION**: could not verify.

Context: Austin TX seasonal business. 100–400 calls/month. Bursts of 20–100 simultaneous calls. Twilio webhooks need a fast answer.

---

### Supabase

| Item | Finding | Label | Source URL |
|---|---|---|---|
| Free price | $0/month. | FACT | https://supabase.com/pricing |
| Pro price | "From $25/month". | FACT | https://supabase.com/pricing |
| Team price | "From $599/month". | FACT | https://supabase.com/pricing |
| Pro compute credits | $10/month. Covers one Micro instance. | FACT | https://supabase.com/pricing |
| Free projects | "Limit of 2 active projects." Paused projects don't count. | FACT | https://supabase.com/pricing |
| Free pausing trigger | "Free projects are paused after 1 week of inactivity." Docs: "low activity over a 7-day period." | FACT | https://supabase.com/docs/guides/platform/free-project-pausing |
| Pause warning | Owner gets a warning email before the pause. | FACT | https://supabase.com/docs/guides/platform/free-project-pausing |
| Restore window | "You can restore a paused project for up to 1 year after it was paused." A 2024 changelog said 90 days. The current docs say 1 year. | FACT | https://supabase.com/docs/guides/platform/free-project-pausing |
| Paid projects pausing | "Projects under a paid plan cannot be paused." | FACT | https://supabase.com/docs/guides/platform/free-project-pausing |
| Seasonal pausing risk | Off-season, real traffic can drop to zero for more than 7 days. A Free project would then pause. Calls that need the DB would fail until someone resumes it by hand. A keep-alive cron reduces the risk but works against the intent of the policy. Pro removes the risk. | INFERENCE | (from above) |
| Free DB size | 500 MB. | FACT | https://supabase.com/pricing |
| Pro DB size | 8 GB disk per project, then $0.125/GB. | FACT | https://supabase.com/pricing |
| Free egress | 5 GB. | FACT | https://supabase.com/pricing |
| Pro egress | 250 GB, then $0.09/GB. | FACT | https://supabase.com/pricing |
| Free compute | Nano. Up to 0.5 GB RAM, shared CPU. | FACT | https://supabase.com/docs/guides/platform/compute-and-disk |
| Connections: Nano | 60 direct. 200 pooler clients. | FACT | https://supabase.com/docs/guides/platform/compute-and-disk |
| Connections: Micro (~$10) | 1 GB RAM. 60 direct. 200 pooler clients. | FACT | https://supabase.com/docs/guides/platform/compute-and-disk |
| Connections: Small (~$15) | 2 GB RAM. 90 direct. 400 pooler clients. | FACT | https://supabase.com/docs/guides/platform/compute-and-disk |
| Connections: Medium (~$60) | 4 GB RAM. 120 direct. 600 pooler clients. | FACT | https://supabase.com/docs/guides/platform/compute-and-disk |
| Serverless guidance | Use the shared pooler in transaction mode, port 6543: "Use it for serverless and edge functions." Turn off prepared statements. | FACT | https://supabase.com/docs/guides/database/connecting-to-postgres |
| Direct connection IPv6 | "Direct connections are on IPv6, or on IPv4 if the project has the IPv4 add-on." | FACT | https://supabase.com/docs/guides/database/connecting-to-postgres |
| Dedicated pooler | Paid plans only. "The dedicated pooler runs in transaction mode only." | FACT | https://supabase.com/docs/guides/database/connecting-to-postgres |
| Burst fit | 100 simultaneous calls through Supavisor at 200 pooler clients should fit on Micro. That holds if each function uses one short-lived pooled connection or the HTTP (PostgREST) API. | INFERENCE | (from compute table) |
| Backups: Free | No automatic backups. Docs say to export with the CLI `db dump`. | FACT | https://supabase.com/docs/guides/platform/backups |
| Backups: Pro | "Pro Plan projects can access the last 7 days of daily backups." | FACT | https://supabase.com/docs/guides/platform/backups |
| Backups: Team | 14 days. | FACT | https://supabase.com/docs/guides/platform/backups |
| PITR price | 7 days ~$100/mo. 14 days ~$200/mo. 28 days ~$400/mo. | FACT | https://supabase.com/docs/guides/platform/backups |
| PITR compute requirement | Requires "at least a Small compute add-on." | FACT | https://supabase.com/docs/guides/platform/backups |
| PITR plans | Add-on on Pro, Team, Enterprise. Not on Free. | FACT | https://supabase.com/pricing |
| Log retention | Free: 1 day. Pro: 7 days (API and Database). | FACT | https://supabase.com/pricing |
| SOC2 | Included on Team and Enterprise only. | FACT | https://supabase.com/pricing |
| HIPAA | Paid add-on on Team and Enterprise only. | FACT | https://supabase.com/pricing |
| Spend cap | "Spend caps are on by default on the Pro Plan." | FACT | https://supabase.com/pricing |
| Spend cap scope | Covers disk, egress, MAU, logs, realtime, storage. Does not cover compute, PITR, IPv4, custom domain, or log drains. Over the cap, "further usage of that item is disallowed until the next billing cycle." | FACT | https://supabase.com/docs/guides/platform/cost-control |
| US regions | us-west-1 (N. California), us-west-2 (Oregon), us-east-1 (N. Virginia), us-east-2 (Ohio). | FACT | https://supabase.com/docs/guides/platform/regions |
| Region pairing | Supabase us-east-1 sits next to Vercel iad1 (Washington, D.C.). | INFERENCE | https://supabase.com/docs/guides/platform/regions , https://vercel.com/docs/functions/configuring-functions/region |

### Vercel

| Item | Finding | Label | Source URL |
|---|---|---|---|
| Hobby commercial ban | "Hobby teams are restricted to non-commercial personal use only. All commercial usage of the platform requires either a Pro or Enterprise plan." | FACT | https://vercel.com/docs/limits/fair-use-guidelines |
| Commercial definition | Any deployment "used for the purpose of financial gain of anyone involved in any part of the production of the project." Examples include "Advertising the sale of a product or service." | FACT | https://vercel.com/docs/limits/fair-use-guidelines |
| Applies to us | A receptionist backend for a paid lighting business is commercial use. Hobby is not allowed. | INFERENCE | https://vercel.com/docs/limits/fair-use-guidelines |
| Pricing page wording | Hobby is "for personal, non-commercial use." | FACT | https://vercel.com/pricing |
| Pro price | $20/month platform fee. Includes 1 deploying seat and $20/month usage credit. | FACT | https://vercel.com/docs/plans/pro-plan |
| Extra seats | Owner/Member seats: $20/month each. Viewer seats: free, unlimited. | FACT | https://vercel.com/docs/plans/pro-plan |
| Pro included CDN | Flat Rate CDN: 1M CDN requests and 1 TB data transfer per month. | FACT | https://vercel.com/docs/plans/pro-plan |
| Pro on-demand rates | Invocations $0.60/1M. Active CPU from $0.128/hr. Provisioned memory from $0.0106/GB-hr. | FACT | https://vercel.com/docs/limits/fair-use-guidelines |
| Hobby included | 1M invocations. 4 hrs Active CPU. 360 GB-hrs memory. 100 GB Fast Data Transfer. | FACT | https://vercel.com/docs/limits/fair-use-guidelines |
| Max duration (Fluid) Hobby | Default 300s. Maximum 300s. | FACT | https://vercel.com/docs/functions/limitations |
| Max duration (Fluid) Pro | Default 300s. Maximum 800s (GA). Extended 1800s (Beta). | FACT | https://vercel.com/docs/functions/limitations |
| Memory | Hobby 2 GB / 1 vCPU. Pro up to 4 GB / 2 vCPU. | FACT | https://vercel.com/docs/functions/limitations |
| Concurrency | Auto-scales to 30,000 on Hobby and Pro. | FACT | https://vercel.com/docs/functions/limitations |
| Default region | iad1 (Washington, D.C.) for all new projects. Changeable. | FACT | https://vercel.com/docs/functions/configuring-functions/region |
| Region count by plan | Hobby: single region. Pro: 5 regions. Enterprise: all. | FACT | https://vercel.com/docs/functions/configuring-functions/region |
| Pinning | Yes. Set `"regions": ["iad1"]` in vercel.json, in the dashboard, or per function. | FACT | https://vercel.com/docs/functions/configuring-functions/region |
| Multi-region cost | No separate fee listed. Failover regions are Enterprise only. | FACT (no fee seen) / OPEN QUESTION (regional price differences) | https://vercel.com/docs/functions/configuring-functions/region |
| Cron per project | 100 on all plans. | FACT | https://vercel.com/docs/cron-jobs/usage-and-pricing |
| Cron Hobby | Once per day minimum. Precision ±59 min. | FACT | https://vercel.com/docs/cron-jobs/usage-and-pricing |
| Cron Pro | Once per minute. Per-minute precision. | FACT | https://vercel.com/docs/cron-jobs/usage-and-pricing |
| Spend Management plans | Pro and Enterprise (Flex Commit). No extra cost. | FACT | https://vercel.com/docs/spend-management |
| Spend Management default | Notifications default to $200 per billing cycle for new customers. | FACT | https://vercel.com/docs/plans/pro-plan |
| Spend Management lag | Checked "every few minutes." Pausing can trigger several minutes late. | FACT | https://vercel.com/docs/spend-management |
| Pause caveat | "Pause Production Deployments" stops all projects (503) until resumed by hand. That would kill phone webhooks. Use alerts only. | FACT (behavior) / INFERENCE (advice) | https://vercel.com/docs/spend-management |
| Inbound WebSockets | Supported natively in Vercel Functions. **Public Beta** on all plans since June 22, 2026. | FACT | https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections |
| WS beta announcement | "WebSocket support is now in Public Beta." | FACT | https://vercel.com/changelog/websocket-support-is-now-in-public-beta |
| WS duration | Same as function max duration. Hobby 300s. Pro 800s. 1800s beta. "each connection closes when it's reached." | FACT | https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections |
| WS in Next.js | Needs `experimental_upgradeWebSocket()` from `@vercel/functions`, returned from a route handler `GET`. | FACT | https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections |
| WS billing | Active CPU only while handling messages. Provisioned memory billed while the connection is open. | FACT | https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections |
| WS requires Fluid | Yes. On by default for projects created on or after April 23, 2025. | FACT | https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections |
| Twilio WS drop behavior | ConversationRelay: "If the WebSocket disconnects unexpectedly ... we don't reconnect, and the call disconnects with a `failed` status." | FACT | https://www.twilio.com/docs/voice/conversationrelay/websocket-messages |
| WS fit for voice | Pro caps a call socket at 800s (13m20s) GA. Longer calls drop unless the `<Connect>` action handler re-attaches. Beta status adds risk for production voice. A small persistent host is safer for the voice socket. Vercel stays fine for webhooks, tools, and the dashboard. | INFERENCE | (from rows above) |
| Vercel Daemons | Public Beta. "Daemons don't receive traffic." No inbound HTTP/TCP. Not usable as a WS server. | FACT | https://vercel.com/kb/guide/vercel-daemons |
| Observability | Available on all plans at no extra cost, with limits. Observability Plus on Pro: $1.20 per 1M events. | FACT | https://vercel.com/docs/observability , https://vercel.com/pricing |
| Always-on tracing | "Always-on tracing is in Beta and available on all plans." | FACT | https://vercel.com/docs/tracing |
| Drains (logs/traces) | Pro and Enterprise only. $0.50/GB. Traces drain in OpenTelemetry format. | FACT | https://vercel.com/docs/drains |
| HIPAA BAA | Pro add-on, $350/month. Not needed for this business. | FACT / INFERENCE | https://vercel.com/docs/plans/pro-plan |

### Sentry

| Item | Finding | Label | Source URL |
|---|---|---|---|
| Developer (free) errors | 5k. | FACT | https://sentry.io/pricing/ |
| Developer spans | 5M spans. | FACT | https://sentry.io/pricing/ |
| Developer replays | 50. | FACT | https://sentry.io/pricing/ |
| Developer users | 1 seat. | FACT | https://sentry.io/pricing/ |
| Developer logs | 5 GB (extra $0.50/GB). | FACT | https://sentry.io/pricing/ |
| Developer monitors | 1 cron monitor. 1 uptime monitor. | FACT | https://sentry.io/pricing/ |
| Developer retention | 30-day lookback. | FACT | https://sentry.io/pricing/ |
| Quota period | Paid plans: "pre-set monthly event volume." The pricing page doesn't say the Developer quota is monthly. | FACT (paid) / OPEN QUESTION (Developer) | https://docs.sentry.io/pricing/ |
| Team price | $29/mo billed monthly. $26/mo billed annually. | FACT | https://sentry.io/pricing/ |
| Team includes | 50k errors, 5M spans, 50 replays, unlimited users, up to 90-day lookback. | FACT | https://sentry.io/pricing/ |
| Business price | $89/mo monthly. $80/mo annually. | FACT | https://sentry.io/pricing/ |
| Next.js support | `@sentry/nextjs`. Next.js 14+, Node 20.19.0+. Wizard: `npx @sentry/wizard@latest -i nextjs`. App and Pages Router. Node and Edge runtimes. | FACT | https://docs.sentry.io/platforms/javascript/guides/nextjs/ |
| Sentry + OTEL | Current Sentry docs: SDK "creates and sends spans without an OpenTelemetry pipeline." Vercel docs say Sentry v8+ sets up OTel by default and can conflict with `@vercel/otel`. Fix: `skipOpenTelemetrySetup: true`. The two sources disagree. Test before relying on either. | FACT (both quotes) / OPEN QUESTION (which is current) | https://docs.sentry.io/platforms/javascript/guides/nextjs/opentelemetry/ , https://vercel.com/docs/tracing |
| OTLP ingest | Sentry accepts OTLP traces and logs. Open beta. | FACT | https://docs.sentry.io/concepts/otlp/ |

### OpenTelemetry options

| Item | Finding | Label | Source URL |
|---|---|---|---|
| Next.js OTEL | Built in. Create `instrumentation.ts` and call `registerOTel({ serviceName })` from `@vercel/otel`. | FACT | https://nextjs.org/docs/app/guides/open-telemetry |
| @vercel/otel portability | "It will work both on Vercel and when self-hosted." Supports Edge. Manual `NodeSDK` is Node-only. | FACT | https://nextjs.org/docs/app/guides/open-telemetry |
| Verbose spans | Set `NEXT_OTEL_VERBOSE=1` for more spans. | FACT | https://nextjs.org/docs/app/guides/open-telemetry |
| Vercel dashboard traces | Always-on tracing (beta, all plans) and session tracing. Viewed under Logs. | FACT | https://vercel.com/docs/tracing |
| Vercel trace export | Trace Drains. Pro/Enterprise only. $0.50/GB. Billed on uncompressed JSON size. | FACT | https://vercel.com/docs/drains |
| Direct export alternative | `@vercel/otel` can export straight to an OTLP backend without a Drain. Should work on any plan. | INFERENCE | https://nextjs.org/docs/app/guides/open-telemetry |
| Grafana Cloud Free | Traces 50 GB/mo, logs 50 GB/mo, metrics 10k active series. 14-day retention. 3 active users. | FACT | https://grafana.com/pricing/ |
| Grafana Cloud Pro | From $19/month + usage. | FACT | https://grafana.com/pricing/ |
| Honeycomb Free | Up to 20M events/month. 100M metric data points. 2 triggers. No SLOs. | FACT | https://www.honeycomb.io/pricing |
| Honeycomb retention | Events and logs: "60-day fixed retention." Not tied to a plan by name. | FACT / INFERENCE (applies to Free) | https://docs.honeycomb.io/get-started/manage-costs/how-honeycomb-calculates-usage |
| Honeycomb Pro | Starting at $150/month. | FACT | https://www.honeycomb.io/pricing |
| Axiom Personal (free) | 500 GB/mo data loading. 30-day retention. 25 GB storage. 10 GB-hrs query compute. | FACT | https://axiom.co/pricing |
| Axiom commercial use | Free plan is for "individual developers and small projects." Commercial use is not addressed. | OPEN QUESTION | https://axiom.co/pricing |
| Axiom paid | $25/mo platform fee + usage. | FACT | https://axiom.co/pricing |
| Sentry tracing | 5M spans on Developer and Team. | FACT | https://sentry.io/pricing/ |
| Volume fit | 400 calls/month makes very little telemetry. Every free tier above is far more than enough. | INFERENCE | (from rows above) |

### Resend

| Item | Finding | Label | Source URL |
|---|---|---|---|
| Free monthly | 3,000 emails/month. | FACT | https://resend.com/pricing |
| Free daily | "The Free plan is limited to 100 emails per day." | FACT | https://resend.com/pricing |
| Free domains | 3 verified domains. | FACT | https://resend.com/docs/knowledge-base/account-quotas-and-limits |
| Retention | 30 days on Free, Pro, Scale. | FACT | https://resend.com/docs/knowledge-base/account-quotas-and-limits |
| Rate limit | 10 requests/second per team. No burst allowance. | FACT | https://resend.com/docs/knowledge-base/account-quotas-and-limits |
| Pro price | $20/mo for 50,000 emails/mo. 10 domains. No daily limit. ($35/mo tier: 100k.) | FACT | https://resend.com/pricing |
| Scale | From $90/mo (100k emails). | FACT | https://resend.com/pricing |
| Burst risk | A TV-ad day of 100+ calls, each sending 1–2 emails, can pass 100/day on Free. Queue sends to stay under 10 req/s. | INFERENCE | (from rows above) |

### Twilio SMS (US) and A2P 10DLC

| Item | Finding | Label | Source URL |
|---|---|---|---|
| Outbound SMS (long code) | $0.0083 per segment. | FACT | https://www.twilio.com/en-us/sms/pricing/us |
| Inbound SMS (long code) | $0.0083 per segment. | FACT | https://www.twilio.com/en-us/sms/pricing/us |
| MMS (long code) | Outbound $0.022. Inbound $0.0165. | FACT | https://www.twilio.com/en-us/sms/pricing/us |
| Carrier fee: AT&T | SMS out $0.0035. SMS in $0.0035. | FACT | https://www.twilio.com/en-us/sms/pricing/us |
| Carrier fee: T-Mobile | SMS out $0.0045. SMS in $0.0025. | FACT | https://www.twilio.com/en-us/sms/pricing/us |
| Carrier fee: Verizon | SMS out $0.005. SMS in: no fee listed. MMS out $0.007. | FACT (read from page HTML table) | https://www.twilio.com/en-us/sms/pricing/us |
| Carrier fee: US Cellular / others | US Cellular SMS out $0.005. All other carriers SMS out $0.0042. | FACT | https://www.twilio.com/en-us/sms/pricing/us |
| Failed message fee | $0.001 per message that ends "Failed." | FACT | https://www.twilio.com/en-us/sms/pricing/us |
| Effective SMS cost | About $0.0118–$0.0133 per outbound segment with the carrier fee. | INFERENCE | (sum of rows above) |
| Brand fee (Sole Prop / Low-Volume Standard) | $4.50 one-time. Took effect Aug 1, 2025 (was $4.00). | FACT | https://support.twilio.com/hc/en-us/articles/1260803965530-Pricing-and-Fees-for-A2P-10DLC-Service |
| Brand fee (Standard) | $46 one-time. Includes $41.50 secondary vetting. | FACT | https://support.twilio.com/hc/en-us/articles/1260803965530-Pricing-and-Fees-for-A2P-10DLC-Service |
| Campaign vetting | $15 one-time per campaign. | FACT | https://support.twilio.com/hc/en-us/articles/1260803965530-Pricing-and-Fees-for-A2P-10DLC-Service |
| Monthly campaign fee | Low-volume mixed: $1.50/mo. Standard: $10/mo. Sole Prop: $2/mo. Charity: $3/mo. Emergency: $5/mo. | FACT | https://support.twilio.com/hc/en-us/articles/1260803965530-Pricing-and-Fees-for-A2P-10DLC-Service |
| Billing timing | Campaign fee billed at approval, then monthly until deactivated. | FACT | https://support.twilio.com/hc/en-us/articles/1260803965530-Pricing-and-Fees-for-A2P-10DLC-Service |
| Other fees | Vetting appeal $11. Authentication Plus $12.50 per retry (public for-profit brands). | FACT | https://support.twilio.com/hc/en-us/articles/1260803965530-Pricing-and-Fees-for-A2P-10DLC-Service |
| Low-Volume Standard cap | Up to 2,000 segments/day to T-Mobile (about 6,000/day across carriers). Needs an EIN. | FACT | https://www.twilio.com/docs/trust-hub/registrations/a2p-10dlc-brand |
| Source caveat | Twilio's marketing page still shows older figures ($4 brand, $44 Standard). The help article (updated 2026-09-26) is the authority. The help center page is JavaScript-rendered. I read it through Twilio's Zendesk article API for the same article ID. | FACT (dates) | https://www.twilio.com/en-us/phone-numbers/a2p-10dlc |
| Best fit | Low-Volume Standard brand + Low-volume mixed campaign. About $19.50 one-time + $1.50/mo. | INFERENCE | (from rows above) |

### Persistent WebSocket host options

| Item | Finding | Label | Source URL |
|---|---|---|---|
| Fly.io smallest | shared-cpu-1x 256 MB: $2.19/month (30 days, iad/ewr). | FACT | https://docs.fly.io/about/pricing |
| Fly.io 512 MB / 1 GB | $3.69/mo / $6.70/mo in iad/ewr. | FACT | https://docs.fly.io/about/pricing |
| Fly.io free tier | "New organizations don't have a free tier or a monthly free usage allowance." | FACT | https://docs.fly.io/about/pricing |
| Fly.io extras | Shared IPv4 free. Dedicated IPv4 $2/mo. NA egress $0.02/GB. No platform fee. | FACT | https://docs.fly.io/about/pricing |
| Fly.io always-on | `auto_stop_machines` default is "off". | FACT | https://docs.fly.io/reference/configuration |
| Fly.io WebSockets | Blog: "The answer is 'Yes'." Undated. Current docs don't say it directly. | VENDOR CLAIM | https://fly.io/blog/websockets-and-fly/ |
| Render workspace | Hobby $0/mo + compute ("personal projects and prototypes"). Pro $25/mo + compute. | FACT | https://render.com/pricing |
| Render smallest always-on | 0.5c-512mb (formerly Starter): $7/month, 512 MB, 0.5 CPU. | FACT | https://render.com/pricing , https://render.com/docs/compute-plans |
| Render free | Spins down after 15 min idle. "Do not use them for production applications." | FACT | https://render.com/docs/free |
| Render WebSockets | Supported. "Render does not enforce a maximum duration for WebSocket connections." Connections close on deploy. | FACT | https://render.com/docs/websocket |
| Railway plans | Free $0 ($1 credit). Hobby $5/mo with $5 usage. Pro $20/mo with $20 usage. | FACT | https://railway.com/pricing |
| Railway rates | ~$10/GB RAM/month. ~$20/vCPU/month. Egress $0.05/GB. Billed per second. | FACT | https://railway.com/pricing |
| Railway smallest always-on | No fixed instance price. A light Node WS server likely fits in the $5 Hobby credit, so about $5/mo total. | INFERENCE | https://railway.com/pricing |
| Railway Hobby use | "For indie hackers and developers to build and deploy personal projects." No commercial ban stated. Pro: "shipping to production." | FACT | https://docs.railway.com/reference/pricing/plans |
| Railway WebSockets | "Websocket connections are exempt from these duration and inactivity limits, and can stay open indefinitely." 10,000 concurrent connections. | FACT | https://docs.railway.com/networking/public-networking/specs-and-limits |

---

### Recommended platform baseline and monthly fixed cost

| Component | Plan | Fixed $/month | Label | Why |
|---|---|---|---|---|
| Vercel | Pro (1 seat) | $20 (includes $20 usage credit) | FACT price / INFERENCE choice | Hobby bans commercial use. Pro adds per-minute cron, drains, 800s functions. Pin to iad1. |
| Supabase | Pro, Micro, us-east-1 | $25 (Micro covered by $10 credit) | FACT price / INFERENCE choice | No pausing. 7-day daily backups. 200 pooler clients covers bursts. Skip PITR (~$100/mo plus Small compute). |
| Voice WebSocket server | Fly.io shared-cpu-1x 512 MB in iad, always on | ~$3.69 (+$2 if dedicated IPv4) | FACT price / INFERENCE choice | No max socket duration. Not beta. Alternatives: Render $7, Railway Hobby ~$5. Or try Vercel WS beta at $0 fixed. |
| Sentry | Developer (free) | $0 | FACT | 5k errors, 5M spans, 1 user. Team $29/mo if more users needed. |
| OTEL | `@vercel/otel` → Grafana Cloud Free or Honeycomb Free | $0 | FACT price / INFERENCE choice | Free tiers far exceed this volume. |
| Resend | Free off-season; Pro in peak season | $0 off-season / $20 peak | FACT price / INFERENCE choice | Free has a 100/day cap. |
| Twilio A2P 10DLC | Low-Volume Standard brand + Low-volume mixed campaign | $1.50 (+$19.50 one-time) | FACT | SMS ~$0.012–0.013 per segment on top. |
| **Total fixed** | | **~$50/mo off-season; ~$70/mo peak** | INFERENCE | Excludes Twilio voice/SMS usage, AI model costs, and the phone number rental. |

Open questions:
- Whether the Sentry Developer quota resets monthly. The page doesn't say.
- Axiom free plan commercial-use terms.
- Exact Vercel regional price differences when using more than one region.
- Fly.io WebSocket support in current docs. Only the undated blog confirms it.
- Twilio ConversationRelay maximum session length. Error 64104 exists, but the limit is not stated.

---
