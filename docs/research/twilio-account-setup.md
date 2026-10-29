# Twilio account setup for Lightline: who owns it, what to collect

As of **2026-10-24** (a Saturday). Read-only research. No accounts were created and no forms were submitted.

Labels: **FACT** = stated in a source opened today, with source key [S#] (URLs at the bottom). **INFERENCE** = my conclusion from those facts. **OPEN** = not documented, or Amy/Josh must answer.

Gaps: help.twilio.com pages are script-rendered. I read them in a real browser. support.twilio.com returns 403. TCR has no public rulebook, so TCR claims come from its resources page plus Twilio's docs. The 2026 Trust Hub console ("1console") is new. Some help articles still describe the legacy console.

---

## 0. Answer in one screen

| Question | Answer |
|---|---|
| Can Pavan create the account in his own name? | Yes for a **dev/test** account. **No** for production. Numbers, Trust Hub and A2P records stay with the account. Moving them later needs Support, approval from both sides, and full re-registration. |
| Recommended setup | **CLG owns the production account.** Sign up with a CLG business-domain email and pay with CLG's card. Josh or Amy does the 15–20 minute signup and upgrade, then invites Pavan as **Administrator**. Pavan does everything else. |
| Why Administrator, not Developer | Only Owner and Administrator can use Trust Hub. Developer cannot [S20]. |
| Biggest hidden blocker | Accounts upgraded on or after 2026-02-03 are capped at **2 concurrent calls** until a **Business** profile is approved [S16]. A ring-first call to Amy probably uses 2 call legs. |
| Second blocker | A trial account strips `<Stream>` and `<Dial><Number>` [S18]. ElevenLabs Media Streams cannot be tested on trial. Upgrade on day one. |
| Texts to Amy | US carriers block them without an approved A2P 10DLC campaign, even to one staff phone [S12]. Plan on about 1–2 weeks. Use email or voice-call alerts until it is approved. |
| Cost of compliance | Low-Volume Standard brand $4.50, campaign vetting $15, Low-Volume Mixed $1.50/mo [S1][S2]. CNAM is free [S14]. |

---

## 1. Ownership options

### 1(a) CLG creates the account and invites Pavan (recommended)

| Claim | Label | Src |
|---|---|---|
| Each account has exactly one Owner: the email that created it. The Owner has access to everything. | FACT | S20 |
| Other roles: **Administrator** (invite and remove users, billing, project settings), **Developer** (API credentials, phone numbers, dev tools, logs, usage), **Billing Manager**, **Support** (logs and usage only). | FACT | S20 |
| Permission matrix: **Trust Hub = Owner and Administrator only.** Manage phone numbers = Owner, Admin, Developer. | FACT | S20 |
| Invite path (help article, legacy console): Accounts menu → pick account → **Admin (top right) → Account management → Manage users → Invite** → choose a role → **Send Invitation**. The invitee must accept. In an Organization, invite from the Admin Center instead. | FACT | S20 |
| You can hold Owner or Administrator, not both. Developer, Billing Manager and Support can be combined. | FACT | S20 |
| To transfer US numbers between accounts, Twilio accepts approval from Owner, Admin or Developer. | FACT | S22 |
| Pavan as Administrator can buy numbers, configure webhooks and Streams, do all Trust Hub work and invite users. He cannot close the account. | INFERENCE from S20 |
| If Pavan leaves, Josh or Amy removes his user. Numbers, registrations and billing stay put. | INFERENCE |

### 1(b) Pavan creates the account in his name and pays

| Claim | Label | Src |
|---|---|---|
| The Terms bind "you or the organization on whose behalf you are accepting." The Customer is responsible for all use under the account. | FACT | S24 |
| The AUP prohibits "creating a false identity" and misleading others about who the sender is. | FACT | S26 |
| To register a separate business from your own account, you need an approved **primary business** profile first. Then you add a **secondary** profile for the other brand. | FACT | S8 |
| For the ISV route, the ISV's own primary profile must be approved, with Business identity "ISV Reseller or Partner." The authorized representative is "for your customer's business." Twilio recommends one subaccount per ISV customer. | FACT | S11, S21 |
| An **Individual** primary profile gets "limited A2P," "unbranded voice calls," and 3 concurrent calls. It cannot create a secondary profile. | FACT | S8, S16 |
| Campaign rule: register the actual business that sends the messages, not the software vendor. | FACT | S4 |
| No source I read says written authorization from the client is required. Twilio may still contact the authorized representative to confirm the business. | OPEN; FACT that Twilio may call the rep (S11, S9) |
| Phone numbers are "associated with Customer's account." Twilio may reclaim numbers on accounts suspended for 90+ days. A port-out needs the Customer's explicit consent, plus consent of the number's user if that is someone else. | FACT | S25 |
| Risks if Pavan owns the account: (1) CLG's public number is legally on Pavan's account. (2) If his card fails, the account can be suspended, and after 90 days the number can be reclaimed. (3) Moving the number needs Pavan's approval. | INFERENCE from S22, S25 |
| The ISV route needs Pavan's own registered business with an EIN. It is unclear whether a sole proprietor with an EIN qualifies as an ISV primary profile. The documented business types are Co-op, Corporation, LLC, Non-profit and Partnership. | OPEN; S6 |
| Self-service account-owner change requires Twilio Organizations and **corporate email domains** for both the current and new owner. With gmail.com it becomes a Support ticket. | FACT | S21 |
| Moving an account to a different **legal entity** needs Twilio's signed Assignment and Assumption Agreement. It takes effect on the 1st of the following month. | FACT | S24 |

**If CLG cannot do the signup itself**, use this fallback. Get Josh's OK in writing. Pavan then creates the account **as CLG**: CLG's domain email, Business identity = Direct, CLG's legal data, Josh as authorized representative. He invites Josh as Administrator the same day and transfers ownership within the week (Settings → All settings → Accounts → ⋯ → Change account ownership [S21]). This avoids an entity assignment. Pavan's own ID and selfie would sit on the account (§2.1). INFERENCE.

### 1(c) A subaccount for CLG under Pavan's account

| Claim | Label | Src |
|---|---|---|
| A parent account cannot become a subaccount, or the reverse. Accounts cannot be merged or migrated. | FACT | S23 |
| Support moves numbers and balance only. It does **not** move users, subaccounts, number configs, regulatory bundles, Trust Hub registrations or WhatsApp registrations. | FACT | S23 |
| Moving a number between unrelated accounts needs a Support ticket. Include the number(s), the losing and gaining Account SIDs, written approval from both accounts (matching tickets if the owners differ), and a timeframe with timezone. | FACT | S22 |
| Transferred numbers "lose their existing configuration" and their A2P registrations. You must reconfigure and **re-register**. | FACT | S22 |
| Within one parent hierarchy (parent to subaccount, or subaccount to subaccount), you move a number by API: POST to `IncomingPhoneNumber` with the new `AccountSid`, using main-account credentials. Error 21473 otherwise. | FACT | S22 |
| Toll-free verification records "cannot transfer between accounts." | FACT | S28 |
| A subaccount does not save time now. It costs a second registration later, and the number goes quiet on SMS while the new campaign is vetted. **Reject this option.** | INFERENCE |

### Recommendation (speed and safety)

1. **Today**: Pavan uses his own account as a **dev sandbox**. Upgrade it, buy a throwaway 512 number, and build Streams to ElevenLabs and callbacks. Never publish that number. Keep Account SID, auth and number in env vars so swapping accounts is a config change. INFERENCE.
2. **Today or Monday**: Josh or Amy creates the **CLG production account**, upgrades it as a **Business**, and invites Pavan as **Administrator**. Buy the public 512 number **only** in this account.
3. Pavan submits the Business profile right away, then SHAKEN/STIR, CNAM, Voice Integrity and A2P in that order (§3, §2.2).

---

## 2. What Twilio asks for, field by field

### 2.1 Signup, upgrade and Business (Primary) profile

| Step / field | What to enter for CLG | Label | Src |
|---|---|---|---|
| Signup | Verify an email and a personal phone number. | FACT | S18 |
| Upgrade: legal first and last name, phone | The person doing the upgrade. | FACT | S19 |
| Upgrade: government ID upload (Persona). A selfie may be required. | That same person. After 3 failed tries you can escalate (48 business hours). Twilio suggests "a colleague or partner" can do it if your ID type is unsupported. | FACT | S19 |
| Upgrade: identity type (Business or Individual), address, tax number, funding amount, payment method | Choose **Business**. Upgrade data becomes the Primary Customer Profile. An approved profile can only be changed through Support. | FACT | S19 |
| Profile friendly name | e.g., "CLG primary" | FACT | S8 |
| Legal business name | **Exact** name on the IRS CP-575 letter (or a 147C). Not the W-2/W-9 name. | FACT | S6 |
| Business identity | **Direct Customer** | FACT | S6, S9 |
| Business type | Co-operative, Corporation, LLC, Non-profit Corp, or Partnership | FACT | S6 |
| Industry; company type | Industry enum is optional in the new console. Company type = **private**. | FACT | S6, S8 |
| Registration ID type and number; country | **EIN**, format `00-0000000`; US | FACT | S6 |
| Website URL | A live, public site that "bear[s] some relationship" to the legal name. It is screenshotted automatically. | FACT | S6 |
| Social media profile URL | Facebook or Instagram. The new console lists it without "(optional)". | FACT | S8 |
| Regions of operation | `USA_AND_CANADA` | FACT | S6 |
| Address | Physical street address: street, city, state (TX), ZIP, US. TCR says it should match IRS or corporate records. | FACT | S8, S27 |
| Authorized representative #1 (required) | First and last name as on government ID, business title, job position (Director/GM/VP/CEO/CFO/General Counsel/Other), E.164 phone, email. Twilio may contact this person. | FACT | S6, S9 |
| Authorized representative #2 | Optional in the ISV/secondary API. The new primary console shows one. | FACT | S11 |
| Notification email or status callback | At least one | FACT | S9 |
| Government ID and selfie (new console) | Listed for Business profiles too. **Who** must do it (the logged-in user or the rep) is not stated. | FACT / OPEN | S8 |
| Review time | "Up to 48 hours" (Profiles page). "24 hours" (SHAKEN doc). | FACT | S8, S13 |
| An approved primary profile is required **before any registration** (A2P, SHAKEN/STIR, CNAM). | FACT | S8 |

### 2.2 A2P 10DLC brand

| Claim | Label | Src |
|---|---|---|
| Brand types. **Sole Proprietor**: no EIN, 1 campaign, 1 number, about 3,000 msgs/day. **Low-Volume Standard (LVS)**: EIN, under 6,000 segments/day. **Standard**: EIN, more volume. | FACT | S3, S10 |
| A sole proprietorship **with** an EIN must not register as Sole Proprietor. | FACT | S6 |
| Fees (TCR raise, 2025-08-01). Brand $4.50 one-time (Sole Prop, LVS, Standard). Standard adds secondary vetting $41.50 (total $46). Vetting appeal $11. Authentication Plus $12.50 per retry, for **public** for-profit brands only. | FACT | S1, S10 |
| Brand registration takes minutes, sometimes up to 24 hours. A data mismatch triggers manual secondary vetting of up to 7 days. | FACT | S3 |
| The brand is created from the existing Trust Hub profile: Trust Hub → Registrations → A2P Brands → Create A2P Brand. | FACT | S10 |
| The EIN must match the legal name. New EINs take 30–90 days to propagate. A Support identity appeal takes 5–7 business days. | FACT | S6, S27 |
| Common rejections: dead, parked or login-only website; name/EIN mismatch; free or personal email; the same email or address used 10+ times across TCR brands. | FACT | S6 |
| **DBA**: Twilio documents DBAs only for Sole Prop brand names. For Standard and LVS brands the legal name rules. Reviewers flag brand-name mismatches. | FACT / OPEN | S6, S4 |
| Fix for the DBA problem: register the legal entity's name. Add "The Christmas Light Guys is a DBA of ‹Legal Name›" to the site footer and privacy policy. Name both in the campaign description. | INFERENCE |
| One Tax ID can hold up to 5 LVS or Standard brands. Sublime Patio and The Fridge need their own brands only if they are separate entities or send their own texts. | FACT (limit) / OPEN (entities) | S7 |
| **Pick: LVS brand.** Alert volume is tiny. | INFERENCE |

### 2.3 A2P campaign (alerts to Amy, plus a daily summary)

| Field | Content for Lightline | Label | Src |
|---|---|---|---|
| Use case | **Low Volume Mixed** ($1.50/mo; under 2,000 segments/day to T-Mobile; lowest throughput). Or Account Notifications ($10/mo). There is no "internal staff" use case. | FACT (list, fees) / INFERENCE (pick) | S1, S5 |
| Campaign vetting | $15 one-time, non-refundable. "Up to 5 business days." The current banner says **up to 10 business days**. Contact Support after 10 days. | FACT | S2, S3 |
| Description | Must say who sends, who receives and why. Example: "Messages are sent by ‹Legal Name› dba The Christmas Light Guys to its own office staff who opted in, with missed-call, voicemail and callback alerts from the company phone line, and a daily call summary." Leave out names and phone numbers (PII). | FACT (rules) | S4 |
| Message flow (opt-in) | Opt-in methods: web form, verbal, paper form, QR code or keyword. Each needs a description plus visual proof. If the proof isn't public, link a screenshot (Drive/OneDrive). | FACT | S4 |
| Opt-in for Amy | A signed one-page **paper consent form**. Required items: phone field, description, frequency, "Msg & data rates may apply", HELP/STOP, links to T&C and privacy policy, signature and date. Keep the original. Send a confirmation text on enrollment. | FACT (form rules) / INFERENCE (method) | S4 |
| Consent law | Prior express consent, for each subject. Keep proof (date and method). STOP must work in one step. Every message names the sender. | FACT | S26 |
| Privacy policy and T&C | **Required for every registration.** Privacy policy must say: "We do not sell or share your SMS opt-in data or personal information with third parties for marketing purposes." T&C needs program name, frequency, rates, **HELP/STOP in bold**, support contact, and "Carriers are not liable for any delayed or undelivered messages." | FACT | S4 |
| Sample messages (2–5) | Use [placeholders] and the brand name. At least one includes "Reply STOP to opt out." Tick the "embedded links" and "phone numbers" boxes if they apply. | FACT | S4 |
| Keywords | Opt-in confirmation (required for recurring). STOP and HELP replies unless Twilio's defaults handle them. | FACT | S4 |

### 2.4 Do texts to Amy need A2P at all?

| Claim | Label | Src |
|---|---|---|
| "Carriers in the US consider all Twilio traffic to be A2P." | FACT | S3 |
| Twilio **blocks** US-bound messages from a +1 10DLC number not tied to an approved campaign (error 30034). | FACT | S12 |
| Alternative: **toll-free + Toll-Free Verification**. About 3–5 business days. No TCR brand or campaign fees. Unverified or pending numbers are blocked (30032). Records can't move between accounts. It is a second number. | FACT | S28 |
| Alternative: **email** alerts need no registration. **Voice-call** alerts to Amy fall outside A2P SMS rules. TCPA consent still applies. | INFERENCE |
| Plan: launch with email plus an optional automated call to Amy. Switch on SMS when the campaign is approved. | INFERENCE |

---

## 3. Voice: what the Business profile changes

| Claim | Label | Src |
|---|---|---|
| Concurrency (Programmable Voice): Trial **5**. No approved profile **2**. Approved Individual profile **3**. Approved **Business** profile **unlimited**. This applies to accounts upgraded on or after **2026-02-03**. | FACT | S16 |
| "Concurrent calls are the total number of inbound and outbound calls on the account at the same time." Overflow fails with error **10004**. | FACT | S16 |
| A ring-first `<Dial>` to Amy plus the parent call is 2 legs. With no profile, a second caller during that call could fail. The Business profile is a **go-live gate**. | INFERENCE |
| CPS defaults to 1. Self-serve CPS increases need an approved Business profile. Unlimited inbound rate also assumes a Business profile. | FACT | S16 |
| SHAKEN/STIR **A** needs: approved Business profile, approved SHAKEN/STIR Trust Product linked to it, and the number assigned to **both**. Approved primary plus Trust Product without the number assigned gives **B**. No approved profile gives **C**. | FACT | S13 |
| Vetting: 24 hours for the Business profile, 72 hours for the SHAKEN/STIR Trust Product. Path: Trust Hub → Registrations → SHAKEN/STIR → Create registration (name plus profile). | FACT | S10, S13 |
| Callbacks signed C are more likely to show "Spam Likely." Register SHAKEN before callbacks go live. | INFERENCE |
| **CNAM**: free, US local numbers only, profile must carry an EIN or DUNS. Display name: up to 15 characters, starts with a letter, letters/numbers/spaces/periods/commas only, unique, must reflect the registered business. Shows on landlines by default; mobile users must opt in. Takes 48–72 hours to propagate after approval. CNAM is in **public beta**. | FACT | S14 |
| CNAM candidates: `XMAS LIGHT GUYS` or `CHRISTMAS LIGHT` (15 characters each). Ask whether a DBA name will pass the "registered business" check. | INFERENCE / OPEN |
| **Voice Integrity** submits numbers to TNS, First Orion and Hiya for spam-label review. It needs an approved profile with EIN or DUNS, a US address, a rep with a US phone and an **https** website. | FACT | S15 |
| None of this is needed for **testing**. After upgrade, calls work with no profile (2 concurrent, C attestation). | FACT (limits) / INFERENCE | S16, S13 |

---

## 4. Checklists

### What to ask Amy/Josh (minimal set)

1. **Exact legal entity name** as on the IRS CP-575 or 147C letter. A photo of the letter is best. Is "The Christmas Light Guys" a DBA? Is "The Light Guys" a second DBA?
2. **EIN**, and roughly how old it is (under 90 days is risky).
3. **Entity type**: LLC, corporation, partnership, or sole proprietorship with an EIN.
4. **Physical business address** as on IRS records (no PO box).
5. **Authorized rep #1** (Josh): legal name as on ID, title, job position, mobile, business email. **Rep #2** (Amy): the same fields.
6. A **business-domain email** for the account Owner and notices (not gmail). Which domain do they own?
7. **Website URL** that shows the legal name, plus **social media URL(s)**.
8. Is there a **privacy policy and T&C** page? Who can edit the site to add the SMS clauses?
9. **Amy's mobile** and her **signed SMS consent form** (Pavan drafts it).
10. **Who signs up and upgrades** (government ID and selfie) and **whose card** pays. Ideally Josh or Amy, on a 20-minute screen share.
11. Are Sublime Patio and The Fridge **separate legal entities** with their own EINs? This matters for future brands.

### What Pavan can do alone, today

| Can do now | Notes | Label | Src |
|---|---|---|---|
| Open his own trial | No card needed. 30 days, 75 voice minutes, calls only to 5 verified numbers, shared trial numbers. | FACT | S18 |
| **Upgrade his own dev account right away** | Trial strips `<Stream>`, `<Dial><Number>`, `<Record>` and `<ConversationRelay>`. Calls are capped at 10 minutes. You can't buy your own number on trial. | FACT | S18 |
| Buy a test 512 number (first month free) | Individual profile: 3 concurrent calls, CPS 1, C attestation. Fine for development. | FACT | S16, S18 |
| Build and test inbound Streams to ElevenLabs, outbound callbacks, ring-first `<Dial>` | All of these work after upgrade. No profile is needed. | INFERENCE | S16 |
| Draft the Business profile data, A2P description, samples, consent form, privacy and T&C text | Ready to paste once Amy and Josh answer. | INFERENCE |
| **Not** possible yet | SMS to any US phone (blocked, 30034). A or B attestation, CNAM, or Voice Integrity under CLG's name. | FACT | S12, S13, S14 |

**Critical path** (INFERENCE from the timings above): CLG account and upgrade on 10/24–26. Profile approved by about 10/28. Then SHAKEN (72 hours) and CNAM (+48–72 hours) by about 11/2. A2P brand the same day the profile is approved. Campaign done by about **11/4–11/9** (5–10 business days). Voice go-live depends on profile approval. SMS go-live depends on the campaign.

---

## Sources (opened 2026-10-24)

- S1 Twilio, A2P 10DLC pricing and fees: https://help.twilio.com/articles/1260803965530-What-pricing-and-fees-are-associated-with-the-A2P-10DLC-service-
- S2 Twilio, Campaign Vetting FAQ: https://help.twilio.com/articles/11587910480155-A2P-10DLC-Campaign-Vetting-FAQ
- S3 Twilio, Overview of A2P 10DLC: https://help.twilio.com/articles/1260800720410-What-is-A2P-10DLC-
- S4 Twilio, Campaign Onboarding Guide: https://help.twilio.com/articles/11847054539547-A2P-10DLC-Campaign-Approval-Requirements
- S5 Twilio, Campaign use case types: https://help.twilio.com/articles/1260801844470-List-of-campaign-use-case-types-for-A2P-10DLC-registration
- S6 Twilio docs, Gather business information: https://www.twilio.com/docs/messaging/compliance/a2p-10dlc/collect-business-info
- S7 Twilio docs, A2P 10DLC: https://www.twilio.com/docs/messaging/compliance/a2p-10dlc
- S8 Twilio docs, Trust Hub Profiles (modified 2026-09-25): https://www.twilio.com/docs/trust-hub/profiles
- S9 Twilio docs, Primary compliance profiles: https://www.twilio.com/docs/trust-hub/profiles/primary-compliance-profiles ; legacy console guide: https://www.twilio.com/docs/trust-hub/trusthub-rest-api/console-create-a-primary-customer-profile
- S10 Twilio docs, Trust Hub Registrations: https://www.twilio.com/docs/trust-hub/registrations ; Brand: https://www.twilio.com/docs/trust-hub/registrations/a2p-10dlc-brand ; SHAKEN/STIR: https://www.twilio.com/docs/trust-hub/registrations/shaken-stir
- S11 Twilio docs, ISV onboarding guide: https://www.twilio.com/docs/messaging/compliance/a2p-10dlc/onboarding-isv-api
- S12 Twilio, Error 30034: https://www.twilio.com/docs/api/errors/30034
- S13 Twilio docs, SHAKEN/STIR onboarding (modified 2026-08-19): https://www.twilio.com/docs/voice/trusted-calling-with-shakenstir/shakenstir-onboarding
- S14 Twilio docs, CNAM: https://www.twilio.com/docs/voice/brand-your-calls-using-cnam ; https://www.twilio.com/docs/trust-hub/registrations/cnam ; Error 11009: https://www.twilio.com/docs/api/errors/11009
- S15 Twilio docs, Voice Integrity: https://www.twilio.com/docs/voice/spam-monitoring-with-voiceintegrity
- S16 Twilio, Call concurrency and CPS: https://help.twilio.com/articles/223180028-How-Fast-Can-I-Place-or-Receive-Phone-Calls-with-Twilio ; Error 10004: https://www.twilio.com/docs/api/errors/10004 ; sending limits: https://help.twilio.com/articles/223183648-Sending-and-Receiving-Limitations-on-Calls-and-SMS-Messages
- S18 Twilio docs, Trial account (modified 2026-10-20): https://www.twilio.com/docs/usage/trials ; Try out Voice: https://www.twilio.com/docs/usage/trials/try-out-voice
- S19 Twilio, Upgrade: https://help.twilio.com/articles/223183208-Upgrading-to-a-paid-Twilio-Account ; ID verification: https://help.twilio.com/articles/26134326277787-Why-does-Twilio-Require-my-ID-to-Upgrade
- S20 Twilio, User roles: https://help.twilio.com/articles/223136227 ; Add users: https://help.twilio.com/articles/223135847
- S21 Twilio, Change account owner: https://help.twilio.com/articles/223183428 ; console how-to: https://www.twilio.com/docs/usage/how-do-i ; Error 25016: https://www.twilio.com/docs/api/errors/25016
- S22 Twilio, Moving numbers between accounts: https://help.twilio.com/articles/223135327-Moving-Twilio-Phone-Numbers-to-another-Twilio-Account ; Error 21473: https://www.twilio.com/docs/api/errors/21473
- S23 Twilio, Merging accounts: https://help.twilio.com/articles/20068971939995-Merging-Two-Twilio-Accounts
- S24 Twilio Terms of Service: https://www.twilio.com/en-us/legal/tos ; Name changes and assignments: https://www.twilio.com/en-us/legal/name-change-assignments
- S25 Twilio, Services Using Phone Numbers terms: https://www.twilio.com/en-us/legal/service-country-specific-terms/phone-numbers
- S26 Twilio AUP: https://www.twilio.com/en-us/legal/aup ; Messaging Policy: https://www.twilio.com/en-us/legal/messaging-policy
- S27 The Campaign Registry, Resources: https://www.campaignregistry.com/resources/
- S28 Twilio, Toll-Free Verification: https://help.twilio.com/articles/5377174717595-Toll-Free-Message-Verification-for-US-Canada ; Error 30032: https://www.twilio.com/docs/api/errors/30032
