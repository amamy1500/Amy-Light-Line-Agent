# Legal and compliance research: Lightline inbound AI receptionist

> **NOT LEGAL ADVICE.** This is engineering research by a non-lawyer.
> It finds and labels sources. It does not apply law to facts with authority.
> Every item in section 10 ("COUNSEL REVIEW NEEDED") must go to a licensed
> Texas attorney before launch. Laws below change often. Re-check before relying.

- Date: 2026-10-22.
- Scope: tenant #1, The Christmas Light Guys (Austin, TX). Later: multi-tenant (plumbers, doctors, CPAs).
- Call flow assumed: dedicated Twilio number. Amy rung first (press-1 screen). No answer: ElevenLabs agent answers, collects lead facts, may warm-transfer to Amy, creates a callback. Optional confirmation SMS. Amy calls back later.
- Status: research input. Not a decision record. Feeds `lib/business-rules/config.ts` and an ADR.

## 0. How to read this

| Label | Meaning |
|---|---|
| FACT | Primary text read during this research (statute, rule, order, opinion, signed bill, vendor's own terms). "(mirror)" = unofficial copy of official text. "(re-verified)" = read twice, independently. |
| SECONDARY | Law-firm alert, news, tracker, or search snippet. Not the source that owns the claim. |
| INFERENCE | Our reasoning. Not authority. |
| OPEN | Could not verify, or law is unsettled. Goes to counsel. |

- Short statutory quotes only. Full text is at the URL.
- Several official sites blocked automated reads. Section 11 lists failures and the mirrors used.
- The web-search budget ran out mid-research. Some items rest on direct fetches only. Section 11 lists gaps.

---

## 1. Bottom line

| # | Conclusion | Label |
|---|---|---|
| 1 | Texas is one-party consent. The business is a party. Texas callers need no recording consent. | FACT + INFERENCE |
| 2 | Callers from CA, FL, WA, IL, PA, MD, MA, MT, NV, NH, MI, CT, DE need notice or consent. Caller location is unknowable. Disclose on **every** call, first thing, and record the disclosure. | FACT + INFERENCE |
| 3 | The bigger risk is not "party" status. It is vendors (ElevenLabs, Twilio, LLM) as third-party eavesdroppers under California CIPA §631. Two 2025 N.D. Cal. rulings let that theory proceed against AI call vendors. Prior caller consent that names vendor processing is the practical fix. | FACT + INFERENCE |
| 4 | No federal or Texas law requires an inbound AI agent to say it is AI (non-health business). Maine does, in effect. Utah does when asked. ElevenLabs' own contract does, on every call. | FACT |
| 5 | "Amy's virtual assistant" is weak. It can mean a remote human. Say "AI assistant" and "not a person". | INFERENCE |
| 6 | Never deny being AI. Utah requires a truthful answer to a clear question. Denial risks FTC Act §5 deception. | FACT + INFERENCE |
| 7 | Do not text from a caller-ID-captured number without asking. FCC says caller-ID capture is not consent. Ask on the call. | FACT + INFERENCE |
| 8 | **New risk found:** Texas Bus. & Com. Code ch. 302 counts an inbound call made "in response to a solicitation … made by any other means" (e.g., a TV ad) as a "telephone solicitation". Registration ($200 + $10,000 bond) is required unless an exemption fits. The likely fit is §302.059(1): no sale or deposit by phone; in-person estimate later. | FACT (re-verified) + INFERENCE + OPEN |
| 9 | Amy's callback to an inquirer is not a federal "telephone solicitation" (inquiry-based EBR, 3 months). Still use strict hours as policy. | FACT + INFERENCE |
| 10 | TDPSA does not apply to an SBA-small business, except: no sale of sensitive data without consent. Do not sell call data at all. | FACT |
| 11 | Cloning Amy's own voice is low risk with a written, scoped consent. ElevenLabs Professional Voice Cloning only clones the account holder's own voice. | FACT + INFERENCE |
| 12 | Medical and CPA tenants each need a contract chain (HIPAA BAAs; Safeguards Rule / IRC §7216). ElevenLabs' "Reception Offering" limits regulated businesses to reception, routing and scheduling. | FACT |

---

## 2. Config recommendations

Maps to `BusinessConfig` in `lib/business-rules/config.ts`. All rows are INFERENCE built on the FACT sections below. Counsel signs off before launch.

### 2.1 Defaults table

| Setting | Recommended default | Why (section) |
|---|---|---|
| `ai.recording` (AI leg) | **Disclosure-gated** (`"disclosed"`). Recording starts at answer. The disclosure is the first audio, so it is on the recording. | WA RCW 9.73.030(3) and CT §52-570d require the notice itself to be recorded (3.3, 3.5) |
| Human leg (Amy answers first) | **Off.** Enable only if a pre-connect notice plays before Amy's phone rings. | No notice is played on the Amy-first leg today (3.6) |
| Recording after AI → Amy transfer | **Stop at transfer** by default. If kept on: announce "I'm connecting you to Amy. This call is still recorded." | One notice probably covers the call; re-announcing is cheap (3.6) |
| `brand.assistantRole` | `"Amy's AI assistant"` (replace `"Amy's virtual assistant"`). | Maine, Utah safe harbor, ElevenAgents §3.5 (4.x) |
| Greeting (exact) | See 2.2. | 3.5, 4.8 |
| Caller declines recording | Stop. Do not keep audio or transcript. See 2.3. | 3.5 |
| AI identity question | Always: "Yes, I'm an AI assistant, not a person." Never deny. Keep the `denied_being_ai` scan. | Utah §13-77-103(1); FTC §5 (4.3) |
| Re-disclosure | After any hand-back to the AI: "You're back with Amy's AI assistant." | Utah §13-77-104 "throughout" safe harbor (4.3) |
| Voice | Stock voice by default. Amy's clone only with signed consent (5.8). Never "I'm Amy". | 5.x; existing `impersonation` scan |
| Confirmation SMS | **Ask-first.** Agent asks: "Can I text a confirmation to the number you're calling from?" Send only on a clear yes. One message, within 5 minutes, informational only, with STOP. | FCC 15-72 ¶52, ¶106 (6.3) |
| SMS content | Business name, what happens next, "Reply STOP to opt out." No offers, discounts, links to promotions. | Marketing content needs written consent (6.3) |
| SMS registration | Twilio A2P 10DLC brand + campaign registered before first send. | Twilio (6.3) |
| Opt-out | STOP (or any reasonable revocation) suppresses all texts and AI calls to that number. One confirmation text within 5 minutes. Honor at once (rule max: 10 business days). | 47 CFR 64.1200(a)(10)-(12) (6.4) |
| Callback quiet hours (Amy + any delayed SMS) | **Mon–Sat 09:00–20:00, Sun 12:00–20:00, caller's local time.** Unknown timezone: use the stricter of Central and the area code's zone. | Strictest mix of TX §301.051, FL §501.616, MD §14-4502(c), WA RCW 80.36.390 (6.1) |
| Callback attempts | Max 3 per 24 h. Stop after 3 total unanswered attempts. Never call back more than 3 months after the inquiry without new consent. | FL/MD 3-per-24h; federal inquiry EBR 3 months (6.1) |
| Internal do-not-call list | Written policy. Honor at once. Keep entries 5 years. | 47 CFR 64.1200(d) (6.1) |
| AI outbound calls | **Disabled.** Enable only with prior express written consent per number and the 64.1200(b) script. | 6.5 |
| Raw audio retention | **30 days**, then delete in Twilio, ElevenLabs and our store. | 7.5 |
| Transcript retention | **13 months** (one season plus follow-up). | 7.5 |
| Lead record (non-customer) | 24 months after last contact. | 7.5 |
| Customer job record | Relationship + 4 years (OPEN: counsel to align with limitations periods and tax rules). | 7.5 |
| Consent evidence | 5 years: call SID, timestamp, greeting version, transcript of disclosure turn, SMS-consent turn, opt-outs. Keep this even after audio/transcript deletion. | ElevenAgents Terms §3.5 (re-verified); 64.1200(d) |
| Declined-recording calls | Delete audio + transcript within 24 h. Keep metadata only. | 2.3 |
| Deletion requests | Complete within 45 days, including vendor copies. | Mirrors TDPSA §541.052 (7.1) |
| Backups | Roll off within 35 days. | 7.5 |
| Litigation hold | Suspends all deletion for the held records. Logged. | 7.5 |
| ElevenLabs account settings | Retention set to 30 days (default is 2 years). Model-training / "data use" opt-out ON. Prefer ElevenAgents with configurable retention over the "Reception Offering" (records by default; zero-retention not offered). | 3.2, 7.6 |
| Twilio | Delete recordings by API after copy (Twilio keeps them until deleted). | 7.6 |

### 2.2 Exact greeting

AI leg, every call, before any question:

> "Hi, thanks for calling The Christmas Light Guys. I'm Amy's AI assistant, an automated system, not a person. This call is recorded and transcribed, and our AI service providers process it to help us respond. If you'd rather not be recorded, just say so. How can I help?"

- About 15 seconds. Do not shorten the three parts: AI-not-person, recorded-and-transcribed, vendor processing.
- Say "**is** recorded". Not "may be". (3.5)
- Name the vendors (ElevenLabs, Twilio, the LLM provider) in the website privacy notice and in the SMS footer link if any. OPEN: whether generic "AI service providers" meets ElevenAgents §3.5(b). Ask ElevenLabs.

Optional pre-connect notice (only if human-leg recording is turned on), played before Amy's phone rings:

> "Thanks for calling The Christmas Light Guys. This call is recorded."

Transfer line (if recording continues):

> "I'm connecting you to Amy now. This call is still recorded."

### 2.3 When the caller declines recording

| Step | Behaviour |
|---|---|
| 1 | Agent: "No problem. I'll stop here and won't keep this call." |
| 2a | Inside ring hours: "Would you like me to try Amy directly?" Yes → transfer with recording **off**. |
| 2b | Outside ring hours or no: "Amy can call you back at the number you're calling from. Is that okay?" Yes → callback task. No → give the business text/email and end. |
| 3 | Do **not** offer the confirmation SMS in this path. |
| 4 | System: stop recording; delete audio and transcript (Twilio + ElevenLabs + our store) within 24 h. |
| 5 | Keep metadata only: caller number, time, `recording_declined`, `callback_requested`. |
| 6 | Amy's callback is unrecorded. |

- OPEN: the vendor processes audio in real time before and during the "no". That is unavoidable. Counsel to confirm the notice-first design is enough (Ambriz treated real-time transcription as "in transit").

---

## 3. Q1. Call-recording consent

### 3.1 Texas: one-party

| Claim | Label | Source |
|---|---|---|
| Penal Code §16.02(c)(4): affirmative defense where a person not under color of law intercepts and "(A) the person is a party to the communication; or (B) one of the parties … has given prior consent," unless for an unlawful act. | FACT | https://tcss.legis.texas.gov/resources/PE/htm/PE.16.htm ; mirror https://texas.public.law/statutes/tex._penal_code_section_16.02 |
| Offense is generally a second-degree felony (§16.02(f)). | FACT | same |
| CPRC §123.001(2): "interception" is acquisition "made without the consent of a party to the communication." | FACT (mirror) | https://texas.public.law/statutes/tex._civ._practice_and_remedies_code_section_123.001 |
| CPRC §123.004: "$10,000 for each occurrence," actual damages above that, punitive damages, fees. | FACT (mirror) | https://texas.public.law/statutes/tex._civ._practice_and_remedies_code_section_123.004 |
| Federal: 18 U.S.C. §2511(2)(d) is one-party, unless the purpose is a criminal or tortious act. §2520: greater of $100/day or $10,000. | FACT | https://www.law.cornell.edu/uscode/text/18/2511 ; /2520 |
| For Texas callers the business is a party, and its consent also covers its vendors (§16.02(c)(4)(B)). | INFERENCE | — |
| No Texas authority found on software or AI as a "party". | OPEN | — |

### 3.2 Is the business (via its AI) a "party"? The vendor problem

- The business is the party. Its AI agent is its instrument. Ambriz attributed software conduct to the operator: "it is Google, not GCCAI, that is alleged to have engaged in the conduct." INFERENCE by analogy; quote is FACT.
- The live risk: vendors treated as **third-party eavesdroppers** under Cal. Penal Code §631(a). §631(a) also reaches anyone who "aids, agrees with, employs, or conspires with" a violator. That can pull in the business.

| Case | Holding | Label | Source |
|---|---|---|---|
| Ambriz v. Google, No. 23-cv-05437-RFL (N.D. Cal. Feb. 10, 2025) | Google Cloud Contact Center AI. Adopted the "capability" test. Contract limits on vendor use are "irrelevant to the question of its capabilities." Real-time transcription is "in transit." Noted the processing was "not disclosed to the caller." | FACT | https://www.courthousenews.com/wp-content/uploads/2025/02/ambriz-v-google-order-denying-motion-dismiss.pdf |
| Taylor v. ConverseNow, No. 25-cv-00990-SI (N.D. Cal. Aug. 11, 2025) | AI voice agent answering restaurant calls. Closest to our facts. Capability test. Vendor is a third party "because it may use details from that conversation for its own purpose." Name, address and card details enough to plead a §632 "confidential" call. | FACT | https://www.courthousenews.com/wp-content/uploads/2025/08/taylor-v-converse-now-ca-ruling.pdf |
| Gladstone v. AWS, 739 F. Supp. 3d 846 (W.D. Wash. 2024) | Amazon Connect. Capability test. | FACT (as quoted in Ambriz/Taylor) | same PDFs |
| Graham v. Noom, 533 F. Supp. 3d 823 (N.D. Cal. 2021) | "Extension" test: a vendor that only serves its client is an extension of the client. | FACT (as quoted) | same |
| Javier v. Assurance IQ (9th Cir. May 31, 2022, unpublished) | Consent must be **prior**. After-the-fact consent fails under §631(a). | FACT | https://cdn.ca9.uscourts.gov/datastore/memoranda/2022/05/31/21-16351.pdf |
| In re Otter.ai; SoundHound/Chipotle AI voice suits (2026) | Reported, not read. | SECONDARY | — |
| Cal. SB 690 (2025–26) | Narrowed to website pen-register (§638.51) claims. Amendments struck all changes to §§631, 632, 632.7. No commercial-purpose exemption for calls. | FACT (Assembly committee analysis) | https://apcp.assembly.ca.gov/system/files/2026-06/sb-690-caballero-apcp-analysis.pdf |
| SB 690 signed Sept. 30, 2026, operative Jan. 1, 2027. | SECONDARY | https://www.wilmerhale.com/en/insights/blogs/wilmerhale-privacy-and-cybersecurity-law/20261006-cipa-reform-signed-into-law |

Vendor data terms that feed the "capability" test:

| Vendor | Term | Label | Source |
|---|---|---|---|
| ElevenLabs | Licence to use customer content "to improve the Services, and to develop new services and products." Opt-out going forward only. Terms last updated Oct. 9, 2026. | FACT | https://elevenlabs.io/terms-of-use |
| ElevenLabs | Enterprise customers not trained on by default. Non-Enterprise default not stated. | FACT / OPEN | https://elevenlabs.io/docs/help-center/legal/is-my-data-used-to-improve-eleven-labs-ai-models |
| Twilio | Conversational Intelligence trains only on opt-in. Generative AI addendum: no third-party training without supplemental terms. | FACT | https://www.twilio.com/en-us/legal/ai-terms/voice-intelligence-data-use ; https://www.twilio.com/en-us/legal/ai-terms/predictive-generative-ai-features |
| LLM vendor | Not researched. | OPEN | — |

- INFERENCE: opt out of all vendor training. That lowers but may not remove "capability" (Ambriz). The real fix is prior caller consent that names recording, transcription and vendor processing.

### 3.3 All-party and mixed states

| State | Statute | Phone-call rule | What suffices | Continuing after notice = consent? | Civil damages | Label / source |
|---|---|---|---|---|---|---|
| CA | Penal Code §632, §632.7, §631 | All-party. §632 needs a "confidential communication". §632.7 (cell/cordless) has no confidentiality element and applies to parties (Smith v. LoanMe, Cal. 2021). | Advise "at the outset of the conversation" (Kearney). | Kearney dicta: caller "may decline to continue". Maghen v. Quicken (9th Cir. 2017, unpub.): "all … calls are recorded" then staying on = consent. | §637.2: greater of $5,000 per violation or 3x actual | FACT. https://codes.findlaw.com/ca/penal-code/pen-sect-632/ ; https://www4.courts.ca.gov/opinions/archive/S260391.PDF ; https://scocal.stanford.edu/opinion/kearney-v-salomon-smith-barney-33656 ; https://caselaw.findlaw.com/court/us-9th-circuit/1850148.html |
| FL | §934.03(2)(d) | All parties' prior consent. Privacy-expectation element sits in "oral" definition, not "wire". | Prior consent of all. | No appellate holding found (OPEN). Possible business-extension defense (Stalley v. ADS, 11th Cir. 2015). | Greater of $100/day or $1,000, punitive, fees (§934.10) | FACT. http://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0900-0999/0934/Sections/0934.03.html |
| WA | RCW 9.73.030 | All participants. | (3): consent obtained when a party "has announced to all other parties … in any reasonably effective manner" that the call "is about to be recorded". The announcement "shall also be recorded". | Yes, by statute. | Actual, or $100/day liquidated up to $1,000, fees (9.73.060) | FACT. https://app.leg.wa.gov/RCW/default.aspx?cite=9.73.030 |
| IL | 720 ILCS 5/14-2(a)(2) | No recording "in a surreptitious manner" of a "private conversation" without all parties. | Announced recording is not "surreptitious". | INFERENCE yes; no case found. | Actual + punitive (14-6) | FACT (mirror). https://codes.findlaw.com/il/chapter-720-criminal-offenses/il-st-sect-720-5-14-2/ |
| PA | 18 Pa.C.S. §5703, §5704(4) | All parties' prior consent. §5704(15): one-party customer-service exception only for training/QC/monitoring, destroy within 1 year. | Prior consent. | Commonwealth v. Byrd (Pa. 2020): knew or should have known = consent. | Greater of $100/day or $1,000, punitive, fees (§5725) | FACT (mirror) statute; SECONDARY for Byrd. https://codes.findlaw.com/pa/title-18-pacsa-crimes-and-offenses/pa-csa-sect-18-5704/ |
| MD | Cts. & Jud. Proc. §10-402(c)(3) | All parties' prior consent. | Prior consent. | No case found (OPEN). | Greater of $100/day or $1,000, punitive, fees (§10-410) | FACT. https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcj&section=10-402&enactments=false |
| MA | G.L. c.272 §99 | Bans **secret** recording without all parties' authority. | Recording all parties know of is not secret. | Yes in effect (Curtatone v. Barstool, Mass. 2021, SECONDARY). | Greater of $100/day or $1,000, punitive, fees (§99 Q) | FACT. https://malegislature.gov/Laws/GeneralLaws/PartIV/TitleI/Chapter272/Section99 |
| MT | MCA 45-8-213 | Hidden recording without knowledge of all parties. | Exception for "persons given warning of the … recording". | Yes (warning). | None found in statute (OPEN) | FACT. https://mca.legmt.gov/bills/mca/title_0450/chapter_0080/part_0020/section_0130/0450-0080-0020-0130.html |
| NV | NRS 200.620 | Effectively all-party (Lane v. Allstate, 1998). But Ditech v. Buckles (Nev. 2017): statute "does not apply when the act of interception takes place outside Nevada." | All-party. | Not found (OPEN). | Greater of actual or $100/day, min. $1,000 (200.690) | FACT (mirror). https://codes.findlaw.com/nv/title-15-crimes-and-punishments/nv-rev-st-200-620/ ; https://caselaw.findlaw.com/court/nv-supreme-court/1874143.html |
| NH | RSA 570-A:2 | All parties. A party who records without all-party consent commits a misdemeanor. | All-party. | Not found (OPEN). | Greater of $100/day or $1,000, punitive, fees (570-A:11) | FACT. https://gc.nh.gov/rsa/html/LVIII/570-A/570-A-2.htm |
| MI | MCL 750.539c | Statute says all parties. Sullivan v. Gray (1982) lets a participant record, but reportedly not another person on its behalf. | Notice (INFERENCE). | OPEN. Vendor recording may fall outside the participant rule. | Actual + punitive (750.539h) | FACT (mirror) statute; SECONDARY for Sullivan |
| CT | §52-570d (civil); §53a-187/189 (criminal, one-party in effect) | Civil: no recording of a private phone call unless (1) all-party consent in writing or recorded at start, (2) "verbal notification which is recorded at the beginning and is part of the communication by the recording party," or (3) tone every ~15 s. | Recorded verbal notice at start. | Yes, by statute (method 2). | Damages, costs, fees | FACT. https://www.cga.ct.gov/current/pub/chap_925.htm |
| DE | 11 Del. C. §2402(c)(4) (one-party) vs §1335(a)(4) (all-party) | Conflict. Follow the stricter. | All-party to be safe. | OPEN | Greater of $100/day or $1,000 (§2409) | FACT statutes; SECONDARY for advice. https://delcode.delaware.gov/title11/c024/sc01/index.html |
| OR | ORS 165.540 | Phone calls: one-party. In-person: all must be "specifically informed". | One party. | n/a | ORS 133.739 does not cover 165.540 | FACT. https://www.oregonlegislature.gov/bills_laws/ors/ors165.html |

### 3.4 Choice of law

| Claim | Label | Source |
|---|---|---|
| Kearney v. Salomon Smith Barney, 39 Cal.4th 95 (2006): California law governs an out-of-state firm recording calls with California residents. Damages for past conduct were withheld because the law was unsettled; injunctive relief only. Firms can "inquire where the client is calling from". | FACT | https://scocal.stanford.edu/opinion/kearney-v-salomon-smith-barney-33656 |
| The "prospective only" grace was tied to pre-2006 uncertainty. Do not expect it now. | INFERENCE | — |
| Florida: Final Expense Direct v. Python Leads (M.D. Fla. Dec. 3, 2024) applied §934.03 to a Texas company recording Floridians. Interception occurs "where the communication is uttered". | FACT | https://ecf.flmd.uscourts.gov/cgi-bin/show_public_doc?2023-02093-88-8-cv= |
| Nevada cuts the other way (Ditech, above). | FACT | — |
| WA, IL, PA, MD, MA choice-of-law rulings not found. | OPEN | — |
| Practical rule: one all-party-grade disclosure on every call. | INFERENCE | — |

### 3.5 Disclosure wording and implied consent

| Point | Label | Source |
|---|---|---|
| Notice must come first, before substance. | FACT | Kearney ("at the outset"); Javier (prior consent) |
| WA and CT require the announcement itself to be recorded. | FACT | RCW 9.73.030(3); C.G.S. §52-570d |
| "All of our calls are recorded" + staying on the line = consent (CA, 9th Cir. unpublished). | FACT | Maghen, above |
| Kight v. CashCall (Cal. Ct. App. 2011): "may be monitored or recorded" at the start of one call "would not necessarily inform" about later calls. Reasonable expectation is "generally a question of fact". §632 applies even to an unannounced listener employed by the same company. | FACT | https://caselaw.findlaw.com/ca-court-of-appeal/1586370.html |
| No case found holding "may be recorded" inadequate when calls are always recorded. | OPEN | — |
| Say "is recorded". WA's text says "is about to be recorded". | INFERENCE | — |
| Ambriz and Taylor both stress that callers were not told a third party processed the call. Naming vendor processing addresses that. | FACT + INFERENCE | 3.2 |
| Continuing after notice = consent: yes by statute in WA and CT; yes in practice in CA (Maghen), PA (Byrd, SECONDARY), MA (secret-only statute), MT (warning exception). Unsettled in FL, MD, NH, NV, MI. | FACT / SECONDARY / OPEN | 3.3 |
| Offering an opt-out ("If you'd rather not be recorded, just say so") strengthens consent-by-continuing. | INFERENCE | — |

### 3.6 Amy's leg and transfers

- Same rules. Amy is the business, so a party. INFERENCE.
- Today Amy is rung first with no announcement. So that leg must not be recorded unless a pre-connect notice plays first. INFERENCE.
- One opening notice likely covers a continuous recording through an AI → Amy transfer (CT "at the beginning"; Maghen). Kight warns a first notice may not carry to **later calls**. Re-announce at transfer anyway. INFERENCE.
- No case found on AI-to-human transfers. OPEN.
- Amy's later callback is a new call. If recorded, it needs its own notice. INFERENCE.

---

## 4. Q2. AI disclosure for an inbound voice agent (as of 2026-10-22)

### 4.1 Federal

| Claim | Label | Source |
|---|---|---|
| FCC 24-17 (Feb. 8, 2024): TCPA "artificial or prerecorded voice" covers "current AI technologies that generate human voices." Applies to calls made/initiated. | FACT | https://docs.fcc.gov/public/attachments/FCC-24-17A1.pdf |
| FCC 24-84 NPRM (Aug. 2024): "The TCPA's requirements do not extend to technologies used to answer inbound calls." Proposes AI-call definitions and start-of-call disclosure for outbound. | FACT | https://docs.fcc.gov/public/attachments/FCC-24-84A1.pdf |
| FCC 24-84 still pending: regulatory agenda "Long-Term Action", next step "To Be Determined". | FACT | https://www.reginfo.gov/public/do/eAgendaViewRule?pubId=202510&RIN=3060-AM12 |
| FCC 26-16 (Mar. 2026) says it does not revisit AI-call regulation. | FACT | https://docs.fcc.gov/public/attachments/FCC-26-16A1.pdf |
| McLaughlin Chiropractic v. McKesson, 606 U.S. 146 (2025): district courts are not bound by FCC interpretations; they decide the statute's meaning independently. FCC rulings are persuasive only. | FACT | https://www.law.cornell.edu/supremecourt/text/23-1226 |
| FTC Impersonation Rule (16 CFR Part 461) bans posing as a government or business. No AI-disclosure rule. Individual-impersonation extension not final. | FACT | https://www.law.cornell.edu/cfr/text/16/part-461 |
| A bot that claims or implies it is human, where that matters, risks FTC Act §5 deception. | INFERENCE | — |
| Executive Order 14365 (Dec. 11, 2025): DOJ AI Litigation Task Force; Commerce list of "onerous" state laws. Preempts nothing itself. No federal moratorium enacted. | FACT (EO); SECONDARY (moratorium) | https://www.whitehouse.gov/presidential-actions/2025/12/eliminating-state-law-obstruction-of-national-artificial-intelligence-policy/ |

### 4.2 California

| Law | Effect for us | Label | Source |
|---|---|---|---|
| B&P §§17940–17943 (SB 1001) | "Bot" = "automated online account"; "online" = website/app. Unlawful to mislead about artificial identity to sell. Probably does not reach a PSTN voice agent. | FACT (mirror) / INFERENCE | https://california.public.law/codes/ca_bus_and_prof_code_section_17940 |
| AB 1609 (2026) "Right to Human Customer Service" | Chaptered Sept. 28, 2026. Applies to large businesses (>$500M revenue, June version). Not to our tenants. Effective Jan. 1, 2027 (SECONDARY). | FACT (status, June text) | https://calmatters.digitaldemocracy.org/bills/ca_202520260ab1609 |
| AB 410 (2025) bot disclosure | Died in Appropriations. | FACT | https://calmatters.digitaldemocracy.org/bills/ca_202520260ab410 |
| Pub. Util. Code §2874 (AB 2905) | Outbound ADAD calls must say if the message uses an artificial voice. | FACT (mirror) | https://california.public.law/codes/ca_pub_util_code_section_2874 |
| H&S Code §1339.75 (AB 3030) | Medical tenants: GenAI patient **clinical** communications need a disclaimer, audio "verbally at the start and the end", plus how to reach a human. Scheduling/billing excluded. | FACT (mirror) | https://california.public.law/codes/ca_health_and_safety_code_section_1339.75 |
| B&P §4999.9 (AB 489) | No implying AI care comes from a licensed person. | FACT (mirror) | https://california.public.law/codes/ca_bus_and_prof_code_section_4999.9 |
| SB 243 (companion chatbots) | Excludes customer-service bots. | FACT (mirror) | https://california.public.law/codes/ca_bus_and_prof_code_section_22601 |

### 4.3 Utah (now Title 13, Chapter 77)

| Claim | Label | Source |
|---|---|---|
| §13-77-103(1): a supplier using GenAI in a consumer transaction must disclose "interacting with generative artificial intelligence and not a human" if the individual asks; the ask must be a "clear and unambiguous request". | FACT (re-verified) | https://le.utah.gov/xcode/Title13/Chapter77/C13-77-S103_2025050720250507.html |
| §13-77-103(2)–(3): regulated occupations must "prominently disclose" in high-risk interactions, "verbally at the start of a verbal interaction". | FACT (re-verified) | same |
| "High-risk" includes collecting health, financial or biometric data, or personalized financial/legal/medical advice. Licensed doctors, CPAs and plumbers are "regulated occupations". | FACT / INFERENCE | https://le.utah.gov/xcode/Title13/Chapter77/C13-77_2025050820250508.pdf |
| §13-77-104 safe harbor: disclose "at the outset" and "throughout" that it "is generative artificial intelligence", "is not human", or "is an artificial intelligence assistant". | FACT | same PDF |
| Penalties: up to $2,500 per violation (Consumer Sales Practices Act). | FACT | same PDF |
| SB 332 (2025) moved the AI Policy Act (Ch. 72) sunset to July 1, 2027. Ch. 77's survival after that is unclear. | FACT / OPEN | https://le.utah.gov/Session/2025/bills/enrolled/SB0332.pdf |

### 4.4 Texas (TRAIGA, HB 149, eff. 2026-01-01)

| Claim | Label | Source |
|---|---|---|
| §552.051(b): governmental agencies must disclose "before or at the time of interaction". | FACT | https://capitol.texas.gov/tlodocs/89R/billtext/html/HB00149F.htm |
| §552.051(f): AI used "in relation to health care service or treatment" must be disclosed "not later than the date the service or treatment is first provided". | FACT | same |
| Disclosure must be clear and conspicuous, plain language, no dark patterns, even if AI use is obvious. | FACT | same |
| No disclosure duty for private non-health businesses. | FACT + INFERENCE | same; SECONDARY https://www.insideprivacy.com/artificial-intelligence/texas-enacts-ai-consumer-protection-law/ |
| AG-only enforcement, 60-day cure, $10k–$12k curable, $80k–$200k uncurable. NIST AI RMF compliance is a defense. | FACT | same |
| SB 1188 (2025), H&S Code §183.005: practitioners using AI for diagnosis must disclose to patients. | FACT | https://capitol.texas.gov/tlodocs/89R/billtext/html/SB01188F.htm |
| SB 140 has no AI-disclosure provision. | FACT | https://capitol.texas.gov/tlodocs/89R/billtext/html/SB00140F.htm |

### 4.5 Colorado

| Claim | Label | Source |
|---|---|---|
| Old §6-1-1704 (SB 24-205): deployers of consumer-facing AI must disclose, unless obvious. Delayed to June 30, 2026 by SB25B-004. | FACT | https://leg.colorado.gov/bills/sb25b-004 |
| SB 26-189 (approved May 14, 2026) repeals and re-enacts the part effective Jan. 1, 2027. No general AI-interaction disclosure. Excludes "routine scheduling" and "customer service triage". | FACT | https://leg.colorado.gov/laws/session-laws/SB26-189/131/download |
| Old §6-1-1704 may be technically in force June 30, 2026 – Jan. 1, 2027. AG told the court (xAI v. Weiser) he will not enforce until rulemaking ends. | INFERENCE / OPEN; FACT (filing) | https://storage.courtlistener.com/recap/gov.uscourts.cod.253513/gov.uscourts.cod.253513.18.0.pdf |

### 4.6 Maine

| Claim | Label | Source |
|---|---|---|
| 10 M.R.S. §1500-DD: "artificial intelligence chatbot" includes "aural communications". No use of AI in trade "in a manner that may mislead or deceive a reasonable consumer" into thinking they deal with a human "unless the consumer is notified in a clear and conspicuous manner that the consumer is not engaging with a human being." Violation = Maine UTPA. | FACT (re-verified) | https://legislature.maine.gov/statutes/10/title10sec1500-DD-1.html |
| UTPA: AG penalty up to $10,000 per intentional violation; private action with fees after a 30-day demand. | FACT | https://legislature.maine.gov/statutes/5/title5sec213.html |

### 4.7 Other states

| State | Status | Reaches our inbound agent? | Label |
|---|---|---|---|
| New Jersey | N.J.S.A. 56:18-1 (2020) online bot disclosure | Phone coverage unclear | FACT / OPEN |
| New York | GBL Art. 47 (AI companions) excludes customer service. A 3411 pending. | No | FACT |
| Illinois | No general bot law. HB 1806 bans AI therapy. | Mental-health tenants only | FACT / SECONDARY |
| Washington, Oregon, Connecticut | 2026 companion-chatbot laws exclude customer service. | No | FACT |
| Nevada | AB 406 (2025): AI may not present as mental-health care. | Behavioral-health tenants only | FACT |
| Pennsylvania | Act 47 of 2026 (SB 992): "artificial voice" robocalls; bans synthetic messaging "to defraud, deceive or mislead". "Telemarketer" includes one who "receives" calls. | Mainly outbound; inbound reach OPEN | FACT / OPEN |
| FL, MA, MI, MD, MT, NH, DE | No enacted AI-interaction disclosure law found (tracker-based). | No | SECONDARY |

### 4.8 What the greeting and behaviour must include

| Requirement | Basis | Label |
|---|---|---|
| Up-front "AI" and "not a person" | Maine §1500-DD; Utah §13-77-104 safe harbor; ElevenAgents Terms §3.5(a) | FACT (texts) / INFERENCE |
| ElevenAgents §3.5: before access, inform each caller (a) AI not human, (b) processed by ElevenLabs, affiliates and providers incl. the LLM, (c) recorded if recording is on. Keep consent proof "for the longer of" the legal period "or five (5) years". | Contract, binding on us | FACT (re-verified) https://elevenlabs.io/agents-terms |
| "Virtual assistant" not enough on its own. | No regulator guidance approves it; it can mean a remote human. | INFERENCE / OPEN |
| Never deny being AI; answer truthfully when asked | Utah §13-77-103(1); FTC §5 | FACT / INFERENCE |
| Re-disclose after hand-back to AI | Utah "throughout" | INFERENCE |
| Doctors: disclose at start; CA clinical content start + end | TX §552.051(f); Utah §13-77-103(3); Cal. §1339.75 | FACT |
| CPAs: disclose at start on Utah calls collecting financial data | Utah §13-77-103(3) | FACT / INFERENCE |

---

## 5. Q3. Cloning Amy's voice

### 5.1 State law summary

| Jurisdiction | Rule | Consent form | Label | Source |
|---|---|---|---|---|
| Tennessee ELVIS Act (Pub. Ch. 588, 2024) | Property right in one's "voice" incl. simulated (§47-25-1102, -1103). Unlawful to use a voice for advertising/soliciting "without such individual's prior consent" (§1105(a)(1)); liability for tools whose "primary purpose" is a specific person's voice. | Prior consent (writing not stated) | FACT | https://capitol.tn.gov/Bills/113/Amend/HA0578.pdf |
| California Labor Code §927 (AB 2602) | Digital-replica clause in a services agreement is unenforceable if: replaces in-person work, no reasonably specific description, and no counsel/union. | Specific written terms; offer counsel | FACT (mirror) | https://california.public.law/codes/labor_code_section_927 |
| California Civ. Code §3344 | Using another's voice for advertising/soliciting needs "prior consent". Greater of $750 or actual + profits, punitive, fees. SB 683 (2025) added injunctions. | Prior consent | FACT (mirror) | https://california.public.law/codes/civil_code_section_3344 |
| California Civ. Code §3344.1 (AB 1836) | Deceased persons only. | n/a | FACT (mirror) | https://california.public.law/codes/civil_code_section_3344.1 |
| New York Civ. Rights Law §§50–51 | Voice used for advertising or trade needs "written consent". | Written | FACT | https://www.nysenate.gov/legislation/laws/CVR/50 ; /CVR/51 |
| New York GOL §5-302 (2024) | Same three-part unenforceability test as CA. | Specific written terms | FACT | https://www.nysenate.gov/legislation/laws/GOB/5-302 |
| New York synthetic-performer ad law (S.8420-A, eff. June 2026) | Unrecognizable synthetic performers in visual ads. Not a phone agent. | n/a | FACT / INFERENCE | https://www.nysenate.gov/legislation/bills/2025/S8420/amendment/A |
| Illinois Right of Publicity Act (PA 103-0836) | Voice is "identity". Commercial use needs "previous written consent". Covers digital replicas. | Written | FACT | https://ilga.gov/Legislation/PublicActs/PrinterFriendly/103-0836 |
| Illinois Digital Voice and Likeness Protection Act (PA 103-0830) | Same three-part unenforceability test. | Written agreement | FACT | https://ilga.gov/Legislation/PublicActs/PrinterFriendly/103-0830 |
| Illinois BIPA (740 ILCS 14) | "Voiceprint" is a biometric identifier (undefined). Written notice + written release; public retention policy; destroy ≤3 years. $1,000 / $5,000 per violation. BIPA class action vs ElevenLabs filed May 2026, pending. | Written release | FACT; SECONDARY (suit) | https://www.ilga.gov/Legislation/ILCS/Articles?ActID=3004&ChapterID=57 ; https://www.loevy.com/bipa-ai-class-action/ |
| Texas CUBI, Bus. & Com. §503.001 | "Voiceprint" is a biometric identifier. Inform before capture + consent. Destroy within a reasonable time, not later than 1 year after purpose expires. Up to $25,000 per violation (AG). TRAIGA added (e)(2) AI-development exemption unless used to identify a person, and (f) clawback for later commercial use. | Notice + consent | FACT | https://tcss.legis.texas.gov/resources/BC/pdf/BC.503.pdf |
| Texas Property Code ch. 26 | Deceased persons only. No living-person digital-replica statute (SB 1960 died, SECONDARY). | n/a | FACT | https://tcss.legis.texas.gov/resources/PR/pdf/PR.26.pdf |
| Federal NO FAKES Act (S.4591, 2026) | Passed Senate Judiciary June 18, 2026; floor UC blocked Sept. 30, 2026. **Not law.** Would require written, specific licence, ≤10 years. | n/a | FACT (bill, committee); SECONDARY (floor) | https://www.govinfo.gov/content/pkg/BILLS-119s4591is/html/BILLS-119s4591is.htm |

- INFERENCE: every statute turns on missing consent. Amy cloning her own voice, with documented consent, is low risk.
- INFERENCE: if the business is an LLC, Amy (the person) should license her voice to the LLC in writing. That covers a sale, her exit, or death.
- OPEN: whether a synthetic clone involves a "voiceprint" under CUBI and BIPA.

### 5.2 ElevenLabs terms (pages dated Oct. 9, 2026)

| Term | Label | Source |
|---|---|---|
| Voice models may be of "your voice" or "a voice you are authorized to share" (§4(b)). You warrant rights (§4(g)); you indemnify (§9). | FACT | https://elevenlabs.io/terms-of-use |
| "Perpetual and irrevocable" licence to content incl. voice to improve services; no standalone commercialization of a voice without permission (§4(d)). Training opt-out applies going forward only (§4(i)). | FACT | same |
| No HIPAA PHI "except as permitted by an executed HIPAA BAA" (§4(h)). | FACT | same |
| Prohibited Use Policy §3: no cloning a living person "without their explicit and informed consent". §10: disclose AI where law requires or silence "would materially mislead". | FACT | https://elevenlabs.io/use-policy |
| Instant Voice Cloning: user confirms "right and consent"; no identity check. | FACT | https://elevenlabs.io/docs/product-guides/voices/voice-cloning/instant-voice-cloning |
| Professional Voice Cloning: "Even with their consent, you cannot clone someone else's voice." Owner verifies by reading lines aloud; can then share. | FACT | https://elevenlabs.io/docs/product-guides/voices/voice-cloning/professional-voice-cloning |
| INFERENCE: Amy creates and verifies the PVC on her own ElevenLabs account, then shares it to the platform. Same pattern per tenant. | INFERENCE | — |

### 5.3 Consent record to keep (INFERENCE unless marked)

| Item | Why |
|---|---|
| Voice owner identity, signature, date; e-signature audit trail | NY §50/51, IL §30(a), BIPA written (FACT) |
| Licensee named (the LLC; the platform); sublicence to ElevenLabs named | ElevenLabs §4(d) |
| Specific uses: inbound calls on listed numbers only. No ads, no outbound unless separately signed | CA §927, NY §5-302, IL 815 ILCS 550 (FACT) |
| Approved AI-disclosure script ("I'm Amy's AI assistant…"); agent never says "I'm Amy" | ElevenAgents §3.5 (FACT) |
| Term (≤10 years mirrors NO FAKES bill) and renewal | S.4591 (not law) |
| Revocation: how, deadline, who deletes the clone and source audio, deletion confirmation | TX §503.001 1-year rule; BIPA 3-year (FACT) |
| Employee/owner departure clause: stop use, delete clone | ELVIS §1105(a)(2) "not authorized" (FACT) |
| Disclosure of ElevenLabs' training licence, opt-out status, retention | ElevenLabs §4(d)/(i) (FACT) |
| Texas: CUBI notice before capture + consent | §503.001(b) (FACT) |
| Illinois voice owners: BIPA notice, written release, public retention policy | BIPA §15 (FACT) |
| CA/NY/IL voice owners: offer independent counsel; separately signed terms | §927, §5-302 (FACT) |
| Compensation, or statement none is owed | — |
| Keep consent records ≥5 years after the licence ends | ElevenAgents §3.5 (FACT) |

---

## 6. Q4. TCPA and Texas telemarketing

### 6.1 (a) Amy's human callback

| Claim | Label | Source |
|---|---|---|
| 47 U.S.C. §227(a)(4): "telephone solicitation" excludes calls with "prior express invitation or permission" or to a person with an "established business relationship". | FACT | https://www.govinfo.gov/content/pkg/USCODE-2024-title47/html/USCODE-2024-title47-chap5-subchapII-partI-sec227.htm |
| 47 CFR 64.1200(f)(5): EBR includes "the subscriber's inquiry or application regarding products or services" within 3 months. FCC 03-153: the inquiry must create an expectation that the company will call. | FACT | https://www.ecfr.gov/current/title-47/section-64.1200 ; https://docs.fcc.gov/public/attachments/FCC-03-153A1.pdf |
| Quiet hours 64.1200(c)(1): no telephone solicitation before 8 a.m. or after 9 p.m. called party's local time. | FACT | eCFR |
| National DNC (c)(2): the "invitation" defense needs a signed written agreement; EBR is the cleaner basis. | FACT / INFERENCE | eCFR |
| 64.1200(d): any telemarketing call to a residential subscriber needs a written DNC policy, training, honoring requests within 10 business days, 5-year retention, and caller ID of name and number. No EBR carve-out. | FACT | eCFR |
| Callback to a quote request within 3 months is not a federal "telephone solicitation". Quiet hours and national DNC do not apply. (d) still likely applies. | INFERENCE | — |
| Tex. Bus. & Com. §301.051: hours Sun 12–9 p.m., weekdays/Sat 9 a.m.–9 p.m. Does not apply to calls "in response to the express request of the consumer" or to a prior/existing business relationship. | FACT | https://tcss.legis.texas.gov/resources/BC/htm/BC.301.htm |
| Tex. ch. 304 (Texas no-call): EBR = voluntary two-way communication, no time limit; chapter does not apply to EBR calls. | FACT | https://tcss.legis.texas.gov/resources/BC/htm/BC.304.htm |
| FL §501.616(6): 8 a.m.–8 p.m., ≤3 calls per 24 h (commercial solicitation). MD §14-4502(c): no calls 8 p.m.–8 a.m., ≤3 per 24 h. WA RCW 80.36.390: 8 a.m.–8 p.m.; requested calls excluded from "telephone solicitation". | FACT | http://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0500-0599/0501/Sections/0501.616.html ; https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcl&section=14-4502&enactments=false ; https://app.leg.wa.gov/RCW/default.aspx?cite=80.36.390 |
| MD hours cap likely applies even to requested callbacks. | INFERENCE | — |

### 6.2 Texas SB 140 and chapter 302 registration

| Claim | Label | Source |
|---|---|---|
| SB 140 (Ch. 964, eff. Sept. 1, 2025) redefined §302.001(7): "a call or other transmission, including a transmission of a text or graphic message or of an image, initiated by a seller or salesperson to induce a person to purchase…". | FACT (re-verified) | https://tcss.legis.texas.gov/resources/BC/htm/BC.302.htm ; https://capitol.texas.gov/tlodocs/89R/billtext/html/SB00140F.htm |
| §302.001(7) also: "The term includes a telephone call a purchaser makes in response to a solicitation sent by mail or made by any other means." | FACT (re-verified) | same |
| §302.101(a): a seller may not make a telephone solicitation "to a purchaser located in this state" without a registration certificate. $200 fee; $10,000 security; annual renewal. | FACT (re-verified §302.101) | same |
| §302.302: up to $5,000 per violation. §302.303: a violation is a DTPA deceptive act, with public or private remedies (this dates from 2009, not SB 140). | FACT (re-verified) | same |
| SB 140 added DTPA remedies to ch. 304 (new §304.2581) and ch. 305 (new §305.054). | FACT | SB 140 enrolled |
| §302.059(1) exemption: seller (A) does not intend to complete or provisionally accept a sale during the solicitation, (B) arranges the major sales presentation "face-to-face at a later meeting", and (C) does not send someone to collect payment or deliver "directly following" the call. | FACT (re-verified) | BC.302 |
| §302.058: (1) maintenance/repair of an item bought from the seller; (2) former/current customers, if same business name ≥2 years. | FACT (re-verified) | BC.302 |
| §302.059(2): retail establishment ≥2 years under same name, majority of business at the store. | FACT (re-verified) | BC.302 |
| Texas SOS: "any business that sends text messages with prior consent of the consumer is not required to complete the Telephone Solicitation Registration Statement," citing the AG/SOS position in Ecommerce Marketers Alliance v. Texas, No. 1:25-cv-1401 (W.D. Tex.). "It is the seller's responsibility to determine whether the seller should register." | FACT (re-verified) | https://www.sos.state.tx.us/statdoc/faqs3400.shtml |
| Inbound calls prompted by TV ads, and Amy's quote callbacks, are likely ch. 302 "telephone solicitations". The SOS text-message position does not clearly cover voice. | INFERENCE / OPEN | — |
| §302.059(1) likely fits **if** the AI and Amy never close a sale or take a deposit by phone, and the quote/contract happens at an in-person visit. A phone or emailed quote with online deposit and no face-to-face meeting likely does not fit. | INFERENCE / OPEN | — |
| §305.053: private action for any TCPA violation: greater of $500 or actual; up to $1,500 if knowing. | FACT | https://tcss.legis.texas.gov/resources/BC/htm/BC.305.htm |

### 6.3 (b) Confirmation SMS after an inbound call

| Claim | Label | Source |
|---|---|---|
| A text is a "call" under §227(b)(1)(A)(iii) (Campbell-Ewald v. Gomez, 2016). | FACT | https://www.law.cornell.edu/supremecourt/text/14-857 |
| ATDS needs a random or sequential number generator (Facebook v. Duguid, 2021). A one-off event-triggered text is unlikely to be ATDS. | FACT / INFERENCE | https://www.supremecourt.gov/opinions/20pdf/19-511_p86b.pdf |
| FCC 1992 ¶31 (quoted in FCC 15-72): knowingly releasing a number = permission. But a number "captured" by caller ID "without notice" is not permission. FCC 15-72 ¶52 lists caller-ID capture as non-consent; non-telemarketing consent may be oral. | FACT | https://docs.fcc.gov/public/attachments/FCC-15-72A1.pdf |
| On-demand text (FCC 15-72 ¶106): lawful if requested by the consumer, one-time, sent immediately, and only the requested info, no marketing. | FACT | same |
| SoundBite / 64.1200(a)(12): one opt-out confirmation text within 5 minutes is presumed OK. | FACT | https://docs.fcc.gov/public/attachments/FCC-12-143A1.pdf |
| Marketing content → prior express written consent (64.1200(a)(2), (f)(9)) if ATDS. FL and MD can require written consent for automated selection/dialing. | FACT / INFERENCE | eCFR; Fla. §501.059 |
| Shields petition (DA 26-940) asks FCC to treat "click-send" texting as autodialing. Pending. | FACT | https://docs.fcc.gov/public/attachments/DA-26-940A1.pdf |
| CTIA: informational messages need agreement "for a specific informational purpose". Twilio: US 10DLC senders must register. | FACT | https://api.ctia.org/wp-content/uploads/2023/05/230523-CTIA-Messaging-Principles-and-Best-Practices-FINAL.pdf ; https://www.twilio.com/docs/messaging/compliance/a2p-10dlc |
| Asking on the call cures the caller-ID problem and gives oral express consent for an informational text. | INFERENCE | — |

### 6.4 Consent revocation (current rules)

| Claim | Label | Source |
|---|---|---|
| 64.1200(a)(10)–(11): revoke by any reasonable means; honor within 10 business days; no exclusive means. In force since April 11, 2025. | FACT | eCFR |
| "Revoke-all" scope provision waived to Jan. 31, 2027 (DA 26-12). | FACT | https://docs.fcc.gov/public/attachments/DA-26-12A1.pdf |
| FCC 26-67 (released Oct. 1, 2026) rewrites (a)(10)–(12): category-specific revocation for informational calls; telemarketing revocation covers all telemarketing; callers may designate an exclusive means if disclosed. Effective 30 days after Federal Register publication. Not yet published on Oct. 22, 2026. | FACT / OPEN (date) | https://docs.fcc.gov/public/attachments/FCC-26-67A1.pdf |
| Policy: treat every opt-out as global and immediate. | INFERENCE | — |

### 6.5 (c) Future AI outbound calls

| Claim | Label | Source |
|---|---|---|
| AI voice = "artificial voice" (FCC 24-17). Telemarketing AI calls need prior express written consent (64.1200(a)(2) wireless, (a)(3) residential). Informational artificial-voice calls to wireless need prior express consent. | FACT | FCC 24-17; eCFR |
| 64.1200(b): identify the business at the start, give a callback number, key-press opt-out within 2 seconds for telemarketing, toll-free opt-out number in voicemails. | FACT | eCFR |
| 64.1200(f)(9) PEWC: signed written agreement, clear disclosure, not a condition of purchase; E-SIGN signatures count (FCC 12-21 ¶34). One-to-one consent rule vacated (IMC v. FCC, 11th Cir. 2025). | FACT | https://media.ca11.uscourts.gov/opinions/pub/files/202410277.pdf |
| Texas Util. Code ch. 55 subch. F (ADAD): PUC permit; hours; message content. Whether an AI dialer is an "ADAD" is unclear. | FACT / OPEN | https://tcss.legis.texas.gov/resources/UT/htm/UT.55.htm |
| ElevenAgents Terms §3.6: outbound requires all consents, business identification at start, opt-out recognized in-call. | FACT (re-verified) | https://elevenlabs.io/agents-terms |
| Cal. PUC §2874 (artificial-voice ADAD notice); PA Act 47 of 2026 (artificial-voice robocalls). | FACT | 4.2, 4.7 |
| Policy: keep outbound AI off. When enabled: written consent via web form or "Reply YES" with full (f)(9) wording; script says business name, "automated AI assistant", callback number, opt-out. | INFERENCE | — |

---

## 7. Q5. Privacy and retention (Texas)

### 7.1 TDPSA (Bus. & Com. Code ch. 541)

| Claim | Label | Source |
|---|---|---|
| §541.002(a)(3): applies only to a person that "is not a small business as defined by the United States Small Business Administration, except to the extent that Section 541.107 applies". | FACT | https://tcss.legis.texas.gov/resources/BC/htm/BC.541.htm |
| §541.107: a small business "may not engage in the sale of personal data that is sensitive data without receiving prior consent from the consumer." | FACT | same |
| SBA caps (13 CFR 121.201): electrical contractors $19.0M; other services to buildings $9.0M; software publishers $47.0M; CPAs $26.5M; physician offices $16.0M. | FACT | eCFR 13 CFR 121.201 |
| The lighting business and early Lightline are SBA-small. | INFERENCE | — |
| "Biometric data" excludes "a video or audio recording or data generated from" one (§541.001(3)). Content can still be sensitive (e.g., a caller mentions a diagnosis). | FACT / INFERENCE | same |
| Precise geolocation = technology-derived, within 1,750 feet. A spoken street address likely is not. Geocoding is OPEN. | FACT / INFERENCE / OPEN | same |
| Processor contract duties (§541.104(b)) apply once Lightline serves non-small tenants. HB 149 added AI-system security assistance to §541.104. | FACT | same |
| AG-only enforcement; 30-day cure; up to $7,500 per violation; no private action. | FACT | same |

### 7.2 Texas CUBI (voiceprints)

- Recording and transcribing callers, with no speaker template, is probably not a "voiceprint" capture. INFERENCE.
- Risk rises with speaker ID, voice authentication, per-person diarization, or using caller audio to clone. INFERENCE.
- Rule and penalties at 5.1. FACT.

### 7.3 Texas data security and breach (ch. 521, ch. 542)

| Claim | Label | Source |
|---|---|---|
| "Sensitive personal information" = name + SSN/ID/financial account with code, or health-related identifying info. Name + address + phone alone is not. | FACT / INFERENCE | https://tcss.legis.texas.gov/resources/BC/htm/BC.521.htm |
| §521.052: reasonable procedures; destroy records with SPI not to be kept. | FACT | same |
| §521.053: notify individuals ≤60 days; AG ≤30 days if ≥250 Texans; a data holder notifies the owner "immediately" (Lightline → tenant). | FACT | same |
| Penalties $2,000–$50,000 per violation; late-notice penalties up to $250,000 per breach. | FACT | same |
| Ch. 542 (SB 2610, eff. Sept. 1, 2025): <250 employees with a compliant cybersecurity program (e.g., NIST, CIS IG1, SOC 2) get no exemplary damages in breach suits. <20 employees: simplified requirements. | FACT | https://tcss.legis.texas.gov/resources/BC/htm/BC.542.htm |

### 7.4 Out-of-state privacy laws

| State | Threshold | Tiny Texas business covered? | Label |
|---|---|---|---|
| California CCPA | $26.625M revenue, or 100k consumers, or 50% revenue from selling | No | FACT https://cppa.ca.gov/regulations/cpi_adjustment.html |
| Connecticut (from July 1, 2026) | 35k consumers, or **any** sensitive-data processing, or selling | Unlikely (no CT targeting). Watch for Lightline. | FACT https://www.cga.ct.gov/2026/sup/chap_743jj.htm |
| Virginia, Montana, Nebraska | Volume thresholds; Nebraska SBA-small exemption | No | FACT |
| Other states (CO, OR, UT, etc.); WA My Health My Data | Not verified | OPEN | OPEN |

### 7.5 Retention defaults

- No Texas statute sets a minimum retention for a private, unregulated business's call recordings. INFERENCE (none found).
- Anchors: FTC "Keep only what you need" (FACT, https://www.ftc.gov/business-guidance/resources/protecting-personal-information-guide-business); Safeguards Rule 2-year disposal for financial data (FACT, 16 CFR 314.4(c)(6)); CUBI 1-year and BIPA 3-year for biometrics (FACT); NIST SP 800-88 Rev. 2 for secure deletion (FACT, https://csrc.nist.gov/pubs/sp/800/88/r2/final).
- Defaults: see table 2.1. All INFERENCE.

### 7.6 Vendor retention facts

| Vendor | Fact | Label | Source |
|---|---|---|---|
| Twilio | No fixed retention; recordings kept until deleted. Metadata kept 40 days after deletion. | FACT | https://www.twilio.com/docs/voice/api/recording |
| ElevenLabs | Transcripts and audio kept 2 years by default; configurable in days; audio-saving toggle. | FACT | https://elevenlabs.io/docs/eleven-agents/customization/privacy/retention |
| ElevenLabs ZRM | "No call recordings will be stored." Enterprise. Data via post-call webhook. | FACT | https://elevenlabs.io/docs/eleven-agents/customization/privacy/zrm |
| ElevenLabs Reception Offering | "Records and transcribes calls … by default"; zero-retention/redaction/residency "are not part of the Reception" offering; regulated businesses limited to "general reception, routing, and scheduling". | FACT (re-verified) | https://elevenlabs.io/agents-terms |

---

## 8. Q6. Regulated tenants: flags only

**Medical tenants (HIPAA).** A doctor is a covered entity. Lightline becomes a business associate because it creates, receives, maintains or transmits PHI (45 CFR 160.103). It needs a BAA with each practice. It may pass PHI to subcontractors only with written assurances (45 CFR 164.502(e), 164.504(e)). So Twilio, ElevenLabs and the LLM vendor each need a subcontractor BAA. Twilio offers a BAA only on Security or Enterprise Edition, for listed HIPAA-eligible services. ElevenLabs offers a BAA only on Enterprise, with Zero Retention Mode and BAA-covered LLMs. The ElevenLabs "Reception Offering" limits regulated businesses to reception, routing and scheduling. Texas adds: H&S Code ch. 181 (HB 300) treats anyone possessing PHI as a covered entity, with 90-day staff training and penalties up to $250,000. SB 1188 (H&S ch. 183) requires electronic health records to be "physically maintained in the United States", including cloud storage. TRAIGA §552.051(f) requires AI disclosure to patients. California tenants: §1339.75 start-and-end AI disclaimer for clinical content; AB 489 bars implying a licensed human. Keep medical agents to scheduling and routing; collect no symptoms. Labels: FACT for cited texts (https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C ; https://elevenlabs.io/docs/eleven-agents/legal/hipaa ; https://www.twilio.com/en-us/hipaa ; https://tcss.legis.texas.gov/resources/HS/htm/HS.181.htm); HHS cloud guidance returned 403 (OPEN); scope advice is INFERENCE.

**CPA tenants (GLBA / IRC §7216).** A tax preparation service is a "financial institution" under the FTC Safeguards Rule (16 CFR 314.2). Lightline is its "service provider". The CPA must select capable providers, require safeguards by contract, and assess them (§314.4(f)). Breaches of unencrypted data affecting ≥500 consumers go to the FTC within 30 days (§314.4(j)). Under 26 CFR 301.7216-1, a taxpayer's name and address furnished for return preparation are "tax return information". A provider of auxiliary services is itself a "tax return preparer". Preparer-to-preparer disclosure is allowed only to US-located preparers (§301.7216-2(d)). Offshore processing needs taxpayer consent. Penalties: criminal up to 1 year / $1,000; civil $250 per disclosure. AICPA ET 1.700.040 requires a confidentiality contract or client consent before using a third-party provider. Keep CPA-tenant data US-only, never use it for training or marketing, and collect nothing beyond contact and callback reason. Labels: FACT for cited texts (https://www.ecfr.gov/current/title-16/part-314 ; https://www.ecfr.gov/current/title-26/section-301.7216-2 ; https://www.irs.gov/pub/irs-pdf/p4557.pdf ; https://pub.aicpa.org/codeofconduct/ethicsresources/et-cod.pdf); scope advice is INFERENCE. Utah §13-77-103(3) adds a start-of-call AI disclosure for licensed CPAs collecting financial data (FACT).

---

## 9. Where research sources disagree or are thin

| Topic | Issue | Label |
|---|---|---|
| Cal. Civ. Code §3344 and digital replicas | One law-firm alert says SB 683 added replicas; current code text has no such subsection (it depended on vetoed SB 11). | FACT (code) vs SECONDARY |
| Colorado §6-1-1704 | Secondary sources disagree on whether the old disclosure duty took effect June 30, 2026. | OPEN |
| Utah "high-risk" | Text reads as alternatives; one policy summary reads it as conjunctive. | OPEN |
| ElevenLabs non-Enterprise training default | Terms grant a training licence; help page states only the Enterprise default. | OPEN |

---

## 10. COUNSEL REVIEW NEEDED

Priority order. **P1 blocks launch.**

| # | Pri | Question |
|---|---|---|
| 1 | P1 | **Texas ch. 302.** Are TV-ad-prompted inbound calls and Amy's quote callbacks "telephone solicitations"? Does §302.059(1) fit the actual sales flow (in-person estimate, no phone deposit)? Register defensively ($200 + $10,000 bond)? Does the SOS text-message position reach voice? |
| 2 | P1 | Approve the exact greeting (2.2). Is "AI assistant, not a person" + "recorded and transcribed" + "AI service providers process it" enough for CA §§631/632/632.7, WA, CT, FL, MD, NH, Maine §1500-DD, and ElevenAgents §3.5(b)? Must vendors be named on the call? |
| 3 | P1 | CIPA §631 vendor exposure (Ambriz, Taylor v. ConverseNow). Does caller consent to "recording/transcription/vendor processing" defeat the theory? Do vendor training opt-outs or DPAs matter? Business aiding-and-abetting risk? Does Twilio fit the §631(b)(1) telephone-company exemption? |
| 4 | P1 | Decline-recording flow (2.3). Is real-time vendor processing before and during the "no" acceptable? |
| 5 | P1 | Confirm the SMS ask-first design and template as "informational" and outside written-consent rules (federal, FL §501.059, MD, WA RCW 19.190). |
| 6 | P2 | "May be recorded" vs "is recorded" where all calls are recorded (CA, WA). Re-announcement at transfer. |
| 7 | P2 | Choice of law for WA, IL, PA, MD, MA callers. FL implied consent and business-extension exception for cloud recording. MI participant rule for vendor recording. DE statutory conflict. |
| 8 | P2 | Callback policy: confirm strict hours (Mon–Sat 9–8, Sun 12–8 local) and 3-attempt cap satisfy TX ch. 301/304, FL §501.616, MD §14-4502(c), WA RCW 80.36.390, 64.1200(d). Is the TSR implicated by interstate callbacks? |
| 9 | P2 | Voice clone: does a synthetic clone involve a CUBI/BIPA "voiceprint"? Do CUBI (e)(2)/(f) apply? Approve the consent form (5.3). Is a SaaS click-through a "services" agreement under CA §927 / NY §5-302 / IL 815 ILCS 550? Is inbound reception "advertising or trade" (NY §51) or "soliciting" (Cal. §3344, ELVIS)? |
| 10 | P2 | Retention schedule (2.1): align job records with Texas limitations periods and tax needs. Consent-evidence 5-year rule. |
| 11 | P2 | FCC 26-67 effective date; whether to designate an exclusive revocation method. |
| 12 | P3 | Future AI outbound: PEWC capture method; voice-recorded consent under FL/MD "written" rules; Texas ADAD (Util. Code ch. 55) coverage; PA Act 47; Cal. PUC §2874; pending FCC 24-84. |
| 13 | P3 | Multi-tenant: Lightline as TDPSA processor vs controller; DPA template; when SBA-small status ends. |
| 14 | P3 | Medical tenants: BAA chain, US-only storage under SB 1188, TRAIGA §552.051(f) for scheduling-only agents, Cal. §1339.75 scope, ElevenLabs Reception Offering limits. |
| 15 | P3 | CPA tenants: whether pre-engagement intake is "tax return information"; Safeguards Rule contract terms; Texas State Board of Public Accountancy confidentiality rules (not checked). |
| 16 | P3 | Utah: "either/both" high-risk test; Ch. 77 survival after July 1, 2027. Colorado §6-1-1704 June–Dec 2026 window. |
| 17 | P3 | Can the platform resell ElevenAgents to many tenants on one account, or does it need OEM terms? |

---

## 11. Not verified, and failed sources

Not verified (treat as OPEN):

- Jones v. Peloton; NEI Contracting v. Hanson; Commonwealth v. Jackson (MA); Commonwealth v. Byrd primary text; Sullivan v. Gray primary text.
- In re Otter.ai; Lisota v. Heartland Dental; SoundHound/Chipotle suits.
- SB 690 signature date (secondary only). AB 1609 final enrolled text (June version read).
- FCC Ifinity ruling text; FCC 1992 order original (read only as quoted in FCC 15-72).
- Oklahoma mini-TCPA (15 O.S. §775C): site showed a bot check; not bypassed.
- Texas common-law right of publicity; Tennessee ELVIS remedies (§47-25-1106).
- Texas AG enforcement history under TDPSA and CUBI.
- Other states' comprehensive-privacy thresholds; Washington My Health My Data Act.
- LLM vendor terms (training, retention, BAA, US residency).
- ElevenLabs BIPA suit status after May 2026.
- HHS cloud-provider guidance (403).
- Pending: PA SB 806, NY A 3411, FCC Club for Growth and Shields petitions, Commerce list under EO 14365.

Failed or blocked (mirror used where noted):

| Site | Result | Workaround |
|---|---|---|
| statutes.capitol.texas.gov | JavaScript app, no text | tcss.legis.texas.gov official file server |
| leginfo.legislature.ca.gov | 403 | california.public.law, codes.findlaw.com mirrors |
| law.justia.com | 403 | Other mirrors |
| legiscan.com | 403 | Official sites |
| ilga.gov | TLS errors via fetch | Retrieved via PowerShell |
| ecfr.gov HTML | Redirect to block page | eCFR versioner API |
| hhs.gov guidance | 403 | None |
| courtlistener.com search | 403 | Direct PDF URLs |
| legislature.mi.gov | Connection refused | findlaw mirror |
| fcc.gov ECFS pages | 403 | publicapi.fcc.gov, docs.fcc.gov PDFs |
| texasattorneygeneral.gov TDPSA page | 402 / failed | None |
| OSCN (Oklahoma) | Bot check | Not bypassed |
| WebSearch | Shared budget exhausted mid-research | Direct fetches of known URLs |
