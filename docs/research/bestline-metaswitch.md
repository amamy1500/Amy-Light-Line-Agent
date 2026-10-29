# Bestline / Metaswitch (Alianza) routing research (2026-10-22)

Read-only research. Nobody was called, emailed or signed up. No settings were touched.

Labels:
- **FACT [Sn]**: stated in a source. Each `[Sn]` links to its URL (list at the end).
- **INFERENCE**: our judgement from the facts.
- **OPEN**: only Bestline (or a live test) can answer.

Source caveat (INFERENCE): Metaswitch does not publish its manuals. The best public copies are
carrier-branded copies of Metaswitch text. The best of them is a Metaswitch-copyright CommPortal
User Guide v9.5.40 [S3]. Bestline's version, menus and enabled services may differ.

---

## 0. One-screen answer

**Best setup (ranked; details in §7):**

1. **"Bestline rings Amy, AI on no-answer."** Amy logs in to the MaX UC Mobile app. The forward-all to her
   cell is turned off. In CommPortal, set no-answer (≈20 s), busy and unavailable to forward to a **dedicated
   Twilio number**. That number goes straight to the AI. Bestline sees the no-answer, so her cell voicemail never steals the call.
2. **"Bestline forwards all, Twilio rings Amy."** Keep forward-all, but point it at a Twilio number instead of
   her cell. Our built press-1 screen rings Amy's cell, then the AI answers. No new app is needed. Rollback is one setting.
   Every call then depends on Twilio.
3. Not recommended: "ring in order" to Amy's cell, then forward. Her cell voicemail or a declined call ends the hunt.

**Only Bestline can:** confirm the caller ID and Diversion header on forwarded calls. Only they know what a
caller hears when the forward target fails, the line's concurrent-call limit and the per-minute forwarding cost.
Only they can add services (Easy Attendant, extra DIDs, hunt groups, schedules) and send SIP straight to us.
They also unlock or reset the CommPortal account.

**Top open questions:** see §7.4. The first three: caller ID kept? fallback when the forward target fails? how
many calls can forward at once?

---

## 1. Platform facts

| # | Claim | Label |
|---|---|---|
| 1.1 | Bestline's voice page lists "CommPortal" ("users and admins manage call routing… without a support ticket") and "Metaswitch MaxUC" (softphone for desktop and mobile). | FACT [S1] |
| 1.2 | It also lists "Easy and Premium auto attendants", multi-line hunt groups in "round-robin, linear, or longest-idle order", and "Call Jump & Forwarding: … forward on busy, no-answer, or after hours." | FACT [S1] |
| 1.3 | Bestline hours: Mon–Fri 8am–5pm, plus "24/7 Emergency Support"; (512) 328-9095, (800) 365-6030. | FACT [S2] |
| 1.4 | Alianza completed its purchase of Metaswitch from Microsoft (agreement Dec 2024; reported complete 2025-03-05). | FACT [S18] |
| 1.5 | "Alianza Core" lists MetaSphere CFS and EAS, MaX UC and Perimeta SBC. Alianza says it will "actively support and continuously evolve these platforms." | FACT [S17] |
| 1.6 | So Bestline's line is a MetaSphere CFS/EAS line with CommPortal and MaX UC. That matches the 2021 Bestline quick start guide. | INFERENCE |
| 1.7 | Is it Bestline's own switch, or a wholesale host they resell? This decides who can change SIP behaviour. | OPEN |

---

## 2. Q1 — Routing features and who can set them

Key: **User** = Amy's own CommPortal login. **BG admin** = a business-group admin login in CommPortal.
**Carrier** = Bestline in MetaView (their provisioning tool).

| Feature | What it does | Who sets it | Label |
|---|---|---|---|
| Forward all (immediate) | Every call goes to another number. "Forwarding calls to another number overrides other call services." If the target is busy or unavailable, "the call cannot be retrieved and will not go to your account voicemail." | User (CommPortal, MaX UC Call Manager) | FACT [S6], [S4] |
| Forward on no answer | Forwards if you "do not answer your phone within a certain time." Default action is voicemail. You "edit the number of seconds you wish the phone to ring before the call is forwarded." | User (CommPortal Call Manager) | FACT [S4], [S6], [S7] |
| Forward on busy | Applies "only if all of your devices are busy (or reject the call)." | User | FACT [S4], [S6] |
| Forward if unavailable | Applies when the phone is "unplugged or not logged in"; "different than the Forward no answer option." | User | FACT [S7], [S3] |
| Selective forward ("Forward Selected") | Calls from a list go to another number. | User | FACT [S3], [S30] |
| Ring order / Follow Me | "Ring the account phone first, set the number of rings, and then ring a second office, home, or mobile." On CFS: "ring a defined sequence of additional phone numbers when a subscriber does not answer." No-answer forward fires "after all the ringing periods have been completed." | User, if the service is enabled | FACT [S7], [S3], [S6] |
| SimRing | Rings several destinations at once. A destination's voicemail answering "will count as the call being answered, and no further destinations will be tried" (set "Permit forwarding" to No to limit this). | User, if enabled | FACT [S4] |
| MaX UC twinning, Call Jump | The account phone rings desk phone and every logged-in MaX UC app. Mid-call "push and pull" between devices. Call Jump needs "EAS Call Jump and DTMF Control" in the Class of Service. | User; Class of Service is Carrier | FACT [S7], [S11], [S3] |
| Do Not Disturb | Calls go to voicemail; priority callers can still ring. | User (CommPortal, MaX UC) | FACT [S3], [S13] |
| Time-of-day rules | Incoming Call Manager: up to 20 rule sets, weekly schedule, special days, public holidays. Only some deployments offer it. | User, if Carrier offers it | FACT [S3] |
| Easy / Premium Attendant (auto attendant) | Menus, business and non-business schedules, special days. A key can "Transfer to Phone", including "an external number such as an answering service". Off state can forward elsewhere. | Carrier creates the attendant line; then User or BG admin builds menus | FACT [S3], [S8], [S9] |
| Hunt group (MLHG) | Linear, circular or uniform hunting; queue when all busy; members can log in and out. External lines are "not enabled by default". | Carrier creates it (MetaView, "typically only accessible to a Metaswitch reseller"); BG admin edits | FACT [S3], [S5], [S15] |
| Call Service Group | Shared unconditional and unavailable forwarding for a group; a user's own setting overrides it. | BG admin (v9.5.40+) | FACT [S3] |
| Self-subscribing to new services | "Business Group Line Users … cannot self-subscribe to new services." | Carrier | FACT [S3] |
| Remote forwarding (from another phone with a PIN) | "Generally blocked by the System Administrator for security purposes." | Carrier | FACT [S7] |
| Star codes | Seen at other carriers: *72/*73 forward all, *92/*93 no-answer, *90/*91 busy, *78/*79 DND. | User, from the line's own phone | FACT [S10] (one carrier; Bestline codes are OPEN) |
| Caller ID on forwards, Diversion, SIP routes, call limits, Class of Service | Not in any user guide. | Carrier | INFERENCE |

Notes:
- **FACT [S3]:** "Subscribers will only see the call services that they are subscribed to." Amy's CommPortal may lack some rows above. **OPEN.**
- **FACT [S3]:** CommPortal comes in several Call Manager flavours: Business Call Manager, Easy Call Manager, Incoming Call Manager and CFS Call Manager. Which one Bestline runs is **OPEN**.
- **INFERENCE:** the MaX UC app's own Call Manager has only Available / DND / Forward all [S11], [S13]. The no-answer and unavailable forwards must be set in CommPortal (web), once.

---

## 3. Q2 — MaX UC Mobile instead of forward-all

| # | Claim | Label |
|---|---|---|
| 3.1 | The "account phone" is the 10-digit number. It rings the desk phone, MaX UC Desktop and MaX UC Mobile. "When logged in to more than one Account Phone, all devices ring." | FACT [S7] |
| 3.2 | The app keeps running when closed: "if it is closed, calls and chats will continue to come to your device. To prevent this, you must log out." | FACT [S12] |
| 3.3 | Rejecting a call on all devices counts as busy, so busy forwarding applies. | FACT [S4] |
| 3.4 | Not logged in, or unreachable: "Forward if Unavailable" applies. | FACT [S7] |
| 3.5 | If the password expires, the app "will only be able to receive calls", then the account locks. | FACT [S13], [S11] |
| 3.6 | **So the no-answer forward does fire.** The app is a Metaswitch device, so the switch itself times the ring. No outside voicemail can answer first. This is the whole reason to prefer it over forward-to-cell. | INFERENCE (from 3.1–3.4, [S6]) |
| 3.7 | Ring timeout: set in seconds per line. Defaults differ by carrier: one carrier KB says a blank field means 30 s; another says a ring cycle is 6 s ("24 seconds = 4 rings"). | FACT [S6], [S7]; FACT (weak) [S14]; FACT [S4] |
| 3.8 | Bestline's default and allowed range | OPEN |
| 3.9 | Suggested value: **20 s**. Push wake-up on a phone adds a little delay. 20 s is about 3 rings to the caller, and close to our Twilio ring (≈18 s). | INFERENCE |
| 3.10 | Today, forward-all is on, so no-answer and unavailable rules are inactive. CommPortal flags services "made inactive by another setting." | FACT [S3], [S6] |
| 3.11 | Push and iOS/Android notification reliability for MaX UC is not documented publicly. A missed push means no ring, then the no-answer timer, then the AI. That fails safe. | OPEN / INFERENCE |

The cell-voicemail trap, in Metaswitch's own words: a destination's voicemail picking up "will count as the
call being answered" [S4]. Forward-all to a cell has the same effect: an unanswered forwarded call "will follow
the programming of forwarded phone" [S7]. **FACT.** This confirms the key point in `docs/bestline-options.md`.

---

## 4. Q3 — Forward targets, caller ID, Diversion

### 4.1 Targets

| Target | Can Amy set it? | Label |
|---|---|---|
| Outside PSTN number (e.g. a Twilio DID) | Yes. Forwarding takes a phone number "as you would dial it". Easy Attendant can also send to "an external number". | FACT [S4], [S8] |
| SIP URI (Twilio SIP Domain, ElevenLabs `sip.rtc.elevenlabs.io`) | No sign of it in any user guide. The forwarding fields are phone numbers. | INFERENCE |
| SIP trunk route from Bestline's switch to us | Carrier work only (trunk or route on their CFS/Perimeta). | INFERENCE / OPEN |

**Prefer a PSTN forward to a Twilio DID over SIP** (INFERENCE, from FACT [S23]):
- For a normal inbound call, Twilio `<Dial>` defaults to "the inbound caller's number as the caller ID". Our ring to Amy then shows the real caller.
- For **inbound SIP** calls, "`callerId` cannot be the `To` or `From` number". A SIP hand-off would hide the real caller from Amy on any handoff leg.
- ElevenLabs SIP needs TLS 1.2+ and our headers. Bestline's switch cannot add our `X-` headers. See `docs/research/elevenlabs.md` [S29].

### 4.2 Caller ID on the forwarded leg

| # | Claim | Label |
|---|---|---|
| 4.2.1 | Carrier platforms usually keep the original caller as `From` on forwards. One operator thread says a find-me-follow-me forward "preserves the original caller's number as the From". | FACT (weak, 2009 forum) [S31]; INFERENCE |
| 4.2.2 | Bestline can change the presented number per group ("Calling Party Number" in a Call Service Group). | FACT [S3] |
| 4.2.3 | Whether 9313 forwards show the caller or 9313 | **OPEN — top question; test with a live call** |

### 4.3 Diversion / History-Info

| # | Claim | Label |
|---|---|---|
| 4.3.1 | Diversion (RFC 5806) is "Historic". It "MUST contain the Request-URI of the request prior to the diversion", i.e. 9313. History-Info (RFC 7044, obsoletes 4244) is the standard. | FACT [S26a], [S26b] |
| 4.3.2 | Twilio `ForwardedFrom` "is set only when Twilio receives a forwarded call, but its value depends on the caller's carrier… Not all carriers support passing this information." | FACT [S22] |
| 4.3.3 | Forwarded calls can carry a "div" PASSporT (RFC 8946). Twilio reports `StirVerstat` values such as `TN-Validation-Passed-A-Diverted`. | FACT [S26c], [S24] |
| 4.3.4 | Whether Bestline sends Diversion, and whether it survives the route to Twilio | OPEN |
| 4.3.5 | **Design so we never need it:** use a dedicated Twilio DID that only Bestline forwards to. `To` alone then tells us "came via 9313, Amy already rang." Log `ForwardedFrom` and `StirVerstat` for diagnosis only. | INFERENCE |

---

## 5. Q4 — APIs, automation, credentials, security

### 5.1 What exists

| Interface | What it is | Who can use it | Label |
|---|---|---|---|
| CommPortal web UI | Settings, call lists, voicemail. Missed, Dialed and Received lists have an **Export** to CSV. | User | FACT [S3] |
| CommPortal API | Integrators use the public CommPortal URL "as both the login endpoint and API endpoint". Login is the subscriber number plus the "EAS Password". | Exists; no public docs | FACT [S16], [S15] |
| MetaView Web / Explorer | Provisioning: lines, MLHGs, Class of Service, unlocks. | Carrier only | FACT [S3], [S15] |
| Metaswitch call-event webhooks for end users | None found. | — | OPEN (INFERENCE: none) |
| Alianza Crux API (v1.0.0, Sept 2026) | "Lets your software receive or answer phone calls on Alianza-powered carrier networks." Post-Call (SIPREC recording) and Virtual Agent (SIP). | Onboarded "Experience Providers" only; OAuth client issued by Alianza | FACT [S19a], [S19b], [S19h] |
| Crux webhooks | Events for experience connections, assignments and users. Subscriptions "are currently created by Alianza on your behalf." No call events listed. | Partners | FACT [S19c] |

Crux details (FACT [S19d]–[S19g], [S20], [S21]):
- Virtual Agent calls go "to your SIP endpoint via a Twilio SIP trunk", TLS 5061, digest auth, IP allowlist.
- Routing is per assigned phone number. No no-answer or schedule rule is documented. INFERENCE: it is AI-first, not Amy-first.
- Hand-back is an in-dialog REFER to "the business number in E.164 format, or an extension". A no-answer returns 408 and "the caller is still with you."
- "If your endpoint is unreachable, the call fails immediately. There is no retry or fallback." "Switch-side fallback may apply, depending on Service Provider configuration."
- Status: "controlled availability" from 2026-09-09; commercial availability planned for H1 2027.
- Whether Crux reaches Metaswitch/"Core" carriers like Bestline: **OPEN** (no source says).

### 5.2 Credentials

| Holder | Credential | Gives |
|---|---|---|
| Amy | 9313 (or email) + CommPortal password. The same login runs the MaX UC app. | All her forwarding, DND, voicemail, call lists, contacts. FACT [S3], [S11] |
| A BG admin (if Bestline sets one up) | Admin CommPortal login | Hunt groups, attendants, CSGs and lines in the business group. FACT [S3] |
| Bestline | MetaView | Everything else. FACT [S3], [S15] |

### 5.3 Security caveats of sharing Amy's CommPortal password

- **FACT [S3]:** lockout after repeated wrong passwords. Only "a system administrator can unlock … using MetaView Web", or you wait.
- **FACT [S3]:** password expiry is on in "the default Classes of Service". A script would break, or lock the account, at expiry.
- **FACT [S3]:** password, PIN and email changes trigger notification emails. Reset links go to the account email.
- **INFERENCE:** that login can forward all three companies' calls anywhere and read every voicemail. That makes it a call-hijack and toll-fraud key. It is also Amy's MaX UC login.
- **INFERENCE:** no MFA or scoped token appears in any source.
- **Recommendation (INFERENCE):** do not store or automate Amy's CommPortal login. Keep the kill switch on our side: `ai_mode=off` in our config, plus the Twilio fallback. The Bestline-side rollback stays manual: Amy's app or CommPortal, or a call to Bestline support.

---

## 6. Q5 — 512-923-9313 (public sources only; not called)

| # | Claim | Label |
|---|---|---|
| 6.1 | The Fridge's JS bundle (Last-Modified 2026-07-31) has `contactTitle:"President", phone:"512-923-9313", phoneHref:"tel:+15129239313"`. It is shown as a button. | FACT [S28] |
| 6.2 | NPA-NXX 512-923 belongs to "NEW CINGULAR WIRELESS PCS, LLC" (AT&T Mobility), Austin rate center. | FACT [S27a] |
| 6.3 | 512-339 belongs to "SOUTHWESTERN BELL" (wireline). 9313 must have been ported to Bestline's carrier. Public data shows the original carrier only. | FACT [S27b]; INFERENCE |
| 6.4 | No web page anywhere lists 512-923-9313. | FACT (search, 2026-10-22) |
| 6.5 | **Probably not a typo of 339.** It is labelled as the President's number and sits in a wireless block. Most likely it is the owner's own mobile, not a Bestline DID. It could still be a ported number. | INFERENCE |
| 6.6 | Then The Fridge's web callers skip 9313. No Bestline change would cover them. | INFERENCE |
| 6.7 | Is 923-9313 on the Bestline account? Whose phone is it? Should The Fridge site show 339-9313? | OPEN (ask Amy and the owner; do not test-call) |

---

## 7. Q6 — Recommended configuration

### 7.1 Ranked options

**Option 1 (preferred): Bestline rings Amy (MaX UC app); AI on no-answer.**

| Setting (Amy's CommPortal line 512-339-9313) | Value |
|---|---|
| Forward all calls | **Off** (today: on, to Amy's cell) |
| Incoming calls | Ring your account phone (MaX UC Mobile on Amy's phone; plus desk or desktop if any) |
| If there is no answer | Forward to **Twilio DID-A** after **20 s** |
| If your phone is busy | Forward to **Twilio DID-A** |
| Forward if unavailable | Forward to **Twilio DID-B** |
| Anonymous Callers (reject) | Off, so blocked-ID callers still reach the AI |
| DND | Off. While on, calls go to Bestline voicemail, not the AI. Ask whether DND can forward instead. |

- DID-A ("Amy already rang") → AI answers at once. No second ring.
- DID-B ("app offline") → our press-1 screen rings Amy's cell, then the AI. Amy is still reachable when the app is logged out or has no data.
- INFERENCE: two DIDs cost $2.30/mo. They remove any need for Diversion data.

Pros (INFERENCE): Bestline itself sees the no-answer. The AI only touches missed calls. A total AI or Twilio outage hurts only missed calls.
Cons (INFERENCE): Amy must adopt the app and stay logged in. Answered calls use VoIP over Wi-Fi or data.

**Option 2 (no app): Forward-all to Twilio; Twilio rings Amy.**

| Setting | Value |
|---|---|
| Forward all calls | **On, to Twilio DID-B**, instead of Amy's cell |

Twilio runs the built flow: press-1 screen to Amy's cell, then the AI (`docs/architecture.md`).

Pros (INFERENCE):
- One setting changes. Amy can flip it in the app [S11] or CommPortal. Rollback is the same flip.
- The press-1 screen already beats her cell voicemail.
- Caller ID to Amy is the real caller, by Twilio's default [S23], if Bestline passes it (OPEN).

Cons (INFERENCE):
- Amy presses 1 on every call.
- **Every** call depends on Twilio and our app. A failed forward target "cannot be retrieved and will not go to your account voicemail" [S6, FACT].
- Extra cost: about $0.014/min outbound on every answered call (`docs/cost-model.md`).

**Option 3 (not recommended): ring in order.** Account phone, then Amy's cell for ≤15 s, then forward to DID-A.
INFERENCE: her cell voicemail answers if the phone is off or she declines. That ends the sequence [S4]. It only works if her cell voicemail timer is longer than Bestline's step.

**Optional add-ons:**
- Easy Attendant on 9313 ("1 lights, 2 patio, 3 vending"), each key to Amy or to per-company Twilio DIDs [S8]. INFERENCE: adds friction before Amy. The AI can ask which company instead.
- Separate Bestline DIDs per company for tracking (prior audit idea).

**Future:** Alianza Crux Virtual Agent [S19]. INFERENCE: AI-first and partner-only. Not usable in 2026.

### 7.2 Failure modes

| Failure | Option 1 | Option 2 | Label |
|---|---|---|---|
| Our app or webhook down | Twilio fallback URL → recorded message (`docs/failure-matrix.md`). Missed calls only. | Same, but for every call. Fallback TwiML should `<Dial>` Amy's cell first. | INFERENCE |
| Twilio down / DID unreachable | Forwarded call fails. Caller hears Bestline's failure treatment. | **All calls fail** until someone flips the forward back. | FACT [S6] + OPEN (what the caller hears) |
| ElevenLabs down | Our 4 s budget → recorded message (built). | Same | FACT (project docs) |
| MaX UC push fails / app logged out | No ring → no-answer (20 s) → AI, or unavailable → DID-B → Amy's cell screen. | n/a | INFERENCE |
| MaX UC password expires | Receive-only, then lockout → unavailable → DID-B. | n/a | FACT [S13] + INFERENCE |
| Amy declines | Busy → DID-A → AI | No press → AI | FACT [S4] |
| Caller ID arrives as 9313 | AI cannot see the caller; returning-caller memory breaks; the AI must ask for a callback number. | Same, and Amy sees 9313 | OPEN |
| Forwarding loop | Never set our transfer or handoff target to 9313. 9313 → DID → AI → 9313 would loop. | Same for Amy's cell, if it forwards to 9313 | INFERENCE |
| Peak burst (several calls at once) | The line's call limit may send extra callers to busy or failure. | Same | OPEN ("Maximum Call Appearances" exists per line [S15]) |
| Double alerts | Bestline voicemail email/text and our lead alert both fire on one call. | Amy's cell voicemail is not reached (screen) | INFERENCE |
| DND left on | Calls go to Bestline voicemail, not the AI | Forward-all wins | FACT [S3] |

### 7.3 What to say to Bestline (ranked requests)

1. "On 512-339-9313, please turn off forward-all to Amy's cell. Set no-answer after 20 seconds and busy to forward to [DID-A]. Set unavailable to forward to [DID-B]. Amy will use the MaX UC Mobile app as her account phone. Please help her log in." *(Option 1)*
2. If Amy won't use the app: "Please change forward-all on 9313 from Amy's cell to [DID-B]." *(Option 2)*
3. "On a forwarded call, does [DID] see the caller's own number as caller ID, not 9313? Do you send a Diversion or History-Info header with 9313? Do you sign forwarded calls with a div PASSporT?"
4. "If [DID] is busy or unreachable, what does the caller hear? Can it fall back to 9313's voicemail?"
5. "How many calls can 9313 ring or forward at the same time? Can you raise it for December?"
6. "Is there a per-minute charge on forwarded calls? Local or long distance?"
7. "Which CommPortal Call Manager do we have? Is Incoming Call Manager (time-of-day rules) available? What is the allowed no-answer range in seconds?"
8. "What are your star codes for forward-all on and off?" (emergency manual rollback)
9. "Is 512-923-9313 on our account?"
10. Optional: "Price for an Easy Attendant on 9313, and for extra DIDs per company?"
11. Optional: "Can you create a limited admin login, so nobody shares Amy's password?"
12. Future: "Is your platform on Alianza Crux? When?"

### 7.4 Top open questions (in priority order)

1. Caller's own number kept on the forwarded leg? (§4.2)
2. Caller treatment when the forward target fails; any fallback? (§7.2)
3. Concurrent call limit on 9313 for peak season.
4. Will Amy use the MaX UC app? (decides Option 1 vs 2)
5. Diversion or History-Info present? (nice to have; DID design does not need it)
6. Forwarding cost per minute.
7. Is 512-923-9313 the owner's mobile, and should The Fridge site show 339-9313?

### 7.5 Day-1 test after the change (our own test phones; never 512-923-9313)

1. Call 9313; let it ring. The AI answers at about 20 s. Check that Twilio `From` is the test phone, and log `ForwardedFrom` and `StirVerstat`.
2. Amy answers in the app. Twilio sees no call.
3. Amy declines. The AI answers (busy path).
4. Put Amy's phone in airplane mode. DID-B screen, then the AI.
5. Two calls at once. Both reach Amy or the AI.
6. Blocked-ID call. It reaches the AI.
7. Point DID-A's webhook at a bad URL (staging). The fallback message plays.

---

## Sources (fetched 2026-10-22)

| ID | Source | Date |
|---|---|---|
| [S1] | Bestline, Voice & VoIP | no date (© 2026) |
| [S2] | Bestline home | no date (© 2026) |
| [S3] | Metaswitch, CommPortal User Guide v9.5.40 (Momentum copy) | © 2000–2020; PDF modified 2022-12-13 |
| [S4] | FirstLight, CommPortal User Guide | 2019-09-03 |
| [S5] | FirstLight, CommPortal Admin Guide | 2019-09-03 |
| [S6] | Midco, CommPortal call forwarding | no date (© 2026) |
| [S7] | Northland, Subscriber CommPortal for Yealink + MaX UC | 2023-03-13 |
| [S8] | Northland, Easy Attendant Programming Manual | 2023-03-21 |
| [S9] | Norvado, Easy and Premium Attendant Guides | 2021-06-07 |
| [S10] | WOW!, CommPortal forwarding help | no date |
| [S11] | Grid4, MaX UC Mobile User Guide | 2020-05-20 |
| [S12] | Telesystem, MaX UC Mobile Guide | 2021-01-29 |
| [S13] | 2degrees, MaX UC mobile guide | updated 2021-11-12 |
| [S14] | Grid4 KB, Introducing CommPortal (30 s default; search snippet only, page now 404) | old |
| [S15] | Xima, Metaswitch Target Platform | updated 2026-09-08 |
| [S16] | Acrobits, Cloud Softphone for Metaswitch | no date |
| [S17] | Alianza Core | no date (© 2026) |
| [S18] | UC Today, Alianza completes Metaswitch acquisition | 2025-03-05 |
| [S19a–j] | Alianza developer docs (Crux API) | changelog 1.0.0 = Sept 2026 |
| [S20] | Light Reading, Alianza Crux | 2026-09-14 |
| [S21] | Revmo AI joins Crux (press release) | 2026-09-29 |
| [S22] | Twilio, TwiML request parameters | modified 2026-06-22 |
| [S23] | Twilio, `<Dial>` | modified 2026-09-07 |
| [S24] | Twilio, SHAKEN/STIR | modified 2026-08-24 |
| [S25] | Twilio, SIP interface | modified 2026-08-19 |
| [S26a–c] | RFC 5806, RFC 7044, RFC 8946 | 2010, 2014, 2021 |
| [S27a–b] | localcallingguide.com, 512-923 and 512-339 | live data |
| [S28] | thefridgevending.com JS bundle | Last-Modified 2026-07-31 |
| [S29] | ElevenLabs SIP trunking (see `docs/research/elevenlabs.md`) | — |
| [S30] | All West, CommPortal User Training | 2019-12 |
| [S31] | VoiceOps list, "Billing of Forwarded Calls" | 2009-11-11 |

[S1]: https://bestline.net/voice-communication/
[S2]: https://bestline.net/
[S3]: https://info.momentumtelecom.com/rs/476-ZWP-927/images/CNG%20MaX%20CommPortal%20UG.pdf
[S4]: https://www.firstlight.net/wp-content/uploads/2019/09/CommPortal-User-Guide.pdf
[S5]: https://www.firstlight.net/wp-content/uploads/2021/05/13-CommPortal-Admin-Guide.pdf
[S6]: https://business.midco.com/support/phone/voip/commportal/business-call-manager/call-forwarding
[S7]: https://www.northland.net/wp-content/uploads/2023/03/Subscriber-CommPortal-for-Yealink-Phones-User-Manual-2.pdf
[S8]: https://www.northland.net/wp-content/uploads/2023/03/Easy-Attendant-Programming-Manual-2.pdf
[S9]: https://norvado.com/wp-content/uploads/2021/06/Easy-and-Premium-Attendant-Guides.pdf
[S10]: https://www.wowway.com/help-center/phone/what-do-i-do-if-my-calls-using-commportal-are-forwarding-somewhere-i-didnt-request
[S11]: https://www.grid4.com/wp-content/uploads/2023/05/MaX-UC-Mobile-User-Guide.pdf
[S12]: https://www.trusttelesystem.com/hubfs/Website/Web%20Resources/Hosted%20VoIP%20Green%20Platform/Green%20Platform%20Add-On%20Resources/MaX%20UC%20Unified%20Communications%20-%20Green/MaX%20UC%20User%20Guides/telesystem_max-uc-mobile-guide-05132020.pdf
[S13]: https://www.2degrees.nz/help/business-broadband-and-landline/getting-started/max-uc-mobile-guide
[S14]: https://grid4.com/knowledge-base/category/cloud-phone-system-users/introducing-commportal/
[S15]: https://guide.xima.cloud/docs/metaswitch-target-platform
[S16]: https://doc.acrobits.net/guides/metaswitch-cloudsoftphone-configuration/
[S17]: https://www.alianza.com/products/alianza-core/
[S18]: https://uctoday.com/alianza-finalises-metaswitch-acquisition-from-microsoft-in-ucaas-landscape-shake-up
[S19a]: https://developer.alianza.com/docs
[S19b]: https://developer.alianza.com/docs/concepts/post-call-vs-virtual-agent
[S19c]: https://developer.alianza.com/docs/webhooks/overview
[S19d]: https://developer.alianza.com/docs/guides/virtual-agent/receive-sip/overview
[S19e]: https://developer.alianza.com/docs/guides/virtual-agent/receive-sip/inbound-call-flow
[S19f]: https://developer.alianza.com/docs/guides/virtual-agent/receive-sip/transfer-to-business
[S19g]: https://developer.alianza.com/docs/resources/known-issues
[S19h]: https://developer.alianza.com/docs/concepts/what-you-need-from-alianza
[S19i]: https://developer.alianza.com/docs/quickstart/virtual-agent
[S19j]: https://developer.alianza.com/docs/resources/changelog
[S20]: https://www.lightreading.com/telecoms-software/alianza-s-crux-protects-the-phone-number-as-telcos-brace-for-an-experience-provider-wave
[S21]: https://www.webull.com/news/15661678050362368
[S22]: https://www.twilio.com/docs/voice/twiml
[S23]: https://www.twilio.com/docs/voice/twiml/dial
[S24]: https://www.twilio.com/docs/voice/trusted-calling-with-shakenstir
[S25]: https://www.twilio.com/docs/voice/api/sip-interface
[S26a]: https://www.rfc-editor.org/rfc/rfc5806.html
[S26b]: https://www.rfc-editor.org/rfc/rfc7044.html
[S26c]: https://www.rfc-editor.org/rfc/rfc8946.html
[S27a]: https://www.localcallingguide.com/lca_prefix.php?npa=512&nxx=923
[S27b]: https://www.localcallingguide.com/lca_prefix.php?npa=512&nxx=339
[S28]: https://thefridgevending.com/assets/index-DVz8jp7-.js
[S29]: https://elevenlabs.io/docs/eleven-agents/phone-numbers/sip-trunking
[S30]: https://www.allwest.com/wp-content/uploads/2022/12/MetaSwitch-CommPortal-User-Training_update-2019.pdf
[S31]: https://puck.nether.net/pipermail/voiceops/2009-November/000901.html
