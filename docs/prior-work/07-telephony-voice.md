# 07 — Telephony (Twilio V1) and Voice-Agent Vendors (V2)

As of 2026-10-20. Labels: **F** = FACT (official page opened), **VC** = VENDOR CLAIM, **UX** = USER EXPERIENCE, **INF** = INFERENCE, **UNK** = UNKNOWN. Not legal advice.

**Coverage note:** I verified Part A (Twilio) myself. In Part B I verified OpenAI, Gemini, Twilio ConversationRelay and Deepgram pricing. The ElevenLabs, Vapi, Retell, Bland, LiveKit and Pipecat columns, and most of the legal table, came from sibling sub-reports. Those never reached this file, so the cells say **UNK (see sibling report)**. Three legal sources (Texas, California, FCC) blocked fetching with 403 errors.

---

## Summary

- **V1 is cheap and buildable now.** Expect well under $100 of Twilio usage for the season (INF). The cost is not the risk. The risks are below.
- **Risk 1: account concurrency (F).** Accounts upgraded from trial on or after 2026-02-03 have hard caps by profile type:
  - no approved profile: **2** concurrent calls
  - Individual Primary Customer Profile: **3**
  - Business Primary Customer Profile: **unlimited**

  A forwarded call likely uses 2 legs (INF). So without a Business profile, a TV spike will block calls. **Get the Business profile approved before the ad airs.**
- **Risk 2: Amy's carrier voicemail answers the forwarded leg.** Twilio then treats the call as answered. Fix this with `<Number url>` screening ("press 1 to accept").
  - Gotcha (F): if the screen hangs up, `DialCallStatus` is **`completed`**, not `no-answer`.
  - **Branch on `DialBridged=true`** instead.
- **Risk 3: webhook outage.** Keep the caller-facing path on Twilio-hosted code (Functions). Point `voice_fallback_url` at a TwiML Bin that only records. Run a reconciler over Twilio's call logs.
- **Risk 4: SMS alerts are blocked until registered (F).** Unregistered 10DLC traffic is blocked with error 30034. Campaign vetting takes up to 5 business days. Toll-free verification takes about 3–5 business days. **Start registration this week.**
- **V2:** use a voice agent that hands Twilio back control through a standard path (SIP or ConversationRelay) and keeps the V1 capture flow as its fallback. Details in the Recommendation section.

---

## Twilio V1 reference design

### Call flow

1. **Number configuration**
   - `voice_url` → Twilio Function `/entry`.
   - `voice_fallback_url` → TwiML Bin "capture-only".
   - `status_callback` → your server. It is async and not on the caller's path.
   - F: the fallback is called "when an error occurs retrieving or executing the TwiML." https://www.twilio.com/docs/phone-numbers/api/incomingphonenumber-resource
2. **`/entry`**
   - Write a lead stub (From, CallSid, time) fire-and-forget.
   - Business-hours check in America/Chicago. After hours → `/capture`.
3. **In hours: ring Amy**
   - `<Dial answerOnBridge="true" timeout="20" action="/dial-result">` → `<Number url="/screen">` with Amy's cell.
   - Optionally add a backup person's number. Up to 10 `<Number>`s ring at once and the first to answer wins (F).
4. **`/screen`** runs on Amy's leg only.
   - Whisper plus `<Gather numDigits="1">`, then `<Hangup/>`.
   - Voicemail and phones that auto-answer can't press 1.
5. **`/dial-result`**
   - `DialBridged=true` → done.
   - Anything else → `/capture`. That covers busy, no-answer, failed, canceled, and screened-out calls that report `completed` without bridging.
6. **`/capture`**
   - Greeting with recording notice.
   - `<Gather input="dtmf speech">` for service type.
   - `<Record>` for name, address and details. Twilio still calls the action URL if the caller hangs up, with `Digits=hangup` (F).
7. **`recordingStatusCallback`** → your server: speech-to-text → LLM extraction → structured lead → SMS **and** email to Amy → callback task.
8. **Reconciler** (cron, every 5 minutes): list Twilio Calls and Recordings. Any CallSid without a lead gets one, even if only the phone number. This backstop is what delivers "zero lost leads" (INF).

### TwiML (verified attributes)

```xml
<!-- /entry (in hours) -->
<Response>
  <Dial answerOnBridge="true" timeout="20" action="/dial-result" method="POST"
        callerId="+1512TWILIONUM">
    <Number url="/screen"
            statusCallback="https://hooks.example.com/twilio/leg-status"
            statusCallbackEvent="initiated ringing answered completed">+1512AMYCELL</Number>
  </Dial>
</Response>

<!-- /screen  (executes on Amy's leg; caller keeps hearing ringback) -->
<Response>
  <Gather numDigits="1" timeout="6" action="/screen-accept">
    <Say>Christmas Light Guys lead call. Press 1 to accept.</Say>
  </Gather>
  <Hangup/>
</Response>
<!-- /screen-accept: Digits=="1" -> <Response/> (empty = bridge); else <Response><Hangup/></Response> -->

<!-- /dial-result: if DialBridged=="true" -> <Response><Hangup/></Response>; else: -->
<Response>
  <Say>Thanks for calling Christmas Light Guys. We're helping another customer.
       This message is recorded and transcribed so we can call you back.</Say>
  <Gather input="dtmf speech" numDigits="1" timeout="5" action="/capture-service"
          hints="installation, removal, repair, commercial">
    <Say>For new lighting press 1, removal or repair press 2, commercial press 3, or say what you need.</Say>
  </Gather>
  <Redirect>/capture-record</Redirect>
</Response>

<!-- /capture-record -->
<Response>
  <Say>After the tone, say your name, the property address, and the best time to reach you.</Say>
  <Record maxLength="180" timeout="6" finishOnKey="#" playBeep="true" action="/capture-done"
          recordingStatusCallback="https://hooks.example.com/twilio/recording"
          recordingStatusCallbackEvent="completed absent"/>
</Response>
```

**Facts behind the design**

| Topic | Fact | Source |
|---|---|---|
| `<Dial timeout>` | Default 30 s, minimum 5, maximum 600. Twilio adds about 5 s of buffer. | https://www.twilio.com/docs/voice/twiml/dial |
| `<Dial action>` | With an action URL, Twilio "will always pass along the status." Values are completed, answered, busy, no-answer, failed, canceled. | same |
| `answerOnBridge` | Keeps the caller ringing until bridged. Whisper requires it. | https://www.twilio.com/docs/glossary/call-whisper |
| `<Number url>` | Only `<Play>`, `<Say>`, `<Gather>` and `<Hangup>` are allowed. `<Dial>` is never allowed. | https://www.twilio.com/docs/voice/twiml/number |
| **Hangup during screening** | "In case of `<Hangup>` or `<Reject>` in screening URL, `DialCallStatus` will be set to `completed`." It was `no-answer` before 2020-12-09. **`DialBridged=true` only if the call was bridged.** | https://www.twilio.com/docs/voice/twiml/changelog |
| `<Gather>` with no input | Falls through to the next verb. `actionOnEmptyResult` defaults to false. | https://www.twilio.com/docs/voice/twiml/gather |
| `<Number machineDetection>` | Enable or DetectMessageEnd. Costs $0.0075 per call. A key-press screen is more deterministic (INF). | number doc; https://www.twilio.com/en-us/voice/pricing/us |
| Webhook timeouts | Connect 5 s; read and total 15 s. One retry by default, on connect failure only. Hard 15 s cap on call requests. Override with `#rc=`, `#rp=` and `#e=` in the URL. | https://www.twilio.com/docs/usage/webhooks/webhooks-connection-overrides |
| Fallback URL | Sends ErrorCode and ErrorUrl. Can point to a TwiML Bin, Function or Studio flow. Host it apart from the primary. Twilio suggests a 4 s timeout as a starting point. | https://www.twilio.com/docs/usage/security/availability-reliability ; https://www.twilio.com/docs/voice/twilio-voice-failover-best-practices |
| TwiML Bins | Twilio-hosted. Support Handlebars templating, e.g. `{{From}}`. | https://www.twilio.com/docs/serverless/twiml-bins |
| Studio vs Functions | Studio: 1,000 executions per month free, then $0.0025 each. Functions: 10,000 invocations free, then $0.0001 each. | https://www.twilio.com/en-us/serverless/pricing |
| `<Enqueue>` | Queue default 1,000, maximum 5,000. Results include `queue-full`. The limitations page says "100 default." **The docs conflict.** | https://www.twilio.com/docs/voice/api/queue-resource ; https://www.twilio.com/docs/voice/limitations-and-edge-cases |

**Design choices (all INF)**

- **Studio vs TwiML Bins vs your own server.** Use Functions for logic and a TwiML Bin for the fallback. Your own server handles only async work: recordings, speech-to-text, notifications. Studio works too, but I didn't confirm whether its "Connect Call To" widget supports a screening URL (UNK).
- **No `<Enqueue>` in V1.** One person on a cell phone can't dequeue callers without an agent app. Capture-and-callback beats a long hold.
- **Caller ID.** Set `callerId` to the Twilio number so Amy can save it as "CLG Lead Line." That keeps phone-level unknown-caller filters and spam labels from diverting forwarded calls. The whisper can read out the caller's number.
- **Carrier voicemail failure mode (item 7).** Without screening, Amy's voicemail answers the forwarded leg when her phone is off, she declines, she's on another call, or her phone filters unknown callers. Twilio sees an answered call, `DialCallStatus` comes back `completed`, and the lead lands in Amy's personal voicemail, outside the system. Screening closes this because voicemail can't press 1. Branching on `DialBridged` sends those calls to capture.

---

## Twilio cost table (US, pay as you go)

| Item | Price | Label / source |
|---|---|---|
| Local number | $1.15/mo | F, https://www.twilio.com/en-us/voice/pricing/us ("current as of August 2026") |
| Toll-free number | $2.15/mo | F, same |
| Inbound, local | $0.0085/min | F, same |
| Inbound, toll-free | $0.0220/min | F, same |
| Outbound (incl. the leg forwarded to Amy) | $0.0140/min | F, same |
| Recording | $0.0025/min | F, same |
| Recording storage | $0.0005/min per month | F, same |
| Native recording transcription | $0.05/min | F, same |
| `<Gather>` speech recognition | $0.02 per use (Deepgram or Google v2: $0.025) | F, same |
| `<Say>` voices | Basic free; Neural $0.0032 per 100 characters | F, same |
| Answering-machine detection | $0.0075/call | F, same |
| Conversation Intelligence | Batch $0.024/min; streaming $0.027/min | F, same |
| SMS, long code or toll-free | $0.0083 per segment, out or in | F, https://www.twilio.com/en-us/sms/pricing/us ("current as of October 2026") |
| SMS carrier fees, outbound | AT&T $0.0035, T-Mobile $0.0045, Verizon $0.005, US Cellular $0.005 | F, same |
| Failed-message fee | $0.001 | F, same |

**Season estimate (INF):** 400 calls in total; 70% bridged to Amy at 3 minutes; 30% captured at 2 minutes.

| Call type | Cost per call | Season total |
|---|---|---|
| Bridged to Amy | about $0.07 (inbound $0.026 + forwarded leg $0.042) | about $20 |
| Captured | about $0.08 (inbound + recording + external speech-to-text + 2 two-segment SMS) | about $10 |

Add the number and 10DLC fees. **Total is about $60 for the season.**

---

## Concurrency and spike behavior

| Fact | Label / source |
|---|---|
| Concurrency counts all active calls, incoming and outgoing. | F, https://support.twilio.com/hc/en-us/articles/223180028-How-Fast-Can-I-Place-or-Receive-Phone-Calls-with-Twilio |
| Accounts upgraded on or after 2026-02-03: Trial 5; no approved profile 2; **Individual 3**; **Business unlimited**. Elastic SIP Trunking: 4, 2, 3, unlimited. Accounts upgraded earlier are unaffected "at this time." | F, same |
| Outbound default is 1 call per second. Excess API calls queue for up to 24 h. Self-serve increase to 5 needs a Business profile. Individual-profile accounts stay at 1. | F, same |
| "No limitations on the rate" of inbound calls (with a Business profile). Each inbound call is an HTTP request to your webhook, so size your server. | F, same |
| `<Dial>` forwarding: destination limits apply, and calls over the limit "may not connect or be marked busy." | F, same |
| Behavior when the concurrency cap is hit | **UNK.** Load-test before the ad. |
| Status RSS shows scheduled US SMS maintenance on Oct 21–22, Oct 27–29 and Nov 16–19, with possible delays. Pair SMS with email. | F, https://status.twilio.com/history.rss |

**Spike playbook (INF)**

- Business profile approved.
- Ring Amy plus a backup in parallel.
- Every other caller goes to deterministic capture, which has no human dependency.
- Use Functions, which Twilio scales.
- The reconciler catches any missed webhook.

---

## Recording and transcription options

| Option | Price | Notes | Source |
|---|---|---|---|
| `<Record transcribe="true">` (native) | $0.05/min | American English only. Audio must be over 2 s and under 120 s. maxLength drops to 120 s when transcribing. | F, https://www.twilio.com/docs/voice/twiml/record ; voice pricing |
| `<Start><Transcription>` (real time) | Conversation Intelligence streaming $0.027/min | Google or Deepgram engine, with automatic failover between them. `languageCode="multi"` uses Deepgram nova-3. | F, https://www.twilio.com/docs/voice/twiml/transcription |
| Conversation Intelligence batch | $0.024/min | Language operators $0.004/min | F, voice pricing |
| Deepgram Nova-3, pre-recorded | $0.0043/min (multilingual $0.0052) | $200 free credit. BAA for Enterprise only. | F, https://deepgram.com/pricing |
| AssemblyAI Universal-2 | $0.15/hr (≈$0.0025/min); Universal-3.5 Pro $0.21/hr | BAA "signable in minutes" (VC) | F, https://www.assemblyai.com/pricing |
| OpenAI gpt-4o-mini-transcribe | $0.003/min | gpt-4o-transcribe $0.006/min; gpt-transcribe $0.0045/min | F, https://developers.openai.com/api/docs/pricing |

**Recommendation (INF):**

- Record with Twilio.
- Transcribe asynchronously with Deepgram Nova-3 or gpt-4o-mini-transcribe. They are cheaper, handle Spanish, and have no 2-minute cap.
- Native transcription stays a zero-code fallback.
- Always keep the raw recording URL in the lead.

---

## SMS registration

| Item | Fact | Source |
|---|---|---|
| Brand fees (TCR, since 2025-08-01) | Sole Proprietor $4.50; Low-Volume Standard $4.50; Standard $46 (includes $41.50 vetting). Authentication Plus retry $12.50. | F, https://support.twilio.com/hc/en-us/articles/1260803965530-Pricing-and-Fees-for-A2P-10DLC-Service ; https://www.twilio.com/docs/trust-hub/registrations/a2p-10dlc-brand |
| Campaign fees | $15 vetting, one-time and non-refundable. Monthly: Sole Prop $2; Low-volume mixed $1.50; Standard $10. | F, same + https://support.twilio.com/hc/en-us/articles/11587910480155-A2P-10DLC-Campaign-Vetting-FAQ |
| Timeline | "Up to 5 business days for standard use cases." Contact support after 10 days. | F, vetting FAQ |
| Limits | Sole Prop: 1 campaign; 1,000 segments a day to T-Mobile. Low-Volume Standard: needs an EIN; 2,000 a day to T-Mobile (about 6,000 across carriers). | F, https://www.twilio.com/docs/messaging/compliance/a2p-10dlc |
| Unregistered traffic | Blocked with error 30034. Pending registrations count as unregistered, and message rates still apply. | F, https://www.twilio.com/docs/api/errors/30034 ; https://support.twilio.com/hc/en-us/articles/14910496447771-Shutdown-of-Unregistered-10DLC-Messaging-FAQ |
| Toll-free alternative | Verification required. Unverified or pending numbers blocked since 2024-01-31 (error 30032). About 3–5 business days. 3 segments per second by default. Fee not stated on the pages I opened (UNK). | F, https://www.twilio.com/docs/api/errors/30032 ; https://support.twilio.com/hc/en-us/articles/5377174717595-Toll-Free-Message-Verification-for-US-Canada |

**Pick (INF):** Low-Volume Standard brand (EIN) with a Low-volume mixed campaign: $4.50 + $15 + $1.50/mo. Submit now. **Email to Amy carries alerts until approval.**

---

## Legal table

| Topic | Rule | Implication | Label / source |
|---|---|---|---|
| Quiet hours | No telephone solicitation "before the hour of 8 a.m. or after 9 p.m." local time at the called party | Schedule callback tasks 8a–9p in the lead's time zone. Callbacks answering an inquiry are generally not solicitations (INF). | F, https://www.law.cornell.edu/cfr/text/47/64.1200 |
| Texas recording consent | Penal Code §16.02, one-party consent | Recording the capture leg is lawful in Texas | INF (sources returned 403); see sibling legal report |
| California callers | Penal Code §632 requires consent of all parties to a confidential communication | Announce recording before any recorded segment. The capture greeting does this. If you ever record bridged calls with Amy, add a pre-bridge notice. | INF (leginfo returned 403) |
| AI voices | FCC Feb 2024 ruling (FCC 24-17): AI-generated voices are "artificial" under TCPA | V2 outbound AI calls need prior express consent. Inbound AI answering is not a "call to" the consumer (INF). | INF (FCC page 403, PDF unreadable) |
| One-to-one consent rule | Vacated by the 11th Circuit, Jan 2025 | Doesn't affect inbound-initiated callbacks (INF) | UNK, not verified this pass |
| Texas SB 140 (2025) | Extends telephone-solicitation rules to texts | Keep texts transactional ("we got your message"). Have counsel confirm exemptions. | UNK, not verified this pass |
| CAN-SPAM | Applies to commercial email | Internal alerts to Amy aren't commercial. Marketing emails to leads must comply (INF). | UNK, not verified this pass |
| HIPAA (later) | BAA needed with every vendor that touches PHI. Twilio requires Security or Enterprise Edition for a BAA. | Medical segment needs BAA-eligible SKUs end to end | F, https://www.twilio.com/en-us/hipaa |

---

## Voice vendor comparison

$/min excludes LLM unless stated.

| Vendor | Price | Turn-taking | Telephony / transfer | Voicemail detection | Evals / observability | Limits | HIPAA | Lock-in |
|---|---|---|---|---|---|---|---|---|
| **OpenAI Realtime / GPT-Live** | gpt-realtime-2.1: $32 audio in / $64 audio out per 1M tokens. ≈$0.048/min on new tokens only; ≈$0.34/min on a 5-minute uncached call (INF). gpt-live-1: $0.05/min plus backend. | server_vad or semantic_vad; GPT-Live is full duplex | SIP endpoint, no phone numbers. REFER endpoint = cold transfer. Twilio charges $0.10 per refer. | None native (UNK) | Cookbook eval harness; sideband WebSocket; tracing in the Agents SDK | GPT-Live 50/300/500 concurrent sessions by tier. Realtime session 60 min max. | `/v1/realtime` on the BAA list (2026-07-09 PDF). GPT-Live **not** listed. | Proprietary model; SIP is standard |
| **Gemini Live** | gemini-3.8-live: $3 audio in / $12 audio out per 1M tokens. ≈$0.014–0.018/min; ≈$0.08/min with re-billing (INF). | Automatic VAD; async non-blocking tools | No native SIP. Partners: Voximplant, LiveKit, Pipecat, Twilio. | UNK | Transcripts only | 15-minute audio sessions without compression | Vertex AI only; the Developer API is not covered | Proprietary |
| **Twilio ConversationRelay** | $0.07/min + $0.0085 inbound ≈ $0.079/min, plus your LLM | Deepgram or Google speech-to-text; tunable interruptions. VC: p50 491 ms. | Native numbers. Transfer via `end` + `<Connect action>` → `<Dial>`. | Twilio AMD $0.0075/call | Conversation Intelligence hook | UNK | On Twilio's HIPAA list (2026-06-30). Text-to-speech only "Basic and Amazon Polly." | Bring any LLM |
| **Deepgram Voice Agent API** | $0.075/min Standard | UNK (see sibling) | UNK | UNK | UNK | 45 concurrent pay-as-you-go / 60 Growth | BAA for Enterprise only | Proprietary |
| ElevenLabs Agents | UNK (see sibling) | — | — | — | — | — | — | — |
| LiveKit Agents + Cloud | UNK (see sibling) | — | — | — | — | — | — | open source (INF) |
| Pipecat + Pipecat Cloud | UNK (see sibling) | — | — | — | — | — | — | open source (INF) |
| Vapi | UNK (see sibling) | — | — | — | — | — | — | — |
| Retell AI | UNK (see sibling) | — | — | — | — | — | — | — |
| Bland | UNK (see sibling) | — | — | — | — | — | — | — |

**Sources for the verified rows:**
- OpenAI: https://developers.openai.com/api/docs/pricing , https://developers.openai.com/api/docs/guides/realtime-sip , https://developers.openai.com/api/docs/models/gpt-live-1 , https://cdn.openai.com/osa/hipaa-endpoints.pdf
- Gemini: https://ai.google.dev/gemini-api/docs/pricing , https://ai.google.dev/gemini-api/docs/live-api/session-management , https://docs.cloud.google.com/docs/security/compliance/hipaa
- Twilio ConversationRelay: https://www.twilio.com/docs/voice/twiml/connect/conversationrelay , https://www.twilio.com/content/dam/twilio-com/global/en/other/hipaa/pdf/HIPAA-Eligible-Services.pdf
- Deepgram: https://deepgram.com/pricing

**Outages and complaints (UX):**
- OpenAI SIP was down about 2h55m on 2026-05-13 (F): https://status.openai.com/incidents/01KRG0AZKH41DV4D9SNJSXM33Q
- Twilio→Realtime 503s on 2026-07-13: https://community.openai.com/t/issue-sip-connection-failures-to-gpt-realtime-from-twilio/1386756
- Gemini 3.8 Live session drops: https://discuss.ai.google.dev/t/gemini-3-8-live-1011-1008-session-drops-runaway-audio-and-output-transcription-with-unspoken-text/190881

---

## Recommendation

**V1 (ship now, all INF on top of the facts above)**

- Twilio local number + Functions + screening with `DialBridged` branching.
- TwiML Bin as the fallback.
- Async speech-to-text and LLM extraction.
- SMS + email alerts.
- Reconciler.
- Business profile.
- Low-Volume Standard 10DLC registration.
- No AI on the critical path.

**(a) V2 Christmas Light Guys after-hours agent (provisional; 6 vendors unverified here)**

1. **Twilio ConversationRelay + your chosen LLM.**
   - The number, recording and fallback stay on Twilio.
   - When the agent fails or ends, the call returns to the V1 `<Dial>`/capture TwiML through `<Connect action>`.
   - About $0.08/min plus LLM.
2. **OpenAI gpt-realtime (or GPT-Live) over Twilio Elastic SIP.**
   - Best speech-to-speech quality per dollar on new tokens.
   - Context re-billing and two 2026 SIP incidents argue for keeping V1 as the fallback.
3. **An open-source framework (LiveKit or Pipecat)** if you want portability. Pending the sibling report.

**(b) Medical receptionist**

- Needs a BAA on every hop.
- Candidates: Twilio Security/Enterprise Edition with ConversationRelay, limited to the listed text-to-speech voices (Polly or Basic). Plus OpenAI `/v1/realtime` under a BAA and Modified Retention, or Gemini via Vertex only.
- The ElevenLabs default voice is not on Twilio's HIPAA list. Re-rank once the sibling HIPAA findings for ElevenLabs, Retell, Vapi and LiveKit are merged.

---

## Sources (opened)

**Twilio**
- https://www.twilio.com/en-us/voice/pricing/us
- https://www.twilio.com/en-us/sms/pricing/us
- https://www.twilio.com/docs/voice/twiml/dial
- https://www.twilio.com/docs/voice/twiml/number
- https://www.twilio.com/docs/glossary/call-whisper
- https://www.twilio.com/docs/voice/twiml/changelog
- https://www.twilio.com/docs/voice/twiml/gather
- https://www.twilio.com/docs/voice/twiml/record
- https://www.twilio.com/docs/voice/twiml/enqueue
- https://www.twilio.com/docs/voice/api/queue-resource
- https://www.twilio.com/docs/voice/twiml/transcription
- https://www.twilio.com/docs/voice/limitations-and-edge-cases
- https://www.twilio.com/docs/usage/security/availability-reliability
- https://www.twilio.com/docs/voice/twilio-voice-failover-best-practices
- https://www.twilio.com/docs/usage/webhooks/webhooks-connection-overrides
- https://www.twilio.com/docs/phone-numbers/api/incomingphonenumber-resource
- https://www.twilio.com/docs/serverless/twiml-bins
- https://www.twilio.com/en-us/serverless/pricing
- https://support.twilio.com/hc/en-us/articles/223180028-How-Fast-Can-I-Place-or-Receive-Phone-Calls-with-Twilio
- https://support.twilio.com/hc/en-us/articles/1260803965530-Pricing-and-Fees-for-A2P-10DLC-Service
- https://support.twilio.com/hc/en-us/articles/11587910480155-A2P-10DLC-Campaign-Vetting-FAQ
- https://support.twilio.com/hc/en-us/articles/14910496447771-Shutdown-of-Unregistered-10DLC-Messaging-FAQ
- https://support.twilio.com/hc/en-us/articles/5377174717595-Toll-Free-Message-Verification-for-US-Canada
- https://www.twilio.com/docs/messaging/compliance/a2p-10dlc
- https://www.twilio.com/docs/trust-hub/registrations/a2p-10dlc-brand
- https://www.twilio.com/docs/api/errors/30034
- https://www.twilio.com/docs/api/errors/30032
- https://www.twilio.com/en-us/hipaa
- https://status.twilio.com/history.rss

**Speech-to-text**
- https://deepgram.com/pricing
- https://www.assemblyai.com/pricing
- https://developers.openai.com/api/docs/pricing

**Legal**
- https://www.law.cornell.edu/cfr/text/47/64.1200

**Vendors (via sub-report, opened by that agent)**
- All OpenAI, Google and Twilio ConversationRelay URLs cited in the vendor section, plus https://www.twilio.com/en-us/sip-trunking/pricing/us and https://www.twilio.com/docs/voice/answering-machine-detection

**Attempted, failed (not relied on)**
- statutes.capitol.texas.gov (no section text)
- leginfo.legislature.ca.gov (403)
- fcc.gov AI-voice page (403)
- docs.fcc.gov FCC-24-17A1.pdf (unreadable)
- ecfr.gov (redirect)
- law.justia.com (403)
- help.twilio.com (empty)
