# ElevenLabs Agents ("ElevenAgents") for the Lightline phone receptionist

As of **2026-10-22**. Sources: elevenlabs.io/docs (raw `.md` pages), elevenlabs.io/pricing/agents, status.elevenlabs.io, github.com/elevenlabs, official changelog. Twilio behaviour is cited from twilio.com/docs.

Labels:

- **FACT**: stated on a primary page I opened today.
- **VENDOR CLAIM**: a marketing or "best effort" statement from the vendor.
- **INFERENCE**: my conclusion from facts. Needs a test.
- **OPEN QUESTION**: not documented. Must test or ask support.

Product naming: the product is now called **ElevenAgents**. The docs moved from `/docs/agents-platform/` and `/docs/conversational-ai/` to `/docs/eleven-agents/`. The API still uses `/v1/convai/...`. FACT. [llms.txt index](https://elevenlabs.io/docs/llms.txt)

---

## 0. Routing verdict

**Short answer: yes, Amy-first → agent → screened warm handoff to Amy → back to agent works. Build it in our own TwiML. Do not use ElevenLabs' built-in `transfer_to_number`.**

| Requirement | Native import | Register-call | SIP (`<Dial><Sip>`) |
|---|---|---|---|
| Our webhook rings Amy first | No. ElevenLabs takes the voice webhook. | Yes | Yes |
| Hand the live call to the agent | Only through a workaround | Yes, with the TwiML it returns | Yes, with `<Dial><Sip>` |
| Built-in `transfer_to_number` | Conference, blind and `agent_message` | **Not supported** | SIP REFER only, with no `agent_message` |
| Press-1 screening of Amy | Not offered | Our TwiML | Our TwiML |
| Caller returns to agent if Amy misses | Not documented | Our TwiML starts a new conversation | Our TwiML, or the REFER path (unverified) |
| `system__call_sid` / `system__caller_id` | Yes | Probably not. Pass your own variables. | Yes, via `X-CALL-ID` / `X-CALLER-ID` |
| Call queueing documented | Yes (Twilio inbound) | Not documented | Yes (SIP inbound) |

Sources: [register-call guide](https://elevenlabs.io/docs/eleven-agents/phone-numbers/twilio-integration/register-call), [native](https://elevenlabs.io/docs/eleven-agents/phone-numbers/twilio-integration/native-integration), [SIP](https://elevenlabs.io/docs/eleven-agents/phone-numbers/sip-trunking), [transfer](https://elevenlabs.io/docs/eleven-agents/customization/tools/system-tools/transfer-to-number), [call queueing](https://elevenlabs.io/docs/eleven-agents/guides/call-queueing). FACT for the cells that come from docs. The judgement in each cell is INFERENCE.

**Recommended pattern: "agent-leg handback".** It works with register-call or SIP. INFERENCE (pending a live test).

1. Our Twilio number's webhook rings Amy with the press-1 screen. This is today's flow.
2. If Amy does not bridge, connect the agent. Use register-call TwiML, or `<Dial><Sip>` to `sip.rtc.elevenlabs.io`.
3. The caller asks for a human. The agent calls **our webhook tool** `handoff_to_amy(summary, caller_name)`.
4. Our server redirects the parent Twilio call to `/handoff` TwiML. It uses the Calls REST API.
   - Fallback: the agent calls `end_call`, and `<Connect action>` / `<Dial action>` takes over.
5. `/handoff` dials Amy with `<Number url="/screen">`.
   - The whisper reads the summary.
   - Amy must press 1.
   - Carrier voicemail cannot press 1, so it cannot accept the call.
6. If Amy does not bridge, the `<Dial action>` reconnects the caller to a **new** agent conversation. Pass `entry=handoff_failed` plus context. The agent books the callback.

The caller is never dropped. Every branch is under our control.

Cost of this pattern: two ElevenLabs conversations per failed handoff. There is a short ringback gap while we switch. INFERENCE.

**Optional variant (keeps one conversation; behaviour not verified):** SIP plus `transfer_to_number` with `transfer_type: sip_refer`, intercepted by Twilio's `<Dial referUrl>`.

- Twilio's docs say the caller "will stay connected" to the original SIP leg when the transfer target does not answer. This needs `answerOnBridge="true"` on the initial `<Dial>`. FACT for Twilio. [Twilio: REFER to Twilio](https://www.twilio.com/docs/voice/api/refer-to-twilio)
- ElevenLabs does **not** document what the agent does after a failed REFER. OPEN QUESTION.

Exact TwiML is in [§1.4](#14-exact-twiml-for-the-recommended-pattern).

---

## 1. Twilio integration methods

### 1.1 Native number import

| Item | Finding | Label | Source |
|---|---|---|---|
| Setup | You give ElevenLabs a Twilio Account SID + token, or an API key (`SK...`). | FACT | [native](https://elevenlabs.io/docs/eleven-agents/phone-numbers/twilio-integration/native-integration) |
| Webhook owner | ElevenLabs "automatically configures" the number. The doc screenshot shows "A call comes in" set to `https://api.us.elevenlabs.io/twilio/inbound_call`. | FACT (screenshot) | same |
| Amy-first possible? | Not directly. ElevenLabs owns the number's voice URL. | INFERENCE | same |
| Workaround 1 | Keep our webhook on the main number. On a miss, `<Dial>` a **second** Twilio number that is imported natively. Twilio allows the inbound `From` as `callerId` on a non-SIP inbound call. | INFERENCE + FACT (Twilio callerId rule) | [Twilio Dial](https://www.twilio.com/docs/voice/twiml/dial) |
| Workaround 2 | `<Redirect>` to `https://api.us.elevenlabs.io/twilio/inbound_call`. This endpoint is undocumented, and ElevenLabs may re-overwrite the number config. | OPEN QUESTION | — |
| Transfers | Conference (default) and blind. `agent_message` is spoken to the human. Post-dial digits work. | FACT | [transfer](https://elevenlabs.io/docs/eleven-agents/customization/tools/system-tools/transfer-to-number) |
| Screening / press-1 | No field exists for a screening URL or an accept digit. The `PhoneNumberTransfer` schema has no such field. | FACT (absence in schema) | [Create agent API](https://elevenlabs.io/docs/api-reference/agents/create) |
| Regional | Transfers fail if the Twilio routing region does not match. This only matters for isolated environments. | FACT | [regional routing](https://elevenlabs.io/docs/eleven-agents/phone-numbers/twilio-integration/regional-routing) |
| Personalization | The conversation initiation webhook fires on inbound Twilio calls. | FACT | [personalization](https://elevenlabs.io/docs/eleven-agents/customization/personalization) |
| DTMF in | Out-of-band DTMF from Twilio is supported. | FACT | [multimodal input](https://elevenlabs.io/docs/eleven-agents/customization/multimodal-input) |

### 1.2 Register-call API (our server keeps the number)

| Item | Finding | Label | Source |
|---|---|---|---|
| Endpoint | `POST https://api.elevenlabs.io/v1/convai/twilio/register-call`. Body: `agent_id`, `from_number`, `to_number`, `direction` (`inbound` default), `conversation_initiation_client_data`. | FACT | [API ref](https://elevenlabs.io/docs/api-reference/integrations/twilio/register-call) |
| Returns | TwiML that "connects the call to your agent via WebSocket". Our server returns it to Twilio. | FACT | [guide](https://elevenlabs.io/docs/eleven-agents/phone-numbers/twilio-integration/register-call) |
| Exact TwiML | Not shown in the docs. It is very likely `<Connect><Stream url="wss://...">`. | INFERENCE / OPEN QUESTION | — |
| Webhook owner | **We are.** The Twilio voice URL points at our server. | FACT | guide |
| Amy-first | Yes. Call register-call only after `DialBridged` is false. | INFERENCE | — |
| Transfers | **"No call transfers"**, because ElevenLabs has no Twilio credentials. | FACT | guide |
| `agent_message` | Not available, because no transfers are available. | FACT (follows) | guide |
| Audio | The agent must use μ-law 8000 Hz for TTS output and input. | FACT | guide |
| Dashboard | Numbers registered this way do not appear in the Phone Numbers dashboard. | FACT | guide |
| Dynamic variables | Passed in `conversation_initiation_client_data.dynamic_variables`. The register-call body has no `call_sid` field, so `system__call_sid` is probably empty. Pass `call_sid` as a custom variable. | FACT (schema) + INFERENCE | API ref, [dynamic vars](https://elevenlabs.io/docs/eleven-agents/customization/personalization/dynamic-variables) |
| Agent ends call | Twilio runs the TwiML after `<Connect><Stream>` "only after your server closes the WebSocket". `<Connect action>` is requested when `<Connect>` ends. | FACT (Twilio) | [Twilio Stream](https://www.twilio.com/docs/voice/twiml/stream), [Twilio Connect](https://www.twilio.com/docs/voice/twiml/connect) |
| Handback hook | Add `action="/agent-ended"` to `<Connect>`, or append `<Redirect>`. You have to edit the returned XML. | INFERENCE | — |
| Recording | ElevenLabs audio saving still applies per agent. Twilio-side recording is ours to configure. | INFERENCE | [audio saving](https://elevenlabs.io/docs/eleven-agents/customization/privacy/audio-saving) |
| DTMF / queueing / over-limit | Not documented for register-call. | OPEN QUESTION | — |

### 1.3 SIP trunk (`<Dial><Sip>` from Twilio Programmable Voice)

| Item | Finding | Label | Source |
|---|---|---|---|
| Endpoint | `sip:<number>@sip.rtc.elevenlabs.io:5061;transport=tls` (TLS), or `:5060` for TCP. UDP is experimental. TLS 1.2+ is required. | FACT | [SIP trunking](https://elevenlabs.io/docs/eleven-agents/phone-numbers/sip-trunking) |
| Identifier | The URI needs an identifier before `@`. A leading `+` must match the imported number. | FACT | same |
| Auth | Inbound digest username/password (recommended). Source-IP allowlist works on TCP/TLS only. | FACT | same |
| Codecs | G.711 PCMU/PCMA 8 kHz, or G.722 16 kHz. This is independent of the agent's websocket format. | FACT | same |
| Media encryption | Disabled, Allowed or Required (SRTP). | FACT | same |
| Caller ID / call SID | Send `X-CALL-ID` and `X-CALLER-ID`. They map to `system__call_sid` and `system__caller_id` and cannot be overridden. | FACT | same |
| Custom context | Inbound `X-Foo-Bar` becomes `{{sip_foo_bar}}`. | FACT | same |
| BYE headers | `attributes_to_headers` maps dynamic variables to headers on the BYE ElevenLabs sends at call end. | FACT | same |
| Twilio header support | Twilio `<Sip>` sends `x-` headers from the URI query. The URI must be under 255 chars and the headers under 1024 chars. `username`/`password` attributes exist. `transport=tls` works. | FACT (Twilio) | [Twilio Sip](https://www.twilio.com/docs/voice/twiml/sip) |
| Webhook owner | **We are.** Twilio Programmable Voice runs our TwiML. | INFERENCE | — |
| Transfers | SIP REFER is supported, to a phone number or SIP URI. It has no `agent_message` and no post-dial digits. It supports custom headers and UUI. | FACT | [transfer](https://elevenlabs.io/docs/eleven-agents/customization/tools/system-tools/transfer-to-number) |
| REFER into Twilio | `<Dial referUrl>` receives `ReferTransferTarget`. With `answerOnBridge="true"` on the initial `<Dial>`, the original leg stays up until the target answers. If the target misses, "UserA's call will stay connected with AgentA". | FACT (Twilio) | [Twilio REFER](https://www.twilio.com/docs/voice/api/refer-to-twilio) |
| Twilio REFER limits | Blind transfers only. No `<Conference>` or `<Queue>`. The Refer-To header must be at most 256 chars. | FACT (Twilio) | same |
| Conference transfer over SIP | It would dial out through the "outbound" trunk config, which needs a Twilio SIP domain or trunk. | INFERENCE | SIP trunking |
| Queueing | Supported for SIP trunk inbound. | FACT | [call queueing](https://elevenlabs.io/docs/eleven-agents/guides/call-queueing) |
| DTMF | Out-of-band DTMF in is supported. `play_keypad_touch_tone` has out-of-band (RFC 4733) mode for SIP only. | FACT | [multimodal](https://elevenlabs.io/docs/eleven-agents/customization/multimodal-input), [keypad](https://elevenlabs.io/docs/eleven-agents/customization/tools/system-tools/play-keypad-touch-tone) |
| Reliability | 2026 status history has SIP-specific incidents: Jul 31, Oct 6 (EU) and Oct 8. | FACT | [status history](https://status.elevenlabs.io/history) |
| Cost | Twilio bills the SIP leg on top of the PSTN leg. ElevenLabs adds no telephony fee. | FACT (EL) / INFERENCE (Twilio leg) | [pricing](https://elevenlabs.io/pricing/agents) |

### 1.4 Exact TwiML for the recommended pattern

All of this is **INFERENCE** until tested. The Twilio attribute semantics are FACT ([Dial](https://www.twilio.com/docs/voice/twiml/dial), [Sip](https://www.twilio.com/docs/voice/twiml/sip)).

**Step 1. Inbound webhook (unchanged Amy-first).**

```xml
<Response>
  <Dial answerOnBridge="true" timeout="20" action="/api/twilio/amy-first-result">
    <Number url="/api/twilio/screen?stage=first">+1512AMYCELL</Number>
  </Dial>
</Response>
```

**Step 2a. Agent leg via register-call.** Use this when `DialBridged != true`.

```ts
// Server side (Next.js route). Edit the returned XML so the agent leg hands control back to us.
const twiml = await elevenlabs.conversationalAi.twilio.registerCall({
  agentId: AGENT_ID,
  fromNumber: from,          // caller
  toNumber: to,              // our Twilio number
  direction: "inbound",
  conversationInitiationClientData: {
    dynamicVariables: {
      call_sid: callSid,     // system__call_sid is likely empty with register-call
      caller_number: from,
      entry: "amy_unavailable", // later: "handoff_failed"
      lead_id: leadId,
    },
  },
});
// Every custom dynamic variable the agent defines must be supplied here, or the call fails
// with "Missing required dynamic variables".
// Assumes the returned TwiML contains a bare "<Connect>" tag. Verify the real payload first.
const withAction = twiml.replace("<Connect>", '<Connect action="/api/twilio/agent-ended">');
```

**Step 2b. Agent leg via SIP (alternative).**

```xml
<Response>
  <Dial answerOnBridge="true" timeout="15" action="/api/twilio/agent-ended"
        referUrl="/api/twilio/refer">
    <Sip username="EL_TRUNK_USER" password="EL_TRUNK_PASS">sip:+15125550100@sip.rtc.elevenlabs.io:5061;transport=tls?X-CALL-ID=CA123&amp;X-CALLER-ID=%2B15125550123&amp;X-Entry=amy_unavailable</Sip>
  </Dial>
</Response>
```

**Step 3. Agent asks for Amy.** The agent calls the webhook tool `handoff_to_amy`.

- Set `execution_mode: "post_tool_speech"` so the "one moment" line plays first.
- The server stores `{summary, caller_name}` against the call SID.
- The server calls `client.calls(parentCallSid).update({ url: "/api/twilio/handoff" })`.
- Fallback: if the agent instead calls `end_call`, `/api/twilio/agent-ended` sees the pending handoff and returns the same TwiML as Step 4.

**Step 4. `/api/twilio/handoff`.**

```xml
<Response>
  <Dial timeout="20" callerId="+15125550123" action="/api/twilio/handoff-result?h=HID">
    <Number url="/api/twilio/screen?h=HID">+1512AMYCELL</Number>
  </Dial>
</Response>
```

**Step 5. `/api/twilio/screen?h=HID` (whisper to Amy only).** It cannot contain `<Dial>`. FACT for Twilio.

```xml
<Response>
  <Gather numDigits="1" timeout="8" action="/api/twilio/screen-accept?h=HID">
    <Say>Lightline lead. Jane in Round Rock wants a roofline quote. Press 1 to take the call.</Say>
  </Gather>
  <Hangup/>
</Response>
```

`screen-accept` returns `<Response/>` when `Digits=1`, which bridges the call. Otherwise it returns `<Response><Hangup/></Response>`.

**Step 6. `/api/twilio/handoff-result`.**

- If `DialBridged=true`, return `<Hangup/>`.
- Otherwise, go back to Step 2 with `entry=handoff_failed`, plus the summary and prior conversation id as dynamic variables.

**Optional REFER variant.**

- Configure `transfer_to_number` with `transfer_type: "sip_refer"`.
- Use destination `{"type":"sip_uri","sip_uri":"sip:amy@handoff.invalid"}`.
- Set `uui.data` to a short id, such as `{{system__conversation_id}}`.
- `/api/twilio/refer` returns the Step 4 `<Dial>`.
- Twilio keeps the agent leg up if Amy misses. What ElevenLabs does next is an **OPEN QUESTION**.

---

## 2. Transfer to human (`transfer_to_number`)

| Item | Finding | Label | Source |
|---|---|---|---|
| Types | `conference` (default), `blind`, `sip_refer`. | FACT | [transfer](https://elevenlabs.io/docs/eleven-agents/customization/tools/system-tools/transfer-to-number) |
| Conference | Dials the destination into a conference, then removes the AI. `agent_message` is read to the human with native Twilio only. | FACT | same |
| Blind | Native Twilio only. Preserves the original caller ID. No warm message. Configured via the JSON editor today. | FACT | same |
| SIP REFER | Needs a SIP conversation and a trunk that allows REFER. No warm message. Custom headers and UUI work. `sip_refer_play_dialtone` defaults to true. | FACT | same, [Create agent API](https://elevenlabs.io/docs/api-reference/agents/create) |
| "Warm" | There is no attended transfer, with the AI talking to the human first. "Warm" means a TTS `agent_message` read to the human in conference mode. | FACT + INFERENCE | transfer |
| LLM params | `transfer_number` (must match a rule), `client_message`, `agent_message`, `reason`. | FACT | [system tools](https://elevenlabs.io/docs/eleven-agents/customization/tools/system-tools) |
| Rule fields | `transfer_destination` (`phone`, `phone_dynamic_variable`, `sip_uri`, `sip_uri_dynamic_variable`), `condition`, `transfer_type`, `custom_sip_headers`, `uui`, `post_dial_digits`, `sip_refer_play_dialtone`. Tool-level `enable_client_message` defaults to true. | FACT | Create agent API |
| Post-dial digits | `0-9 * # w W`. Conference and blind only. Native Twilio only. | FACT | transfer |
| UUI size | Transfer doc: 256 bytes after substitution, over-limit data dropped. Changelog 2026-07-06: workflow `UUITransferConfig.data` max raised to 8192 chars. **These conflict.** | FACT (conflict) | transfer, [changelog 2026-07-06](https://elevenlabs.io/docs/changelog/2026/7/6) |
| Human no-answer / busy | Not documented. | OPEN QUESTION | — |
| Voicemail answers the transfer | Not documented. No screen URL or accept-digit field exists. In conference mode, carrier voicemail can answer and the caller would be bridged into it. | FACT (no field) / INFERENCE (outcome) | Create agent API |
| Return to agent | Not documented. A `transfer_to_number_error` result type exists. Since 2026-06-15, error payloads can include `agent_message`. That suggests some failures return a tool error, but no-answer semantics are unknown. | FACT (schema) / OPEN QUESTION (behaviour) | [Get conversation API](https://elevenlabs.io/docs/api-reference/conversations/get), [changelog 2026-06-15](https://elevenlabs.io/docs/changelog/2026/6/15) |
| Caller ID shown to the human | Blind keeps the original caller ID. Conference and REFER are not documented. | FACT / OPEN QUESTION | transfer |
| Ring timeout | No transfer-specific timeout field. Outbound calls have `ringing_timeout_secs` (default 60). | FACT | [Outbound call API](https://elevenlabs.io/docs/api-reference/integrations/twilio/outbound-call) |
| Register-call | No transfers. | FACT | [register-call](https://elevenlabs.io/docs/eleven-agents/phone-numbers/twilio-integration/register-call) |
| Status history | "Transfer to Human not working correctly" (major) on 2025-05-16: the wrong number was passed. | FACT | [status incidents API](https://status.elevenlabs.io/api/v2/incidents.json) |

---

## 3. Concurrency

| Plan | Price/mo | Included minutes | Concurrent calls | Label |
|---|---|---|---|---|
| Free | $0 | 15 | 4 | FACT |
| Starter | $6 | 75 | 6 | FACT |
| Creator | $22 ($11 first month) | 275 | 10 | FACT |
| Pro | $99 | 1,238 | 20 | FACT |
| Scale | $299 | 3,738 | 30 | FACT |
| Business | $990 | 12,375 | 40 | FACT |
| Enterprise | Custom | Custom | "Elevated" | VENDOR CLAIM |

Source: [pricing/agents](https://elevenlabs.io/pricing/agents). The plans, minutes and concurrency in the brief are correct. Scale and Business minutes were missing from the brief.

| Item | Finding | Label | Source |
|---|---|---|---|
| Over the limit, default | "New calls are normally rejected immediately." | FACT | [call queueing](https://elevenlabs.io/docs/eleven-agents/guides/call-queueing) |
| Queueing | Per agent. **On by default for new agents.** Max wait 1–1,800 s, default 180 s. Custom hold audio up to 40 MB / 3 min. FIFO per agent. Wait time is not billed and does not use a slot. At timeout, telephony calls "are hung up normally". | FACT | same |
| Queueing channels | Twilio inbound and SIP trunk inbound: yes. Outbound and batch: no. Register-call is not listed. | FACT / OPEN QUESTION (register-call) | same |
| Daily limit | Not queued. Rejected immediately. | FACT | same |
| Burst | Per agent `bursting_enabled`. Up to 3× the limit or 300, whichever is lower. Burst calls cost 2× ($0.16/min). | FACT | [burst](https://elevenlabs.io/docs/eleven-agents/guides/burst-pricing) |
| Burst quality | Burst calls are deprioritized for STT/TTS and "may experience higher latency". | FACT | same |
| Pooling | Agents share the workspace concurrency pool. Per-agent `agent_concurrency_limit` defaults to -1 (unlimited). | FACT | call queueing, [skills repo config ref](https://github.com/elevenlabs/skills/blob/main/agents/references/agent-configuration.md) |
| Twilio-forwarded call | A slot is only used when the agent leg starts. Amy-first time costs nothing on ElevenLabs. | INFERENCE | — |
| Rejection seen by Twilio | SIP: a failed INVITE should surface as `DialCallStatus` busy/failed on our `<Dial action>`, so we can fall back. Register-call: likely an API error at register time. | INFERENCE / OPEN QUESTION | — |
| Queued SIP call | Hold audio implies the SIP leg is answered. A queue timeout then looks like `completed` on `<Dial action>`. Detect it via the post-call data or our own state. | INFERENCE | — |

---

## 4. Pricing

| Item | Finding | Label | Source |
|---|---|---|---|
| Extra minutes | $0.08/min on all plans. | FACT | [pricing/agents](https://elevenlabs.io/pricing/agents) |
| Burst minutes | $0.16/min. | FACT | same |
| Text messages | $0.003 each. | FACT | same |
| Silence | 95% discount for silence longer than 10 s, i.e. billed at 5%. | FACT | [cost help](https://elevenlabs.io/docs/help-center/product/eleven-agents/how-much-does-eleven-agents-cost), [optimizing costs](https://elevenlabs.io/docs/eleven-agents/customization/llm/optimizing-costs) |
| Billed duration | Connection duration, from begin to end. | FACT | cost help |
| `retranscribe_on_turn_timeout` | Disables the silence discount while enabled. | FACT | [Create agent API](https://elevenlabs.io/docs/api-reference/agents/create) |
| Telephony | ElevenLabs charges no telephony fee. Twilio or the SIP provider bills you directly. | FACT | pricing/agents |
| LLM | Pass-through at the provider's published rate, "no markup". Select Gemini and Claude models are billed +10% (Vertex regional rates). Per-model prices appear only in the UI ("Detailed costs"). | FACT | [LLM](https://elevenlabs.io/docs/eleven-agents/customization/llm), cost help |
| LLM options | ElevenLabs-hosted (Nemotron, DeepSeek, GLM, Qwen), Google Gemini, OpenAI GPT-4o to GPT-6.1, Anthropic Claude Haiku 4.5 to Opus 5.5, custom LLM, Realtime v1 Mini/Max. | FACT | LLM, [realtime](https://elevenlabs.io/docs/eleven-agents/customization/realtime-models) |
| Tool-calling model advice | The docs recommend "high intelligence models like GPT 6 or Claude Sonnet 5.5" for tools. | VENDOR CLAIM | [webhook tools](https://elevenlabs.io/docs/eleven-agents/customization/tools/webhook-tools) |
| Custom guardrails | Extra LLM cost per agent response. Focus, Manipulation and Content guardrails are free. | FACT | [guardrails](https://elevenlabs.io/docs/eleven-agents/best-practices/guardrails) |
| Voice Library voices | `voice_surcharge_charge` is billed on top, as a voice-actor reward. | FACT | [Get conversation API](https://elevenlabs.io/docs/api-reference/conversations/get) |
| Test / simulation cost | Not documented. The schema has a `charging.dev_discount` flag whose meaning is undocumented. | OPEN QUESTION | same |
| Overage | You need Pay-As-You-Go credits to exceed quota. | FACT | cost help |

---

## 5. Tools

### 5.1 Webhook (server) tools

| Item | Finding | Label | Source |
|---|---|---|---|
| Methods | GET, POST, PUT, PATCH, DELETE. JSON or form-urlencoded. | FACT | [Create tool API](https://elevenlabs.io/docs/api-reference/tools/create) |
| Auth | Custom headers. Secret headers come from the workspace secrets store. Auth connections: OAuth2 client credentials, OAuth2 JWT, Basic, Bearer. | FACT | [webhook tools](https://elevenlabs.io/docs/eleven-agents/customization/tools/webhook-tools) |
| Secret variables | `secret__*` variables are only used in headers and never sent to the LLM. They are redacted in webhooks and the API. | FACT | [dynamic vars](https://elevenlabs.io/docs/eleven-agents/customization/personalization/dynamic-variables) |
| Timeout | `response_timeout_secs` defaults to 20. Range 5–300 s for webhook tools. | FACT | Create tool API |
| Retries | None documented. The prompting guide tells you to prompt the agent to retry or escalate. | OPEN QUESTION / FACT (guidance) | [prompting guide](https://elevenlabs.io/docs/eleven-agents/best-practices/prompting-guide) |
| On error | `tool_error_handling_mode`: `auto` (summarized for native integrations, **hide** for others), `summarized`, `passthrough`, `hide`. | FACT | Create tool API |
| Execution | `execution_mode`: `immediate`, `post_tool_speech`, `async`. `pre_tool_speech`: auto/force/off. `interruption_mode`: allow / disable_during_tool / disable_during_tool_and_turn. | FACT | Create tool API, [interruptions](https://elevenlabs.io/docs/eleven-agents/customization/tools/tool-configuration/tool-interruptions) |
| Deterministic params | Parameters can come from `dynamic_variable` or `constant_value` instead of the LLM. `allowed_values` gives server-side rejection. Use this for `call_sid` and `caller_id`. | FACT | [Create agent API](https://elevenlabs.io/docs/api-reference/agents/create) |
| Response | JSON results can update dynamic variables (`assignments`). `response_filter` trims what the LLM sees. | FACT | Create tool API |
| Redirects | `follow_redirects` is off by default. It follows one GET only, on an allowlisted HTTPS domain. | FACT | same |
| Mocks | `response_mocks` (with `is_error`) for tests. | FACT | same |
| Egress IPs | Static egress IPs are published for allowlisting. | FACT | [IP allowlisting](https://elevenlabs.io/docs/eleven-api/resources/ip-allowlisting) |
| Code tools | Sandboxed JS, 1–30 s timeout. **Enterprise only.** | FACT | [code tools](https://elevenlabs.io/docs/eleven-agents/customization/tools/code-tools) |

### 5.2 Client tools

They run in the client SDK or widget. `expects_response` sets whether the agent waits. Timeout is 1–120 s, or -1 to wait forever. FACT. [Create tool API](https://elevenlabs.io/docs/api-reference/tools/create)

Not useful for PSTN calls. INFERENCE.

### 5.3 System tools

| Tool | Key facts | Label | Source |
|---|---|---|---|
| `end_call` | `reason`, optional farewell `message`. On by default for dashboard agents. **Not added by default for API/SDK-created agents.** | FACT | [end call](https://elevenlabs.io/docs/eleven-agents/customization/tools/system-tools/end-call) |
| `skip_turn` | Stays silent. `wait_timeout_secs` (default -1) controls a later check-in. | FACT | [system tools](https://elevenlabs.io/docs/eleven-agents/customization/tools/system-tools), Create tool API |
| `language_detection` | Switches to a configured language. | FACT | system tools |
| `voicemail_detection` | Detection is LLM-based. Optional `voicemail_message`, otherwise it hangs up. Built for outbound. | FACT | [voicemail detection](https://elevenlabs.io/docs/eleven-agents/customization/tools/system-tools/voicemail-detection) |
| `transfer_to_agent` | Hands off between AI agents. Optional `branch_id`, `node_id`, `preserve_voice_settings`. | FACT | system tools, [changelog 2026-10-05](https://elevenlabs.io/docs/changelog/2026/10/5) |
| `transfer_to_number` | See §2. | FACT | — |
| `play_keypad_touch_tone` | `0-9 * # w W`. Twilio and SIP only. Out-of-band DTMF for SIP only. | FACT | [keypad](https://elevenlabs.io/docs/eleven-agents/customization/tools/system-tools/play-keypad-touch-tone) |
| `update_state` | Sets dynamic variables from expressions, with no HTTP call. | FACT | system tools |
| Twilio AMD | `telephony_call_config.twilio_machine_detection` for **outbound** calls only. | FACT | [Outbound call API](https://elevenlabs.io/docs/api-reference/integrations/twilio/outbound-call) |

**Reliability guidance from the vendor:**

- Use precise tool names and descriptions.
- Explain when to call each tool in the system prompt.
- State parameter formats.
- Add explicit error-handling instructions.
- Use tool-call tests.

All VENDOR CLAIM. [Prompting guide](https://elevenlabs.io/docs/eleven-agents/best-practices/prompting-guide), [webhook tools](https://elevenlabs.io/docs/eleven-agents/customization/tools/webhook-tools)

---

## 6. Conversation initiation webhook and dynamic variables

| Item | Finding | Label | Source |
|---|---|---|---|
| When | New inbound Twilio, SIP, Exotel, WhatsApp or SMS conversation, when initiation data is **not already present**. It never runs for preview, widget or SDK. With register-call we pass the data, so it does not run. | FACT + INFERENCE | [personalization](https://elevenlabs.io/docs/eleven-agents/customization/personalization) |
| Config | URL and header secrets live in Agents settings. Enable "Fetch initiation client data" per agent (Security tab). Per-agent override: `workspace_overrides.conversation_initiation_client_data_webhook`. | FACT | same, [Create agent API](https://elevenlabs.io/docs/api-reference/agents/create) |
| Request | `POST {caller_id, called_number, agent_id, call_sid, conversation_id}`. SIP may add `call_id` and `sip_headers`. | FACT | personalization, [Twilio personalization](https://elevenlabs.io/docs/eleven-agents/customization/personalization/twilio-personalization) |
| Auth | Static headers or secrets only. No HMAC is documented. | FACT / INFERENCE | same |
| Response | `conversation_initiation_client_data` JSON, 256 KB or less. It must include **every** custom dynamic variable. Overrides must be enabled. | FACT | personalization |
| Timeout | Not documented ("reasonable timeout"). It runs in parallel with ringback. | OPEN QUESTION / VENDOR CLAIM | Twilio personalization |
| Failure | "A failed or timed-out webhook can prevent the conversation from starting." | FACT | personalization |
| Missing variable | The call fails with "Missing required dynamic variables". | FACT | [call failing help](https://elevenlabs.io/docs/help-center/product/eleven-agents/where-can-i-locate-the-reason-for-my-call-failing) |
| System variables | `system__caller_id`, `system__called_number`, `system__call_sid` (Twilio), `system__call_id` (SIP), `system__conversation_id`, `system__time*`, `system__timezone`, `system__call_duration_secs`, `system__conversation_history`, and more. They cannot be set by the client. | FACT | [dynamic vars](https://elevenlabs.io/docs/eleven-agents/customization/personalization/dynamic-variables) |
| Prompt caching | Variables marked † (time, turns) change per turn and can break prompt caching. | FACT | same |

---

## 7. Post-call webhooks

| Item | Finding | Label | Source |
|---|---|---|---|
| Types | `post_call_transcription`, `post_call_audio` (base64 MP3, chunked, 5 min timeout), `call_initiation_failure`. Per-agent `events` also allow `answering_machine_detection`, `unredacted_transcript` and `unredacted_audio`. | FACT | [post-call](https://elevenlabs.io/docs/eleven-agents/workflows/post-call-webhooks), [Create agent API](https://elevenlabs.io/docs/api-reference/agents/create) |
| Scope | Workspace-level, with per-agent override (`workspace_overrides.webhooks`). | FACT | same |
| Transcription payload | `agent_id`, `agent_name`, `conversation_id`, `status`, `branch_id`, `version_id`, `environment`, `transcript[]`, `metadata`, `analysis`, `conversation_initiation_client_data` (includes dynamic variables), `has_audio`. | FACT | post-call |
| Analysis | `evaluation_criteria_results`, `data_collection_results`, `call_successful`, `transcript_summary`. | FACT | post-call |
| Tool calls | Per-turn `tool_calls` and `tool_results`, with `tool_latency_secs`. | FACT | [Get conversation API](https://elevenlabs.io/docs/api-reference/conversations/get) |
| Per-turn latency | `conversation_turn_metrics` (e.g. `convai_llm_service_ttfb`, `convai_llm_service_ttf_sentence`). RAG has `rag_latency_secs`. | FACT | post-call, Get conversation API |
| Call SID | `metadata.phone_call.call_sid` (twilio / sip_trunking types). `call_result` is answered / voicemail / busy / no_answer / failed. `queue_wait_secs` and `charging.is_burst` are also included. | FACT (schema) | Get conversation API |
| `exclude_transcript` | Option to omit turn data. | FACT | Create agent API |
| HMAC header | `ElevenLabs-Signature: t=<unix>,v0=<hex>` | FACT | [SDK source](https://github.com/elevenlabs/elevenlabs-js/blob/main/src/wrapper/webhooks.ts) |
| HMAC algorithm | `v0 = HMAC_SHA256(secret, "<t>.<rawBody>")` as hex. The SDK rejects `t` older than 30 min. The SDK compares with `!==` (not constant-time), so prefer `crypto.timingSafeEqual`. | FACT / INFERENCE (advice) | SDK source |
| SDK helper | `elevenlabs.webhooks.constructEvent(rawBody, sig, secret)`. Next.js example uses `req.text()`. | FACT | post-call |
| Success | Must return HTTP 200. | FACT | post-call |
| Retries | **Off by default.** When on: up to 5 attempts (immediate, 30 s, 2 m, 8 m, 30 m) plus up to 10% jitter. Only 5xx, 429, 408 and connection errors are retried. 100 pending retries max per webhook. Audio over 50 MiB is not retried. Total queued audio is capped at 400 MiB. | FACT | [webhooks](https://elevenlabs.io/docs/eleven-api/resources/webhooks) |
| Idempotency | Retries are byte-identical. Dedupe by `conversation_id`. | FACT | same |
| Auto-disable | After 10+ consecutive failures **and** no success in more than 7 days, or never. Admins get an email. Manual re-enable. | FACT | same |
| Initiation failure | Covers busy, no-answer and unknown, with Twilio or SIP metadata. It is not sent for voicemail. It is effectively for outbound calls. | FACT / INFERENCE | post-call |

---

## 8. Testing and agents-as-code

| Item | Finding | Label | Source |
|---|---|---|---|
| Test types | Simulation (multi-turn, 1–50 turns, default 5), Next Reply (scenario), Tool Call (exact, regex or LLM match). | FACT | [agent testing](https://elevenlabs.io/docs/eleven-agents/customization/agent-testing) |
| Tool mocking | Mock none, all or selected. Fallback is "call real tool" or "finish with error". System tools are never mocked. | FACT | same |
| Repeat runs | Dashboard 3×/5×/15×. API `repeat_count` 2–20, which returns a pass rate plus failure buckets. | FACT | same, [run tests API](https://elevenlabs.io/docs/api-reference/tests/run-tests) |
| From real calls | "Create test from this conversation". | FACT | agent testing |
| CLI | `elevenlabs agents init/add/push [--dry-run]/pull [--update]/status/test <agent_id>`. `tests add/push/pull/delete`. `tools add`. | FACT | [CLI docs](https://elevenlabs.io/docs/eleven-agents/operate/cli), [CLI repo](https://github.com/elevenlabs/cli) |
| CI | `ELEVENLABS_API_KEY` env var. `agents test` polls to completion and exits non-zero on failure. | FACT | CLI docs, CLI README |
| Branches / environments | Tests can target `branch_id` and `environment`. | FACT | run tests API |
| Old simulate endpoint | The "Simulate conversation" guide and endpoints are **deprecated**. | FACT | [simulate (deprecated)](https://elevenlabs.io/docs/eleven-agents/guides/simulate-conversation) |
| Telephony coverage | Tests are text or LLM level. Twilio/SIP transfer behaviour is not exercised. | INFERENCE | — |
| Cost | Not documented. | OPEN QUESTION | — |
| Known gap | GitHub issue: tests from CLI and UI differ when using workflows (open). | FACT | [cli#76](https://github.com/elevenlabs/cli/issues/76) |

---

## 9. Knowledge base, RAG, guardrails, prompt safety

| Item | Finding | Label | Source |
|---|---|---|---|
| Files | PDF, DOCX, TXT, MD, HTML, EPUB. 20 MB per file. URLs can auto-sync. | FACT | [knowledge base](https://elevenlabs.io/docs/eleven-agents/customization/knowledge-base) |
| Full-context limit | About 300,000 characters. The max system prompt is 2 MB. | FACT | same, [LLM](https://elevenlabs.io/docs/eleven-agents/customization/llm) |
| RAG workspace quota | Free 1 MB, Starter 2 MB, Creator 20 MB, Pro 100 MB, Scale 500 MB, Business 1 GB, Enterprise 1 GB+. Docs under 500 B go into the prompt. | FACT | [RAG](https://elevenlabs.io/docs/eleven-agents/customization/knowledge-base/rag) |
| RAG latency | About 250 ms. | VENDOR CLAIM | RAG |
| Guardrails | Focus, Manipulation (prompt injection; terminates the conversation), Content, Custom (LLM-judged). | FACT | [guardrails](https://elevenlabs.io/docs/eleven-agents/best-practices/guardrails) |
| Modes | Streaming: no added latency, but under 500 ms of audio may leak before the block. Blocking: +200–500 ms. Exit is `end_call`, or `retry` (blocking only, up to 3×). Streaming is recommended for voice. | FACT / VENDOR CLAIM | same |
| System-prompt leakage | No dedicated "prompt protection" feature exists. Guidance: a custom guardrail that blocks "revealing ... system prompts", the Manipulation guardrail, `secret__` variables, and injection tests. | FACT | guardrails, [testing](https://elevenlabs.io/docs/eleven-agents/customization/agent-testing) |
| `# Guardrails` heading | "Models are tuned to pay extra attention" to it. | VENDOR CLAIM | guardrails |

---

## 10. Privacy

| Item | Finding | Label | Source |
|---|---|---|---|
| Recording | Per agent `platform_settings.privacy.record_voice`, **on by default**. Off still keeps transcripts. | FACT | [audio saving](https://elevenlabs.io/docs/eleven-agents/customization/privacy/audio-saving) |
| Retention | Per agent `retention_days`. Default **2 years**. -1 means unlimited, 0 means scheduled deletion. Can be applied to existing data. | FACT | [retention](https://elevenlabs.io/docs/eleven-agents/customization/privacy/retention) |
| ZRM per agent | Toggle under Privacy > Advanced. No recordings and no PII transcripts are stored. Data is only available via post-call webhooks. Debugging is limited. | FACT | [ZRM per agent](https://elevenlabs.io/docs/eleven-agents/customization/privacy/zrm) |
| ZRM eligibility | Enterprise page: ZRM is "available to select enterprise customers". The per-agent page does not state the plan. | FACT (conflict) / OPEN QUESTION | [ZRM enterprise](https://elevenlabs.io/docs/eleven-api/resources/zero-retention-mode) |
| PII redaction | Conversation-history redaction (entities become `[NAME]` and similar; audio is bleeped). **Select enterprise clients only.** DTMF `redact_input` is available separately. | FACT | [redaction](https://elevenlabs.io/docs/eleven-agents/customization/privacy/conversation-history-redaction), [multimodal](https://elevenlabs.io/docs/eleven-agents/customization/multimodal-input) |
| Data residency | Enterprise only. Isolated EU, India and Singapore environments, each a separate account and API host. The default is US. | FACT | [data residency](https://elevenlabs.io/docs/overview/administration/data-residency) |
| HIPAA | BAA is Enterprise only. It requires ZRM and restricts the LLM list. | FACT | [HIPAA](https://elevenlabs.io/docs/eleven-agents/legal/hipaa) |
| Twilio API integration | Not ZRM-compatible. | FACT | [Twilio API integration](https://elevenlabs.io/docs/eleven-agents/customization/integrations/twilio) |

---

## 11. Voice

| Item | Finding | Label | Source |
|---|---|---|---|
| IVC plans | Starter and up. | FACT | [pricing](https://elevenlabs.io/pricing) |
| IVC samples | 1–2 min recommended. At least 1 min. More than 3 min does not help. | FACT | [IVC](https://elevenlabs.io/docs/eleven-creative/voices/voice-cloning/instant-voice-cloning) |
| IVC consent | Confirm you have "the right and consent". The API concepts page says IVC and PVC both use "voice-captcha" verification. **These conflict.** | FACT (conflict) | IVC, [cloning concepts](https://elevenlabs.io/docs/eleven-api/concepts/voice-cloning) |
| PVC plans | Creator and up. Slots: Creator/Pro 1, Scale 3, Business 10. | FACT | [PVC](https://elevenlabs.io/docs/eleven-creative/voices/voice-cloning/professional-voice-cloning) |
| PVC samples | At least 30 min, ideally 2–3 h. Fine-tuning usually takes 3–6 h, up to 24 h. | FACT | PVC |
| PVC ownership | "You can only create a Professional Voice Clone of your own voice." Voice verification is required. Retry after 24 h on failure. | FACT | PVC |
| Client voice in our account | PVC: the owner creates it and shares it via an "Anyone with the link" share link; it lands in our My Voices. IVC: only shareable **inside the workspace**. Option: invite Amy as a workspace member (multi-seat plans) or use "Copy resources between workspaces" (voices). | FACT (sharing rules) / INFERENCE (agent can use it) | [share a voice](https://elevenlabs.io/docs/help-center/product/voices/my-voices/how-do-i-share-a-voice), [workspaces](https://elevenlabs.io/docs/overview/administration/workspaces/overview) |
| Voice Library terms | Covered by the Voice Library Addendum. Notice periods run 30 days to 2 years. Voices without one can vanish immediately. `voice_removal_notice` webhooks exist. Agents pay a voice surcharge. | FACT | [voice library](https://elevenlabs.io/docs/eleven-creative/voices/voice-library), [VLA](https://elevenlabs.io/vla), [webhooks](https://elevenlabs.io/docs/eleven-api/resources/webhooks) |
| Latency | Flash plus an IVC or default voice beats the same model with a PVC voice. | VENDOR CLAIM | [latency](https://elevenlabs.io/docs/eleven-api/concepts/latency) |

---

## 12. Known issues and latency

### 12.1 2026 status incidents relevant to us

FACT for titles and dates. Sources: [history](https://status.elevenlabs.io/history), [incidents API](https://status.elevenlabs.io/api/v2/incidents.json).

| Date (UTC) | Incident |
|---|---|
| 2026-01-09 → 01-13 | Increased LLM failure errors on Agent calls, tied to RAG latency (minor). |
| 2026-05-15 | EU residency: Agents, TTS and Scribe issue (major). |
| 2026-07-31 | SIP call failures (RCA pending). |
| 2026-08-18 | Inbound Twilio calls intermittently failing. About 1% of inbound calls from about 07:00 to 11:00 UTC. A config error on ElevenLabs' side (minor). |
| 2026-08-27 | Batch calling degraded (EU). |
| 2026-09-18 | Some ElevenAgents calls failed to start. |
| 2026-09-28 / 09-29 | EU Agents incident. Then Agents, STT and Creative latency and conversation failures (RCA pending). |
| 2026-10-06 | EU Agents disruption in SIP calls (major). |
| 2026-10-08 | Agent SIP conversation disruption (major; non-SIP unaffected; RCA pending). |
| 2026-10-13 | Multiple US endpoints with timeouts and latency (RCA pending). |

Impact labels in the history list come from the web view. Only some are confirmed in the JSON. INFERENCE for the unconfirmed ones.

### 12.2 GitHub and community

- I searched `org:elevenlabs` issues for transfer, Twilio, hang-up and register-call. I found no telephony or transfer bugs in the SDK repos. FACT (search result). [GitHub search](https://github.com/search?q=org%3Aelevenlabs+transfer&type=issues)
- The SDKs are not where telephony bugs get filed. INFERENCE.
- I did not find or check an official community forum. My web-search budget ran out. OPEN QUESTION.
- A third-party post claims agent audio is cut off when a transfer triggers. I did not verify it. OPEN QUESTION.

### 12.3 Published latency figures

All VENDOR CLAIM.

- Flash TTS model inference is about 75 ms.
- Network round-trip is 20–200 ms.
- RAG adds about 250 ms.
- Blocking guardrails add 200–500 ms.
- Burst calls are deprioritized.
- **No end-to-end agent latency SLA is published.** OPEN QUESTION.

Sources: [latency](https://elevenlabs.io/docs/eleven-api/concepts/latency), [RAG](https://elevenlabs.io/docs/eleven-agents/customization/knowledge-base/rag), [guardrails](https://elevenlabs.io/docs/eleven-agents/best-practices/guardrails), [burst](https://elevenlabs.io/docs/eleven-agents/guides/burst-pricing).

---

## 13. Workspaces and multi-tenant

| Item | Finding | Label | Source |
|---|---|---|---|
| Multi-seat | Scale, Business and Enterprise only. Scale 3 seats, Business 10. | FACT | [workspaces](https://elevenlabs.io/docs/overview/administration/workspaces/overview), [pricing](https://elevenlabs.io/pricing/agents) |
| Seats | Full or Basic seats. Basic seats target Agents and API use. Personal API keys need a Full seat. | FACT | workspaces, [API keys](https://elevenlabs.io/docs/overview/administration/workspaces/api-keys) |
| Service accounts | Multi-seat customers only. Admin-managed. Granted access via groups or sharing. Their keys do not expire. | FACT | [service accounts](https://elevenlabs.io/docs/overview/administration/workspaces/service-accounts) |
| API key limits | Endpoint scope, credit quota, IP allowlist (1–100 public IPs/CIDRs). User keys can expire. GitHub secret scanning auto-disables leaked keys. | FACT | API keys |
| Sharing | Share agents, tools, KB docs, secrets, phone numbers, tests and more with users or groups. | FACT | [sharing](https://elevenlabs.io/docs/overview/administration/workspaces/sharing-resources) |
| Multiple workspaces | A user can join unlimited paid workspaces. Voices and basic agent configs can be copied across (secrets are not copied). | FACT | workspaces |
| Per-tenant knobs | Per-agent webhook URL overrides. Per-agent concurrency and daily caps. `phone_dynamic_variable` transfer destinations. Environment variables, for dev/staging/prod (not for tenants). | FACT | [Create agent API](https://elevenlabs.io/docs/api-reference/agents/create), [env vars](https://elevenlabs.io/docs/eleven-agents/integrate/environment-variables) |
| Shared pool | Concurrency is a workspace pool. One busy tenant can starve the others unless you set per-agent caps. | FACT + INFERENCE | [call queueing](https://elevenlabs.io/docs/eleven-agents/guides/call-queueing) |
| Billing per tenant | One workspace means one bill. Separate workspaces mean separate subscriptions. | INFERENCE | workspaces |

---

## 14. Corrections to the brief

| Brief said | Status | Note |
|---|---|---|
| Plans, prices, concurrency | Correct | Add the minutes: Scale 3,738 and Business 12,375. Creator's first month is $11. |
| $0.08 extra, 3× burst at $0.16 | Correct | The burst cap is the lower of 3× or 300. Burst calls are deprioritized. |
| LLM at provider rates | Mostly | +10% on select Gemini and Claude models (Vertex regional). |
| `transfer_to_number` defaults to conference | Correct | — |
| `agent_message` only with native Twilio | Correct | — |
| SIP REFER has no warm message | Correct | — |
| Post-call webhooks are HMAC-signed | Correct | Retries are **off by default**. |
| Agent testing via CLI | Correct | The old simulate-conversation endpoint is deprecated. |
| BAA Enterprise only | Correct | — |
| Default retention 2 years | Correct | — |
| New: register-call | — | **No transfers at all.** |
| New: call queueing | — | **On by default** for new agents. |
| New: silence | — | Silence over 10 s is billed at 5%. |

## 15. Open questions to test or ask ElevenLabs support

1. What TwiML does register-call return? Is the `<Connect>` safe to add `action` to?
2. With register-call, what happens over the concurrency limit? Is call queueing applied?
3. Is `system__call_sid` populated for register-call? Are DTMF and queueing supported there?
4. After a SIP REFER the far end fails (NOTIFY non-2xx, or the leg is kept up by Twilio `answerOnBridge`), does the agent resume talking? What tool result does it see?
5. For a conference transfer: what happens on no-answer, busy or voicemail? What caller ID does the human see? Can the caller return to the agent?
6. What is the conversation initiation webhook timeout?
7. Are webhook tools retried on failure?
8. What does a test or simulation run cost, and what does `dev_discount` mean?
9. Is per-agent ZRM available on non-Enterprise plans?
10. Is the UUI limit 256 bytes or 8192 characters?
11. Does IVC require voice-captcha verification, or only a consent checkbox?
12. Does native import overwrite a manually reset voice URL? Is `api.us.elevenlabs.io/twilio/inbound_call` a supported redirect target?
