# Port 512-339-9313 into Twilio: ring-first, failures, rollback, cost (2026-10-24)

Read-only research. No accounts, numbers, ports, calls or messages. Only this file was written.

Labels: **FACT [id]** = primary source opened today (IDs at the end). **INFERENCE** = our judgement. **OPEN** = needs a live test, Twilio, Bestline or Amy.
Fills gaps in `keep-9313-options.md` (K), `twilio-account-setup.md` (A), `telephony-receive-options.md` (T), `elevenlabs.md` (E), `../failure-matrix.md` (FM). Their facts are cited, not repeated.

## 0. One screen

- **9313 itself becomes the Twilio number.** No second public number. Configure its webhook and fallback before the port date; the first ported call hits our app. FACT [P1].
- **Voicemail never gets the caller.** Carrier voicemail answers Amy's leg, the press-1 screen times out and hangs up. Action URL gets `DialCallStatus=completed`, `DialBridged=false`. Our code routes on `DialBridged` → AI. FACT [D3] + code (`lib/telephony/decide.ts`).
- **Twilio down = 9313 down.** No Twilio-hosted fallback runs when Twilio's own voice platform fails. Twilio documents no carrier-level failover for its numbers. Calls in that window are lost. FACT (absence) [F1]; INFERENCE.
- **History, Jan 2025–Oct 2026:** ~5 US inbound/platform voice incidents of 1.5–5 h, plus a 1 h TwiML Bins outage. SLA: 99.95% monthly *API* availability, 10% credit. Details §6.3. FACT [S1][S2].
- **Show Amy 9313 as caller ID, saved as a contact.** The whisper says who is calling. Unknown numbers get silenced or screened by iOS/Pixel. FACT [C7][C8]; INFERENCE.
- **Keep register-call.** Native import takes the voice URL. Elastic SIP Trunking ignores TwiML. `<Dial><Sip>` is the only real alternative. FACT (E §1, T §2.4).
- **Worked cost:** 300 calls × 3 min, 60/40 → Twilio **≈ $25/mo**, ElevenLabs + LLM **≈ $32/mo**, total **≈ $58/mo** before hosting. §8.
- **Rollback:** soft = point 9313's voice URL at a "dial Amy" TwiML Bin (one change). Hard = port out; PIN from porting@twilio.com. §7.

## 1. Port mechanics and cutover

| # | Claim | Label |
|---|---|---|
| 1.1 | "Porting a number to Twilio will migrate both Voice calling and SMS functionality to Twilio." | FACT [P1] |
| 1.2 | At the end of the port, "Twilio adds the phone numbers to your account". 9313 becomes an ordinary `IncomingPhoneNumber`. No second public number is needed. | FACT (K [T4]) + INFERENCE |
| 1.3 | "Be sure to configure each phone number, particularly your voice URL… in advance of the porting date. You can configure your numbers at any point of the porting process." Find them under Port In Request or Active Numbers. | FACT [P1] |
| 1.4 | So the first call after activation already hits `/api/voice/inbound`. Set voice URL, **voice fallback URL** and status callback during the port. | INFERENCE from 1.3 |
| 1.5 | Per-number events: `PortInPhoneNumberSubmitted`, `…Pending` ("accepted by the losing carrier", effectively the FOC), `…Completed`, `…Rejected`, `…Canceled`. No separate FOC-date event. | FACT [P3] |
| 1.6 | Activation window: weekdays 8:00–8:30 a.m. PT (10:00–10:30 Austin). Ports can land 1–3 days early. | FACT (K 1.3.8, 1.3.9) |
| 1.7 | Bestline stops serving 9313 when the port activates. Until then Bestline still forwards to Amy, so no gap if Bestline does not disconnect early. | INFERENCE (K 1.3.11) |
| 1.8 | In the window, some calls may still route via Bestline (direct ring, as today) while others reach Twilio (press-1). Both reach Amy. Expect minutes of mixed routing. | INFERENCE |
| 1.9 | Do not cancel Bestline until `PortInPhoneNumberCompleted` fires and calls show in Twilio's logs. | FACT (K 1.3.9–1.3.10) |
| 1.10 | Twilio billing for 9313 starts about 7 days before the port. Port-in fee $0. | FACT (K 1.4.1–1.4.2) |
| 1.11 | Prerequisites before the port date: Business profile approved (concurrency, §5) and 9313 assigned to SHAKEN/STIR + CNAM after it lands. | FACT (A §3) + INFERENCE |

## 2. Ring-first with a press-1 gate

### 2.1 What the `<Dial action>` receives

Twilio facts: `DialCallStatus` ∈ completed, answered (conference only), busy, no-answer, failed, canceled. `DialBridged` = "whether or not the dialing call has been connected to the dialed destination." With an action URL, "Twilio will continue the initial call after the dialed party hangs up." FACT [D1]. "In case of `<Hangup>` or `<Reject>` in screening URL" or a hang-up during screening, `DialCallStatus` = `completed`; `DialBridged` is `true` "only if the call was bridged." FACT [D3] (2020-12-09). The `url` TwiML runs "after they answer, but before the parties are connected"; only Play/Say/Gather/Hangup; never `<Dial>`. FACT [D2].

| Case | Amy's leg | `DialCallStatus` | `DialBridged` | Our route (`decideAfterDial`) | Label |
|---|---|---|---|---|---|
| (a) Amy presses 1 | `screen-accept` returns empty → bridged | `completed` (after the talk ends) | `true` | Hang up | FACT [D1][D3] |
| (b) No answer | Rings out at `timeout` (+5 s Twilio buffer) | `no-answer` | `false` | AI | FACT [D1] |
| (c1) Busy signal from carrier | Not answered | `busy` | `false` | AI | FACT [D1] |
| (c2) Amy taps Decline | Most carriers/iPhones send it to voicemail → case (d). Some return busy → (c1). | `completed` or `busy` | `false` | AI | INFERENCE; OPEN (her carrier) |
| (d) Carrier voicemail / iOS Live Voicemail / screener answers | Answered; whisper plays to the machine; Gather times out → `<Hangup/>` | `completed` | `false` | AI | FACT [D3] + code |
| (e1) Amy answers, never presses 1 | Gather times out → `<Hangup/>` | `completed` | `false` | AI | FACT [D3] |
| (e2) Amy hangs up during the whisper | Hang-up during screening | `completed` | `false` | AI | FACT [D3] |
| (f) Twilio can't route to her number | — | `failed` | `false` | AI | FACT [D1] |

- **The caller is never bridged to voicemail.** Bridging requires the empty `screen-accept` response, which only follows a Gather digit. The action URL then runs our TwiML on the caller's leg. FACT [D1][D3] + code (`lib/telephony/twiml.ts` `screenTwiml`, `screenAcceptTwiml`).
- `DialCallStatus` alone cannot tell (a) from (d)/(e). Branch only on `DialBridged`. Already the rule (FM row "Amy's voicemail answers"; `supabase/migrations/0001_core.sql` I4). FACT (code).
- Side effect: her voicemail box records our whisper ("… call. Press 1 to take it."). Amy will get short junk voicemails. INFERENCE.
- Caller wait in case (d): her voicemail timer (often ~20 s) + ~15 s screen. Covered in `ai-first-vs-ring-first.md` §3. FACT there.
- Today's live example: Twilio incident "Voice Call Failures and Post Dial Delay From a Subset of Twilio Phone Numbers to United States" opened 07:17 PT 2026-10-24, unresolved at 15:28 PT. A failed Amy leg returns `failed` → AI, so ring-first degrades to AI-first. FACT [S2]; INFERENCE.

### 2.2 AMD vs press-1

| | Press-1 (`<Number url>` + `<Gather numDigits=1>`) | AMD (`machineDetection` on `<Number>`) | Label |
|---|---|---|---|
| Decision | Deterministic. A machine cannot press 1. | Probabilistic. "AMD will not always return the right answer." Short greetings can read as human. | FACT [D4] |
| Accuracy | — | `DetectMessageEnd` "close to 100%" in the US; `Enable` "more relative". | FACT [D5] |
| Latency | Whisper + 8 s keypress wait | "~4 seconds after the call was answered" on average | FACT [D5] |
| On `<Dial><Number>` | — | Supported; **async by default and can't be configured otherwise** | FACT [D5] |
| iOS 26 call screening | Screener answers; no keypress → AI | Twilio's own tutorial needs AMD **plus** real-time transcription to handle it | FACT [D6] |
| Cost | $0 | $0.0075 per call | FACT [$1] |

**Recommendation (INFERENCE):** keep press-1 as the only gate. Optionally add AMD as an accelerator: on `AnsweredBy=machine_*`, hang up the child leg by REST to save ~10 s. Never bridge on `human` alone.

### 2.3 Phone-side screening

- iPhone "Screen Unknown Callers": **Silence** "sends them to voicemail"; **Ask Reason for Calling** screens "before your phone even rings". It applies to unsaved numbers only. FACT [C7] (2026-09-14).
- Pixel Call Screen "uses contacts stored on your phone to determine whether to screen a call". Save a number as a contact to avoid it. Automatic screening covers US Pixels. FACT [C8].
- **Have Amy save 9313 as a contact**, e.g. "Lightline: press 1". With `callerId` = caller, every call looks unknown, gets silenced, and goes to AI. INFERENCE from [C7][C8].
- Already in code: `ringOwnerTwiml` sets `callerId: line.lineNumber`. After the port that is 9313. FACT (code).

## 3. Caller ID

| # | Claim | Label |
|---|---|---|
| 3.1 | After the port, 9313 calls are ordinary inbound calls. `From` = the caller's number as delivered; `anonymous`/`unknown` if withheld. `StirVerstat` only if the call carried a PASSporT. No `ForwardedFrom`: the call is no longer forwarded. | FACT (T §1.1) + INFERENCE |
| 3.2 | `<Dial>` default: "the dialed party sees the inbound caller's number". Allowed `callerId`: "the `To` or `From` number" of the request, any purchased or verified Twilio number. So both 9313 and the caller's number are allowed. | FACT [D1] |
| 3.3 | Signed forwarding with the original caller ID (`CallToken`, DIV PASSporT) works only for the Calls API: "Using the `<Dial>` instruction is not possible for this call flow." | FACT [C1] |
| 3.4 | `<Dial>` calls "can use the original caller ID by default", without `callToken`. The page gives no attestation level for this. | FACT [C1] |
| 3.5 | B is "the highest level of attestation possible" for non-Twilio numbers. A needs a Twilio number assigned to an approved Business profile and SHAKEN Trust Product. | FACT [C2] |
| 3.6 | So the Amy leg is signed **A with `callerId`=9313** (after assignment) and **at best B with the caller's number**. | INFERENCE from 3.4–3.5 |
| 3.7 | Twilio documents no SIP Diversion header on `<Dial>` PSTN legs, only DIV PASSporTs on the Calls API path. | FACT (absence) [C1] |
| 3.8 | Law: 47 CFR 64.1604 bans caller-ID manipulation "with the intent to defraud, cause harm, or wrongfully obtain anything of value". Passing the real caller's number to Amy is not that. | FACT [C6] + INFERENCE (not legal advice) |
| 3.9 | **Recommend 9313** as Amy's caller ID: A attestation, contact match, no unknown-caller screening. The whisper names the company and source. Lead alert carries the caller's number with tap-to-call. | INFERENCE |
| 3.10 | Cost of 3.9: Amy's recents show 9313, not the caller. She calls back from the alert, not from recents. Change-management item: today Bestline shows her the caller's number. | INFERENCE; OPEN (Amy's preference) |
| 3.11 | Optional: whisper the caller's last four digits or `CallerName` ($0.01 lookup, T §1.1). | INFERENCE |

## 4. Handing the caller to ElevenLabs

| Option | Ring-first on 9313 | Transfer back to Amy | Caller ID into agent | Twilio $/AI-min | Label |
|---|---|---|---|---|---|
| **Register-call** (today) | Yes: call it after `DialBridged=false` | No vendor transfers. Our webhook tool + REST redirect + press-1 (built) | We send `from_number` and our own `caller_number` variable. Whether `system__caller_id` fills is not documented. | Media Streams $0.0044 + inbound $0.0085 | FACT [E1][E2]; E §1.2; FM; OPEN (system var) |
| Native Twilio import | **No.** ElevenLabs takes the number's voice URL | Conference/blind; voicemail can take a conference transfer | `system__caller_id` | — | FACT (E §1.1, §2) |
| Native, on a 2nd hidden number we `<Dial>` | Yes, at the price of a second Twilio number and two extra billed legs | Native transfer still unscreened | Pass the caller's `From` as `callerId` (allowed, 3.2) | +$0.014 out +$0.0085 in | FACT [D1]; INFERENCE |
| `<Dial><Sip>` to `sip.rtc.elevenlabs.io` | Yes | Our REST redirect, or REFER caught by `referUrl` (keeps the caller up on a miss) | `X-CALLER-ID` → `system__caller_id` (documented) | SIP $0.0040 + inbound $0.0085 | FACT (E §1.3); [$1] |
| Elastic SIP Trunk origination | **No.** "If a `trunk_sid` is present, we ignore all of the voice urls" | — | — | — | FACT (T §2.4) |

**Recommendation (INFERENCE):** keep register-call for 2026. Revisit `<Dial><Sip>` only for documented caller-ID mapping and queueing (E §3). ElevenLabs had SIP incidents on 2026-07-31, 10-06 and 10-08 (E §12.1).

## 5. Concurrency and simultaneous calls

| # | Claim | Label |
|---|---|---|
| 5.1 | Programmable Voice caps for accounts upgraded on/after 2026-02-03: trial 5, no PCP 2, Individual 3, Business unlimited. Counted as "both incoming and outgoing". | FACT [R1] (also A §3) |
| 5.2 | Over the cap: error 10004, "a new Voice call would exceed the number of active calls". What the caller hears is not documented. | FACT [R2]; OPEN |
| 5.3 | `<Dial>` forwarding: "limitations depend on the destination phone number. Calls exceeding the limit may not connect or be marked busy." | FACT [R1] |
| 5.4 | Legs: call 1 bridged to Amy = 2; call 2 ringing Amy = 2 more. With 2–3 concurrent you cannot run two ring-first calls. **A Business profile is a hard gate before the port.** | INFERENCE from 5.1 |
| 5.5 | Register-call Media Streams are not a separate call. `<Dial><Sip>` to ElevenLabs is a child call and counts. | INFERENCE; OPEN |
| 5.6 | ElevenLabs: Creator 10, Pro 20 concurrent. Over the limit, "rejected immediately" unless queueing applies. Queueing is not documented for register-call. | FACT (E §3) |
| 5.7 | Call 2 while Amy talks on call 1: her carrier decides. Call waiting on → she hears a beep, call 2 rings to `timeout` → `no-answer` → AI. Call waiting off → `busy` (fast) or voicemail (`completed`, not bridged) → AI. Either way 0–25 s, then AI. | INFERENCE from §2.1; OPEN (her carrier) |
| 5.8 | **Gap in our code:** no "Amy is already on a Lightline call" check. Add one: if any call is bridged to her (`owner_answered`, no completion yet), skip the ring and go to AI with `entry=owner_on_another_call`. Personal calls on her cell stay invisible to us. | FACT (grep: no such state in `lib/`); INFERENCE (design) |
| 5.9 | Call 3: same as call 2. With a Business profile, Twilio imposes no cap. ElevenLabs Creator allows 10. | INFERENCE |

## 6. Failures

### 6.1 ElevenLabs down

Built: 4 s register-call budget, circuit breaker, then `<Record>` capture. Capture is Twilio-native, independent of ElevenLabs. FACT (FM rows "ElevenLabs API error", "Repeated vendor failures").

### 6.2 Our app down → voice fallback URL

| # | Claim | Label |
|---|---|---|
| 6.2.1 | Fallback "will be used if the primary URL fails". The request carries `ErrorCode` and `ErrorUrl`. Functions, TwiML Bins or Studio can serve it. | FACT [F1] |
| 6.2.2 | Timeouts: connect 5 s, read 15 s, total 15 s, one retry on connect failure. "Twilio imposes a hard upper timeout of 15 seconds on all call-related HTTP requests." Override in the URL fragment, e.g. `…/inbound#ct=2000&rt=5000&tt=7000&rp=ct,rt,5xx`. | FACT [F2] |
| 6.2.3 | Set short overrides so fallback starts within ~7 s, not 15. | INFERENCE |
| 6.2.4 | TwiML Bins use Mustache: "logic-less", no "branching statements". Request params and URL query params are available. Sections (`{{#X}}`) only test presence. | FACT [F3] |
| 6.2.5 | So a Bin **can** ring Amy with press-1. `fallback-entry`: `<Dial timeout=20 answerOnBridge=true callerId=+15123399313 action=BIN_AFTER><Number url=BIN_SCREEN>`. `BIN_SCREEN`: Gather → `BIN_ACCEPT`, else `<Hangup/>`. `BIN_ACCEPT`: `<Response/>`. `BIN_AFTER`: shared-line greeting + `<Record>`. | INFERENCE on [D1][D2][F3] |
| 6.2.6 | Limits: any key accepts (Bins cannot compare `Digits` to "1"). `BIN_AFTER` cannot branch on `DialBridged`, so if Amy talks and hangs up first, the caller hears the message prompt. Use a Twilio Function for exact branching. | INFERENCE from [F3] |
| 6.2.7 | Today's `docs/prior-work/fallback-twiml-bin.xml` is record-only and names only CLG. After the port it must greet all three companies, and should ring Amy first. | FACT (file) + INFERENCE |
| 6.2.8 | Whether the number's fallback URL also fires when a **mid-call** action URL fails (`/dial-result`, `/agent-ended`) is not documented. A 2024 changelog shows one mid-call case that does hit the fallback. | OPEN; test by stopping the app between ring and dial-result |
| 6.2.9 | Bins are still Twilio: "TwiML Bins – Service Failures" on 2026-09-11, 12:52–13:54 UTC: "failures fetching TwiML for voice or messaging requests". | FACT [S2] |

### 6.3 Twilio itself down

| # | Claim | Label |
|---|---|---|
| 6.3.1 | The failover page offers: fallback URLs, SIP edge failover and an Elastic SIP Trunking disaster-recovery URL. **Nothing at number or carrier level** for Programmable Voice numbers. | FACT (absence) [F1] |
| 6.3.2 | When Twilio's voice platform cannot process a call, no TwiML runs: no Bin, no fallback, no record. The caller hears whatever the network plays (ringing, reorder, error). Nothing reaches Amy. | INFERENCE from 6.3.1 |
| 6.3.3 | **"No call may be lost" cannot be guaranteed for a ported 9313.** Today, with Bestline → Amy, Twilio is not in the path. | INFERENCE |
| 6.3.4 | Mitigations: Twilio status email subscription [S1 §2]. An external synthetic call to 9313 every 5–10 min from a non-Twilio provider, alerting Amy to use her cell voicemail and Google profile text. A post-incident call-log review (calls that never reached Twilio are invisible). | INFERENCE |
| 6.3.5 | Ask Twilio sales whether any carrier-level "forward on failure" exists for ported numbers. | OPEN |

**Status history, 2025-01-01 → 2026-10-24** (status.twilio.com `history.json` pages 1–8 plus incident JSON). FACT [S2]:

- 6,783 entries: 3,129 maintenance, 3,201 minor, 17 major, 1 critical. Most are carrier- or country-specific SMS.
- Of the 18 major/critical, one hit US Programmable Voice: the AWS us-east-1 outage, 2025-10-20.

| Date (PT) | Incident | Duration | Relevance |
|---|---|---|---|
| 2025-03-31 09:36–11:24 | "Intermittent Programmable Voice Outages Impacting Calls and Flex" ("Customers will experience issues with… Programmable Voice") | ~2 h, business hours | Direct |
| 2025-09-24 15:41–17:18 | "Twilio Accounts May Not Be Able to Receive an Inbound Call to a Twilio Number" (US1) | ~1.6 h | Direct: 9313 dead |
| 2025-10-20 00:26–05:31 | AWS US1 outage, **major**. "Programmable Messaging and Programmable Voice are fully recovered" at 05:31. Intermittent Voice degradation until ~15:35. | ~5 h hard, ~15 h degraded | Direct |
| 2025-11-06 15:56 → 11-07 03:18 | "Inbound Calls From Carrier Peering Experiencing Drops in the United States" | ~11 h, a subset | Calls drop mid-call |
| 2026-05-08 21:00 → 05-09 05:21 | "Network Degradation Between Regions Impacting Voice Calls… & Webhooks" | ~8 h, overnight | Degraded |
| 2026-08-09 07:56–13:18 | "Voice Call Failures from Network Subscribers to a Subset of Twilio United States Phone Numbers" | ~5.4 h, a subset | Direct, if 9313 is in it |
| 2026-09-11 05:52–06:54 | TwiML Bins failures | ~1 h | Fallback path |
| 2026-10-24 07:17 → open | Outbound failures and PDD to US subscribers | ongoing | The Amy leg |

INFERENCE: about 3–5 events in 22 months would have silenced or partly broken 9313 for 1–5 h, at least one in business hours.

**SLA.** FACT [S1] (updated 2026-04-09):

- Threshold: 99.95% monthly API availability ("unavailable for use"), about 22 min/month.
- Credit: below threshold, 10% of that month's fees for the affected APIs. Credit toward future bills only, "not available in the form of refunds".
- Claim: within 30 days of month end, ticket subject "SLA Claim".
- Exclusions: "telecommunications provider-related problems", outages under 5 continuous minutes, beta products, maintenance.
- Credits are the "sole and entire liability". INFERENCE: at ~$25/mo, the most we recover is ~$2.50, and a call-delivery outage may not even count as API unavailability.

## 7. Rollback

| # | Claim | Label |
|---|---|---|
| 7.1 | **Soft rollback / kill switch:** pre-build Bin `direct-to-amy`: `<Response><Dial timeout="25" answerOnBridge="true">+1512AMYCELL</Dial><Say>…</Say><Record maxLength="120"/></Response>`. No `callerId`, so Amy sees the caller like today. No action, so `<Record>` runs after the Dial. | FACT [D1] (no-action and callerId defaults); INFERENCE (design) |
| 7.2 | Flip by Console ("A call comes in" → TwiML Bin) or one API update of `voiceUrl`. Applies from the next call. This takes our app out of the path entirely, beyond `AI_MODE=off`. Her voicemail can take calls again, as today. | INFERENCE |
| 7.3 | Still inside Twilio: it does not help in §6.3. | INFERENCE |
| 7.4 | **Hard rollback (port out).** The new carrier (Bestline or other) files the port and LOA. Name: "Twilio, Inc." as owner of record. Account number: last 8 characters of the Account SID (or digits only). Service address: the one on our original LOA. PIN: 4–5 digits, "mandate only for US local numbers"; email porting@twilio.com. BTN: any number in the port. Proof: screenshot of the Numbers tab. | FACT [P4] |
| 7.5 | Twilio emails to confirm the port-away; "confirm the port-away request promptly". Do not release the number during the port. The notice goes to an admin or billing user. | FACT [P4] |
| 7.6 | Timing: one business day for a simple port, four for non-simple (FCC). Bestline would also have to rebuild forwarding. Plan days, not hours. Get the PIN **now**, not mid-outage. | FACT (K 1.1.3) + INFERENCE |

## 8. Costs (Twilio US, "current as of August 2026") and worked example

Unit prices: local number $1.15/mo; inbound $0.0085/min; outbound US/Canada (mobile not split) $0.0140/min; SIP $0.0040/min; Media Streams $0.0044/min; AMD $0.0075/call; recording $0.0025/min; storage $0.0005/min-month; transcription $0.05/min; Branded calling $0.12/call. FACT [$1].

Rounding: "partial minutes… rounded up to the next full minute", per Call SID. Covers Voice, SIP and Media Streams. FACT [$2]. "calls with status : `Failed`, or `Busy`, are not billed". FACT [$4]. No-answer billing and ring-time billing are not stated. OPEN.

Other fees: port-in $0 (K 1.4.1). CNAM: "a free way to help boost your call pickup rates". FACT [C4]. SHAKEN/STIR and Voice Integrity: not on the price page. OPEN. A2P (only if 9313 texts): $4.50 + $15 once, $1.50/mo. FACT (A §2). Trust Hub profile: no fee found. OPEN.

**Example: 300 calls/mo, 3:00 average talk, 180 to Amy, 120 to AI.** Assumptions (INFERENCE):

- Inbound legs: ring + screen + 3:00 ≈ 3:15–3:25 → 4 billed minutes (inbound leg assumed billed from arrival; OPEN).
- Amy leg on answered calls: 4 billed minutes.
- On AI calls the Amy leg is billed 1 min. This is an upper bound: half are voicemail-answered; the rest are no-answer, probably unbilled.
- Stream: 4 billed minutes.

| Item | Math | $/mo |
|---|---|---|
| Inbound, all calls | 300 × 4 × $0.0085 | 10.20 |
| Amy leg, answered | 180 × 4 × $0.0140 | 10.08 |
| Amy leg, AI path (upper bound) | 120 × 1 × $0.0140 | 1.68 |
| Media Streams | 120 × 4 × $0.0044 | 2.11 |
| Number 9313 | — | 1.15 |
| **Twilio subtotal** | | **25.22** |
| ElevenLabs Creator: $22 for 275 min + 85 × $0.08 (E §3, `cost-model.md`) | 360 AI min | 28.80 |
| LLM pass-through, ~$0.01/min (INFERENCE, `cost-model.md`) | 360 min | 3.60 |
| **Telephony + AI** | | **≈ 57.60** |
| Optional: AMD on every Amy leg | 300 × $0.0075 | 2.25 |
| Optional: record all calls (+ storage ~$0.60/mo, growing) | 300 × 4 × $0.0025 | 3.00 |
| Not recommended: Branded calling on Amy legs | 300 × $0.12 | 36.00 |

- With hosting and A2P from `cost-model.md` (Vercel $20, Supabase $25, A2P $1.50): **≈ $104/mo**.
- Per call: Amy-answered ≈ $0.09 Twilio. AI call ≈ $0.07 Twilio + $0.24 ElevenLabs at overage. INFERENCE.

## 9. One number, three companies

| # | Claim | Label |
|---|---|---|
| 9.1 | Voice: one Twilio number serves all three. The company comes from the greeting/`<Gather>` (`SHARED_LINE_NUMBER`, K §2). | FACT (code) + INFERENCE |
| 9.2 | Trust Hub: the number is assigned to **one** Business profile, which "associates a single identity with the phone numbers". | FACT [C3] |
| 9.3 | CNAM: max 15 characters, letters/numbers/spaces/periods/commas, starts with a letter; must reflect the registered business. 48–72 h to propagate. Landlines by default; mobile is opt-in. | FACT [C3]; A §3 |
| 9.4 | Which name: the legal entity that owns the account, e.g. its CLG DBA (`XMAS LIGHT GUYS`, 15 chars, A §3). No name fits all three. CNAM shows only on calls **from** 9313: the Amy leg (her contact name wins) and future callbacks. Low stakes. | INFERENCE; OPEN (DBA acceptance) |
| 9.5 | If Sublime Patio and The Fridge are separate entities, they cannot be 9313's CNAM identity. | INFERENCE; OPEN (A checklist #11) |
| 9.6 | A2P: "Phone numbers can only belong to one A2P 10DLC Campaign at a time". A campaign belongs to one brand. | FACT [$3] |
| 9.7 | So 9313 can text for **one** brand (the account's entity). Texts for three separately-owned brands from 9313 would misstate the sender. Keep 9313 voice-only. If texting is ever needed: Amy alerts from a separate CLG campaign number; per-brand numbers for customer texts if the entities differ. | INFERENCE from [$3], A §2 |
| 9.8 | Porting moves 9313's SMS too. It stays blocked until the number joins an approved campaign. Allow 1–2 days after the port. | FACT [P1] |

## 10. Pre-port test list (INFERENCE)

1. On a throwaway Twilio number with the production config, run cases (a)–(f) of §2.1 on Amy's actual phone and carrier, including Decline and call waiting.
2. Stop the app mid-call to settle 6.2.8. Kill the primary URL to time 6.2.2/6.2.3.
3. Build and test the three fallback Bins (6.2.5) and the `direct-to-amy` kill switch (7.1).
4. Get the port-out PIN from porting@twilio.com as soon as 9313 lands (7.4).

## Sources (opened 2026-10-24)

| ID | Source | Date |
|---|---|---|
| D1 | [Twilio TwiML `<Dial>`](https://www.twilio.com/docs/voice/twiml/dial) | 2026-09-07 |
| D2 | [Twilio TwiML `<Number>`](https://www.twilio.com/docs/voice/twiml/number) | 2026-06-22 |
| D3 | [Twilio TwiML changelog](https://www.twilio.com/docs/voice/twiml/changelog) | entries 2020-12-09 |
| D4 | [Twilio Answering Machine Detection](https://www.twilio.com/docs/voice/answering-machine-detection) | 2026-08-19 |
| D5 | [Twilio AMD FAQ & best practices](https://www.twilio.com/docs/voice/answering-machine-detection-faq-best-practices) | live |
| D6 | [Twilio blog: Detecting iOS 26 Call Screening](https://www.twilio.com/en-us/blog/developers/tutorials/product/detect-ios-call-screening-amd-transcriptions) | 2025-11-03 |
| P1 | [Twilio help: How to Port a Phone Number](https://help.twilio.com/articles/223179348) (read in browser) | undated |
| P3 | [Twilio porting webhooks](https://www.twilio.com/docs/phone-numbers/port-in/porting-webhooks) | 2026-07-24 |
| P4 | [Twilio help: Port numbers away from Twilio](https://help.twilio.com/articles/223179588) (read in browser) | undated |
| C1 | [Twilio SHAKEN/STIR](https://www.twilio.com/docs/voice/trusted-calling-with-shakenstir) | 2026-08-24 |
| C2 | [Twilio SHAKEN/STIR onboarding](https://www.twilio.com/docs/voice/trusted-calling-with-shakenstir/shakenstir-onboarding) | 2026-08-19 |
| C3 | [Twilio CNAM](https://www.twilio.com/docs/voice/brand-your-calls-using-cnam) | 2026-09-25 |
| C4 | [Twilio Trust Hub CNAM registration](https://www.twilio.com/docs/trust-hub/registrations/cnam) | 2026-10-08 |
| C6 | [47 CFR 64.1604 (LII)](https://www.law.cornell.edu/cfr/text/47/64.1604) | current |
| C7 | [Apple: Screen Unknown Callers](https://support.apple.com/en-us/111106) | 2026-09-14 |
| C8 | [Google: Call Screen](https://support.google.com/phoneapp/answer/9118387) | ©2026 |
| R1 | [Twilio help: How fast can I place or receive calls](https://help.twilio.com/articles/223180028) (read in browser) | undated |
| R2 | [Twilio error 10004](https://www.twilio.com/docs/api/errors/10004) | live |
| F1 | [Twilio Voice failover best practices](https://www.twilio.com/docs/voice/twilio-voice-failover-best-practices) | 2026-09-28 |
| F2 | [Twilio webhook connection overrides](https://www.twilio.com/docs/usage/webhooks/webhooks-connection-overrides) | 2026-10-14 |
| F3 | [Twilio TwiML Bins: getting started (templates)](https://www.twilio.com/docs/serverless/twiml-bins/getting-started) | 2026-07-21 |
| S1 | [Twilio APIs SLA](https://www.twilio.com/en-us/legal/service-level-agreement/twilio-apis) (read in browser) | 2026-04-09 |
| S2 | [status.twilio.com history](https://status.twilio.com/history) via `history.json?page=1..8`, `incidents/<code>.json` and `api/v2/incidents.json` | fetched 2026-10-24 |
| $1 | [Twilio US voice pricing](https://www.twilio.com/en-us/voice/pricing/us) | "current as of August 2026" |
| $2 | [Twilio help: call duration rounding](https://help.twilio.com/articles/223132307) (read in browser) | undated |
| $4 | [Twilio: Resolving call log and usage discrepancies](https://www.twilio.com/docs/voice/resolve-call-log-usage-discrepancies) | 2026-10-01 |
| $3 | [Twilio help: multiple A2P use cases](https://help.twilio.com/articles/4403014741403) (read in browser) | undated |
| E1 | [ElevenLabs register-call guide](https://elevenlabs.io/docs/eleven-agents/phone-numbers/twilio-integration/register-call) | undated |
| E2 | [ElevenLabs dynamic variables](https://elevenlabs.io/docs/eleven-agents/customization/personalization/dynamic-variables) | undated |
