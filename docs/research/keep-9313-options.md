# Keep 512-339-9313? Port to Twilio vs new number vs forwarding (2026-10-24)

Read-only research. Nobody was called, emailed or signed up. No settings were touched.

Labels:
- **FACT [id]**: stated in a primary source opened today. IDs map to URLs at the end.
- **INFERENCE**: our judgement from the facts.
- **OPEN**: only Amy, the owner, Bestline or a live test can answer.

Gaps: support.twilio.com and fcc.gov block plain fetches; both were read in a browser instead.
Bestline publishes no contract, port-out fee or ETF terms. No AT&T wireless page lists its conditional-forward codes.
Builds on `docs/bestline-options.md` and, in `docs/research/`, `bestline-metaswitch.md`, `telephony-receive-options.md` §5,
`spam-screening.md` and `new-number-rollout.md`. Where they agree, this file does not repeat them.

## 0. One-screen answer

- **Yes, 9313 can move to Twilio.** US law requires Bestline to release it. Twilio charges $0 to port it in.
- **But a port is not "leaving Bestline out".** Bestline must hand over the CSR, account number and PIN, then release the number.
- **It moves all three companies at once.** The day it ports, Bestline's forward-all to Amy stops. Twilio and our app carry every call.
- **Timing is bad.** Typical 5–15 days, average 11, up to 4+ weeks after a rejection. That lands mid-November to December: peak season.
- **The spam follows the number.** Porting changes the carrier, not the lists spammers dial.
- **Recommendation (INFERENCE):** keep plan **A** (new Twilio number) for the 2026 season.
  Do not port before January. Revisit **B** off-season, with the owner's sign-off, after A has run cleanly.
  Skip **D** (Amy's cell forwards): it would send her personal missed calls to the AI too.
  **C** stays the cheapest way to cover 9313 without a port, if Amy ever agrees to touch Bestline.

## 1. Porting a US local number into Twilio

### 1.1 Eligibility and the law

| # | Claim | Label |
|---|---|---|
| 1.1.1 | Portable types include "Geographic (local) numbers (mobile, VoIP, landline)". "Most numbers are portable." Twilio may lack coverage for some. | FACT [T3] |
| 1.1.2 | An interconnected VoIP provider must "facilitate" a valid port "without unreasonable delay or unreasonable procedures". It may not sign agreements that block porting. | FACT [F2] |
| 1.1.3 | A simple port must complete "within one business day". Non-simple ports get four business days. Ports "involving interconnected VoIP service" count as intermodal. | FACT [F1] |
| 1.1.4 | "Simple" excludes accounts with more than one line, complex switch translations (e.g. Centrex, remote call forwarding) and resellers. | FACT [F3] (footnote) |
| 1.1.5 | Validation for a simple port may use at most four fields: 10-digit number, account number, 5-digit ZIP, passcode (if applicable). | FACT [F3] fn. 32 |
| 1.1.6 | The old company "cannot refuse to port your number, even if you owe money for an outstanding balance or termination fee." Companies "may charge you to port". | FACT [F4] |
| 1.1.7 | 9313 sits in a Southwestern Bell block, so it was already ported once, to Bestline's carrier. | FACT + INFERENCE (`bestline-metaswitch.md` §6.3) |
| 1.1.8 | A hosted-PBX line with forwarding, maybe on a resold carrier, may be "non-simple". Expect days, not one. | INFERENCE |
| 1.1.9 | Exact carrier of record and portability: run Twilio's Console Portability Checker on 9313. | OPEN (needs a Twilio login) [T4] |

### 1.2 What Twilio requires

| # | Claim | Label |
|---|---|---|
| 1.2.1 | Needed: owner or authorized user's name; the physical service address (no PO boxes); an LOA "signed by the authorized user and/or owner"; a CSR; a bill "within the last 30 days" showing account, name and address for each number. | FACT [T1] |
| 1.2.2 | "The information on your LOA must match the authorized user name and service address provided by your current carrier." | FACT [T1] |
| 1.2.3 | Also listed: the current provider's account number, and a PIN "if required". Wrong name/address is "the most common reason" for rejection. | FACT [T3] |
| 1.2.4 | API fields: customer type Individual/Business; name matching the losing carrier; account number ("mandatory for US local"); account telephone number; authorized representative ("the person listed with the losing carrier" who can change the account) and that person's own email. | FACT [T5] |
| 1.2.5 | At least one uploaded document must be a "Utility Bill". | FACT [T5] |
| 1.2.6 | Rejection causes: PIN, address or ZIP mismatch; "a port request made by an unauthorized user". "The surest way" to avoid rejection is the carrier's CSR. | FACT [T14], [T1] |
| 1.2.7 | Porting needs an upgraded (paid) Twilio project. | FACT [T7] |

### 1.3 How to start, timeline and port day

| # | Claim | Label |
|---|---|---|
| 1.3.1 | New Console flow: **Console → Phone Numbers → Port & Host → Port-in US Local.** Portability check, auto-generated digital LOA routed for e-signature, preferred port date and activation time, self-serve cancellation. Public Beta, US local, ≤50 numbers. | FACT [T6] (2025-09-03) |
| 1.3.2 | Current docs path: Communications → Numbers & senders → Port and host. "The process takes 5-15 days, but can take up to 4 weeks" after a rejection. | FACT [T19] (2026-09-25) |
| 1.3.3 | The authorized representative has 30 days to sign the LOA, or the request cancels itself. | FACT [T4] |
| 1.3.4 | Steps: Twilio approval (~24 h), submission to carrier partner (≤24 h), partner to losing carrier (~1 week), approve or reject, then Twilio emails the port date. | FACT [T1] |
| 1.3.5 | US ports average 11 days; up to 4 weeks with rejections. A rejection "may add an additional two to four weeks". | FACT [T9], [T2] |
| 1.3.6 | API/new flow: target date "at least 7 days in the future"; Twilio "can't guarantee the exact date and time". The help center also says API ports "can port in 3 days". | FACT [T5], [T2] (they conflict; plan on 7) |
| 1.3.7 | Phases: CSR check, FOC date agreed by both carriers, then "the number is re-routed from the losing carrier to Twilio's network." | FACT [T11] |
| 1.3.8 | "All numbers will port on weekdays between 8:00 and 8:30 A.M. PT." No weekends or holidays. That is 10:00–10:30 a.m. in Austin. | FACT [T9] + INFERENCE (time zone) |
| 1.3.9 | Ports can complete 1–3 days early or slip. Configure the voice URL before the date. Keep the old carrier "until you verify that traffic is appearing in your Twilio logs." | FACT [T10], [T1] |
| 1.3.10 | Do not cancel the old service before completion. Afterwards, ask the old carrier to remove the number so billing stops. | FACT [T13], [F4] |
| 1.3.11 | **Downtime:** Twilio says the process is "without service interruption" [T11]. In practice expect minutes of mixed routing in the 30-minute window. Bestline stops serving 9313 when the port activates, and its forward-all to Amy stops with it. | FACT [T11] + INFERENCE |

### 1.4 Cost

| # | Claim | Label |
|---|---|---|
| 1.4.1 | "There is no cost to port a US phone number to Twilio." | FACT [T7] |
| 1.4.2 | Monthly number billing starts when a port date is scheduled, about 7 days before the port. | FACT [T8] |
| 1.4.3 | Then the usual rates: local number $1.15/mo, inbound $0.0085/min, outbound to US $0.0140/min (the ring-Amy leg). | FACT [T23] |
| 1.4.4 | Losing-carrier fees are the customer's: "Customer is solely responsible for all fees and costs incurred from the telecommunications provider". | FACT [T15] |
| 1.4.5 | Bestline offers "Month-to-month agreements or term contracted pricing". Which one Amy's account has, and any port-out fee or ETF, is unpublished. | FACT [B1]; OPEN |

### 1.5 Scheduling and cancelling

| # | Claim | Label |
|---|---|---|
| 1.5.1 | Standard (legacy) ports cannot be expedited or moved. The API flow can change dates and set activation time. Custom porting (via an Account Executive) can fix a date or hold. | FACT [T9] |
| 1.5.2 | Cancel "anytime before the port date is scheduled". After that it "may incur costs or service disruptions"; Twilio does not like cancelling within 48 h. | FACT [T12] |
| 1.5.3 | API: cancellations accepted only "more than 72 hrs before the port in date". Legal terms: written notice ≥2 business days, not guaranteed. | FACT [T5], [T15] |
| 1.5.4 | A late cancel may be cheaper as "port in, then port back out". That is a second multi-day port. | FACT [T12] + INFERENCE |

### 1.6 Who signs, and whose Twilio account

| # | Claim | Label |
|---|---|---|
| 1.6.1 | The LOA signer must be the person listed on the **Bestline** account. A consultant cannot sign for the business. | FACT [T5], [T14] |
| 1.6.2 | Whoever submits gets the number: "Twilio adds the phone numbers to your account." So a port into a consultant's account works if the business's authorized person signs. | FACT [T4] + INFERENCE |
| 1.6.3 | Afterwards Twilio treats its **account holder** as the authorized user. End users who ask for port-out info are referred to that customer. Twilio waits 5 business days for a reply before releasing it. | FACT [T17] |
| 1.6.4 | Moving a number to a different owner's Twilio account needs support tickets from both owners. Voice/SMS configuration and A2P registration are lost in the move. | FACT [T18] |
| 1.6.5 | **The business should own the Twilio account that holds 9313** (or a subaccount it controls), with us as a user. Otherwise the owner's main line depends on our cooperation. | INFERENCE |

## 2. What the business loses when 9313 leaves Bestline

| # | Item | Label |
|---|---|---|
| 2.1 | Bestline stops routing 9313. All three companies' calls ride on Twilio and our app from port day. | INFERENCE from [T19] ("previous provider releases control") |
| 2.2 | Lost Bestline features on 9313: forward-all/no-answer rules, auto attendant, hunt groups, voicemail-to-email, call recording, MaX UC app, CommPortal self-service. Desk phones on 9313, if any, stop working. | FACT (features listed) [B1]; INFERENCE (loss); OPEN (desk phones?) |
| 2.3 | CommPortal call history. Missed/Dialed/Received lists can be exported to CSV first. | FACT (`bestline-metaswitch.md` [S3]) |
| 2.4 | Contract exposure: month-to-month or term (unknown). ETFs still apply after a port; the port cannot be blocked over them. | FACT [B1], [F4]; OPEN (Amy's terms) |
| 2.5 | Other Bestline numbers or services on the account (512-923-9313? internet? IT?) stay unless cancelled. If 9313 is the main number, Bestline must re-key the account. | OPEN |
| 2.6 | Texts to 9313 (if any work today) move too. Twilio SMS routing lags 2–3 business days and needs an approved A2P 10DLC brand and campaign. | FACT [T2], [T1] |

**What our system must handle instead (INFERENCE, code checked):**
- Shared line: set `SHARED_LINE_NUMBER=+15123399313` (`lib/server/db.ts:73`).
  The greeting already asks "Which company are you calling about" (`lib/agents/policy.ts:43-44`). Front-desk capture covers Sublime Patio and The Fridge.
- Amy-first ringing replaces Bestline's forward-all. The press-1 human check already beats her cell voicemail.
- A Twilio **voice fallback URL** that dials Amy's cell directly. Otherwise an app outage silences three businesses.
- Lead alerts replace Bestline voicemail emails. Missed-call texts from her cell carrier stop for 9313 calls.
- Outbound caller ID: unchanged (Amy calls back from her cell). Showing 9313 on callbacks would need a Twilio dialer.

## 3. Twilio Hosted SMS (text-enable 9313, voice stays at Bestline)

| # | Claim | Label |
|---|---|---|
| 3.1 | Hosting adds Twilio **messaging** to a number you keep with your carrier. "Hosted Number does not affect your voice capabilities." Port & Host marks Voice "not supported" for hosting. | FACT [T20], [T19] |
| 3.2 | US/Canada only; mobile numbers not supported. A number "already marked as messaging-enabled with its current provider" is ineligible. | FACT [T20] |
| 3.3 | Steps: OTP ownership call to the number, then an e-LOA matching the voice provider's authorized user and service address. Up to one business day for landlines. | FACT [T20], [T21] |
| 3.4 | US SMS/MMS from a hosted number needs A2P 10DLC registration. The Hosted Numbers **API** is "not intended for use by new customers"; use the Console. | FACT [T19], [T20] |
| 3.5 | A Bestline VoIP number is "not mobile", so it should qualify, unless Bestline already text-enables it. The OTP call would reach Amy's cell through the forward-all. | INFERENCE; OPEN (is 9313 SMS-enabled at Bestline?) |
| 3.6 | **It does not help the AI receptionist.** No calls reach Twilio. Only "text us at 9313" would. Low value now. | INFERENCE |

## 4. Keeping 9313 without porting

### 4.1 (C) Forward from Bestline to a Twilio number

- Two shapes, both in `bestline-metaswitch.md` §0/§7: forward-all to Twilio (Twilio rings Amy first), or MaX UC app plus no-answer forward. FACT/INFERENCE there.
- Bestline advertises forwarding "on busy, no-answer, or after hours" and CommPortal self-service "without a support ticket". FACT [B1].
- So Amy (or the owner) could change the forward target herself, without calling Bestline. INFERENCE; OPEN (does she have a CommPortal login?).
- Amy asked to leave Bestline out. C still touches a Bestline setting. Her call.
- Rollback is one setting. Bestline per-minute forwarding charges and caller-ID passthrough: OPEN (Bestline questions list).

### 4.2 (D) Conditional forwarding on Amy's cell

| Carrier | Forward on no answer | Turn off | Label |
|---|---|---|---|
| Verizon | `*71` + 10-digit number ("forward only the calls you don't answer") | `*73` | FACT [C1] |
| T-Mobile | `**61*1`+number`#`; delay `**61*1`+number`**`seconds`#` (5–30 s). Unreachable `**62*`, busy `**67*` | `##61#`; `##004#` resets all forwarding to default | FACT [C2] |
| AT&T | Same GSM codes as T-Mobile (`**61*`…, `##004#`) or the phone's call-forwarding menu | `#21#` turns off forwarding | FACT for `#21#` [C3]; INFERENCE for the rest; OPEN |

- Verizon: forwarded calls bill as normal plan minutes; "no monthly fee… on most plans". You must set it from the phone. FACT [C1].
- Caller ID: the call path becomes caller → Bestline → Amy's cell → Twilio. Twilio's `ForwardedFrom` "depends on the caller's carrier"; "Not all carriers support passing this information." FACT (`telephony-receive-options.md`). Whether `From` stays the original caller across two forwards, or shows 9313 or her cell: OPEN. Test before relying on it.
- STIR: if the PASSporT `dest` no longer matches, Twilio reports `No-TN-Validation`. FACT [T22]. Our gate ignores that value and gates only `TN-Validation-Failed*` and hidden numbers (`lib/telephony/screening.ts:38`), so real callers are not challenged for it. INFERENCE.
- **Big catch (INFERENCE):** this forwards **every** missed call to her cell: family, the owner, personal calls. Her cell voicemail stops. The AI cannot tell 9313 calls from personal ones unless `ForwardedFrom` survives (OPEN).
- iPhone Live Voicemail or call screening may answer first and break no-answer forwarding. Anecdotal only. OPEN.

## 5. Spam

| # | Claim | Label |
|---|---|---|
| 5.1 | Carriers label calls using analytics engines: Hiya for AT&T, TNS for Verizon, First Orion for T-Mobile. | FACT [H1], [H3] (2023) |
| 5.2 | Factors include the call's context, consumer blocks and reports. Some carriers label "based on the call, not the number". A past label "doesn't mean it will be in the future." | FACT [H1], [H3] |
| 5.3 | The three run a free registry for **outbound** business numbers. "Does not guarantee redress." | FACT [H2] |
| 5.4 | Two different problems. **Inbound flood** = spammers dialing 9313. **"Spam Likely"** = labels on calls **from** 9313. Amy calls back from her cell, so 9313's outbound label barely matters today. | INFERENCE |
| 5.5 | **The flood follows the number.** Robocall lists hold 9313, not "Bestline". Porting changes the carrier only. Any label history is keyed to the number and its calls, so it follows too. | INFERENCE from [H1] |
| 5.6 | After a port our screen covers all 9313 traffic: `<Reject>` for denylisted callers ($0), press-1 for hidden and failed-STIR callers, fast AI hang-up. It cannot stop live telemarketers. | FACT (`spam-screening.md` §1 #4, #7) + code |
| 5.7 | Spam that passes the screen still rings Amy first, now via Twilio (two billed legs). Her carrier may still label those calls on her phone. | INFERENCE |
| 5.8 | **A fresh number avoids 9313's lists, for a while.** Twilio screens numbers so you don't get calls "meant for previous owners". Unpublished numbers averaged 8 weeks to first spam; nobody measured website/Google publication. | FACT [T24], `spam-screening.md` #9; OPEN |
| 5.9 | Under plan A, 9313's flood is unchanged and still hits Amy's cell. Only the new channel is clean. | INFERENCE |

## 6. Google Business Profile

| # | Claim | Label |
|---|---|---|
| 6.1 | Besides the primary number you can add up to 2 more. | FACT [G1] |
| 6.2 | Edits are reviewed before going live. Google names name and address changes, not phone, as re-verification triggers. | FACT (`new-number-rollout.md` §1.1, [G1]) |
| 6.3 | Google may call or text the **number on the profile** with automated checks. | FACT [G3] |
| 6.4 | Practitioners: phone "does not influence rankings"; tracking number primary, real number additional, is the accepted pattern. | FACT [Pract] (`new-number-rollout.md` §1.2) |
| 6.5 | Reviews belong to the profile, not the phone field. A phone change does not move or delete them. | INFERENCE |
| 6.6 | **Port (B):** nothing changes on GBP, websites or directories. That is the port's main advantage. | INFERENCE |
| 6.7 | **New number (A):** edit Phone → set the new number primary, move 9313 to additional. Change websites the same day. Google's automated calls would reach the AI line, so Amy must be able to take them. | INFERENCE on [G1], [G3] |

## 7. Comparison

| | (A) New Twilio number (current plan) | (B) Port 9313 to Twilio | (C) Bestline forwards 9313 → Twilio | (D) Amy's cell forwards → Twilio |
|---|---|---|---|---|
| Time to go live | Same day | 1–4+ weeks; likely mid-Nov to Dec | Same day if Amy has CommPortal; else a Bestline call | Minutes (star code) |
| Cost | $1.15/mo + per-minute | $0 port; same Twilio rates; maybe Bestline port fee/ETF (OPEN); Bestline bill may shrink | Twilio rates + possible Bestline forward charges (OPEN) | Twilio rates; cell minutes per plan |
| Risk to Amy's setup | None; 9313 untouched | High: all three companies cut over in season; rejections; Bestline features gone | Low; one reversible setting | Medium: personal missed calls go to AI; her voicemail stops |
| Spam exposure | Clean new channel; 9313 flood unchanged | Full 9313 flood now hits our screen | Full flood (forward-all) or only unanswered calls (no-answer) | Only calls she lets ring out, spam included |
| Other two companies | Unaffected | Shared-line greeting must carry them from day 1 | Shared-line greeting | Shared-line greeting; can't tell from personal calls (OPEN) |
| Bestline involved? | No | Yes (CSR, PIN, release) | A Bestline setting | No |
| Amy must provide | GBP access; OK to change sites | Everything in §8 | CommPortal login or a call to Bestline | Her carrier; dial one code |

## 8. Exactly what Amy (or the account owner) provides for a port

1. Name of the person **listed on the Bestline account**, exactly as Bestline has it, plus the business name. FACT [T1], [T5]
2. Service address exactly as on Bestline's CSR. Physical address, no PO box. FACT [T1], [T3]
3. Bestline account number, and the account's main telephone number. FACT [T5]
4. Port-out PIN or passcode, if Bestline set one. FACT [T3], [F3]
5. A Bestline bill dated within the last 30 days, showing account, name, address and 9313. FACT [T1]
6. The CSR from Bestline's porting team. Strongly advised. FACT [T14]
7. That person's own email, then their e-signature on Twilio's LOA within 30 days. FACT [T4], [T5]
8. Decisions: port date (weekday, ≥7 days out, cutover 10:00–10:30 a.m. Austin time); which other Bestline numbers/services stay; whether to close Bestline after; whose Twilio account holds 9313. FACT [T5], [T9]; INFERENCE (last item)

## 9. Open questions

1. Who is the authorized person on the Bestline account: Amy or the owner?
2. Month-to-month or term? Any port-out fee or ETF?
3. Is 9313 the account's main number? What else is on the account (512-923-9313, desk phones, internet)?
4. Is 9313 text-enabled at Bestline today?
5. Does Amy have a CommPortal / MaX UC login?
6. Amy's mobile carrier and phone (for D codes and Live Voicemail).
7. On a forwarded call, does Twilio see the original caller ID? (Test for C or D.)

## Sources (opened 2026-10-24)

| ID | Source | Date |
|---|---|---|
| T1 | [Twilio: How to Port a Phone Number](https://help.twilio.com/articles/223179348) | undated |
| T2 | [Twilio: How long does it take to port a US number](https://help.twilio.com/articles/223179468) | undated |
| T3 | [Twilio US Porting Guidelines](https://www.twilio.com/en-us/guidelines/us/porting) | © 2026 |
| T4 | [Twilio: Port phone numbers using Twilio APIs](https://www.twilio.com/docs/phone-numbers/port-in) | 2026-07-07 |
| T5 | [Twilio PortIn resource](https://www.twilio.com/docs/phone-numbers/port-in/port-in-request-api) | 2026-07-31 |
| T6 | [Twilio changelog: Porting Console for US Local](https://www.twilio.com/en-us/changelog/porting-console-for-us-local-numbers-in-public-beta) | 2025-09-03 |
| T7 | [Twilio: Cost to port](https://help.twilio.com/articles/223131967) | undated |
| T8 | [Twilio: Billing cycle for port requests](https://help.twilio.com/articles/223131987) | undated |
| T9 | [Twilio: Port by a specific date?](https://help.twilio.com/articles/223132127) | undated |
| T10 | [Twilio: Port before or after scheduled date](https://help.twilio.com/articles/223131947) | undated |
| T11 | [Twilio: Phases of porting a landline](https://help.twilio.com/articles/223179368) | undated |
| T12 | [Twilio: Cancelling a port request](https://help.twilio.com/articles/223179748) | undated |
| T13 | [Twilio: Cancel service with current carrier?](https://help.twilio.com/articles/223182748) | undated |
| T14 | [Twilio: Number rejected during porting](https://help.twilio.com/articles/223179628) | undated |
| T15 | [Twilio Porting Services Requirements](https://www.twilio.com/en-us/legal/porting-services) | © 2026 |
| T17 | [Twilio: Preventing end customers porting away](https://help.twilio.com/articles/223179568) | undated |
| T18 | [Twilio: Moving numbers to another account](https://help.twilio.com/articles/223135327) | undated |
| T19 | [Twilio: Porting and Hosting Numbers](https://www.twilio.com/docs/numbers-and-senders/port-host) | 2026-09-25 |
| T20 | [Twilio: Hosted Numbers FAQ](https://www.twilio.com/docs/phone-numbers/hosted-numbers) | 2026-09-25 |
| T21 | [Twilio changelog: Hosted SMS ownership verification](https://www.twilio.com/en-us/changelog/phone-number-verification-required-for-hosting-on-twilio) | 2024-10-17 |
| T22 | [Twilio: SHAKEN/STIR](https://www.twilio.com/docs/voice/trusted-calling-with-shakenstir) | 2026-08-24 |
| T23 | [Twilio US voice pricing](https://www.twilio.com/en-us/voice/pricing/us) | live |
| T24 | [Twilio Phone Numbers docs](https://www.twilio.com/docs/phone-numbers) | 2026-09-02 |
| F1 | [47 CFR 52.35 Porting intervals (eCFR)](https://www.ecfr.gov/current/title-47/chapter-I/subchapter-B/part-52/subpart-C/section-52.35) | current to 2026-10-22 |
| F2 | [47 CFR 52.34 VoIP porting obligations (eCFR)](https://www.ecfr.gov/current/title-47/chapter-I/subchapter-B/part-52/subpart-C/section-52.34) | same |
| F3 | [FCC 09-41, LNP Porting Interval Order](https://docs.fcc.gov/public/attachments/FCC-09-41A1.pdf) | 2009-05-13 |
| F4 | [FCC consumer guide: Porting](https://www.fcc.gov/consumers/guides/porting-keeping-your-phone-number-when-you-change-providers) | 2025-12-10 |
| B1 | [Bestline: Voice & VoIP](https://bestline.net/voice-communication/) | live |
| C1 | [Verizon: Call Forwarding FAQs](https://www.verizon.com/support/call-forwarding-faqs/) | live |
| C2 | [T-Mobile: Self-service & short codes](https://www.t-mobile.com/support/plans-features/self-service-short-codes) | live |
| C3 | [AT&T: Troubleshoot wireless call issues](https://www.att.com/support/article/wireless/KM1062174/) | 2026-10-03 |
| H1 | [Hiya: How carriers label spam calls](https://blog.hiya.com/how-carriers-label-spam-calls-and-how-businesses-can-support-a-healthy-call-reputation) | 2024-07-23 |
| H2 | [Free Caller Registry](https://www.freecallerregistry.com/fcr/) | live |
| H3 | [Hiya: Free Caller Registry explained](https://blog.hiya.com/dont-pay-a-vendor-to-register-your-phone-numbers-across-carriers-use-free-caller-registry) | 2023-08-02 |
| G1 | [Google: Edit your Business Profile](https://support.google.com/business/answer/3039617) | live |
| G3 | [Google: Automated calls and texts to confirm info](https://support.google.com/business/answer/7690269) | via `new-number-rollout.md` |
