# Carrier options for 512-339-9313: Telnyx vs Twilio, ElevenLabs as endpoint, no-port control (2026-10-24)

Read-only research. No accounts, numbers, ports or contacts. Builds on `keep-9313-options.md` (Twilio port),
`telephony-receive-options.md` (receive paths), `elevenlabs.md` (register-call, transfers), `vendor-research.md`
(Telnyx AI, LiveKit) and `bestline-metaswitch.md`. Facts already there are cited, not repeated.

Labels: **FACT [id]** = read today on a primary page (IDs at the end). **INFERENCE** = our reasoning. **OPEN** = needs a test or a vendor answer.

Three layers, kept apart in every section:

| Layer | Question | Today |
|---|---|---|
| **(1) OWNERSHIP** | Who is carrier of record for 9313 (holds it, signs the port-out)? | Bestline (Metaswitch line, resold carrier OPEN) |
| **(2) ROUTING** | Who receives the call and decides ring-Amy / press-1 / AI / capture? | Bestline forward-all → Amy's cell; our TwiML only on Twilio numbers |
| **(3) MEDIA** | Who runs STT, LLM and voice? | ElevenLabs Agents via register-call over Twilio Media Streams |

---

## 0. One-screen answer

1. **Routing stays on Twilio.** Register-call is Twilio-only; our ring-first, press-1, hand-back and capture floor are built on TwiML. INFERENCE.
2. **Ownership has two good homes.** Port 9313 to **Twilio** (fewest parts) or to **Telnyx** (carrier-diverse failover). Twilio by default; Telnyx only if 3 pilot tests pass (§3). INFERENCE.
3. **Telnyx's edge is the cutover and the floor.** Two things Twilio lacks:
   - On-demand port activation, 6 AM–8 PM CT on FOC day. FACT [X6].
   - Number-level "forward on failure". FACT [X7], [X8].
   - But that forward works only on numbers on a **SIP Connection**, not TeXML or Call Control apps. FACT [X7].
4. **Do not move routing to Telnyx.** It means a TeXML rewrite and SIP-only ElevenLabs. 2026 Telnyx voice incidents included all-region dead air (Aug 10). FACT [X20]. Verdict INFERENCE.
5. **ElevenLabs is MEDIA only, never OWNERSHIP.** It is not a carrier.
   - It imports numbers from `twilio`, `exotel` or `sip_trunk`. FACT [E1].
   - Its new Reception.ai product assigns pool numbers. Carrier unnamed, no porting mentioned. FACT [E8], [E11].
6. **No-port voice control is possible only through Bestline.** Forward-all to a Twilio number, or Bestline SIP/BYOC. Bestline stays carrier of record and stays in the path. Twilio Hosted Numbers is SMS-only: reject. FACT [K-T20].

---

## 1. Telnyx (B)

### 1.1 OWNERSHIP: porting 9313 to Telnyx

| # | Claim | Label |
|---|---|---|
| 1.1.1 | US local needs: "LOA (BTN, Account number & Local address required)" and "Latest Invoice". | FACT [X3] |
| 1.1.2 | Flow: portability check (returns `fast_portable`), draft order, end-user + service address + documents, submit. Requested FOC "not guaranteed—the losing carrier determines the actual activation date." | FACT [X5] |
| 1.1.3 | Simple port: submitted to losing carrier "within 2 business days", "estimated completion: 7 business days". Non-simple: within 4, "15 business days or more". | FACT [X4] |
| 1.1.4 | Processing Mon–Fri 7am–7pm CT. "Most US ports allow 24/5 port activations (M-F)." No reply to an exception in 14 days → cancelled. | FACT [X4] |
| 1.1.5 | "Telnyx does not charge for port-in fees for US and Canadian numbers." | FACT [X2] |
| 1.1.6 | **On-demand activation** only if `fast_port_eligible`; US window **6:00 AM–8:00 PM CT** on the FOC date. Not used → auto-ports at window end. "Activate Now… your numbers will port to Telnyx within a few moments." | FACT [X6], [X2] |
| 1.1.7 | FastPort depends on the losing carrier: "Not all carriers are set-up to real-time analysis of their records." | FACT [X2] |
| 1.1.8 | Is 9313 `fast_port_eligible`? Bestline's upstream carrier is unknown. Telnyx's portability-check API answers it (needs an account). | OPEN [X25] |
| 1.1.9 | Hosted-PBX line with forwarding is likely "non-simple" → plan on 15+ business days, same as the Twilio estimate. | INFERENCE (`keep-9313-options.md` 1.1.8) |
| 1.1.10 | Compared with Twilio: Twilio ports weekdays **8:00–8:30 a.m. PT** only, can't pick the minute (legacy flow). Telnyx on-demand lets us flip it while watching both call logs. Biggest port-day risk reducer. | FACT [K-T9] + INFERENCE |
| 1.1.11 | Carrier of record: Telnyx calls itself "a fully licensed telecommunications carrier" (self-description). Twilio submits ports via a "carrier partner", so a Twilio-held number may sit on a partner's SPID. | FACT [X24], [K-T1]; INFERENCE (who holds the SPID) |
| 1.1.12 | Coverage for Austin 512: no published rate-center list; the portability check reports `"No coverage"` per number. | FACT [X25]; OPEN for 9313 |

### 1.2 Pricing (US, pay-as-you-go)

| Item | Telnyx | Twilio (from earlier notes) | Label |
|---|---|---|---|
| Local number | $1.00/mo | $1.15/mo | FACT [X1], [K-T23] |
| Inbound | Voice API/TeXML $0.002 + SIP trunking $0.0032 = **≈$0.0052/min** | $0.0085/min | FACT [X1] (parts); INFERENCE (sum) |
| Outbound (ring Amy) | $0.002 + SIP outbound $0.005 = **≈$0.007/min** | $0.0140/min | same |
| Media streaming | $0.0035/min | $0.0044/min | FACT [X1], `telephony-receive-options.md` |
| Recording / conference | $0.002/min; $0.002 per participant-min | — | FACT [X1] |
| Forward-on-failure | Monthly charge on enable (amount not shown) + per-minute on both legs | n/a | FACT [X7]; OPEN (amount) |
| Inbound CNAM lookup | $0.40/mo per number ("subject to change") | $0.01 per lookup | FACT (support article, search snippet) [X19]; `telephony-receive-options.md` |

At Lightline volumes price does not decide this. INFERENCE.

### 1.3 ROUTING: TeXML vs Call Control, ring-first and press-1

| # | Claim | Label |
|---|---|---|
| 1.3.1 | **TeXML** = TwiML-style XML + webhooks; "created to allow the easy migration from Twilio to Telnyx". Dial, Gather, Redirect, Refer, Stream, Number, Sip all supported; REST "Update call" compatible (`/Accounts/{AccountSid}/Calls/{CallSid}`). | FACT [X12], [X13] |
| 1.3.2 | `<Number url>`: "URL to another TeXML document that can contain `<Gather>` and `<Hangup>` verbs." `answerOnBridge`, `timeout` 5–120 s, `action` on Dial end. → **press-1 whisper is expressible.** | FACT [X11]; parity with our Twilio screen = OPEN (test) |
| 1.3.3 | TeXML docs don't state the default caller ID on `<Dial>` or document `DialCallStatus`. Caller-ID survival on the Amy leg must be tested. | FACT (absence) [X11]; OPEN |
| 1.3.4 | **Call Control** = event-driven REST: answer, dial, bridge, transfer, gather / gather-using-speak, streaming start, fork, SIP REFER, start AI assistant. Press-1 = dial Amy as a second leg, gather on it, bridge on "1". | FACT (command list) [X16]; INFERENCE (flow) |
| 1.3.5 | Webhook auth is Ed25519, not Twilio HMAC. Our signature check and TwiML builders would be rewritten. | FACT/INFERENCE (`telephony-receive-options.md` 2.6) |

### 1.4 MEDIA: handing the call to ElevenLabs from Telnyx

| Path | Finding | Label |
|---|---|---|
| SIP to ElevenLabs (documented) | Telnyx FQDN connection → `sip.rtc.elevenlabs.io`, TCP, `+E.164`. "Telnyx inbound trunks don't use digest authentication." From TeXML: `<Dial><Sip>` to that URI. | FACT [E3]; INFERENCE (TeXML form) |
| Passing `X-CALLER-ID` / context on TeXML `<Sip>` | Telnyx `<Sip>` page not reachable (404). Call Control `custom_headers` likely. | OPEN |
| Telnyx media streaming → ElevenLabs | Telnyx stream = `<Start><Stream>`, own JSON schema (`stream_id`, chunk reordering), no Twilio-compat claim. Register-call is `/v1/convai/twilio/register-call`. **Register-call won't run on Telnyx**; we'd need our own relay. | FACT [X14], [X15], `elevenlabs.md`; INFERENCE |
| Telnyx AI Assistant | Native `<Connect><AIAssistant>`; warm transfer with conversational accept, return-to-agent. Replaces ElevenLabs Agents (ElevenLabs only as a TTS voice). | FACT (`vendor-research.md` App. C), [X23] |
| Hand-back to Amy | Our webhook tool → TeXML "Update call" redirect to `/handoff`. Same pattern as today. | FACT [X13]; INFERENCE |
| ElevenLabs SIP REFER into Telnyx | How Telnyx handles a far-end REFER isn't documented for TeXML. | OPEN |

### 1.5 STIR/SHAKEN, CNAM

- Inbound: Telnyx verifies the Identity header. Result is in PAI `verstat` and the CDR (A/B/C/Unavailable/Invalid). FACT [X17] (support/release notes, search snippets).
- Forwarded calls: signed calls keep the original attestation plus a div-PASSporT. Unsigned calls are re-originated with B. FACT [X18].
- Outbound CNAM: "Enable CNAM Listing", 15 characters, not toll-free. Free per support article. FACT [X19] (snippet; OPEN, a sibling page conflicts).
- Twilio equivalents (`StirVerstat`, `CallToken` with DIV PASSporTs) are in `telephony-receive-options.md` 1.1.

### 1.6 Reliability, SLA, support

| # | Claim | Label |
|---|---|---|
| 1.6.1 | SLA: "99.99% uptime SLA for core voice and messaging", credits 10% / 25% / 50% below 99.99 / 99.9 / 99.0. Excludes maintenance with 72 h notice and "Internet routing issues beyond Telnyx network". This is a machine-readable summary (verified 2026-04-21), not the contract. | FACT [X21]; OPEN (signed terms) |
| 1.6.2 | Voice incidents, 2026-07-27 → 10-23: Jul 28 503s on number/SIP config; **Aug 10 one-way/dead air, drops, missing recordings (all regions)**; Aug 11 EU 503s; Sep 10 call-audio quality + conference failures; **Oct 21 ~18:17–19:20 UTC Call Control/TeXML 503s, failed call setups, missing webhooks**; Oct 22 "Partial Service Degradation Affecting US Traffic". | FACT [X20] |
| 1.6.3 | History before 2026-07-27 (all of 2025) not visible on the status page or feeds. | OPEN |
| 1.6.4 | Support: "fully available to all of our customers, all the time, with no minimum spend… or premium support plans" (24/7). | FACT (vendor) [X22] |
| 1.6.5 | **Failover at the number:** "Always" or "On-Failure" forwarding; failure = unregistered endpoint, DND, declined; "simply rings… is not considered a failure". **"Not possible… on numbers assigned to voice or fax applications, only SIP Connections."** TeXML/Call Control must "forward programmatically". | FACT [X7] |
| 1.6.6 | SIP Connection: retries every route from IP1 then IP2. `on_failure` forwards to PSTN after all routes fail on 408/480/503/504 or transport error. 404/486/603 do not trigger it. | FACT [X8] |
| 1.6.7 | App-level fallbacks: TeXML `voice_fallback_url` (on error from `voice_url`); Call Control `webhook_event_failover_url`. | FACT [X9], [X10] |

---

## 2. Other serious carriers (brief)

| Vendor | Port-in | Ring-first + press-1 | ElevenLabs handoff | Reliability signals | Label |
|---|---|---|---|---|---|
| **Bandwidth** | Self-set activation 5 AM–10 PM ET, manual "Activate Numbers"; FOC valid 10 business days; Bandwidth "unable to provide CSRs" | `transferAnswerUrl` runs BXML (Gather allowed) on the called party before bridge; fallback URL for that callback | SIP trunk guide (VCP route to `sip.rtc.elevenlabs.io`; digest for outbound) | Own "48-state facilities-based CLEC" (vendor); pricing "Request a quote" (sales-led); inbound $0.0055, outbound $0.0100/min; SLA not published; port-activation incidents Oct 22–23 2026 | FACT [B1]–[B4], [B6], [E14]; vendor claim [B5] |
| **Plivo** | Free; US local "up to 4 weeks"; FOC ≥2 business days out | `<Dial confirmSound confirmKey>`: callee must press the key, so voicemail can't bridge. **Native press-to-accept.** | SIP (Zentrunk inbound trunk to `sip.rtc.elevenlabs.io`) | Not researched further | FACT [P1], [P2], [E13] |
| **SignalWire** | Dashboard port requests; 5–10 business days vs "a couple of weeks" (two pages conflict) | LaML/cXML "feature-to-feature compatible" with TwiML (vendor) | Not documented by ElevenLabs | Status page created 2025-12-23, so no long public history | FACT [S1], [S2]; OPEN (register-call on LaML) |
| **Vonage** | Not researched | NCCO; whisper/press-1 not confirmed | ElevenLabs needs a **self-hosted WebSocket connector** (Vonage L16 ↔ ElevenLabs) | — | FACT [E12]; OPEN |

Bandwidth is the reliability-heavy choice (owns its network) but sales-led with no public SLA. Plivo has the cleanest native press-1. Neither runs register-call. INFERENCE.

---

## 3. Comparison: Twilio vs Telnyx vs Bandwidth

| | Twilio | Telnyx | Bandwidth |
|---|---|---|---|
| (1) Port-in cost | $0 [K-T7] | $0 [X2] | Not public (OPEN) |
| (1) Port timing / cutover | 5–15 days, avg 11; activates weekdays 8:00–8:30 a.m. PT; can't pick minute (legacy) [K-T2], [K-T9] | 7 business days simple, 15+ non-simple; FastPort same-day possible; on-demand 6 AM–8 PM CT if eligible [X4], [X5], [X6] | Activation 5 AM–10 PM ET, manual activate [B2] |
| Monthly + per-min (in / out) | $1.15; $0.0085 / $0.0140 | $1.00; ≈$0.0052 / ≈$0.007 | not listed; $0.0055 / $0.0100 |
| (2) Ring-first + press-1 | `<Number url>` + Gather. **Built and in use.** | TeXML `<Number url>` with Gather/Hangup (FACT [X11]); rewrite + test | `transferAnswerUrl` + Gather (FACT [B4]); rewrite |
| (3) ElevenLabs handoff | register-call (built) or `<Dial><Sip>` | SIP only (no register-call) [E3] | SIP only [E14] |
| Hand-back to Amy | REST redirect (built) | TeXML Update call [X13] | OPEN |
| Failover if the voice platform degrades | Voice fallback URL (our app down); edge lists; Elastic SIP DR URL. **No number-level forward if Twilio Voice itself is down.** [T2] | `voice_fallback_url` / webhook failover URL; **forward-on-failure to PSTN, SIP-Connection numbers only** [X7]–[X10] | Callback fallback URL [B4]; rest OPEN |
| SLA | APIs 99.95% (99.99% Enterprise Edition); 10% credit; excludes "telecommunications provider-related problems", outages <5 min [T1] | 99.99% core voice (summary, not contract) [X21] | Not published (OPEN) |
| Incident history | Feed showed 14 non-messaging items in 5 days, all "minor", per country/route (e.g. 2026-10-24 "Voice Call Failures… Subset of Twilio Phone Numbers to United States"). No platform-wide US voice outage found for 2025–26. [T7] | Aug 10 all-region dead air; Oct 21 Call Control/TeXML outage ~1 h; pre-Jul 2026 invisible [X20] | Port-activation incidents Oct 2026 [B6] |
| Support | Free: est. 3 business days. Production $250 or 4%: 3 business hours. Business $1,500 or 6%: 1 h 24/7. [T6] | Free 24/7 for all [X22] | Sales-led (INFERENCE) |
| Ecosystem / docs | Largest; ElevenLabs native + register-call; our code | Good docs, TS SDK, TwiML-compatible TeXML | Enterprise-oriented |

Search coverage of 2025 Twilio incidents was poor, so "none found" is weak evidence. INFERENCE.

### 3.1 Verdict (reliability first)

- **(2) ROUTING + (3) MEDIA bridge: stay on Twilio.** It is the only carrier where register-call, our press-1 screen, the REST hand-back and the capture floor already work. Moving means a rewrite and SIP-only ElevenLabs, and Telnyx's 2026 voice record is no better. INFERENCE.
- **(1) OWNERSHIP, default: port 9313 to Twilio** (off-season, per `keep-9313-options.md`).
  - Fewest moving parts.
  - App-down floor: the voice fallback URL runs a Twilio-hosted TwiML Bin that dials Amy.
  - Gap: if Twilio Voice itself fails, the line is dead. INFERENCE.
- **(1) OWNERSHIP, reliability upgrade: port 9313 to Telnyx on a SIP Connection** and send calls to Twilio (BYOC trunk or SIP Domain) running today's TwiML.
  - Set Telnyx **forward-on-failure → Amy's cell**. A Twilio outage then degrades to "rings Amy" instead of silence.
  - On-demand activation de-risks port day.
  - Adopt only if a pilot on a spare number shows:
    1. **Amy sees the real caller ID.** Twilio forbids `callerId` = From on inbound SIP [T4]. BYOC is not addressed [T5]. One option is Twilio `<Sip>` back to Telnyx with the caller as From. Telnyx outbound caller-ID policy is OPEN.
    2. **On-failure fires.** Telnyx must forward when Twilio returns 5xx or times out [X8].
    3. **Original `To`/`From` arrive** at our webhook. BYOC discards `X-` headers (`telephony-receive-options.md` 2.4).
  - INFERENCE throughout.
- Not now: Bandwidth (sales-led, no public SLA), Plivo/SignalWire/Vonage (no register-call; rewrite). INFERENCE.

---

## 4. ElevenLabs as the endpoint (C)

### 4.1 Can ElevenLabs own 9313?

| # | Claim | Label |
|---|---|---|
| 4.1.1 | Import API body variants: `twilio`, `exotel`, `sip_trunk`. No purchase or port endpoint. | FACT [E1] |
| 4.1.2 | Help center: connect non-Twilio numbers "using SIP trunking". Does not say ElevenLabs provides numbers. | FACT [E7] |
| 4.1.3 | Native import: the number "must be purchased through Twilio". | FACT [E5] |
| 4.1.4 | **Reception.ai** (ElevenLabs' packaged receptionist, docs under elevenlabs.io): US/Canada get "a local number, assigned instantly" from a pool. No toll-free. Carrier not named. Porting not mentioned. Numbers released 14 days after cancel. | FACT [E8], [E11] |
| 4.1.5 | Reception.ai features (caller ID on transfers, SMS) require "Twilio numbers". | FACT [E9], [E10]; carrier of pool numbers = OPEN |
| 4.1.6 | **ElevenLabs is not a carrier of record and cannot receive a port of 9313.** Reception pool numbers sit with an unnamed carrier, probably Twilio. | INFERENCE |

### 4.2 Phone options and ring-Amy-first

| Option | (1) Owner | (2) Router | Ring Amy first? | Transfer back to a human | Label |
|---|---|---|---|---|---|
| Native Twilio import | Twilio | **ElevenLabs** (it configures the number's voice URL) | **No. The agent answers first.** Workaround: our number dials a second, imported number. | `transfer_to_number`: conference (default; `agent_message` to the human, native Twilio only), blind (keeps caller ID), no press-1 field | FACT [E4], [E5], `elevenlabs.md` 1.1 |
| SIP trunk import | The carrier (Twilio/Telnyx/Plivo/Bandwidth/Bestline) | Whoever sends the INVITE | **Only if the router rings Amy before sending the INVITE.** ElevenLabs does not document the agent ringing a human first. Transfers via SIP REFER need the trunk to allow REFER. | SIP REFER (number or SIP URI; no `agent_message`) or conference via outbound trunk config | FACT [E2], [E4]; INFERENCE (ring-first) |
| Register-call | Twilio | **Us** (our TwiML) | **Yes** (built) | ElevenLabs offers "No call transfers". We do it: webhook tool → Twilio REST redirect → press-1 ring → new agent on miss | FACT `elevenlabs.md` 1.2, 0 |
| Reception.ai | Pool (unnamed) / your Twilio / SIP | ElevenLabs | **"Staff first"**: rings 10/15/20/30 s, then AI, within set hours. **No press-1 gate documented**, so Amy's voicemail could win. | Transfer rules by intent; default shows the caller's number; a business-number option reads a summary first (Twilio numbers only) | FACT [E10]; INFERENCE (voicemail trap) |

SIP trunk requirements from the carrier:
- Transport: TCP 5060 or TLS 5061 (TLS 1.2+). UDP is "experimental".
- Codecs: G.711 PCMU/PCMA 8 kHz or G.722 16 kHz. ≥100 kbps per call. RTP UDP 10000–60000.
- Auth: digest strongly recommended. The source-IP filter works on TCP/TLS only. Static /24 IPs are Enterprise-only.
- Headers: `X-CALL-ID`, `X-CALLER-ID`; other `X-` headers → `{{sip_*}}`.
- SRTP: optional ("varies by provider").
- REGISTER: not mentioned, so it can't register to Bestline. INFERENCE.
- Over the concurrency limit, calls are rejected unless queueing is on.

FACT [E2].

**Answer:** ElevenLabs = **(3) MEDIA** always. It becomes **(2) ROUTING** only with native import or Reception.ai, and both lose our press-1 gate. Keep register-call. INFERENCE.

### 4.3 LiveKit SIP

- **(1)** LiveKit Phone Numbers: buy US local/toll-free numbers in LiveKit. **Inbound only** ("outbound… coming soon"). Porting not mentioned. FACT [L2].
  - "Forwarding calls using the `TransferSIPParticipant` API is not yet supported" on these numbers. FACT [L2].
- **(2)** LiveKit SIP does not support REGISTER. The carrier must send INVITEs. REFER is supported on SIP trunks. FACT [L1].
- **(3)** What it adds: our own agent pipeline (any STT/LLM/TTS), first-party warm transfer with return-to-agent, Node SDK (`vendor-research.md` App. B).
- **Relevance:** none for keeping 9313. It would replace ElevenLabs Agents (media), not the carrier. Same Twilio front door. INFERENCE.

---

## 5. Keeping 9313 at Bestline without porting (D)

In all D options: **(1) OWNERSHIP = Bestline** and **Bestline stays in the call path**. INFERENCE.

| Option | Real inbound voice control? | Bestline in path | Caller ID | Reliability | Label |
|---|---|---|---|---|---|
| **Twilio Hosted Numbers** | **No.** "Hosted Number does not affect your voice capabilities"; voice "not supported" for hosting. **Reject.** | — | — | — | FACT [K-T20], [K-T19] |
| **Twilio BYOC trunk** (Bestline SIP → `{x}.sip.twilio.com`) | **Yes.** "A Call Comes In" runs our webhook; "Primary Handler Fails" fallback. | Yes, as carrier and SIP origin | Bestline sets `From`. `X-`/UUI discarded. Amy-leg `callerId` rule for BYOC undocumented. | Twilio asks the carrier to fail over across IPs (4 s) and regions (US1→US2). Bestline switch down = no calls. Twilio unreachable → Bestline's alternate route, if any. | FACT [T3], `telephony-receive-options.md` 2.4; OPEN (Bestline must offer carrier-grade SIP to a third party; callerId) |
| **Telnyx equivalent** (Bestline SIP → TeXML/Call Control `sip_subdomain`, or FQDN/IP connection) | Yes | Yes | Telnyx `custom_headers`; no TLS on subdomain calls | Same Bestline dependency; Telnyx forward-on-failure doesn't apply (no Telnyx number) | FACT `vendor-research.md` App. C, [X9]; INFERENCE |
| **SIP registration** (our endpoint registers as a 9313 device) | Only via a box **we run** (Asterisk/FreeSWITCH). Twilio and LiveKit don't register out; ElevenLabs doesn't mention it. | Yes | That box → Twilio SIP is "inbound SIP", so Amy's leg can't show `From` → **caller ID lost** unless the box rings Amy itself | Adds a 24/7 self-hosted server. Weakest. **Reject.** | FACT [T9] (blog: trunks don't REGISTER), [L1], [T4]; Bestline "Phones from Polycom, Cisco, Yealink… often work" [BL1]; OPEN (SIP credentials) |
| **Carrier forwarding** (Bestline forward-all → hidden Twilio number) | **Yes** for the forwarded leg: ordinary inbound PSTN call to our TwiML (today's design) | Yes, and it holds two call paths per call (OPEN) | `From` = caller only if Bestline passes it (OPEN; test). `ForwardedFrom` is "carrier-dependent". Twilio `<Dial>` defaults to the inbound caller's number. FCC: intermediate providers "must pass unaltered" calling-party info; a forward is a new Bestline-originated leg, so the rule doesn't settle it. | Two platforms in series. Billing: Bestline forward leg (OPEN) + Twilio $0.0085 in + $0.014 to ring Amy. | FACT [T4], [F1], [F2], `telephony-receive-options.md` 1.1; INFERENCE |
| Alianza Crux Virtual Agent (Bestline's platform vendor) | AI-first SIP to our endpoint; REFER back | Yes | — | "Controlled availability"; Bestline access OPEN | FACT `bestline-metaswitch.md` 5.1 |

Bottom line for D:
- Real voice control without a port = **forwarding (works today)** or **BYOC (needs Bestline carrier-side SIP)**. INFERENCE.
- Both leave Bestline as owner and as a single point of failure. INFERENCE.
- Hosted Numbers and SIP registration are rejected. INFERENCE.

---

## 6. Open items (ranked)

1. Is 9313 `fast_port_eligible` at Telnyx? Who is the current carrier of record behind Bestline? (portability checks, Twilio and Telnyx)
2. Pilot (spare number): Telnyx SIP Connection → Twilio. Check caller ID on Amy's leg, on-failure forward when Twilio returns 5xx, and the `To`/`From` our webhook sees.
3. Twilio BYOC: `callerId` rules for `<Number byoc>` and on BYOC-inbound calls. (Twilio support)
4. Telnyx: forward-on-failure monthly price; outbound caller-ID policy for non-owned numbers; signed SLA terms; status history before Jul 2026.
5. Bestline: can it deliver 9313 over SIP to a third party (BYOC)? Does it pass the caller on forwards? Who is the upstream carrier?
6. ElevenLabs: who carries Reception.ai pool numbers? Can a pool number port out?

## Sources (opened 2026-10-24)

`[K-*]` = source table in `keep-9313-options.md` (T1–T24). Status pages show only recent windows. Twilio's JSON feed covered about 5 days; Telnyx's covered 2026-07-27 → 10-23.

| ID | Source |
|---|---|
| X1 | [Telnyx Voice API pricing](https://telnyx.com/pricing/call-control) |
| X2 | [Telnyx FastPort FAQs](https://support.telnyx.com/en/articles/2054704-fastport-faqs) |
| X3 | [Telnyx US number porting](https://support.telnyx.com/en/articles/3267816-united-states-number-porting) |
| X4 | [Telnyx porting policy](https://support.telnyx.com/en/articles/1130630-porting-policy-procedure) |
| X5 | [Telnyx porting getting started](https://developers.telnyx.com/docs/numbers/porting/getting-started.md) |
| X6 | [Telnyx on-demand activations](https://developers.telnyx.com/docs/numbers/porting/on-demand-activations.md) |
| X7 | [Telnyx call forwarding](https://support.telnyx.com/en/articles/1130657-call-forwarding) |
| X8 | [Telnyx SIP failover and retries](https://developers.telnyx.com/docs/voice/sip-trunking/routing/failover-and-retries) |
| X9 | [Telnyx create TeXML application](https://developers.telnyx.com/api-reference/texml-applications/creates-a-texml-application.md) |
| X10 | [Telnyx create Call Control application](https://developers.telnyx.com/api-reference/call-control-applications/create-a-call-control-application.md) |
| X11 | [Telnyx TeXML Dial](https://developers.telnyx.com/docs/voice/programmable-voice/texml-verbs/dial.md) |
| X12 | [Telnyx TeXML/TwiML compatibility](https://developers.telnyx.com/docs/voice/programmable-voice/texml-twiml-compatibility.md) |
| X13 | [Telnyx TeXML Update call](https://developers.telnyx.com/api-reference/texml-rest-commands/update-call) |
| X14 | [Telnyx media streaming](https://developers.telnyx.com/docs/voice/programmable-voice/media-streaming.md) |
| X15 | [Telnyx TeXML Stream](https://developers.telnyx.com/docs/voice/programmable-voice/texml-verbs/stream.md) |
| X16 | [Telnyx Calling docs index](https://developers.telnyx.com/development/llms/calling-llms-txt) |
| X17 | [Telnyx SHAKEN/STIR parameters](https://support.telnyx.com/en/articles/7421223-shaken-stir-parameters), [CDR attestation](https://telnyx.com/release-notes/shaken-stir-attestation-in-cdr) (search snippets) |
| X18 | [Telnyx SHAKEN/STIR call forwarding](https://telnyx.com/resources/shaken-stir-call-forwarding) |
| X19 | [Telnyx outbound CNAM](https://support.telnyx.com/en/articles/1130720-caller-id-outbound-vs-cnam), [inbound CNAM](https://support.telnyx.com/en/articles/1130656-set-up-inbound-caller-id-name) (search snippets) |
| X20 | [Telnyx status history](https://status.telnyx.com/history), [incidents API](https://status.telnyx.com/api/v2/incidents.json) |
| X21 | [Telnyx SLA summary (JSON)](https://telnyx.com/ai/sla.json) |
| X22 | [Telnyx support](https://telnyx.com/landing/support) |
| X23 | [Telnyx TTS (ElevenLabs voices)](https://developers.telnyx.com/docs/voice/programmable-voice/tts) (search snippet) |
| X24 | [INCOMPAS member profile: Telnyx](https://incompas.org/member-profile-telnyx/) |
| X25 | [Telnyx portability check API](https://developers.telnyx.com/api-reference/phone-number-porting/run-a-portability-check.md) (search snippet) |
| T1 | [Twilio APIs SLA](https://www.twilio.com/en-us/legal/service-level-agreement/twilio-apis) (2026-04-09) |
| T2 | [Twilio Voice failover best practices](https://www.twilio.com/docs/voice/twilio-voice-failover-best-practices) (2026-09-28) |
| T3 | [Twilio BYOC](https://www.twilio.com/docs/voice/bring-your-own-carrier-byoc) (2026-08-24) |
| T4 | [Twilio `<Dial>`](https://www.twilio.com/docs/voice/twiml/dial) |
| T5 | [Twilio `<Number>`](https://www.twilio.com/docs/voice/twiml/number) |
| T6 | [Twilio support plans](https://www.twilio.com/en-us/support-plans) |
| T7 | [Twilio status incidents API](https://status.twilio.com/api/v2/incidents.json) |
| T9 | [Twilio blog: Elastic SIP Trunking setup](https://twilio.com/blog/elastic-sip-trunking-step-by-step-setup) |
| E1 | [ElevenLabs Import phone number API](https://elevenlabs.io/docs/eleven-agents/api-reference/phone-numbers/create.md) |
| E2 | [ElevenLabs SIP trunking](https://elevenlabs.io/docs/eleven-agents/phone-numbers/sip-trunking.md) |
| E3 | [ElevenLabs Telnyx SIP](https://elevenlabs.io/docs/eleven-agents/phone-numbers/telephony/telnyx.md) |
| E4 | [ElevenLabs transfer_to_number](https://elevenlabs.io/docs/eleven-agents/customization/tools/system-tools/transfer-to-number.md) |
| E5 | [ElevenLabs native Twilio](https://elevenlabs.io/docs/eleven-agents/phone-numbers/twilio-integration/native-integration.md) |
| E7 | [ElevenLabs: non-Twilio phones](https://elevenlabs.io/docs/help-center/product/eleven-agents/can-i-connect-a-non-twilio-phone-to-eleven-agents.md) |
| E8 | [Reception.ai phone numbers](https://elevenlabs.io/docs/reception-ai/phone-numbers/overview.md) |
| E9 | [Reception.ai bring your own number](https://elevenlabs.io/docs/reception-ai/phone-numbers/bring-your-own-number.md) |
| E10 | [Reception.ai call handling](https://elevenlabs.io/docs/reception-ai/receptionist/call-handling.md) |
| E11 | [Reception.ai quickstart](https://elevenlabs.io/docs/reception-ai/quickstart.md) |
| E12 | [ElevenLabs Vonage](https://elevenlabs.io/docs/eleven-agents/phone-numbers/telephony/vonage.md) |
| E13 | [ElevenLabs Plivo](https://elevenlabs.io/docs/eleven-agents/phone-numbers/telephony/plivo.md) |
| E14 | [ElevenLabs Bandwidth](https://elevenlabs.io/docs/eleven-agents/phone-numbers/telephony/bandwidth.md) |
| L1 | [LiveKit telephony overview](https://docs.livekit.io/telephony/) |
| L2 | [LiveKit Phone Numbers](https://docs.livekit.io/telephony/start/phone-numbers.md) |
| B1 | [Bandwidth pricing](https://www.bandwidth.com/pricing/) |
| B2 | [Bandwidth custom activation time](https://www.bandwidth.com/support/en/articles/12823377-how-do-i-set-a-custom-activation-time-on-a-port-in-order) |
| B3 | [Bandwidth carrier FAQ](https://www.bandwidth.com/carriers-faqs/) |
| B4 | [Bandwidth transferAnswer](https://dev.bandwidth.com/docs/voice/webhooks/transferAnswer) |
| B5 | [Bandwidth vs Twilio (vendor)](https://www.bandwidth.com/twilio-plateau/) |
| B6 | [Bandwidth status RSS](https://status.bandwidth.com/history.rss) |
| P1 | [Plivo Dial confirm-to-answer](https://docs.plivo.com/docs/voice/xml/dial/confirm-to-answer-call) |
| P2 | [Plivo porting FAQ](https://plivo.com/docs/faq/numbers/porting), [docs](https://docs.plivo.com/docs/numbers/number-porting) |
| S1 | [SignalWire Compatibility API](https://signalwire.com/docs/compatibility-api), [porting](https://signalwire.com/docs/platform/porting-into-signalwire) |
| S2 | [SignalWire status](https://status.signalwire.com) |
| F1 | [47 CFR 64.1601 (LII)](https://www.law.cornell.edu/cfr/text/47/64.1601) |
| F2 | [47 CFR 64.6302 (LII)](https://www.law.cornell.edu/cfr/text/47/64.6302) |
| BL1 | [Bestline Voice & VoIP](https://bestline.net/voice-communication/) |
