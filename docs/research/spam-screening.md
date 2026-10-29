# Research: inbound spam and robocall screening for the CLG AI line

- Date: 2026-10-23. Every page below was opened on this date unless marked.
- Read-only research. Nobody was signed up, called, emailed or billed. No setting was changed.
- Scope: a **new dedicated Twilio local number** for The Christmas Light Guys. It is published on the
  website and the Google Business Profile. ElevenAgents answers it. Our Next.js webhook
  (`/api/voice/inbound` → `handleInbound` in `lib/server/voice.ts`) sees every call first.
- Problem: Amy's main line gets so much spam that she lets almost every call go to voicemail.
  The new line must keep spam away from the AI (minutes, junk leads) and from Amy's phone,
  without turning away real customers. Many customers are older homeowners.
- Builds on, does not repeat: `docs/research/telephony-receive-options.md` (webhook params),
  `docs/cost-model.md` (unit prices), `docs/failure-matrix.md` (spam call → `finish_call not_a_lead`).

## 0. Labels

| Label | Meaning |
|---|---|
| FACT | Read today on a primary page: vendor docs or pricing, regulator text, peer-reviewed paper, or a vendor's report of its own data. `[Sn]` links to the URL in §7. Vendor performance numbers are the vendor's own claims. |
| INFERENCE | Our reasoning from the facts. Needs a test. |
| OPEN QUESTION | Not documented, not public, or conflicting. Must measure, or check in the Twilio Console. |

---

## 1. Bottom line

| # | Conclusion | Label |
|---|---|---|
| 1 | Twilio has **no first-party inbound spam filter** in 2026. Inbound tools are: the free `StirVerstat` webhook parameter, partner Marketplace add-ons (Nomorobo Spam Score, Marchex Clean Call), CNAM `CallerName` ($0.01) and Lookup Line Type ($0.008). | FACT [S1][S8][S10][S18][S19]; "none other" is INFERENCE from a changelog search |
| 2 | `StirVerstat` is a **weak spam signal**. About 45% of US calls reach the terminating carrier unsigned. Robocallers sign most of their own calls with A attestation. Use it to **skip** friction, never to block. | FACT [S5][S7] + INFERENCE |
| 3 | **Voice Integrity and Branded Calling are outbound-only.** They do nothing for calls coming in. | FACT [S25][S26] |
| 4 | Returning `<Reject>` as the first verb means Twilio never answers. **The call costs $0.** Use it for denylisted numbers. | FACT [S22] |
| 5 | **Money is not the main risk.** A spam call that the AI ends within a minute costs at most ≈ $0.10. The real costs are Amy's attention, junk leads, and real callers lost to friction. | INFERENCE on FACT prices (§5.3) |
| 6 | **No field study measures a "press 1" gate.** In a lab test, a conversational screen stopped 95% of replayed mass robocalls, with 8.1% false positives, mostly first-time human callers who stayed silent. | FACT [S30] |
| 7 | A press-1 gate does **not** stop live telemarketers. In a 2026 honeypot, about 54% of unwanted callers' opening audio was labelled human. | FACT [S32] + INFERENCE |
| 8 | Google tells business owners: "Do not press any buttons even if the voice prompt tells you to." A recorded "press 1" can sound like a robocall to cautious older callers. | FACT [S37] + INFERENCE |
| 9 | **Spam onset:** never-published numbers averaged 8 weeks to their first unsolicited call. Numbers typed into lead-gen forms got calls the same day. Nobody has measured numbers published on a website or Google listing. | FACT [S29][S33] + OPEN QUESTION |
| 10 | **Recommendation.** Day 1: free webhook screen (allow and deny lists, `<Reject>`, gate only for anonymous and failed-verification calls), the AI as the main screen with a fast `end_call`, an auto-denylist, and logging. Add Nomorobo, then a press-1 gate for unsigned callers, **only** if the measured spam crosses a threshold (§5.2). | INFERENCE |

---

## 2. Q1. What Twilio offers today for inbound screening

### 2.1 `StirVerstat`: what it is

| # | Claim | Label |
|---|---|---|
| 2.1.1 | `StirVerstat` is a parameter on the incoming-call webhook. It is "only present in the incoming call webhook when the incoming call has SHAKEN PASSporT identity headers." | FACT [S1] (modified 2026-08-24) |
| 2.1.2 | Twilio verifies STIR/SHAKEN on incoming calls to Twilio **local** numbers. Launched 2020-09-21. | FACT [S2] |
| 2.1.3 | SHAKEN/STIR is "currently only deployed in United States and France." | FACT [S1] |
| 2.1.4 | Attestation: **A** = the carrier knows the caller and that they may use the number. **B** = knows the caller, not the right to the number. **C** = neither, including international calls. | FACT [S1] |
| 2.1.5 | Values: `TN-Validation-Passed-A/B/C` (signature checked), `TN-Validation-Failed-A/B/C` ("could mean tampering or that Twilio could not retrieve the public certificate"), `No-TN-Validation` (malformed number, bad PASSporT, `orig`/`dest` mismatch, `iat` over one minute old), `TN-Validation-Failed` and `NULL` (no attestation level), plus `-Diverted` and `-Passthrough` variants. | FACT [S1] |
| 2.1.6 | Twilio's own suggested uses: "display a trust indicator or … make a routing decision," for example skipping a voice CAPTCHA. | FACT [S1][S2] |
| 2.1.7 | Twilio does not say it blocks failed calls. The docs give no spam-blocking guidance. | FACT [S1] |
| 2.1.8 | Twilio engineers (2020): "Industry consensus is to never block calls based on the STIR/SHAKEN attestation alone." Also: "only a subset of inbound calls will be signed." | FACT [S3] |
| 2.1.9 | Twilio blog (2023) sample flow: A → connect; B → record name and screen; C → voicemail; missing or failed → "human detection" (press a digit). It warns the code is illustrative only. | FACT [S4] |

### 2.2 `StirVerstat`: how reliable, and how many real calls arrive unverified

TransNexus collects these numbers from "hundreds of voice service providers" that use its products.
It does not name them or give volumes. Treat as vendor data, not a census. FACT [S5][S6].

| Metric, at the terminating carrier | Aug 2026 [S6] | Sep 2026 [S5] |
|---|---|---|
| Calls signed with STIR/SHAKEN | 54.8% | 54.5% |
| Calls signed A / B / C | 33.8% / 5.7% / 8.0% | 32.8% / 5.5% / 9.3% |
| Robocalls among A-signed calls | 1.6% | 1.6% |
| Robocalls among B-signed calls | 3.8% | 4.6% |
| Robocalls among C-signed calls | 7.8% | 7.8% |
| Attestation mix of the top-10 "prolific robocall signers" | 71% A, 27% C | 75% A, 5% B, 20% C |

| # | Claim | Label |
|---|---|---|
| 2.2.1 | The FCC: "STIR/SHAKEN only works in IP networks." When a call crosses a non-IP segment, "the STIR/SHAKEN information is stripped out." | FACT [S7] ¶9 (adopted 2025-04-28) |
| 2.2.2 | In April 2025 the FCC proposed requiring non-IP caller ID authentication (ATIS-1000095 in-band, ATIS-1000096 out-of-band). I found no final order. | FACT [S7]; final status OPEN QUESTION |
| 2.2.3 | **About 45% of calls arrive unsigned.** Robocalls are only ~3–4% of signed traffic, so most unsigned calls are legitimate. A gate on "no `StirVerstat`" would hit roughly half of all real callers. | INFERENCE from [S5] |
| 2.2.4 | Unsigned real callers likely skew to copper landlines, small or rural carriers, and calls that cross old TDM links. That skew fits older homeowners. No source splits this by line type. | INFERENCE from [S7]; OPEN QUESTION |
| 2.2.5 | An A attestation does not mean "not spam." Prolific robocall signers put 71–75% of their calls out at A. | FACT [S5][S6] |
| 2.2.6 | The mix on **our** Twilio number is unknown. Log `StirVerstat` on every call for two weeks before using it in routing. | OPEN QUESTION |

**Use:** treat `TN-Validation-Passed-A` or `-B` as "skip the gate if one is on." Treat
`TN-Validation-Failed*` as "gate." Treat a missing value as neutral. INFERENCE.

### 2.3 Marketplace add-ons for incoming calls

**Mechanics (all FACT [S8][S9] unless marked):**

- "All installed and configured Listings are automatically invoked for each incoming call." Billing is per call, on every call, spam or not.
- Results arrive in the `AddOns` parameter of the incoming voice webhook. "`POST` callbacks only."
- Results are synchronous. "Requests taking longer than 2000 ms are failed by Twilio and an error payload is sent." Results over 64 KB also fail. "The developer is not billed" for those failures.
- "Add-on Listings are not supported for outbound calls."
- "Partners set their own pricing." Twilio meters use and deducts it from the account balance. Prices are shown in the Marketplace catalog inside the Console.
- Latency: the add-on runs before our webhook is called. Worst case adds about 2 s of ringing before the caller hears anything. INFERENCE from the 2000 ms cap.

| Add-on | Output | Field path in `AddOns` JSON | Available today? | Price per call | Label |
|---|---|---|---|---|---|
| **Nomorobo Spam Score** | `score` 0 (legit) or 1 (spam) | `results.nomorobo_spamscore.result.score` | Twilio's own tutorial of **2026-03-06** tells you to install it. | **Not public.** Shown only in the Console catalog. A 2023 hobbyist blog says $0.003 per lookup. | FACT [S10]; price OPEN QUESTION (secondary [S14]) |
| **Marchex Clean Call** | `recommendation` `BLOCK` or `ALLOW` (2017 example shows `PASS`) | `results.marchex_cleancall.result.result.recommendation` | Same 2026 tutorial installs it. | Not public. | FACT [S10][S11]; price OPEN QUESTION |
| Whitepages Pro Phone Reputation | n/a | n/a | Named only on an older Code Exchange page. Absent from the 2026 tutorial. | n/a | FACT [S12]; status OPEN QUESTION (likely retired, INFERENCE) |

| # | Claim | Label |
|---|---|---|
| 2.3.1 | Check each add-on's `status` is `"successful"` before trusting its result. Twilio's samples do this. | FACT [S10][S11] |
| 2.3.2 | Twilio's samples `<Reject>` when **any** add-on says spam. For a sales line, route a positive to a gate first. Reject only after we see no false positives. | FACT [S11] + INFERENCE |
| 2.3.3 | Nomorobo also sells a direct API to "VSPs, self-hosted enterprises, and number providers." No public price. Latency is described only as "extremely low." | FACT [S15] (vendor claim) |
| 2.3.4 | Nomorobo admits the limit of number lists: "plenty of illegal phone spammers are using throwaway numbers." | Secondary [S14] |
| 2.3.5 | No accuracy figures are published for either add-on. | OPEN QUESTION |

### 2.4 Other inbound signals Twilio gives us

| Signal | What it gives | Cost | Label |
|---|---|---|---|
| `From` | Withheld caller ID shows as `anonymous` since 2023-05-17. Docs say it "may" contain `anonymous` or `unknown`. | Free | FACT [S20][S21] |
| `CallerName` | CNAM name, when the number's `voice_caller_id_lookup` is `true`. | "$0.01 per look up" | FACT [S19] |
| Lookup Line Type Intelligence | `landline`, `mobile`, `fixedVoip`, `nonFixedVoip` ("obtained online … Google Voice"), `tollFree`, etc. Extra REST call inside our webhook. | $0.008 per request | FACT [S18][S27] |
| Lookup reputation or spam score | Not offered as a Lookup package. | n/a | FACT [S18] |

CNAM and line type are weak spam signals. Real customers use Google Voice and blank CNAM too. Use them
for Amy's lead card, not for blocking. INFERENCE.

### 2.5 Voice Integrity and Branded Calling are outbound-only

| # | Claim | Label |
|---|---|---|
| 2.5.1 | Voice Integrity lets a business register "their details and outbound phone numbers directly with major US analytics vendors." Public Beta. It "won't make your numbers fully immune to spam labels." | FACT [S25] (modified 2026-10-16) |
| 2.5.2 | Branded Calling shows "your verified business name, logo, and call reason on recipients' mobile devices during outbound calls." Mobile only; landlines need CNAM. | FACT [S26] |
| 2.5.3 | Branded Calling costs $0.12 per call. | FACT [S17] |
| 2.5.4 | Neither product screens or labels **incoming** calls. Relevant only if Amy later calls customers back **from** the Twilio number. | INFERENCE from [S25][S26] |

---

## 3. Q2. Cheap screening we can do in our own webhook

### 3.1 Patterns

| Pattern | How | Cost per call | Catches | Misses / harms | Label |
|---|---|---|---|---|---|
| **Allowlist** | Prior leads and customers, Amy, staff, known suppliers skip every check. | $0 | n/a | A spoofed customer number gets through. Rare. | INFERENCE |
| **Denylist → `<Reject>`** | Numbers the AI or Amy marked spam. `<Reject>` first: "Twilio will not pick up the call." `reason="busy"` plays a busy tone. | **$0** | Repeat spam from the same number | Spoofing rotates numbers. 6.12% of honeypot calls used neighbor spoofing (same area code and exchange). A real customer's spoofed number could get listed. Let entries expire. | FACT [S22][S29] + INFERENCE |
| **Anonymous caller → gate, not reject** | `From` is `anonymous`/`unknown`. | ≈ $0.0085 if they fail | Many robocalls | Some private people hide caller ID. Rejecting them loses leads. | FACT [S21] + INFERENCE |
| **Failed verification → gate** | `StirVerstat` starts `TN-Validation-Failed`. | ≈ $0.0085 if they fail | Tampered or uncertified calls | Can also mean Twilio failed to fetch a certificate. | FACT [S1] + INFERENCE |
| **Press-1 (DTMF) gate** | `<Gather numDigits="1">`, default `timeout` 5 s, say the prompt twice. On no input, fall through to `<Record>` voicemail, **not** hang up. | Answered call: $0.0085 per billed minute, rounded up | Pre-recorded robocalls and silent dialers | Live telemarketers. Callers who can't find the keypad, or who distrust "press 1" prompts. | FACT [S23][S24] + INFERENCE |
| **Random-digit variant** | Read 1–2 random digits; caller repeats them. Twilio's 2020 recipe. | Same | Bots that blindly send "1" | More effort for older callers | FACT [S3] |
| **"Say your name" gate** | `<Gather input="dtmf speech">`. Accept a keypress or any spoken words. | +$0.02 per speech use (default model) | Silent dialers | A recording that talks passes. Weak alone. Good as the no-keypad path. | FACT [S17][S23] + INFERENCE |
| **AI as the screen** | The agent greets and asks what they need. The LLM spots recordings, pitches and silence, then calls `end_call` and `finish_call not_a_lead`. | ≤ $0.10 for a call ended within a minute (§5.3) | Robocalls, most telemarketers, wrong numbers | Costs AI minutes. Needs prompt and eval work. | INFERENCE; tools FACT [S48] |
| **Cap AI call length** | Lower `conversation_config.conversation.max_duration_seconds` from the default 600 s. Range 60–7,200 s. | $0 | Runaway robocall loops | Must not cut real long calls | FACT [S47] + INFERENCE |
| **Repeat-caller limit** | Example: a number with ≥3 calls in 10 min and no lead → reject for 1 hour. | $0 | Voicemail-injection redials. In the honeypot, 2.91% of calls fit a redial-in-30–90 s pattern. | Real customers redial after a dropped call. Only limit numbers with no lead or already flagged. | FACT [S29] + INFERENCE |
| **Silence cut-off** | Gate times out; AI ends after ~10 s of caller silence. | $0 | Silent dialers. In the 2026 honeypot, 9.9% of greeted unwanted callers never spoke (median 16 s on the line). | Nervous first-time callers | FACT [S32] + INFERENCE |
| **Known-spam feed** | FTC "Do Not Call reported calls" API: caller number, date, subject, robocall Y/N. Updated "each weekday." Free api.data.gov key. "None of the information … is verified." | $0 | Numbers consumers report | Spoofed and churned numbers | FACT [S42][S43] |

### 3.2 How well do blocklists and gates work? (evidence)

| # | Claim | Label |
|---|---|---|
| 3.2.1 | Blocklists built from FTC complaints, crowd reports and honeypot data could block "more than 55%" of future unwanted calls, with a 0.01% false-positive rate on legitimate business numbers. Data are from before STIR/SHAKEN. | FACT [S31] (NDSS 2018) |
| 3.2.2 | A 2026 study finds caller numbers "churn quickly," while scripts and audio persist. It suggests number blocklists may be weak today. Preprint, not peer reviewed. | FACT [S32] |
| 3.2.3 | **Lab test of a conversational screen (RoboHalt):** it stopped 95% of 144 replayed mass robocalls; 94.5% when the recording waited for the greeting; 84% of "evasive" and 87% of "targeted" red-team robocalls. | FACT [S30] (USENIX Security 2023) |
| 3.2.4 | Same study: 40 people made 160 calls; 13 were wrongly blocked (8.1%). In 10 of 13 the person stayed silent. By their third and fourth calls, false positives fell to 5%. About a quarter of participants were over 50. | FACT [S30]; the "quarter" is our arithmetic from its age bands |
| 3.2.5 | The same paper says commercial **audio CAPTCHAs** can be broken by off-the-shelf speech recognition. | FACT [S30] |
| 3.2.6 | A 2016 survey of defenses: CAPTCHA-style tests risk discriminating against people with poor English or disabilities. The caller "may become irritated." They "cause significant delays." | FACT [S34] |
| 3.2.7 | 2026 honeypot (lead-gen-seeded numbers, AI answering): 26.9% of greeted unwanted calls were machine-voiced on audio evidence; 54.2% were labelled human; 9.9% never spoke. Machine callers ignored about one question in three. Only 0.44% of detector-flagged calls said they were automated. | FACT [S32] (preprint) |
| 3.2.8 | **I found no measurement of a plain press-1 gate on real traffic.** Twilio's recipes publish no outcome data. | FACT [S3][S4]; gap noted |
| 3.2.9 | Best estimate: a press-1 gate stops most pre-recorded robocalls and silent dialers. It does not stop live telemarketers, roughly half of unwanted callers. It is untested against AI voice bots that can send tones. | INFERENCE from 3.2.3–3.2.7; bots OPEN QUESTION |

### 3.3 Effect on real customers (older homeowners)

| # | Point | Label |
|---|---|---|
| 3.3.1 | Google tells business owners to hang up on fake-Google calls: "Do not press any buttons even if the voice prompt tells you to." The FTC tells consumers: "Pressing numbers to speak to someone or remove you from the list will probably only lead to more robocalls." Some careful older callers may hang up on any recorded "press 1." | FACT [S37][S49] + INFERENCE |
| 3.3.2 | iPhone's "Ask Reason for Calling" asks unknown callers why they're calling "before your phone even rings." Callers are getting used to speaking to a screen. A spoken greeting is more familiar than a keypad test. | FACT [S46] + INFERENCE |
| 3.3.3 | On smartphones the keypad is hidden during a call. A caller must find and tap it. That is a real hurdle for some older users. | INFERENCE |
| 3.3.4 | Failing the gate must not end the call. Fall through to a voicemail recording. Amy loses nothing; robocall audio lands in a recording we can auto-classify. | INFERENCE |
| 3.3.5 | Relay-service calls (711) and hearing-aid users may struggle with tight timeouts. Keep the 5 s default and repeat the prompt once. | INFERENCE; OPEN QUESTION |
| 3.3.6 | Google Business Profile phone verification: "Interactive Voice Response (IVR) systems won't get the code." A gate or the AI would swallow Google's code call. | FACT [S38] |
| 3.3.7 | Google also places automated calls to businesses with public numbers, to confirm hours or map phone trees. They can be turned off in Business Profile settings, under "Google automated calls and text messages." | FACT [S36] |

---

## 4. Q3. How fast does a new published business number get spam?

### 4.1 Evidence

| # | Claim | Label |
|---|---|---|
| 4.1.1 | Honeypot of 66,606 lines, 11 months, **never published anywhere**: 1,481,201 unsolicited calls. Each line averaged 0.11 calls per day (one every ~9 days). | FACT [S29] (USENIX Security 2020) |
| 4.1.2 | Same study: it took "an average of 8.01 weeks" for a line to get its first unsolicited call. 24.9% of clean lines got none in 11 months. | FACT [S29] |
| 4.1.3 | Same study: "clean" lines (new or rotated from prior customers) and "abuse-history" lines got about the same rate, 0.11 per day. History of abuse was not needed to get spam. | FACT [S29] |
| 4.1.4 | Same study: answering unsolicited calls did **not** raise later call volume (p = 0.07). | FACT [S29] |
| 4.1.5 | Numbers typed into lead-gen "free quote" forms: "aggregators resell within hours, so a seeded number begins receiving calls the same day." 10,211 calls over 54 days across the seeded numbers; 253 per weekday. | FACT [S33] (preprint; the "same day" line is the authors' statement, not a timed measurement) |
| 4.1.6 | Robocall campaigns target small businesses through their **Google listings**. The FTC sued one in 2018 ("permanently closed" threats). In 2020 it refunded 4,467 small business owners. | FACT [S35] |
| 4.1.7 | Business numbers cannot go on the Do Not Call Registry: "Business phone numbers and fax lines are not covered." Most B2B sales calls are exempt from DNC rules. The 2024 TSR change only bans **lying** in B2B telemarketing. | FACT [S40][S41] |
| 4.1.8 | Spammers get numbers from lead sellers, form submissions, data leaks, apps, or by generating them from the numbering plan. The authors "do not know for sure the most popular means." | FACT [S34] |
| 4.1.9 | Twilio says every number it sells goes through screening so "you and your customers don't receive unwanted calls and text messages meant for previous owners." | FACT [S28] (vendor claim) |
| 4.1.10 | Background (vendor data): Austin received an estimated 26.6 M robocalls in September 2026, about 20.6 per person. A 2019 vendor survey of 500 owners said 84% of small businesses get robocalls every day. | FACT [S44][S45] (vendor estimates and survey) |
| 4.1.11 | **No study measures spam onset for a number published on a website or a Google listing.** | OPEN QUESTION |

### 4.2 What this means for the new number

| # | Conclusion | Label |
|---|---|---|
| 4.2.1 | Random dialing alone gives a floor of roughly 3 calls a month, starting within weeks. | INFERENCE from 4.1.1–4.1.2 |
| 4.2.2 | The Google listing will attract B2B pitches (SEO, "Google listing," merchant services, lead sellers). Many are live humans. They are legal to call a business. A press-1 gate will not stop them. The AI must triage them. | INFERENCE from 4.1.6–4.1.7, 3.2.7 |
| 4.2.3 | The new number should start far cleaner than Amy's years-old main line. The 2026 season (Oct–Dec) is the cleanest window this number will ever have. Measure it. | INFERENCE |
| 4.2.4 | **Keeping it off lead-gen and quote forms clearly helps.** That channel is the one shown to bring same-day calls. | INFERENCE from 4.1.5 |
| 4.2.5 | Keeping it off other directories (data aggregators, Yelp-style sites, WHOIS, state filings) plausibly helps. It is unmeasured. Google and the website are where customers find the business, so keep it there. | INFERENCE; OPEN QUESTION |

### 4.3 Publication hygiene (day 1, $0)

1. Publish the AI number on the website and as the Google Business Profile number only. INFERENCE.
2. Never type it into vendor, supplier, credit, lead-marketplace, trade-show or directory-submission forms. Use Amy's main line for those. INFERENCE from [S33].
3. Google listed numbers must connect to the business and be "under the direct control of the business." A Twilio local number we own fits. FACT [S39] + INFERENCE.
4. If Google asks to re-verify after the phone change, pick text, email or video. "IVR systems won't get the code" by phone. FACT [S38]. Whether a phone change triggers re-verification: OPEN QUESTION.
5. Consider turning off "Google automated calls and text messages" in Business Profile settings. Those calls burn AI minutes and are not leads. FACT [S36] + INFERENCE.
6. Optional experiment: a second Twilio number ($1.15/mo) for the website only. Compare spam per source after 30 days. Check local-SEO preference first. INFERENCE.

---

## 5. Q4. Recommended layered setup

### 5.1 Day 1 (launch)

All layers here are free or nearly free. INFERENCE unless marked.

1. **Publication hygiene** (§4.3).
2. **Webhook pre-screen** in `handleInbound`, before any route that rings Amy or connects the AI:
   - Allowlist hit (lead or customer number, Amy, staff, suppliers) → normal flow.
   - Denylist hit → `<Reject reason="rejected"/>`. $0. FACT [S22].
   - `From` anonymous or unknown → short gate (below).
   - `StirVerstat` starts `TN-Validation-Failed` → short gate.
   - Everything else → normal flow. **No gate** for the rest on day 1.
3. **The short gate:** "Thanks for calling The Christmas Light Guys. To reach us, press 1 or say yes." `<Gather input="dtmf speech" numDigits="1">`, said twice. No input → `<Record>` voicemail with a callback promise. Never hang up on a possible customer.
4. **AI as the main screen.** Prompt the agent to spot recordings, sales pitches and silence early. It ends with `finish_call not_a_lead` and `end_call` within ~20 s. Add eval cases for robocall audio, a live SEO pitch, a "Google listing" robocall, and Google's own hours-check call.
5. **Cap the AI call** below the 600 s default (for example 420 s). FACT [S47] for the setting; the value is INFERENCE.
6. **Auto-denylist with expiry.** A number the AI ends as robocall or sales pitch twice → denylist for 30 days. Never auto-list a number that already has a real lead.
7. **Do not ring Amy for unknown callers before screening.** On lines with `ringOwner`, today's flow rings her first in business hours. A spam call would then ring her cell. That recreates the main-line problem. Ring her only for allowlisted callers, or through the agent's warm hand-off. Owner decision.
8. **Log for two weeks:** `From`, `StirVerstat`, `CallerName` if enabled, gate result, AI outcome. Report spam share weekly on the console.

### 5.2 Add only if spam grows

Suggested trigger: over a week, ≥ 3 robocall or pitch calls a day reach the AI, or junk exceeds 25% of AI calls, or Amy sees junk leads. INFERENCE.

| Step | What | Expected effect | Cost | Label |
|---|---|---|---|---|
| L2 | **Nomorobo Spam Score add-on.** `score = 1` → gate for two weeks; then `<Reject>` if no real caller was caught. | Catches numbers Nomorobo already knows. Adds up to 2 s of ringing. | Per call, on **every** call. Price OPEN (≈ $0.003 per a 2023 blog). | FACT [S8][S10] + OPEN |
| L3 | **Gate every caller without `TN-Validation-Passed-A/B`**, except the allowlist. | Stops most pre-recorded robocalls. Puts friction on roughly half of real callers. | ≈ $0 extra for passers; $0.0085 for failures; +$0.02 per speech answer | INFERENCE from [S5][S30] |
| L4 | **Repeat-caller limit** (§3.1). | Stops redial storms. | $0 | INFERENCE |
| L5 | **FTC DNC reported-calls feed** → gate (not reject) on a match. | Modest; numbers churn. | $0 | FACT [S42][S43] + INFERENCE |
| L6 | **Marchex Clean Call** as a second opinion, if still in the catalog. | Unknown | OPEN | OPEN QUESTION |

Do **not** add Voice Integrity or Branded Calling for this problem. They are outbound. FACT [S25][S26].

### 5.3 Per-call costs

Unit prices: Twilio inbound local $0.0085/min [S17]; Media Streams $0.0044/min, ElevenLabs $0.08/min
overage, LLM ≈ $0.01/min, recording $0.0025/min (all from `docs/cost-model.md`). Twilio rounds call
duration **up** to the next minute [S24].

| Item | When it applies | Cost per call | Label |
|---|---|---|---|
| `<Reject>` (denylist) | First verb | **$0** | FACT [S22] |
| Free checks (`From`, `StirVerstat`, lists) | Every call | $0 | FACT [S1][S20] |
| Gate, caller fails or hangs up | Gated calls | $0.0085 | FACT [S17][S24] |
| Gate, caller passes | Gated calls | 8–12 s more on the call; at most +$0.0085 from rounding | INFERENCE |
| Speech answer in gate | Per speech use | $0.02 | FACT [S17] |
| Voicemail after a failed gate | Per minute | $0.0085 + $0.0025 | FACT + cost-model |
| `CallerName` (optional) | Every call if enabled | $0.01 | FACT [S19] |
| Line Type Intelligence (optional) | Per lookup | $0.008 | FACT [S18] |
| Nomorobo add-on (L2) | Every call once installed | OPEN (≈ $0.003, secondary) | OPEN [S14] |
| Spam call the AI ends in ≤ 1 min | Spam reaching AI | ≈ $0.023 inside plan minutes; ≈ $0.103 at overage | INFERENCE on cost-model prices |
| Ringing Amy's cell for a spam call | Amy-first lines | $0.014 (outbound leg, 1 billed minute) | FACT [S17][S24] |

Note: `docs/cost-model.md` prices the ≈ 18 s Amy-first leg at $0.0042, which assumes per-second
billing. Twilio's docs say round up to the minute, so it is $0.014. INFERENCE; worth correcting there.

### 5.4 Monthly illustration (not a forecast)

Assume 150 spam calls a month reach the line. Real volume is OPEN until measured.

| Setup | Spam cost / month | Label |
|---|---|---|
| Day 1, all 150 reach the AI, overage rate | ≈ $15 | INFERENCE |
| Day 1 + denylist rejects one third | ≈ $10 | INFERENCE |
| + Nomorobo on 600 total calls at $0.003 | + ≈ $1.80 | INFERENCE (price OPEN) |
| + L3 gate stops most robocalls | ≈ $3–5 | INFERENCE |

The dollars are small. The trade is friction. One real job worth $180, lost to a gate, equals a full
year of the worst case above. Gate only what the data says to gate. INFERENCE.

### 5.5 Where it plugs in (sketch, for whoever builds it)

- New pure function, for example `lib/telephony/screen.ts`: `screenCaller(params, lists) → "allow" | "gate" | "reject"`. Unit-test each `StirVerstat` value and `From` form. INFERENCE.
- Call it at the top of `handleInbound` (`lib/server/voice.ts`), before `routeInbound` / `routeCarrierMissed`. INFERENCE.
- New route `/api/voice/gate` for the `<Gather>` result. On pass, continue the existing flow. INFERENCE.
- Store `stir_verstat` and the screen decision on the call row, beside `ForwardedFrom` (see `telephony-receive-options.md`). INFERENCE.

---

## 6. Open questions

| # | Question | How to close it |
|---|---|---|
| 1 | Current price and availability of Nomorobo Spam Score and Marchex Clean Call. | Owner opens Console → Marketplace catalog (read only). |
| 2 | `StirVerstat` mix on our number. | Log every call for two weeks. |
| 3 | Real spam volume on the new number, by source. | Weekly console report; optional split number (§4.3 item 6). |
| 4 | Does ElevenLabs bill a 15 s call as a full minute? | Check one short test call's charge. |
| 5 | Do AI voice bots answer DTMF prompts? | No source found. Watch gate pass rates on calls the AI later tags as spam. |
| 6 | Does changing the Google listing's phone trigger re-verification? | Watch the Business Profile after the change. |
| 7 | Has the FCC adopted the 2025 non-IP authentication rule? | Check WC Docket 17-97. |
| 8 | Which legitimate automated callers must be allowlisted (Google, suppliers, payment processors)? | Ask Amy. |
| 9 | Amy's existing Bestline line: Nomorobo Landline Protection is $39.99/yr per line via Simultaneous Ring, if Bestline supports it. | FACT price [S16]; support OPEN — ask Bestline. |

---

## 7. Sources

| Id | Source | Notes |
|---|---|---|
| S1 | [Twilio: Trusted calling with SHAKEN/STIR](https://www.twilio.com/docs/voice/trusted-calling-with-shakenstir) | modified 2026-08-24 |
| S2 | [Twilio changelog: STIR/SHAKEN verification on incoming calls](https://www.twilio.com/en-us/changelog/twilio-performs-shaken-stir-verification-on-incoming-calls-to-yo) | 2020-09-21 |
| S3 | [Twilio blog: STIR/SHAKEN verification in a voice CAPTCHA IVR](https://www.twilio.com/en-us/blog/shaken-stir-verification-voice-captcha-ivr) | 2020-09-24 |
| S4 | [Twilio blog: Call flows using SHAKEN/STIR attestation levels](https://www.twilio.com/en-us/blog/shaken-stir-call-flows) | 2023-04-26 |
| S5 | [TransNexus: STIR/SHAKEN statistics, September 2026](https://transnexus.com/blog/2026/shaken-statistics-september/) | 2026-10-05; vendor data |
| S6 | [TransNexus: STIR/SHAKEN statistics, August 2026](https://transnexus.com/blog/2026/shaken-statistics-august/) | 2026-09-02; vendor data |
| S7 | [FCC 25-25, Non-IP caller ID authentication NPRM](https://docs.fcc.gov/public/attachments/FCC-25-25A1_Rcd.pdf) | adopted 2025-04-28 |
| S8 | [Twilio: How to use Marketplace Listings](https://www.twilio.com/docs/marketplace/listings/usage) | |
| S9 | [Twilio: Marketplace Listings](https://www.twilio.com/docs/marketplace/listings) | |
| S10 | [Twilio blog: Block spam calls with Twilio Voice in Node.js](https://www.twilio.com/en-us/blog/developers/tutorials/product/block-spam-calls-twilio-voice-node-js) | 2026-03-06 |
| S11 | [Twilio: Block spam calls and robocalls with Python](https://www.twilio.com/docs/guides/block-spam-calls-and-robocalls-python) | 2017-01-09, migrated |
| S12 | [Twilio Code Exchange: Block spam calls](https://www.twilio.com/code-exchange/block-spam-calls) | undated |
| S13 | [Twilio blog: Detect robocalls with Lookup and Nomorobo](https://www.twilio.com/en-us/blog/detect-robocalls-with-twilio-lookup-and-nomorobo) | 2019-03-25 |
| S14 | [Botkin: Using Nomorobo to block calls in Asterisk](https://dale.botkin.org/2023/07/29/using-nomorobo-to-block-calls-in-asterisk/) | 2023-07-29; **secondary**, price hint only |
| S15 | [Nomorobo: Business](https://www.nomorobo.com/business/) | vendor |
| S16 | [Nomorobo: Landline and VoIP protection](https://www.nomorobo.com/landline/) | vendor |
| S17 | [Twilio Voice pricing, US](https://www.twilio.com/en-us/voice/pricing/us) | "current as of August 2026" |
| S18 | [Twilio Lookup pricing](https://www.twilio.com/en-us/trusted-activation/pricing/lookup) | "current as of August 2026" |
| S19 | [Twilio: IncomingPhoneNumber resource](https://www.twilio.com/docs/phone-numbers/api/incomingphonenumber-resource) | modified 2026-05-04 |
| S20 | [Twilio: TwiML for Programmable Voice (request parameters)](https://www.twilio.com/docs/voice/twiml) | modified 2026-06-22 |
| S21 | [Twilio changelog: withheld caller ID behavior](https://www.twilio.com/en-us/changelog/changes-to-withheld-caller-id-behavior) | 2023-05-17 |
| S22 | [Twilio: TwiML `<Reject>`](https://www.twilio.com/docs/voice/twiml/reject) | modified 2026-06-22 |
| S23 | [Twilio: TwiML `<Gather>`](https://www.twilio.com/docs/voice/twiml/gather) | modified 2026-10-08 |
| S24 | [Twilio: Resolve call log and usage discrepancies](https://www.twilio.com/docs/voice/resolve-call-log-usage-discrepancies) | modified 2026-10-01 |
| S25 | [Twilio: Voice Integrity](https://www.twilio.com/docs/voice/spam-monitoring-with-voiceintegrity) | modified 2026-10-16 |
| S26 | [Twilio: Branded Calling](https://www.twilio.com/docs/voice/branded-calling) | modified 2026-08-24 |
| S27 | [Twilio: Lookup Line Type Intelligence](https://www.twilio.com/docs/lookup/v2-api/line-type-intelligence) | modified 2026-07-24 |
| S28 | [Twilio: Phone Numbers overview](https://www.twilio.com/docs/phone-numbers) | modified 2026-09-02 |
| S29 | [Prasad et al., "Who's Calling?", USENIX Security 2020](https://www.usenix.org/system/files/sec20-prasad.pdf) | peer reviewed |
| S30 | [Pandit et al., "Combating Robocalls with Phone Virtual Assistant Mediated Interaction", USENIX Security 2023](https://www.usenix.org/system/files/usenixsecurity23-pandit.pdf) | peer reviewed; lab and red-team study |
| S31 | [Pandit et al., "Towards Measuring the Effectiveness of Telephony Blacklists", NDSS 2018](https://www.ndss-symposium.org/wp-content/uploads/2018/02/ndss2018_04A-3_Pandit_paper.pdf) | peer reviewed; abstract read |
| S32 | [Shen et al., "The Machines Are Calling", arXiv 2609.11137](https://arxiv.org/html/2609.11137v1) | 2026-09; preprint; first 100k chars read |
| S33 | [Traister et al., "Anatomy of a Scam Call", arXiv 2608.24127](https://arxiv.org/html/2608.24127) | 2026-08; preprint |
| S34 | [Tu et al., "SoK: Everyone Hates Robocalls", IEEE S&P 2016](https://adamdoupe.com/publications/sok-everyone-hates-robocalls-oakland2016.md) | peer reviewed |
| S35 | [FTC: refunds to small business owners hit by Google-listing robocalls](https://www.ftc.gov/news-events/news/press-releases/2020/08/ftc-sends-refund-checks-totaling-more-700000-small-business-owners-defrauded-deceptive-robocalls) | 2020-08-18 |
| S36 | [Google Business Profile Help: automated calls and texts from Google](https://support.google.com/business/answer/7690269?hl=en) | undated |
| S37 | [Google Business Profile Help: protect against fraudulent calls](https://support.google.com/business/answer/6212928?hl=en) | undated |
| S38 | [Google Business Profile Help: verify your business](https://support.google.com/business/answer/7107242?hl=en) | undated |
| S39 | [Google Business Profile guidelines](https://support.google.com/business/answer/3038177?hl=en) | undated |
| S40 | [FTC: National Do Not Call Registry FAQs](https://consumer.ftc.gov/articles/national-do-not-call-registry-faqs) | |
| S41 | [FTC: new TSR protections for businesses (B2B)](https://www.ftc.gov/news-events/news/press-releases/2024/03/ftc-implements-new-protections-businesses-against-telemarketing-fraud-affirms-protections-against-ai) | 2024-03-07 |
| S42 | [FTC: Do Not Call reported calls data](https://www.ftc.gov/policy-notices/open-government/data-sets/do-not-call-data) | |
| S43 | [FTC: DNC reported calls data API](https://www.ftc.gov/developer/api/v0/endpoints/do-not-call-dnc-reported-calls-data-api) | |
| S44 | [YouMail Robocall Index](https://robocallindex.com/) | Sep 2026; vendor estimate |
| S45 | [Ooma: small-business robocall survey](https://www.ooma.ca/press-release/survey-finds-84-of-small-businesses-get-robocalls-every-day-at-an-average-cost-of-9-46-per-call/) | 2019-11-06; vendor-sponsored survey |
| S46 | [Apple Support: Manage unknown callers on iPhone](https://support.apple.com/en-us/111106) | |
| S47 | [ElevenLabs: Conversation flow (max duration, turn timeout)](https://elevenlabs.io/docs/eleven-agents/customization/conversation-flow) | |
| S48 | [ElevenLabs: End call system tool](https://elevenlabs.io/docs/eleven-agents/customization/tools/system-tools/end-call) | |
| S49 | [FTC consumer advice: Robocalls](https://consumer.ftc.gov/articles/robocalls) | |

Fetch failures: fcc.gov/call-authentication (403), Marchex investor pages (403), Twilio support and help
articles (403 or empty), Twilio public Marketplace pages (404). Add-on prices exist only in the logged-in Console.
