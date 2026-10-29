# Receiving Bestline-forwarded calls: PSTN, Twilio SIP, ElevenLabs SIP, Telnyx

- Date: 2026-10-22. Every price and doc claim was read from a live page today.
- Scope: **our receiving side only.** Bestline keeps 512-339-9313 and forwards calls to us.
- Goal: one number for three companies (Christmas Light Guys, Sublime Patio, The Fridge).
- Status: research input. Not a decision record. Builds on `docs/bestline-options.md`, `docs/adr/0003-voice-stack.md`, `docs/research/elevenlabs.md`.

| Label | Meaning |
|---|---|
| FACT | Read today on a primary page (vendor docs, pricing, RFC, regulation). URL given. Page dates are the page's own `dateModified` where it had one. |
| INFERENCE | Our reasoning from facts or from our code. Needs a test. |
| OPEN QUESTION | Not documented. Ask Bestline / the vendor, or test. |

---

## 0. Verdict

1. **Receive Bestline's calls as ordinary PSTN forwards to dedicated Twilio numbers (option a).** It is the only option that keeps register-call, the press-1 hand-back to Amy and the capture fallback unchanged. It needs nothing from Bestline beyond normal call forwarding. INFERENCE.
2. **The Twilio number decides the flow, not `ForwardedFrom`.** A number that only Bestline forwards to is marked "Amy already rang". Calls to it skip the ring and go straight to the AI. `ForwardedFrom` is logged and used as a soft check. Twilio says it depends on the carrier. FACT ([TwiML request params](https://www.twilio.com/docs/voice/twiml)). The rule is INFERENCE.
3. **"Authenticating Bestline" over the PSTN is not possible in the cryptographic sense.** No connection exists between Bestline and us. The call crosses the phone network. We authenticate **Twilio** (signature check, already built). We **recognise** Bestline traffic by the number dialled, `ForwardedFrom`, and `StirVerstat`. INFERENCE.
4. **A real authenticated connection needs SIP (option b).** Bestline would send SIP to a Twilio SIP Domain. Twilio then enforces IP ACL **and** digest credentials, with TLS and SRTP. FACT ([sending SIP](https://www.twilio.com/docs/voice/api/sending-sip), [secure media](https://www.twilio.com/docs/voice/api/secure-media)). Whether Bestline can route a forward to a SIP URI is an OPEN QUESTION. Treat it as phase 2.
5. **Do not send Bestline's SIP straight to ElevenLabs (option c) for v1.** Our server would leave the call path. We would lose the press-1 hand-back and the no-AI capture floor. INFERENCE from FACTs in §2.5.
6. **Telnyx (option d) adds nothing here.** It is still a PSTN forward. Register-call is a Twilio endpoint. We would rewrite the telephony layer. INFERENCE.
7. **Blocker for testing: the Twilio trial.** Trial accounts only take calls from verified numbers. The current trial docs also strip `<Dial><Number>`, `<Stream>` and `<Record>`. FACT ([try out Voice](https://www.twilio.com/docs/usage/trials/try-out-voice), 2026-09-25). Upgrade before any Bestline test.
8. **Never port 9313 in v1.** Keep the "never port" rule from `bestline-options.md`. The trade-off is in §5.

---

## 1. What actually arrives on a forwarded PSTN call (Twilio)

### 1.1 Parameters on the inbound voice webhook

| Parameter | When present | Label / source |
|---|---|---|
| `CallSid`, `AccountSid`, `From`, `To`, `CallStatus`, `ApiVersion`, `Direction` | Always. `From` may be `anonymous` or `unknown` if caller ID is withheld. | FACT, [TwiML request params](https://www.twilio.com/docs/voice/twiml) (2026-06-22) |
| `ForwardedFrom` | "This parameter is set only when Twilio receives a forwarded call, but its value depends on the caller's carrier including information when forwarding. Not all carriers support passing this information." | FACT, same page |
| `CallerName` | Only if the receiving number has `VoiceCallerIdLookup` set to `true`. | FACT, same page |
| `CallToken` | "A token string needed to invoke a forwarded call." It carries any SHAKEN and DIV PASSporTs. | FACT, same page; [SHAKEN/STIR](https://www.twilio.com/docs/voice/trusted-calling-with-shakenstir) (2026-08-24) |
| `ParentCallSid` | Omitted on the first leg. | FACT, TwiML page |
| `FromCity/State/Zip/Country`, `ToCity/...` | When Twilio can look them up. | FACT, TwiML page |
| `StirVerstat` | Only when the INVITE carried a SHAKEN PASSporT. Values include `TN-Validation-Passed-A/B/C`, `No-TN-Validation`, and `-Diverted` variants. A `-Diverted` value means Twilio fetched the **diverting** provider's certificate. | FACT, [SHAKEN/STIR](https://www.twilio.com/docs/voice/trusted-calling-with-shakenstir) |
| `StirPassportToken` | "May" be sent. Holds the original PASSporT. Not further documented. | FACT, same page |
| The diversion **reason** (no-answer vs busy vs unconditional) | Not listed anywhere in Twilio's request parameters. | FACT (absence), TwiML page |

Implications:

- `ForwardedFrom` may arrive empty even when Bestline forwarded the call. INFERENCE from the FACT above.
- Even when it arrives, it cannot tell "forward on no answer" from "forward all". So it cannot tell us whether Amy was already rung. INFERENCE (the reason is not exposed).
- Whether `From` will be the real caller or 9313 depends on Bestline. Already OPEN in `bestline-options.md` question 5.
- `CallerName` costs $0.01 per request ("Inbound caller identification", US only). FACT ([Lookup pricing](https://www.twilio.com/en-us/user-authentication-identity/pricing/lookup), "current as of August 2026"). It is optional.
- The SIP view of forwarding is the Diversion header (RFC 5806, **Historic**). It carries the pre-diversion Request-URI and a `reason` such as `no-answer`, `user-busy`, `unconditional`. FACT ([RFC 5806](https://www.rfc-editor.org/rfc/rfc5806)). The standards-track successor is History-Info (RFC 7044, obsoletes RFC 4244). FACT ([RFC 7044](https://www.rfc-editor.org/rfc/rfc7044)). The signed form is the `div` PASSporT. FACT ([RFC 8946](https://www.rfc-editor.org/rfc/rfc8946)).
- How Bestline's Metaswitch maps its forward into these, and whether `ForwardedFrom` reaches Twilio: OPEN QUESTION. One test call answers it (§7.3).

### 1.2 What Bestline's platform can do (indirect evidence)

- Another Metaswitch CommPortal carrier documents separate rules: "If your phone is busy", "If there is no answer", "Forward if Unavailable". It lists star codes *72 (forward all), *92 (delayed / no-answer), *90 (busy). FACT for that carrier ([WOW CommPortal help](https://www.wowway.com/help-center/phone/what-do-i-do-if-my-calls-using-commportal-are-forwarding-somewhere-i-didnt-request)). That Bestline exposes the same rules: INFERENCE.
- The voicemail trap still applies. If 9313 forwards **all** calls to Amy's cell, her cell voicemail answers. Bestline then never sees a no-answer. INFERENCE, already in `bestline-options.md`.

---

## 2. Receiving options compared (question 1)

### 2.1 Summary matrix

Twilio prices: [voice pricing](https://www.twilio.com/en-us/voice/pricing/us) and [SIP trunking pricing](https://www.twilio.com/en-us/sip-trunking/pricing/us), both "current as of August 2026". FACT. ElevenLabs plan minutes are the same in every column. "Design works" means register-call + REST-redirect hand-back + capture fallback, per `lib/server/voice.ts`.

| | (a) PSTN forward → Twilio number | (b1) SIP → Twilio SIP Domain | (b2) SIP → Twilio BYOC trunk | (b3) Twilio Elastic SIP Trunking | (c) SIP → ElevenLabs SIP trunk | (d) Telnyx |
|---|---|---|---|---|---|---|
| Bestline change | Forward rule to an outside number | Route forward to a SIP URI. OPEN if offered | Carrier-style SIP interconnect. OPEN | n/a (wrong direction) | Route forward to a SIP URI. OPEN | Forward rule to a Telnyx number |
| Receive $/min | Twilio $0.0085 | Twilio $0.0040 | Twilio $0.0040 | origination $0.0034 | none from ElevenLabs | ≈ $0.0052 (INFERENCE, §2.6) |
| Monthly | $1.15 per number | Domain fee not listed; a $1.15 number still needed as hand-off caller ID (INFERENCE) | not listed | $1.15 per number | $0 telephony | $1.00 per number |
| Register-call works | Yes (built) | Yes. INFERENCE | Yes. INFERENCE | **No.** No TwiML runs | **No.** No Twilio leg | **No.** Twilio-only endpoint |
| Hand-back to Amy, press-1 | Yes (built) | Yes, needs explicit `callerId` (FACT rule, §2.3) | Yes, same | No | **No.** SIP REFER only | Rebuild in TeXML |
| No-AI capture floor | Yes (built) | Yes | Yes | No | **No** | Rebuild |
| Caller ID survives | If Bestline passes it. OPEN | Bestline sets `From` | Bestline sets `From` | n/a | via `X-CALLER-ID` | If Bestline passes it |
| Original dialed number | `ForwardedFrom`, carrier-dependent | Request-URI user part, or `X-` header → `SipHeader_X-*` | `X-` headers **discarded** | n/a | `X-` → `{{sip_*}}` | `custom_headers`; Diversion OPEN |
| Authentication | Twilio signature on our webhook only | IP ACL + digest (both enforced if both set), TLS, SRTP, plus Twilio signature | IP ACL and/or credentials, TLS/SRTP | IP ACL / credentials | Digest, IP allowlist (TCP/TLS), TLS 1.2+, SRTP | IP / credential / FQDN connections; Ed25519 webhooks |
| Latency vs (a) | baseline | one PSTN transit fewer. INFERENCE | same as b1. INFERENCE | n/a | lowest (no Twilio hop). INFERENCE | ≈ (a). INFERENCE |
| Verdict | **v1** | **Phase 2** if Bestline can do SIP | Only if Bestline wants carrier interconnect | Not a fit | Not for v1 | Not a fit |

Media Streams is billed at $0.0044/min. FACT (Twilio voice pricing). Register-call TwiML is very likely `<Connect><Stream>` (INFERENCE, `elevenlabs.md` §1.2). If so, every AI minute on (a)/(b) adds $0.0044. `docs/cost-model.md` does not include it yet. INFERENCE.

### 2.2 (a) PSTN forward to a Twilio number (current design)

| Item | Finding | Label / source |
|---|---|---|
| Setup | Buy a Twilio local number per forward target. Point its voice URL at `/api/voice/inbound`. Bestline sets a forward rule to it. | INFERENCE (our flow) |
| Cost | $1.15/mo per number, $0.0085/min inbound, $0.0140/min for the leg that rings Amy. | FACT, [voice pricing](https://www.twilio.com/en-us/voice/pricing/us) |
| Bestline cost | Per-minute charge for forwarding to an outside number. Already asked (Bestline Q9). | OPEN QUESTION |
| Bestline capacity | A forwarded call likely holds two call paths on Bestline (in + out) for its whole length. Simultaneous callers to three companies could hit a path limit. | INFERENCE; OPEN QUESTION for Bestline |
| Time to answer | Caller hears ringing for Bestline's no-answer timer, then the forward setup, then register-call (4 s budget, ADR 0003). | INFERENCE |
| In-call latency | One extra PSTN transit compared with SIP. Not measured. ADR 0003 prove-it test 6 measures it. | INFERENCE |
| Register-call + hand-back | Unchanged. The call is an ordinary inbound Twilio call. | INFERENCE from `lib/server/voice.ts` |
| Caller ID | `From` is the original caller only if Bestline passes it. | OPEN QUESTION (Bestline Q5) |
| Original number | `ForwardedFrom`, carrier-dependent. | FACT, [TwiML params](https://www.twilio.com/docs/voice/twiml) |
| Authentication | Our webhook verifies `X-Twilio-Signature`: HMAC-SHA1 over the URL plus sorted POST params, keyed by the auth token. Twilio has no fixed webhook IP range. | FACT, [webhook security](https://www.twilio.com/docs/usage/webhooks/webhooks-security) (2026-10-14). Built: `lib/telephony/signature.ts`, `lib/server/twilio-request.ts` |
| Bestline identity | Not cryptographic. Signals: the dedicated `To`; `ForwardedFrom` ∈ Bestline numbers; `StirVerstat` ending `-Diverted`. Whether Bestline signs `div` PASSporTs: OPEN. | INFERENCE + FACT for the values |

### 2.3 (b1) SIP from Bestline to a Twilio SIP Domain

| Item | Finding | Label / source |
|---|---|---|
| Setup | Create a SIP Domain, e.g. `lightline.sip.twilio.com`. Set its voice URL to our webhook. Bestline sends INVITEs to it. | FACT, [sending SIP](https://www.twilio.com/docs/voice/api/sending-sip) (2026-10-08) |
| Authentication | You must configure at least one IP ACL or Credential List. "If you configure both, then both ACLs and credential lists are enforced." ACL entries must be full IPs. Credentials are challenged with 407. Passwords ≥ 12 chars, mixed case, a digit. Twilio stores MD5 digests. | FACT, same page |
| Digest strength | MD5 digest is obsolete under RFC 8760, which adds SHA-256. Twilio storing MD5 suggests MD5 digest. Pair it with IP ACL and TLS. | FACT ([RFC 8760](https://www.rfc-editor.org/rfc/rfc8760)); INFERENCE for Twilio |
| TLS | Port 5061, TLS 1.2. Use `sip:` with `transport=tls`, not `sips:`. Send to the domain name, not an IP, or get 403. | FACT, [SIP with Twilio Voice](https://www.twilio.com/docs/voice/api/sip-interface) (2026-08-19) |
| SRTP | "Secure Media" toggle on the domain. Then TLS and SRTP are both required. Non-encrypted calls are rejected. Suites `AES_CM_128_HMAC_SHA1_80` / `_32`. | FACT, [secure media](https://www.twilio.com/docs/voice/api/secure-media) (2026-08-19) |
| Params to our webhook | `To` = INVITE URI, `From` = From header, `SipDomain`, `SipDomainSid`, `SipCallId`, `SipSourceIp`, `SipHeader_<name>` for each `X-` header. | FACT, [SIP TwiML](https://www.twilio.com/docs/voice/api/sip-twiml) (2026-10-08) |
| Other headers | "Twilio will read any headers beginning with the X- prefix". UUI arrives as `SipHeader_User-to-User`. Diversion and History-Info are not mentioned. | FACT ([SIP TwiML](https://www.twilio.com/docs/voice/api/sip-twiml), [sending SIP](https://www.twilio.com/docs/voice/api/sending-sip)); passing Diversion = OPEN QUESTION |
| One URL per domain | "All users in the same SIP domain are sent to the same application URL." Per-company routing uses the URI user part or an `X-` header. | FACT, sending SIP |
| Status callbacks | Inbound SIP calls get only the *completed* status callback. Our `handleStatus` only acts on terminal statuses. | FACT (Twilio); INFERENCE (fit) |
| Hand-back caller ID | On an inbound SIP call, `<Dial>` `callerId` cannot be the `To` or `From` number. It must be a Twilio number or a verified number. Our `handoffDialTwiml` sets none today. | FACT, [Dial](https://www.twilio.com/docs/voice/twiml/dial) (2026-09-07); INFERENCE (code gap) |
| Cost | $0.0040/min receive. Refer $0.10 each (unused). | FACT, voice pricing |
| Register-call | Works on any Twilio call leg. `from_number`/`to_number` must be extracted from SIP URIs. | INFERENCE |
| Bestline side | A hosted-subscriber forward is normally to an E.164 number. Forwarding to an external SIP URI needs carrier-level routing. | INFERENCE; OPEN QUESTION |

### 2.4 (b2) Twilio BYOC trunk and (b3) Elastic SIP Trunking

| Item | Finding | Label / source |
|---|---|---|
| BYOC purpose | Interconnects an existing carrier with Programmable Voice. The "A Call Comes In" handler can be our webhook. | FACT, [BYOC](https://www.twilio.com/docs/voice/bring-your-own-carrier-byoc) (2026-08-24) |
| BYOC auth | IP ACL or credentials (both enforced if both set). "IP ACLs alone does not protect against certain types of attacks." TLS/SRTP toggle. | FACT, same page |
| BYOC headers | Custom and UUI headers on BYOC trunk INVITEs are discarded. So no `X-Lightline-Company`. | FACT, [sending SIP](https://www.twilio.com/docs/voice/api/sending-sip) |
| BYOC cost | $0.0040/min receive; secure media included. | FACT, voice pricing |
| Elastic SIP Trunking direction | Origination = PSTN → your Twilio number → **your** SIP. Termination = your SIP → PSTN. | FACT, [Elastic SIP Trunking](https://www.twilio.com/docs/sip-trunking) (2026-09-25) |
| Elastic and TwiML | "If a `trunk_sid` is present, we ignore all of the voice urls". A trunk number never reaches our webhook. | FACT, [IncomingPhoneNumber](https://www.twilio.com/docs/phone-numbers/api/incomingphonenumber-resource) (2026-05-04) |
| Elastic verdict | Not a receiving path for Bestline. Termination would send Bestline's call back out to the PSTN. | INFERENCE |

### 2.5 (c) SIP straight into ElevenLabs (native SIP trunk import)

| Item | Finding | Label / source |
|---|---|---|
| Endpoint | `sip.rtc.elevenlabs.io`. TCP 5060, TLS 5061; UDP "for testing only, not production". TLS 1.2+. | FACT, [SIP trunking](https://elevenlabs.io/docs/eleven-agents/phone-numbers/sip-trunking) |
| Import | Dashboard "Import number → From SIP Trunk", or `POST /v1/convai/phone-numbers` with `provider: "sip_trunk"`, `inbound_trunk_config` (`allowed_addresses`, `allowed_numbers`, `media_encryption`, `credentials`, `remote_domains`), `agent_id`. | FACT, [SIP trunking](https://elevenlabs.io/docs/eleven-agents/phone-numbers/sip-trunking), [create phone number API](https://elevenlabs.io/docs/api-reference/phone-numbers/create) |
| Authentication | "Digest Authentication is strongly recommended." Source-IP limits apply on TCP/TLS only (default `0.0.0.0/0`). SRTP Disabled / Allowed / Required. Static IPs are Enterprise-only. | FACT, SIP trunking |
| Headers | `X-CALL-ID`, `X-CALLER-ID` → `system__call_sid`, `system__caller_id`. Other `X-Foo-Bar` → `{{sip_foo_bar}}`. Diversion / History-Info / Request-URI are not mentioned. | FACT, SIP trunking; Diversion = OPEN QUESTION |
| Called number | `system__called_number` exists ("Destination phone number called"). | FACT, [dynamic variables](https://elevenlabs.io/docs/eleven-agents/customization/personalization/dynamic-variables) |
| Transfers | SIP REFER to a number or SIP URI. Needs a trunk that allows REFER. No `agent_message`. Behaviour when the target does not answer is not documented. | FACT, [transfer_to_number](https://elevenlabs.io/docs/eleven-agents/customization/tools/system-tools/transfer-to-number); OPEN QUESTION (no answer) |
| Our design | Our server is out of the call path. REFER hands the call back to Bestline. Bestline rings Amy, and her voicemail can take it again. A missed hand-off does not come back to the agent. No capture floor if ElevenLabs is down, unless Bestline fails over. | INFERENCE |
| Cost | No ElevenLabs telephony fee; an external provider "bills you directly". | FACT, [pricing](https://elevenlabs.io/pricing/agents) |
| Reliability | 2026 SIP-specific incidents: Jul 31, Oct 6 (EU), Oct 8. | FACT per `elevenlabs.md` §1.3 ([status](https://status.elevenlabs.io/history)) |
| Verdict | Cheapest and lowest latency. Gives up the three things ADR 0003 exists for. Not for v1. | INFERENCE |

A hybrid exists: receive on Twilio (a or b), then `<Dial><Sip>` to ElevenLabs instead of register-call. It keeps hand-back and adds `X-CALL-ID`. Detail in `elevenlabs.md` §1.3. Not needed for this question. INFERENCE.

### 2.6 (d) Telnyx

| Item | Finding | Label / source |
|---|---|---|
| Price | Number $1.00/mo. Voice API $0.002/min "+ SIP Trunking fee"; SIP trunking inbound from $0.0032/min. TeXML $0.002/min. Media streaming $0.0035/min. Page dated 2026-09-01. | FACT, [Telnyx voice pricing](https://telnyx.com/pricing/call-control) |
| Effective inbound | ≈ $0.0052/min. | INFERENCE (sum of the two lines) |
| SIP auth | Connection types: credentials (register), IP (static IP needed), FQDN. | FACT, [Telnyx auth methods](https://developers.telnyx.com/docs/voice/sip-trunking/authentication/credential-types), [connection types](https://support.telnyx.com/en/articles/4245868-sip-connection-types) |
| Webhook auth | `telnyx-timestamp` + `telnyx-signature-ed25519`. Not Twilio HMAC. | FACT, [TeXML callback](https://developers.telnyx.com/api-reference/callbacks/texml-http-request) |
| Headers | SIP headers reach `custom_headers` on `call.initiated`; X-Telnyx headers stripped; headers stripped across accounts and to the PSTN. Diversion not confirmed. | FACT, [Telnyx header propagation](https://support.telnyx.com/en/articles/16666680-custom-sip-x-header-propagation-on-telnyx); OPEN for Diversion |
| ElevenLabs link | Direct SIP trunk. "Telnyx inbound trunks don't use digest authentication". | FACT, [ElevenLabs Telnyx guide](https://elevenlabs.io/docs/eleven-agents/phone-numbers/telephony/telnyx) |
| Register-call | Endpoint is `/v1/convai/twilio/register-call` and returns TwiML. Whether Telnyx `<Stream>` speaks the same media protocol: not documented. | FACT (path); OPEN QUESTION |
| Our design | New signature check, new REST redirect, TeXML builders, SIP leg to ElevenLabs. Still a PSTN forward from Bestline. | INFERENCE |
| Verdict | No gain on the receive side. Revisit only with a full Telnyx move (`vendor-research.md`). | INFERENCE |

---

## 3. Detecting a forwarded call and skipping the second ring (question 2)

### 3.1 The rule

**Decide by the number Bestline forwards to.** Configure it; do not infer it. INFERENCE.

| Signal | Reliable? | Use |
|---|---|---|
| `To` = a Twilio number that only Bestline's forward rule targets | Yes. We assign it. | **Primary.** Line mode `owner_already_rang` → skip ring. |
| `ForwardedFrom` | Carrier-dependent; may be empty. FACT ([TwiML](https://www.twilio.com/docs/voice/twiml)) | Evidence. Log it. Routing hint on a shared target (§4). Never the only gate. |
| Diversion reason (no-answer vs all) | Not exposed by Twilio on PSTN calls. FACT (absence) | Cannot be used. |
| `StirVerstat` `…-Diverted` | Only if Bestline signs a `div` PASSporT. OPEN | Evidence. Log it. |
| `From` = 9313 | Means Bestline replaced the caller ID. OPEN | Treat as forwarded; flag "caller ID lost". |

Why the number, not `ForwardedFrom`:

- Bestline's "forward all" and "forward on no answer" both produce a forward. Only the second means Amy was rung. Only configuration knows which rule points where. INFERENCE.
- An empty `ForwardedFrom` must not ring Amy twice. INFERENCE.

### 3.2 Two Bestline modes, one code path

| Bestline rule | Twilio line mode | Our flow | When to pick |
|---|---|---|---|
| No answer / busy → Twilio number | `owner_already_rang` | AI first. Any AI failure → capture (record). **Never ring Amy again.** Hand-off to Amy via tool still uses press-1. | Bestline owns the no-answer timer (MaX UC app, or a ring Amy's voicemail cannot answer). |
| Forward all → Twilio number | `ring_owner` (today's behaviour) | Our press-1 ring to Amy, then AI. | Bestline cannot detect no-answer, e.g. it forwards to Amy's cell. Fixes the voicemail trap. Bestline's own voicemail/text stops. |

Both are INFERENCE. The second is what `bestline-options.md` calls option D, in its "forward all" form.

### 3.3 Edge cases

- Someone dials the unpublished forward target directly. They reach the AI receptionist, as if Amy missed. Low harm. INFERENCE.
- `ForwardedFrom` is present but not a Bestline number. Still treat as forwarded. Raise a low-severity incident `forward_source_unrecognized`. INFERENCE.
- Webhook replay. `ingestInboundCall` already pins the first decision. The forwarded mode must pin "no ring" the same way. INFERENCE from `lib/server/voice.ts` `handleInbound` (the `effective` route).
- Server down. The number's fallback TwiML Bin must not ring Amy and must name the right company. `docs/prior-work/fallback-twiml-bin.xml` is CLG-only. INFERENCE.
- Double alerts. Bestline's missed-call text plus our lead alert. Ask Bestline to disable its voicemail/text on forwarded calls, or accept both. OPEN (Bestline).

---

## 4. Per-number routing for three companies (question 3)

### 4.1 Ways to know the company without asking

| Option | How the company is known | Needs | Label |
|---|---|---|---|
| R1. One Bestline DID per company, each forwards to its own Twilio number | `To` → `tracking_number` → `business_id`. Already how `findLineByNumber` works. | New Bestline DIDs (cost OPEN); $1.15/mo per Twilio number (FACT) | INFERENCE (design); FACT (code) |
| R2. Bestline auto attendant on 9313 ("1 lights, 2 patio, 3 Fridge"); each option rings Amy then forwards to its own Twilio number | Same as R1 | Bestline AA can target "ring then forward". OPEN (Bestline Q7) | INFERENCE |
| R3. 9313 and 512-923-9313 both forward to **one** Twilio number | `ForwardedFrom` → company map | Carrier passes `ForwardedFrom`. Fragile. | FACT (carrier-dependent); INFERENCE |
| R4. SIP (b1) | Request-URI user part = original DID, or `X-Lightline-Company` → `SipHeader_X-Lightline-Company` | Bestline SIP routing. OPEN | FACT (header passing) |
| R5. Shared 9313, no IVR | Unknown. Ask once. | Deterministic `<Gather>` before the agent, then the chosen company's agent | INFERENCE |

- 512-923-9313 appears on thefridgevending.com. Typo or second line: OPEN (Bestline Q8). If real, it gives R1 for The Fridge.
- R1 or R2 is the target. R5 is the v1 fallback for a single shared forward. INFERENCE.

### 4.2 How the agent learns the company

- Each `business` row has its own config and `config.ai.agentId`. `connectAgent` uses the line's business config. FACT (`lib/server/voice.ts` `connectAgent`, `configFor`).
- So the company picks the **agent**, the brand line in `openingLine`, and the approved facts. No new variable is strictly required. INFERENCE.
- Register-call accepts `conversation_initiation_client_data.dynamic_variables` and `conversation_config_override` (agent `first_message`, `prompt`, …). FACT ([register-call API](https://elevenlabs.io/docs/api-reference/twilio/register-call)). Whether overrides must be enabled per agent: OPEN QUESTION. Not needed if each company has its own agent. INFERENCE.
- Sublime Patio and The Fridge start as message-taking agents until Amy approves facts. Matches `bestline-options.md`. INFERENCE.

---

## 5. Porting 512-339-9313 to Twilio vs keeping it on Bestline (question 4, not v1)

| | Keep on Bestline + forward (v1) | Port to Twilio |
|---|---|---|
| Control | Bestline decides ring/no-answer. We see what the forward gives us. | Our TwiML decides everything; `To` = 9313; no `ForwardedFrom` guesswork. INFERENCE |
| Double ring / voicemail trap | Depends on Bestline mode (§3.2) | Gone. Our press-1 ring is the only ring. INFERENCE |
| Per-company menu | Bestline AA (OPEN) or our `<Gather>` | Our `<Gather>`. INFERENCE |
| Cost | Bestline plan (unknown) + $1.15/mo per number + $0.0085/min | $1.15/mo + $0.0085/min in, $0.014/min to ring Amy (FACT, prices). Bestline plan may shrink or end. OPEN |
| Blast radius | Our outage → Bestline still holds the number. Calls fall to the TwiML Bin or Bestline voicemail (OPEN). | Our or Twilio's outage hits **all three companies at once**. Only Twilio fallback TwiML mitigates it. INFERENCE |
| Lost features | None | MaX UC app, hunt groups, Bestline voicemail-to-text, Amy's outbound caller ID as 9313 (`bestline-options.md`: the app shows the business number). Rebuild or lose. INFERENCE |
| SMS on 9313 | Unchanged | Moves too. SMS routing typically lags 2–3 business days after the port. Local numbers need an approved A2P 10DLC brand and campaign. FACT ([Twilio porting FAQ](https://support.twilio.com/hc/en-us/articles/223179468-How-long-does-it-take-to-port-a-US-number-to-Twilio), older support article, via search snippet) |
| Timeline | Days (forward rule) | "5 to 15 days for standard ports", "up to four weeks or longer" after a rejection. FACT ([Twilio US porting guidelines](https://www.twilio.com/en-us/guidelines/us/porting), © 2026). Ports run weekdays 8:00–8:30 a.m. PT; no weekends or holidays. FACT (older Twilio support FAQ, via search snippet; re-check) |
| Paperwork | None | LOA, name and address matching the CSR, a bill from the last 30 days, account number, PIN. "The most common reason for a rejected port is incorrect name and/or address information." FACT (porting guidelines) |
| API | n/a | Porting API is public beta, US non-toll-free, no SLA. Twilio emails an e-LOA; 30 days to sign. Partial ports supported. FACT ([port-in](https://www.twilio.com/docs/phone-numbers/port-in), 2026-07-07) |
| Regulation | n/a | FCC: a "simple" port must complete "within one business day". FACT ([47 CFR 52.35](https://www.law.cornell.edu/cfr/text/47/52.35), LII mirror of the eCFR). A hosted-PBX line with features may not count as "simple". INFERENCE |
| Reversibility | Change the forward rule | Port back out: another multi-day port. INFERENCE |
| Risks | Bestline per-minute and call-path limits (OPEN) | Cutover mistakes in peak season; Bestline contract or early-termination fee (OPEN); other numbers on the same Bestline account turning this into a partial port (OPEN). INFERENCE |

Recommendation: keep 9313 on Bestline through the 2026 season. Revisit porting off-season, after measured forward reliability, with Amy's and the owner's approval. If 512-923-9313 is a real separate line, it is the safer pilot port. INFERENCE.

---

## 6. Twilio trial limits for this test (question 5)

| Limit | Finding | Label / source |
|---|---|---|
| Who can call in | "You can only make or receive calls from verified numbers." Forwarded callers are strangers. Every test caller must be verified. | FACT, [try out Voice](https://www.twilio.com/docs/usage/trials/try-out-voice) (2026-09-25) |
| Verified cap | "Each account can verify up to 5 recipients", shared with Messaging, WhatsApp and Verify. | FACT, [trials](https://www.twilio.com/docs/usage/trials) (2026-10-20) |
| Verification method | "You must select SMS as the verification method." If Bestline replaces the caller ID with 9313, 9313 itself would need verifying by SMS. Whether 9313 takes SMS: OPEN. | FACT, [trial guide](https://www.twilio.com/docs/usage/tutorials/how-to-use-your-free-trial-account) (2026-09-25); INFERENCE |
| Blocked TwiML | Stripped during trial: `<Record>`, `<Stream>`, `<Dial><Number>`, `<Dial><Sip>`, `<Refer>` and others. `<Connect>` is not mentioned. Each is replaced with "The {verb} verb is not available on trial accounts." | FACT, try out Voice |
| Effect on us | Our Amy ring (`<Dial><Number>`), the register-call stream, and capture (`<Record>`) would all be stripped. | INFERENCE from `lib/telephony/twiml.ts` |
| Trial numbers | "Trial numbers are shared Twilio-owned numbers, not dedicated numbers assigned to your account." The legacy Console still lets you buy a number with "your preloaded trial balance". | FACT, trials; trial guide |
| Effect on setup | `scripts/live/setup.ts` `configureTwilio` looks up `CLG_TV_NUMBER` in `incomingPhoneNumbers`. A new-style trial with shared numbers would fail there. Which style this account is: OPEN. | INFERENCE |
| Trial notice | "On a trial account, you will hear a message from Twilio asking you to press any key to execute the call." A forwarded caller would have to press a key. | FACT, [Flex voice test](https://www.twilio.com/docs/flex/admin-guide/setup/voice/test) (2026-07-17) |
| Concurrency | "Max concurrent calls" 5 per trial account. | FACT, try out Voice |
| Free units / expiry | 75 call minutes; trials "expire 30 days after sign-up"; voice limited to the sign-up country. | FACT, trials |
| SIP Domain / BYOC on trial | Not stated. | OPEN QUESTION |
| Upgrade | Create a profile, add an address, "load a starting balance", add payment. No minimum stated in current docs. Older Twilio blog posts said $20. | FACT (docs: no minimum); OPEN (exact minimum) |
| After upgrade | Verified-recipient restriction removed. Pay as you go: $1.15/mo per number, $0.0085/min in, $0.014/min out. Post-upgrade free units are used first. | FACT, trials; voice pricing |

Conclusion: a Bestline-forward test cannot run on a trial. Upgrade first. Test spend is a few dollars plus the starting balance. INFERENCE.

**Risk to flag in full:** the README's "Real phone test (Twilio trial + ElevenLabs)" section may not work at all on a new-style trial, because `<Dial><Number>`, `<Stream>` and `<Record>` are stripped. Confirm the account type (legacy trial with a bought number vs. shared trial numbers) before the next live test. INFERENCE from the FACTs above.

---

## 7. Recommended receiving architecture (question 6)

### 7.1 Shape

```
Caller ──► 512-339-9313 (Bestline, Metaswitch)
             │  Bestline rings Amy (MaX UC app / desk / cell: Bestline's choice)
             │  no answer or busy
             ▼  PSTN forward (one rule per company if Bestline can; else one rule)
          Twilio number FWD_CLG / FWD_SP / FWD_FRIDGE   (unpublished, $1.15/mo each)
             │  POST /api/voice/inbound   (X-Twilio-Signature verified: built)
             ▼
          handleInbound: line.entryMode = owner_already_rang
             │  log ForwardedFrom / StirVerstat / From
             │  no ring; route = agent | capture
             ▼
          register-call (that company's agent) ──► <Connect action=/agent-ended>
             │  transfer_to_amy → REST redirect → press-1 ring to Amy (built)
             ▼
          capture (record) on any AI failure; never a second ring
```

Fallback mode, if Bestline cannot own the no-answer timer: Bestline forwards **all** calls to a Twilio number with `entryMode = ring_owner`. Today's flow runs unchanged. INFERENCE.

Phase 2, only if Bestline offers SIP routing: same webhook via a Twilio SIP Domain with IP ACL + credentials + TLS + Secure Media. The company comes from the Request-URI or `X-Lightline-Company`. INFERENCE.

### 7.2 Concrete code changes (not made; for the implementer)

1. **New migration `supabase/migrations/0004_forwarded_lines.sql`** (then rerun `scripts/bundle-migrations.mjs`).
   - `tracking_number.entry_mode text not null default 'ring_owner' check (entry_mode in ('ring_owner','owner_already_rang'))`.
   - `tracking_number.forward_sources text[] not null default '{}'` (Bestline numbers expected in `ForwardedFrom`).
   - `call.forwarded_from text`, `call.stir_verstat text`, `call.caller_name text`.
   - `app.ingest_inbound_call(...)`: accept and store those three fields. Start in state `recovery` when the line is `owner_already_rang`.
2. **`lib/db/repo.ts`**: add `entryMode` and `forwardSources` to `LineRow` and `LINE_SELECT`. Extend `ingestInboundCall` input with `forwardedFrom`, `stirVerstat`, `callerName`.
3. **New `lib/telephony/forwarding.ts`**: pure `classifyForward(params, line)` → `{ ownerAlreadyRang, forwardedFrom, recognisedSource, stirVerstat }`. Use `normalizeUsPhone` from `lib/telephony/phone.ts`. Export it from `lib/telephony/index.ts`. Unit-test every row of §3.1.
4. **`lib/business-rules/routing.ts`**: add `routeForwarded(config, capacity): AfterOwnerRoute`. Agent if admitted, else capture. Never `ring_owner`. Reuse `agentAdmission`. `ai.mode = "off"` on a forwarded line means capture.
5. **`lib/server/voice.ts` `handleInbound`**: call `classifyForward`. If `ownerAlreadyRang`, use `routeForwarded` and pass `afterHours: true` (or a renamed `skipOwnerRing`) to `ingestInboundCall`, so replays never ring. Enter the agent with entry `owner_unavailable`. Raise `forward_source_unrecognized` (low severity) for an unknown `ForwardedFrom`.
6. **`lib/agents/policy.ts` `openingLine`**: `owner_unavailable` already says "{owner} is tied up right now". Check it fits a caller who already heard ~20 s of ringing. Optionally add an `Entry` value `forwarded_missed` in `lib/elevenlabs/dynamic-variables.ts` (changes the agent spec; keep `DYNAMIC_VARIABLE_KEYS` complete).
7. **Per company**: add `lib/business-rules/tenants/sublime-patio.ts` and `lib/business-rules/tenants/the-fridge.ts` (message-taking, no unapproved facts). Seed their businesses and forward lines in `lib/db/seed.ts` and `developmentSeedOptions` in `lib/server/db.ts` (env keys such as `CLG_FWD_NUMBER`, `SP_FWD_NUMBER`, `FRIDGE_FWD_NUMBER`).
8. **`scripts/live/setup.ts`**: `configureTwilio` loops over every line number, not just `CLG_TV_NUMBER`. It sets `voiceFallbackUrl` to a per-company TwiML Bin and, optionally, `voiceCallerIdLookup: true` ($0.01/call). It fails early, with a clear message, on a trial whose number is not an `IncomingPhoneNumber`. `provision` builds one agent per business via `buildAgentRequest`.
9. **`lib/telephony/twiml.ts` `handoffDialTwiml`** (and `ringOwnerTwiml`): accept an optional `callerId`. Required for phase-2 SIP calls (FACT rule, §2.3). Harmless for PSTN.
10. **Shared-line fallback (R5)**: new `companyMenuTwiml` in `lib/telephony/twiml.ts` (`<Gather input="dtmf speech">`) plus a `/api/voice/company` route. It sets the call's business, then runs the normal `connectAgent`. Needs a "shared" `tracking_number` whose business is chosen per call. Build only if Bestline has no per-company DIDs or AA.
11. **Phase 2 only (SIP)**: `e164FromSipUri()` in `lib/telephony/phone.ts`. `handleInbound` resolves the line from the user part of `p.To` or from `p["SipHeader_X-Lightline-Company"]`. Reject unless `p.SipDomainSid` equals a new env `TWILIO_SIP_DOMAIN_SID`. Optionally require `p.SipSourceIp` ∈ Bestline's SBC IPs. Signature verification stays as is (INFERENCE: Twilio signs SIP Domain webhooks the same way).
12. **Docs** (separate change): `docs/cost-model.md` adds Media Streams $0.0044/min (§2.1). `docs/failure-matrix.md` adds "forward arrives without `ForwardedFrom`" and "Bestline call-path limit". `docs/go-live.md` adds the Twilio upgrade step.

### 7.3 First test (after the Twilio upgrade, before touching 9313)

1. Ask Bestline for a **test DID** on the same platform with the same forward rule. Point it at a Twilio forward number. Nothing on 9313 changes. INFERENCE.
2. Call it from a cell that is not Amy's. Let it go unanswered. Persist **all** webhook params for this call (a temporary event emit in `handleInbound`).
3. Record: `From` (real caller or 9313?), `ForwardedFrom`, `StirVerstat`, ring time before Twilio sees the call, audio latency after the forward.
4. Repeat with Bestline "forward all" to check the fallback mode.
5. Only then change 9313's rule, in a quiet window, with Amy's and the owner's approval.

### 7.4 New questions for Bestline (add to the `bestline-options.md` list)

1. On a forward to an outside number, do you pass the original caller ID **and** a redirecting number / Diversion header? OPEN
2. Does a forwarded call use two call paths? How many paths does 9313's account have? OPEN
3. Can the no-answer timer be set (e.g. 18 s)? Does it run when Amy uses the MaX UC app? OPEN
4. Can 9313 ring Amy's cell with an answer confirmation, so her voicemail cannot "answer"? OPEN
5. Can you route a forward to a SIP URI (Twilio SIP Domain) over TLS/SRTP with digest auth? From which source IPs? Can you put the original DID in the Request-URI or an `X-` header? OPEN
6. Do you sign STIR/SHAKEN `div` PASSporTs on forwarded calls? OPEN
7. Can each company get its own DID, or can an AA option ring Amy then forward to a distinct number? Cost? OPEN
8. If our number is unreachable or busy, does the forward fall back to Bestline voicemail? OPEN
9. Can Bestline's missed-call text and voicemail be turned off for calls that forward to us? OPEN

---

## 8. Open questions (consolidated)

| # | Question | Who |
|---|---|---|
| 1 | Does Bestline's forward deliver `ForwardedFrom` and the real `From` to Twilio? | Test (§7.3) / Bestline |
| 2 | Bestline per-minute forwarding charge and call-path limit | Bestline |
| 3 | Can Bestline own the no-answer decision without Amy's voicemail winning? | Bestline |
| 4 | Can Bestline route to a SIP URI (phase 2)? | Bestline |
| 5 | Is 512-923-9313 a real line on the account? | Bestline |
| 6 | Is this Twilio account a legacy trial or the new shared-number trial? Minimum upgrade balance? | Twilio Console |
| 7 | Does Twilio pass Diversion / History-Info on SIP Domain or BYOC calls? | Twilio support / test |
| 8 | Is register-call billed as Media Streams ($0.0044/min)? | First Twilio invoice |
| 9 | Do register-call `conversation_config_override` fields need enabling per agent? | ElevenLabs docs / test |
| 10 | ElevenLabs SIP REFER: what happens when the target does not answer? | ElevenLabs (only if option c is revisited) |
