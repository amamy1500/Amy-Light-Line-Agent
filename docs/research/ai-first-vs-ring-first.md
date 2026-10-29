# AI-first or ring-first on the new line?

- Date: 2026-10-23. Every web claim was read today unless marked otherwise.
- Scope: the new dedicated number for The Christmas Light Guys. Mon–Sat 9–6 ring hours.
- Options compared:
  - **A. AI-first.** The AI answers every call. It transfers to Amy only on request.
  - **B. Ring-first.** Amy's cell rings with a press-1 screen. The AI answers if she doesn't.
- Status: research input. Not a decision record. B is what ADR 0003 and Amy's 2026-10-22 answers describe today.
- Read-only. No vendor or person was contacted.

| Label | Meaning |
|---|---|
| FACT | Read on a primary page today: regulator, peer-reviewed paper, analyst or government survey, vendor **docs**. URL given. |
| VENDOR CLAIM | A number from a company that sells phone, CX or AI products, about its own data or its own survey. Method noted when stated. |
| INFERENCE | Our reasoning from facts, or from our own code. Needs a test. |
| OPEN QUESTION | Not answerable from public sources, or a statistic we could not trace (marked **unverified**). |

---

## 0. Verdict

**Recommend a hybrid: "AI-first, Amy one sentence away" (call it A+).**

1. **The AI answers every call at once, all hours.** No ring before it. Spam never reaches Amy's phone. INFERENCE.
2. **Any caller who asks for Amy is transferred right away**, after at most their name. The greeting tells them they can ask. INFERENCE.
3. **In ring hours, the AI also offers Amy to real leads.** "Amy's in the office. Want me to try her now, or have her call you back?" Amy's own default (question 6) already allows this. INFERENCE; `docs/amy-open-questions.md`.
4. **Amy's phone must recognize the transfer.** Present the business number as caller ID and save it in her contacts. iPhone "Silence" or "Ask Reason for Calling" otherwise intercepts the ring. FACT (Apple) + INFERENCE (§3.3).
5. **Callbacks go out from the business number, fast.** Target minutes, not hours, in ring hours. INFERENCE from §1.

**Why not B.** It puts every spam call back on Amy's phone in ring hours. That is the problem that made her stop answering. It also makes every caller she misses hear about 23 s of ringing (up to ~38 s) before the AI. Then a ~20–26 s greeting. INFERENCE from FACTs in §3.

**Why not plain A.** Most callers will not ask for a person. Amy closes "~90% of qualified calls" (Amy-reported, ADR 0003). Surveys agree people want a human reachable. A+ keeps that reach without the ring delay. INFERENCE.

**Evidence strength: low to moderate.** No study compares AI-first with ring-first for small service businesses. The case rests on structural facts (Twilio timing, phone screening, spam), consistent but mostly vendor-funded surveys, and vendor defaults. Run the measurement in §6 for two to three weeks.

**This reverses an Amy-approved default** ("Ring Mon–Sat 9–6"). Amy decides. The code already supports A+ as a config change (`ai.mode: "always"` routes to the agent with reason `ai_first`; `lib/business-rules/routing.ts`). INFERENCE from code.

---

## 1. Callers, voicemail and speed-to-lead

### 1.1 What callers do when voicemail answers

| Claim | Label | Source and quality |
|---|---|---|
| 69% of callers answered by voicemail "declined to leave a message, and instead hung up". Survey of 300 micro businesses plus "10,000 businesses' call data". Page says it does not separate which source gave the 69%. | VENDOR CLAIM | [Moneypenny, 2016-11-21](https://moneypenny.com/us/resources/news/small-business-call-report/). Answering-service vendor. Page mixes "Britain's smallest businesses" with "US businesses". Old. |
| 411 Locals: 37.8% of calls reached a live person, 37.8% voicemail, 24.3% no response. 85 businesses, 58 industries, 30 days. | OPEN QUESTION (original not opened) | Secondary only, e.g. [Carly](https://www.usecarly.com/blog/missed-call-statistics/). Dated January 2016 by the best source. Often misdated to 2024. |
| Home-services callers reach a person on 52% of calls. 65% for calls over 15 s, 73% over 30 s. | VENDOR CLAIM | [Invoca 2026 Home Services Benchmarks](https://invoca.com/reports/the-invoca-home-services-lead-conversion-benchmarks-report-2026). Averages across Invoca customers, nine sub-industries, July 2026. |
| Home services missed 14% of calls (healthcare 32%, legal 28%). 1.1 million leads. | VENDOR CLAIM | CallRail release, 2025-01-14 ([BusinessWire](https://www.businesswire.com/news/home/20250114793850/en/CallRail-Releases-Report-Benchmarking-Marketing-Efforts-for-Small-Businesses); 403 on direct fetch, figures from search snapshot). |
| 31% of missed business calls get any callback. Nearly all within 24 h. 16.7 million missed calls, three months. | VENDOR CLAIM | [Quo blog](https://www.quo.com/blog/small-business-callback-statistics/). Measures businesses calling back, not callers. |
| 42% of consumers say they leave a voicemail; 78% have taken business elsewhere after an unanswered call. "1,000 US consumers, 2025". | OPEN QUESTION (unverified) | Only in roundups ([Carly](https://www.usecarly.com/blog/missed-call-statistics/), [JustCall](https://justcall.io/blog/voicemail-statistics-2026.html)). No CallRail page found. |

What this means for Amy (INFERENCE):

- Every source agrees: many callers who hit voicemail leave nothing. The size is uncertain (vendor data, 31–69% range in the documented figures).
- Amy's current "let it go to voicemail" habit loses an unknown share of callers who never leave a message. Both A and B fix this. The AI collects details instead.

### 1.2 Will the caller pick up Amy's callback?

| Claim | Label | Source |
|---|---|---|
| 19% of US adults generally answer calls from unknown numbers. 67% don't answer but check voicemail. 14% ignore voicemail too. Web survey of 10,211 adults, July 13–19, 2020. | FACT | [Pew Research Center, 2020-12-14](https://www.pewresearch.org/short-reads/2020/12/14/most-americans-dont-answer-cellphone-calls-from-unknown-numbers/) |
| 14% "immediately answer" unrecognized numbers; 28% reject; 41% wait to see if a voicemail is left. 12,000+ consumers, six countries. 73% say businesses should identify themselves with caller ID. | VENDOR CLAIM | [Hiya blog, 2026-04-14](https://blog.hiya.com/eroding-trust-is-crippling-the-voice-channel?hsLang=en). Call-protection vendor; no fieldwork dates on that page. |
| US respondents get 9.9 unwanted calls a week, growing 16% a year since 2023. | VENDOR CLAIM | [Hiya State of the Call 2026 release, 2026-03-02](https://www.hiya.com/newsroom/press-releases/state-of-the-call-2026-ai-deepfake-voice-calls-hit-1-in-4-americans-as-consumers-say-scammers-are-beating-mobile-network-operators-2-to-1) |

INFERENCE: a callback from Amy's personal cell is an unknown number to the caller. Most people will not pick up. A callback from the **same number they just dialed** is recognizable. This favors callbacks from the business line in every option.

### 1.3 Speed-to-lead: what the studies actually show

**InsideSales.com / "MIT" Lead Response Management study (2007).** FACT, from the study's own summary page ([copy hosted by Mortech](https://www.mortech.com/hs-fs/hub/25649/file-13535879-pdf/docs/mit_study.pdf), page captured 2008-07-17):

- Presented by Dave Elkington (InsideSales.com CEO) and James Oldroyd (then at MIT Sloan). MarketingSherpa B2B summit, 2007-10-16.
- Data: InsideSales.com's own system. Six companies, three years, 15,000+ web-form leads, 100,000+ call attempts.
- Headline: the odds of contacting a lead called in 5 minutes vs 30 minutes "drop 100 times". Odds of qualifying "drop 21 times". Odds of contact fall "over 10 times in the 1st hour".
- The study says itself: "This study did not address close ratios."
- Caveats (INFERENCE): vendor data analysed with one academic; conference talk, not peer-reviewed. Leads were **web forms**, not inbound phone calls. "Contact" and "qualified" were defined differently per company. Often miscredited as an MIT study.

**HBR, "The Short Life of Online Sales Leads" (Oldroyd, McElheran, Elkington, March 2011).** Citation FACT ([BYU ScholarsArchive](https://scholarsarchive.byu.edu/facpub/9711)). Numbers quoted via [SmartCompany, 2011](https://www.smartcompany.com.au/marketing/20110704-are-you-letting-online-leads-go-cold/) because HBR is paywalled:

- Audit of 2,241 US companies with a test web lead: 37% replied within an hour; 23% never replied. Average among responders: 42 hours.
- Separate dataset: 1.25 million leads at 42 companies (29 B2C, 13 B2B). Contacting within an hour made firms "nearly seven times as likely to qualify the lead" as an hour later. Over 60 times as likely as waiting 24 hours or more.
- Same caveat: web leads, observational, a co-author ran the vendor.

**Later "replications".**

- XANT (InsideSales renamed), 2021: 5.7 million inbound leads, 400+ companies. Only 0.1% answered within 5 minutes. Five-minute responders had "8X" conversion. VENDOR CLAIM, via [GZ Consulting summary](https://gzconsulting.org/2021/03/03/xant-inbound-lead-response-rates/); XANT's own page not opened.
- No peer-reviewed independent replication found in this search. OPEN QUESTION.
- Invoca 2026 buyer survey: 56% expect a reply within an hour of a form; 36% get one. 79% would switch to a faster competitor. 693 US consumers, May 8–22, 2026. VENDOR CLAIM ([Invoca blog](https://www.invoca.com/blog/ai-in-customer-experience-what-buyers-told-us); [press release](https://www.customerexperiencedive.com/press-release/20260609-new-invoca-study-finds-consumers-wont-wait-ai-gives-brands-the-speed-to-w/)).
- Home-services response-time data: none with a method. Thumbtack staff advise replying "within the first few minutes" but cite no dataset. OPEN QUESTION.

What transfers to Amy (INFERENCE):

- **Direction is solid. Magnitude is not.** Faster first contact raises the chance of talking to the lead. The 100x and 21x figures are odds from vendor web-lead data. Do not quote them as phone-call conversion.
- For this business the "lead response" is Amy's callback. The win is turning a voicemail she hears hours later into a text summary she can act on in minutes. Both A and B deliver that for callers she misses.
- A live answer is the fastest response of all. That is B's real advantage, but only on the calls Amy actually takes.

### 1.4 Statistics that failed tracing

| Statistic | Status |
|---|---|
| "80% of callers sent to voicemail don't leave a message" | **Unverified.** Earliest trace: a 2014 CRM magazine column crediting "Forbes" with no study ([destinationCRM](https://www.destinationcrm.com/Articles/CRM-Insights/Insight/Business-Voicemail-Goes-Unanswered-100080.aspx)). |
| "85% of people whose calls aren't answered won't call back" | **Unverified.** Appears in a CallRail release and many blogs with no study. |
| "Missed calls cost small businesses $126,000 a year" | **Unverified.** Cited page is gone; CallRail's blog repeats it citing a marketing site. |
| "78% buy from the first business to respond" | **Unverified.** No publication, date or sample found. |
| "62% of calls to small businesses go unanswered" | Real but old: 411 Locals, January 2016, counts voicemail as unanswered. Not a current benchmark. |

Source for the trace work: [Carly missed-call statistics](https://www.usecarly.com/blog/missed-call-statistics/) (itself a vendor page; we re-checked what we could).

---

## 2. Will callers accept an AI on the phone? (2025–2026)

### 2.1 Surveys

| Finding | Label | Source, method |
|---|---|---|
| 87% say companies using GenAI must offer access to a human. 50% say GenAI makes interactions easier. Gartner advises it "should not" be a mandatory first step; the top thing that would make reluctant customers use AI is "the ability to switch to a human agent if needed". | FACT (analyst survey) | Gartner, 2026-08-04; 3,566 B2B and B2C customers, Feb–Mar 2026. [Gartner release](https://www.gartner.com/en/newsroom/press-releases/2026-08-04-gartner-survey-finds-87-percent-of-customers-say-companies-using-genai-for-customer-service-must-provide-access-to-a-human-agent0) (403 on fetch); read via [Insurance-Canada](https://insurance-canada.ca/?p=86496). |
| 64% would prefer companies not use AI for service. 53% would consider switching. Top worry (60%): AI makes it harder to reach a person. | FACT (analyst survey) | Gartner, 2024-07-09; 5,728 customers, Dec 2023. [Gartner release](https://www.gartner.com/en/newsroom/press-releases/2024-07-09-gartner-survey-finds-64-percent-of-customers-would-prefer-that-companies-didnt-use-ai-for-customer-service) (403; figures via search snapshot and [Insurance-Canada](https://insurance-canada.ca/2024/07/15/gartner-survey-ai-for-customer-service/)). |
| Trust that AI resolves the issue: 26% with no human option, 55% when one is reachable. 92% give AI under 10 minutes before asking for a person. 71% say knowing it's AI matters. | VENDOR CLAIM | Five9 2026 Consumer CX Report; 3,000 consumers US/UK/DE, Hanover Research, April 2026. [Release via Finviz](https://finviz.com/news/402484/new-five9-research-reveals-consumers-embrace-ai-in-customer-service-but-trust-still-depends-on-having-a-person-within-reach) |
| 88% satisfied with human-handled interactions vs 60% AI-driven. Top annoyance (47%): can't reach a live human. | VENDOR CLAIM | Verizon CX Annual Insights; 5,000 consumers, 7 countries, Longitude, Oct–Nov 2024. [Verizon](https://www.verizon.com/about/news/ai-and-human-first-customer-experience) |
| 84.9% prefer a human agent; 80.1% even if both would resolve it. Those 45+ least accepting. | FACT (analyst survey) | Metrigy, 2026-02-18; 503 US/Canada adults, Nov 2025. [Metrigy](https://www.metrigy.com/press-release-metrigy-study-85-of-consumers-prefer-interacting-with-humans-vs-ai-agents-for-customer-service/) |
| 59% prefer a human when both are equally available. 83% say it matters that AI identifies itself. AI made things worse for 18% (29% in 2025). Calling is the top support channel (41%). | VENDOR CLAIM | Invoca B2C Buyer Experience 2026; ~700 US consumers. [Invoca](https://www.invoca.com/blog/ai-in-customer-experience-what-buyers-told-us) |
| 31% "would hang up immediately if connected to an AI agent"; 38% "it depends"; 31% would continue. 79% would pick a business with a human receptionist. | VENDOR CLAIM | OnePoll for a human-answering firm (AnswerConnect-linked); 6,000 people; dates and countries not stated. [Yahoo Finance](https://finance.yahoo.com/sectors/technology/articles/global-survey-reveals-brutal-truth-180000515.html). Weak method. |
| 69% prefer a human. In a test, 90% failed to identify AI voice clips. | VENDOR CLAIM | Twilio, Nov 2025; method not reported. [CX Dive](https://www.customerexperiencedive.com/news/consumers-cant-tell-the-difference-between-humans-and-ai/806709/) |
| "59.1% will give an AI voice agent time if they can reach a human." | OPEN QUESTION (unverified) | Attributed to Metrigy Q1 2026 in [Carly](https://www.usecarly.com/blog/missed-call-statistics/). No Metrigy page found. |

Reading (INFERENCE):

- Stated preference is clearly for humans. Stated tolerance of AI rises sharply when a human is **visibly reachable**. Five9 roughly doubles trust (26% → 55%); Gartner's top unlock is the switch to a human.
- These are stated attitudes about customer **service**. None measures a homeowner calling a lighting company for a quote. Most are vendor-funded.

### 2.2 Does saying "I'm an AI" make people hang up?

| Evidence | Label | Notes |
|---|---|---|
| Field experiment, 6,200+ customers, outbound sales calls randomly given to chatbots or humans. Undisclosed bots sold as well as proficient workers. Disclosing the bot **before** the conversation cut purchases by more than 79.7% and shortened calls. Late disclosure and prior AI experience softened it. | FACT (peer-reviewed RCT) | Luo, Tong, Fang, Qu, *Marketing Science* 38(6), 2019. [IDEAS/RePEc](https://ideas.repec.org/a/inm/ormksc/v38y2019i6p937-947.html), DOI 10.1287/mksc.2019.1192 |
| Inbound AI receptionists, 450,702 calls, 503 receptionists. Saying the caller reached an AI: ~20% **lower** hang-up odds. Mentioning recording: ~30% lower. Greetings that **lead with the owner being unavailable**: ~50% higher hang-up odds. Setup explains only ~13% of between-business variance; most early hang-ups were silent junk calls. Observational. | VENDOR CLAIM | [Upfirst, updated 2026-06-16](https://upfirst.ai/blog/ai-receptionist-hang-ups). Logistic regression; association, not cause. |
| Outbound cold calls opening with a 20–30 s AI disclosure: 88–90% intro hang-ups across three voices. No control arm. | VENDOR CLAIM | [Rime](https://www.rime.ai/resources/which-ai-voice-keeps-people-on-the-phone). Cold outbound; not comparable. |

Reading (INFERENCE):

- Luo is the only randomized evidence. It is **outbound sales** to people who did not call. Our callers dialed us with intent. The penalty should be smaller, but no study measures it.
- Upfirst is the only **inbound** data. It points the other way: disclosure is not linked to more hang-ups.
- Disclosure is not optional for us anyway (`docs/research/legal-compliance.md` §4). So the question is **not** whether to disclose. It is what the caller hears first and how fast they can reach Amy.

### 2.3 Older callers

| Evidence | Label | Source |
|---|---|---|
| Share more concerned than excited about AI: 18–29: 55%, 30–49: 51%, 50–64: 47%, 65+: 59%. 3,488 adults, June 22–28, 2026. | FACT | [Pew Research, 2026-08-18](https://www.pewresearch.org/short-reads/2026/08/18/young-adults-in-the-us-are-increasingly-wary-of-ai-concerned-it-will-take-jobs.md) |
| 1 in 10 Gen Z say AI has no service benefit vs 55% of the Silent Generation. | VENDOR CLAIM | Five9 2026 (release above) |
| Trust in AI with no human option: 16% of boomers, 5% of the Silent Generation. "Repeatedly misunderstood me" as the reason to leave AI: Gen Z 38%, boomers 59%, Silent 62%. | VENDOR CLAIM | Five9 2026 as reported by [CMSWire, 2026-10-14](https://www.cmswire.com/contact-center/contact-center-leaders-you-have-10-minutes/). Not in the release we read. |
| Calling is the top channel for 52% of boomers vs 30% of Gen Z. | VENDOR CLAIM | Invoca 2026 (above) |
| 8 in 10 adults 50+ would consider leaving a company that traps them in automation without a human. 482 respondents from the vendor's own customer lists. | VENDOR CLAIM | Consumer Cellular via [Telecom Reseller, 2026-10-20](https://telecomreseller.com/2026/10/20/consumer-survey-finds-ai-support-can-drive-customers-away). Biased sample. |
| Gen X and boomers were about twice as accurate as younger people at spotting AI voices (still poor; best group 14%). | VENDOR CLAIM | Twilio via CX Dive (above) |

Reading (INFERENCE):

- Older callers lean more on the phone and trust AI less **when no human is reachable**. Concern about AI is now high at every age (Pew).
- Holiday-lighting buyers plausibly skew to established homeowners. We have no age data for Amy's callers. OPEN QUESTION.
- The age evidence argues for an easy, early path to Amy. It does not by itself argue for making every caller wait for her phone.

### 2.4 Direct evidence on AI-first vs human-first

- **None found** for small service businesses. No trial, no vendor A/B. OPEN QUESTION.
- Closest: a *Management Science* randomized field experiment in a meal-delivery chat service routed customers chatbot-first, then to humans. Chatbot comprehension failures soured sentiment toward the later human help. [INFORMS](https://pubsonline.informs.org/doi/10.1287/mnsc.2022.03920) (403 on fetch; summary from search snapshot). FACT (existence and setting); details unverified.
- Gartner's 2026 advice (§2.1) is the nearest guidance: AI first is acceptable only with an easy switch to a human. FACT (advice), INFERENCE (application).

---

## 3. Practical downsides for this business

### 3.1 What the caller hears, second by second

Built from our code and Twilio docs. INFERENCE unless marked.

| Path | Ringing before anyone answers | Then | Caller first asked anything |
|---|---|---|---|
| **A / A+**, any time | ~1–3 s (agent connect; 4 s budget then capture, ADR 0003) | 64-word greeting, ~20–26 s at 150–190 wpm, not interruptible (`disableFirstMessageInterruptions: true`) | **~22–30 s** |
| **B**, Amy takes it | ~5–15 s (she answers, hears a ~3 s whisper, presses 1) | Amy, live | **~8–18 s** (best case of all paths) |
| **B**, Amy lets it ring | 18 s configured (`amy-open-questions.md`; DB default 20 s) **+ 5 s Twilio buffer = ~23–25 s** | Same greeting, which says "Amy is tied up right now" | **~45–55 s** |
| **B**, her phone/voicemail/screener picks up the leg first | t + ~15 s (whisper twice + 1 s pause + 8 s keypress wait, `screenTwiml`) | Same greeting | **~38–65 s** (t ≈ 0 with iPhone "Silence"; t ≈ 20 s with a typical voicemail timer) |
| **A**, caller asks for Amy | Greeting first, then "Let me try Amy", then up to ~23–25 s ringing her | Amy, or back to the AI with "I've kept everything you told me" | Amy at **~35–60 s** if she answers |

Facts behind the table:

- Twilio `<Dial>` timeout: default 30 s, minimum 5 s. "Twilio always adds a five-second timeout buffer to your `<Dial>`." FACT ([Twilio Dial](https://www.twilio.com/docs/voice/twiml/dial)).
- With `answerOnBridge`, the caller keeps hearing ringing while the TwiML on Amy's leg runs. FACT ([Twilio Client noun](https://www.twilio.com/docs/voice/client/twiml), via search snapshot). Our `ringOwnerTwiml` sets `answerOnBridge: true`. FACT (code).
- Greeting text: "Hi, thanks for calling The Christmas Light Guys. I'm Amy's AI assistant, an automated system, not a person. This call is recorded and transcribed, and our AI service providers process it to help us respond. If you'd rather not be recorded, just say so. Amy is tied up right now, but I can get everything started for you. What can I help you with?" 64 words. FACT (`lib/agents/policy.ts`, `scripts/simulate-calls.ts`). Duration is INFERENCE.
- Carrier voicemail timers vary. T-Mobile lets users set 5–30 s. FACT ([T-Mobile community, staff reply](https://t-mobile.com/community/discussions/accounts-services/how-to-change-number-of-rings-before-goes-to-voicemail/16506/replies/16509)). Amy's carrier and timer: OPEN QUESTION.

### 3.2 The ring-delay cost of B (~20 s+)

There is **no rigorous study** of how long callers let a phone ring before hanging up. OPEN QUESTION. Proxies:

| Proxy | Label | Source |
|---|---|---|
| FCC: telemarketers may not hang up an unanswered call before "at least 15 seconds or four (4) rings". The regulator's floor for giving a person time to reach the phone. | FACT | [47 CFR 64.1200(a)(6)](https://www.law.cornell.edu/cfr/text/47/64.1200) |
| Ruby (human receptionists) recommends overflow forwarding of "no more than 1-2 rings", so callers don't wait. | FACT (vendor docs) | [Ruby help, 2025-01-15](https://rubyhelpcenter.helpjuice.com/call-forwarding/call-forward-busy-no-answer) |
| Signpost: "conditional forwarding does not allow all of your calls to be answered within 2 rings"; recommends unconditional forwarding. | FACT (vendor docs) | [Signpost help](https://help.signpost.com/can-you-answer-only-a-specific-number-of-calls-or-specific-types-of-calls) |
| Contact-center patents state callers "can be expected to wait at least four ring cycles" before abandoning; a US ring cycle is 6 s (~24 s). Boilerplate, not a measurement. | OPEN QUESTION (search snippet; patents not opened) | USPTO family incl. [9560210](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/9560210), [10277745](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/10277745) |
| "80/20" (80% answered in 20 s) is the default contact-center service level. Its origin is undocumented; sources call it arbitrary. | OPEN QUESTION | e.g. [Verint](https://www.verint.com/blog/managers-guide-to-call-center-service-levels/) |
| Invoca's answer rate rises from 52% (all calls) to 65% (>15 s) and 73% (>30 s): many short calls end unanswered. | VENDOR CLAIM | Invoca 2026 (above) |

INFERENCE on the cost:

- ~23–25 s is about four US ring cycles. It is right where callers expect voicemail.
- Callers who hang up when they expect voicemail are the same people §1.1 says won't leave a message. Under B they are lost **before** the AI speaks. Our system still logs an `abandoned` lead with caller ID (`docs/architecture.md`), so Amy gets a number, not details.
- Then the greeting adds ~20–26 s, and it tells them Amy is unavailable. Upfirst links owner-unavailable openings with ~50% higher hang-up odds (VENDOR CLAIM). Ours is not the opening phrase, so the effect may be smaller.
- Shortening B's ring cannot go far. Below ~15 s (≈10 s setting + 5 s buffer) Amy rarely reaches her phone, and ring-first loses its point (FCC floor above).

### 3.3 Option B downsides

1. **Spam returns to Amy's phone in ring hours.** The whisper names the business, not the caller's intent. Amy must answer to find out. That is why she stopped answering. INFERENCE from the brief.
   - Spam share on business lines: 8.2% (2026) or 45.8% "not leads (spam, wrong number, personal)" (2025, 1.45 million calls, 2,074 businesses). VENDOR CLAIM ([NextPhone](https://www.getnextphone.com/blog/ai-receptionist-statistics)). Definitions differ; treat as a wide range.
   - US robocalls: ~4.35 billion in July 2026; telemarketing and suspected scams 49%. VENDOR CLAIM (YouMail, via [search snapshot of coverage](https://www.consumeraffairs.com/news/us-robocall-volume-reaches-one-year-high-in-july-080726.html)).
   - A new number starts clean. Once it is on the website, Google profile and ads, scrapers and sales callers find it. INFERENCE. How fast: OPEN QUESTION.
   - Pre-filters help only with robocalls. STIR/SHAKEN `StirVerstat` is on our webhook (FACT, `telephony-receive-options.md`). Twilio's Nomorobo/Marchex add-on tutorials exist ([Twilio blog](https://www.twilio.com/en-us/blog/developers/tutorials/product/block-spam-calls-twilio-voice-node-js)); current availability is OPEN QUESTION. Live SEO and merchant-services sellers pass all of these. INFERENCE.
2. **The likely end state is the worst of both.** If spam rings Amy, she ignores rings again. Then every caller waits ~23 s and gets the AI anyway. INFERENCE.
3. **Amy's phone may intercept the ring.** Our `<Dial>` sets no `callerId`, so Amy sees the caller's own number (Twilio default; `bestline-metaswitch.md` §4). FACT (code).
   - iPhone "Screen Unknown Callers" for numbers not in contacts: "Silence" "silences these calls and sends them to voicemail"; "Ask Reason for Calling" screens them before the phone rings. FACT ([Apple](https://support.apple.com/en-us/111106)).
   - A spam-weary owner may well have one of these on. OPEN QUESTION (ask Amy).
   - Either setting answers our leg with a machine. The press-1 screen then times out: ~15 s more ringing, and Amy may never see the call. INFERENCE from the two FACTs.
   - Rosie (AI receptionist) tells customers it "works best when your iPhone isn't trying to screen or answer calls on its own". FACT (vendor docs, [Rosie](https://heyrosie.com/support/en/articles/11058354-get-rosie-to-answer-your-calls-set-up-call-forwarding)).
4. **Amy's time and focus.** Every answered call is a live conversation, at the moment it arrives. Peak season (Oct–Dec) is when she is busiest and least able to answer. INFERENCE. She plans a hire after Jan 1 (`amy-open-questions.md`).
5. **Trust after a long ring.** The caller reaches an AI after waiting for a human, and is told the human is busy. No direct data. INFERENCE.

### 3.4 Option A downsides

1. **Fewer live conversations with Amy.** Only callers who ask get her. Most won't ask. Amy is the closer (~90% of qualified calls, Amy-reported). INFERENCE.
2. **Callback phone tag.** Pew and Hiya say most people don't answer unknown numbers (§1.2). Calling back from her cell makes this worse. INFERENCE.
3. **Hot leads may shop on.** A homeowner calling three lighting companies may book whoever talks to them live first. Invoca: 79% say they'd switch to a faster competitor (VENDOR CLAIM). No home-services data. OPEN QUESTION.
4. **Some callers refuse AI.** Stated rates: 31% "would hang up immediately" (weak vendor survey); Upfirst sees no disclosure penalty inbound. Real rate for our callers: OPEN QUESTION.
5. **Reaching Amy is slow under plain A.** ~35–60 s (§3.1), and the greeting cannot be interrupted. INFERENCE.
6. **Cost.** Every ring-hours call now uses agent minutes, spam included. $22 plan has 275 min, then $0.08/min (ADR 0003). Monthly impact depends on call volume. OPEN QUESTION. Spam calls should be short (agent ends with `not_a_lead`). INFERENCE.
7. **Single dependency.** If the AI vendor fails, `always` mode already falls back to ringing Amy in hours, else capture (`routeInbound`). FACT (code). So the floor is unchanged.

### 3.5 Side by side

| Factor | A (AI-first, transfer on request) | B (ring-first, ~18 s) | A+ (recommended) |
|---|---|---|---|
| Spam reaching Amy | None | All spam in ring hours | None |
| Amy's interruptions | Only callers who ask | Every call in hours | Callers who ask + real leads who accept |
| Caller wait before a voice | ~1–3 s | ~23–25 s (to ~38 s) when missed | ~1–3 s |
| Fastest path to Amy | ~35–60 s | ~8–18 s | ~35–60 s; shorter with a trimmed greeting |
| Hot lead who wants Amy now | Only if they ask | Yes, if she answers | Offered |
| Hot lead who hangs up on the ring | n/a | Lost; caller ID only | n/a |
| Phone screening on Amy's iPhone | Hits transfers only | Hits every call | Fixed by business caller ID |
| Agent minutes | All calls | Missed calls only | All calls |
| Code change | Config (`ai.mode: "always"`) | None (built) | Config + greeting + transfer offer + `callerId` |

---

## 4. What comparable services do

| Service | Type | Routing it documents | Label |
|---|---|---|---|
| Ruby | Human virtual receptionists | Forward all calls, or delayed (overflow) forwarding. Recommends "no more than 1-2 rings" first. | FACT ([Ruby](https://rubyhelpcenter.helpjuice.com/call-forwarding/call-forward-busy-no-answer)) |
| Signpost | Answering (human/AI) | Recommends unconditional forwarding to answer within 2 rings. | FACT ([Signpost](https://help.signpost.com/can-you-answer-only-a-specific-number-of-calls-or-specific-types-of-calls)) |
| Smith.ai | AI + human receptionists | Carrier guides for both no-answer (*71 etc.) and forward-all. Integrations offer all, conditional, or failover. No stated default. | FACT ([Smith.ai docs](https://docs.smith.ai/article/fzjhrar7xd-article-4-how-to-forward-calls-from-your-mobile-phone-conditional-call-forwarding)) |
| Jobber Receptionist | AI, home-services software | "Answers every call to your dedicated phone number." Owners forward an existing line via the carrier (after rings or after hours). Optional ~10 s "about two rings" answering delay. Escalation triggers transfer "immediately". Disclosure "encouraged", not required. | FACT ([Jobber help](https://help.getjobber.com/en/articles/receptionistpowered-by-jobber-ai/)) |
| Quo (OpenPhone) Sona | AI on a business phone system | A step in the call flow: after "Ring users" (missed calls), after a menu, or after an hours check. Greeting should say it's AI. | FACT ([Quo docs](https://support.quo.com/core-concepts/ai-automations/sona-ai-agent.md)) |
| Goodcall | AI receptionist | "Have it answer every call, or only the ones you miss." Transfers "when a caller asks for someone". | FACT ([Goodcall](https://goodcall.com/how-it-works)) |
| Rosie | AI receptionist, home services | Unconditional or conditional forwarding; no recommendation. Turn off iPhone screening/Live Voicemail. | FACT ([Rosie](https://heyrosie.com/support/en/articles/11058354-get-rosie-to-answer-your-calls-set-up-call-forwarding)) |
| CallRail Voice Assist | AI add-on to call tracking | Pitched for after hours "or when your team is focused on other customers". | VENDOR CLAIM ([BusinessWire](https://www.businesswire.com/news/home/20250401257635/en/CallRail-Debuts-Voice-Assist-the-AI-Assistant-that-Handles-Leads-247)) |

Pattern (INFERENCE):

- **Human answering services optimize for answer speed.** All calls, or one to two rings at most. None recommends ~20 s.
- **AI products offer both modes.** "Missed calls only" exists for owners who keep their existing number and want to keep answering. On a **dedicated** AI number, Jobber's documented behavior is to answer every call. That is the closest match to Amy's new line.
- **No vendor publishes outcome data comparing the modes.** OPEN QUESTION.

---

## 5. Recommendation in detail

**A+ — AI-first, Amy one sentence away.**

| # | Change | Why | Label |
|---|---|---|---|
| 1 | Set CLG's `ai.mode` to `"always"`. Keep ring hours for transfers only. | No ring delay; no spam on Amy's phone; falls back to ringing Amy if the AI is down. | INFERENCE; code FACT |
| 2 | Put "say 'Amy' any time and I'll try her" right after the disclosure. Let counsel trim the rest. 64 words is long. | Visible human access is the strongest lever in every survey (Gartner, Five9, Verizon). | INFERENCE from FACT/VENDOR CLAIM |
| 3 | On request: transfer after at most the caller's name. | Don't make a human-seeker answer quote questions first. Gartner: forced AI steps reduce reuse. | INFERENCE |
| 4 | In ring hours, offer Amy to real leads once the basics are in ("try her now, or a callback?"). Once per call. | Recovers B's live-close advantage for leads, not spam. Matches Amy's question-6 default. | INFERENCE |
| 5 | Set `<Dial callerId>` on the transfer leg to the business number. Amy saves it as a contact ("CLG live caller"). | Apple screens only numbers not in contacts, so a saved number rings through. The whisper still carries the caller's summary. | INFERENCE from Apple FACT |
| 6 | Callbacks from the business number, not her cell; text first once A2P 10DLC is live. Target ≤15 min in ring hours. | Recognized number; speed-to-lead direction (§1.3). | INFERENCE |
| 7 | Measure for 2–3 weeks (§6). | No direct evidence exists. Our own data decides. | — |

**When B would be the better choice (INFERENCE).** B wins if Amy reliably takes a large share of ring-hours calls and spam stays low. Rough break-even, all inputs unknown: B beats A+ when *p* × (live close − callback close) > (1 − *p*) × *h* × callback close. *p* = share Amy answers; *h* = extra hang-ups caused by the ring. Example: live 90%, callback 70%, *h* = 10% → B wins only if Amy answers more than ~26% of calls. But spam pushes *p* down over time, and A+ recovers part of the live gain through offered transfers. So measure *p* before choosing B.

**If Amy still wants ring-first (B′),** at minimum:

- Business number as caller ID on her ring, saved in contacts (item 5).
- Ring setting ~12–13 s (≈17–18 s with the Twilio buffer), not 18–20 s.
- Ask her to confirm her phone's screening and voicemail timer.
- Rework the missed-call greeting so it doesn't open on her absence. Upfirst's association (VENDOR CLAIM).
- Accept that spam will ring her. No pre-filter catches live sales callers.

**Optional later:** ring-first only for returning customers (caller ID matches a past lead). Real leads, no spam. Needs the returning-caller lookup. INFERENCE.

### Evidence strength

| Claim | Strength | Basis |
|---|---|---|
| Spam must not ring Amy | Moderate | Amy's own behavior on the old line; vendor spam shares |
| B's ring makes missed callers wait ~23–38 s | Strong | Twilio docs + our code |
| That wait loses callers | Weak | Proxies only; no ring-patience study |
| An easy path to a human matters | Moderate | Consistent across Gartner 2024/2026, Five9, Verizon, Metrigy; mostly stated attitudes, mostly vendor-funded |
| AI disclosure costs inbound hang-ups | Mixed | RCT is outbound sales (−79.7%); inbound vendor data shows no penalty |
| Faster callbacks raise contact | Moderate direction, weak size | 2007 vendor study, 2011 HBR, 2021 vendor; web leads, not calls |
| AI-first beats ring-first for small service firms | None | No study found |

---

## 6. Measurement and open questions

### 6.1 What to measure (2–3 weeks)

| Metric | Why |
|---|---|
| Hang-ups before the caller first speaks, by path | Direct test of greeting and ring delay |
| Share of callers who ask for Amy; share who accept the offer | Sizes demand for a live human |
| Transfer answer rate and seconds to answer | Is Amy reachable in ring hours? |
| Minutes from call end to Amy's first callback; callback connect rate | Speed-to-lead and phone tag |
| Close rate: live transfer vs callback | The number B's case rests on |
| Spam/not-a-lead calls per day on the new number, over time | Tracks how fast spam finds it |

Low volume limits statistics. Look for large effects only. A clean A/B (alternate days, or hash of `CallSid`) is possible in code; run it only if Amy agrees. INFERENCE.

### 6.2 Open questions

| # | For | Question |
|---|---|---|
| 1 | Amy | Does your iPhone use "Silence" or "Ask Reason for Calling" for unknown callers? Live Voicemail? Carrier voicemail timer? |
| 2 | Amy | In season, how often can you take a call within ~15 s during 9–6? |
| 3 | Amy | Are you OK with the AI answering first if callers can reach you by saying your name? |
| 4 | Amy | Rough calls per day in Nov–Dec, and share that were spam on the old line? |
| 5 | Counsel | Can the disclosure be shorter, and can the "say Amy" line come right after it? |
| 6 | Us | Does `<Dial callerId>` with the business number keep the whisper and caller context intact? (Test call.) |
| 7 | Twilio | Are the Nomorobo/Marchex spam add-ons still offered for inbound voice? |
| 8 | Research | Any peer-reviewed lead-response replication, or ring-patience study? None found today. |

---

## 7. Sources (all opened or searched 2026-10-23)

Primary or peer-reviewed:
- InsideSales.com/Oldroyd LRM study summary (2007), [Mortech copy](https://www.mortech.com/hs-fs/hub/25649/file-13535879-pdf/docs/mit_study.pdf)
- Oldroyd, McElheran, Elkington, HBR 2011, [BYU ScholarsArchive](https://scholarsarchive.byu.edu/facpub/9711); figures via [SmartCompany](https://www.smartcompany.com.au/marketing/20110704-are-you-letting-online-leads-go-cold/)
- Luo et al., *Marketing Science* 2019, [IDEAS/RePEc](https://ideas.repec.org/a/inm/ormksc/v38y2019i6p937-947.html)
- Pew 2020 unknown callers, [pewresearch.org](https://www.pewresearch.org/short-reads/2020/12/14/most-americans-dont-answer-cellphone-calls-from-unknown-numbers/); Pew 2026 AI concern by age, [pewresearch.org](https://www.pewresearch.org/short-reads/2026/08/18/young-adults-in-the-us-are-increasingly-wary-of-ai-concerned-it-will-take-jobs.md)
- 47 CFR 64.1200(a)(6), [Cornell LII](https://www.law.cornell.edu/cfr/text/47/64.1200)
- Apple, Manage unknown callers, [support.apple.com](https://support.apple.com/en-us/111106)
- Twilio `<Dial>`, [twilio.com](https://www.twilio.com/docs/voice/twiml/dial)

Analyst surveys:
- Gartner 2024 ([release](https://www.gartner.com/en/newsroom/press-releases/2024-07-09-gartner-survey-finds-64-percent-of-customers-would-prefer-that-companies-didnt-use-ai-for-customer-service)) and 2026 ([release](https://www.gartner.com/en/newsroom/press-releases/2026-08-04-gartner-survey-finds-87-percent-of-customers-say-companies-using-genai-for-customer-service-must-provide-access-to-a-human-agent0), [Insurance-Canada](https://insurance-canada.ca/?p=86496))
- Metrigy 2026, [metrigy.com](https://www.metrigy.com/press-release-metrigy-study-85-of-consumers-prefer-interacting-with-humans-vs-ai-agents-for-customer-service/)

Vendor data and surveys:
- Invoca home services 2026, [invoca.com](https://invoca.com/reports/the-invoca-home-services-lead-conversion-benchmarks-report-2026); Invoca buyers 2026, [invoca.com](https://www.invoca.com/blog/ai-in-customer-experience-what-buyers-told-us)
- Five9 2026, [Finviz](https://finviz.com/news/402484/new-five9-research-reveals-consumers-embrace-ai-in-customer-service-but-trust-still-depends-on-having-a-person-within-reach), [CMSWire](https://www.cmswire.com/contact-center/contact-center-leaders-you-have-10-minutes/)
- Verizon CX 2025, [verizon.com](https://www.verizon.com/about/news/ai-and-human-first-customer-experience)
- Hiya 2026, [release](https://www.hiya.com/newsroom/press-releases/state-of-the-call-2026-ai-deepfake-voice-calls-hit-1-in-4-americans-as-consumers-say-scammers-are-beating-mobile-network-operators-2-to-1), [blog](https://blog.hiya.com/eroding-trust-is-crippling-the-voice-channel?hsLang=en)
- Upfirst hang-up study, [upfirst.ai](https://upfirst.ai/blog/ai-receptionist-hang-ups); NextPhone, [getnextphone.com](https://www.getnextphone.com/blog/ai-receptionist-statistics); Rime, [rime.ai](https://www.rime.ai/resources/which-ai-voice-keeps-people-on-the-phone)
- Moneypenny 2016, [moneypenny.com](https://moneypenny.com/us/resources/news/small-business-call-report/); Quo, [quo.com](https://www.quo.com/blog/small-business-callback-statistics/); CallRail 2025, [BusinessWire](https://www.businesswire.com/news/home/20250114793850/en/CallRail-Releases-Report-Benchmarking-Marketing-Efforts-for-Small-Businesses)
- XANT 2021 via [GZ Consulting](https://gzconsulting.org/2021/03/03/xant-inbound-lead-response-rates/)
- OnePoll/AnswerConnect via [Yahoo Finance](https://finance.yahoo.com/sectors/technology/articles/global-survey-reveals-brutal-truth-180000515.html); Consumer Cellular via [Telecom Reseller](https://telecomreseller.com/2026/10/20/consumer-survey-finds-ai-support-can-drive-customers-away); Twilio via [CX Dive](https://www.customerexperiencedive.com/news/consumers-cant-tell-the-difference-between-humans-and-ai/806709/)

Vendor docs (routing defaults): [Ruby](https://rubyhelpcenter.helpjuice.com/call-forwarding/call-forward-busy-no-answer), [Signpost](https://help.signpost.com/can-you-answer-only-a-specific-number-of-calls-or-specific-types-of-calls), [Smith.ai](https://docs.smith.ai/article/fzjhrar7xd-article-4-how-to-forward-calls-from-your-mobile-phone-conditional-call-forwarding), [Jobber](https://help.getjobber.com/en/articles/receptionistpowered-by-jobber-ai/), [Quo Sona](https://support.quo.com/core-concepts/ai-automations/sona-ai-agent.md), [Goodcall](https://goodcall.com/how-it-works), [Rosie](https://heyrosie.com/support/en/articles/11058354-get-rosie-to-answer-your-calls-set-up-call-forwarding)

Trace work on unverified statistics: [Carly](https://www.usecarly.com/blog/missed-call-statistics/), [JustCall](https://justcall.io/blog/voicemail-statistics-2026.html), [destinationCRM 2014](https://www.destinationcrm.com/Articles/CRM-Insights/Insight/Business-Voicemail-Goes-Unanswered-100080.aspx)

Repo inputs: `docs/adr/0003-voice-stack.md`, `docs/amy-open-questions.md`, `docs/architecture.md`, `docs/research/legal-compliance.md`, `docs/research/bestline-metaswitch.md`, `lib/business-rules/routing.ts`, `lib/telephony/twiml.ts`, `lib/agents/policy.ts`.
