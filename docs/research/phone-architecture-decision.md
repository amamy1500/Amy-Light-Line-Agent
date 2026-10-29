# Keeping 512-339-9313: phone architecture from first principles

Research only, 2026-10-24. No account was changed, no number bought, no port started, nobody contacted.
Evidence: `port-9313-twilio-deep.md` (Twilio path, failures, costs), `carrier-options-2026.md`
(Telnyx, ElevenLabs, LiveKit, no-port options), `keep-9313-options.md` (porting requirements),
`twilio-account-setup.md` (Trust Hub, concurrency), and our code. Labels: **FACT** (primary source or
code), **INFERENCE** (our reasoning), **OPEN** (needs a test or an answer).

## The answer in one screen

- **Your architecture is technically possible, and most of it is already built.** Ring Amy first with a
  private "press 1" gate, AI only when she doesn't accept, one agent that asks which company. This is
  Lightline's "phone rings first" mode (`AI_MODE=overflow`). FACT (code).
- **9313 itself can become the programmable number** by porting it to Twilio. After the port there is
  no second public number. FACT.
- **Your hypothesis survives, with one correction and one warning.**
  - Correction: a throwaway test number proves the technology but catches **zero** real 9313 calls this
    season. If you want the AI catching real calls before January without a port, the only way is one
    Bestline setting (forward 9313 to a hidden Twilio number). That touches Bestline, which Amy asked to
    leave out. INFERENCE.
  - Warning: after a port, **if Twilio's voice platform is down, 9313 is down.** Twilio offers no
    number-level failover. In the last 22 months, about 3–5 Twilio incidents would have silenced or
    partly broken incoming calls for 1–5 hours. "No call ever lost" can't be guaranteed for a ported
    number; it can be made rare and visible. FACT (absence of failover; status history) + INFERENCE.
- **Recommendation:** prove it on a throwaway number now; port 9313 to Twilio **in January** (after
  takedown season), never in Nov–Dec. Details in §4.

## 1. Three layers, kept separate

| Layer | What it is | Who it should be | Label |
|---|---|---|---|
| Number ownership | The carrier of record holding 9313 | Today Bestline. After a port: Twilio (default) or Telnyx (reliability upgrade, §3) | FACT (port rules) + INFERENCE |
| Call routing | Who receives the call and decides where it goes | Twilio running Lightline's instructions (ring Amy, press 1, AI, fallbacks) | INFERENCE |
| AI media | Speech-to-text, the language model, the voice | ElevenLabs, reached through register-call | FACT |

ElevenLabs is the voice and brain only. It is not a carrier and cannot take a port of 9313. If you import
a number into ElevenLabs, ElevenLabs takes over routing and the agent answers first, which breaks
"Amy first". FACT (`carrier-options-2026.md` §4).

## 2. Your 20 questions

**1. Is the architecture technically possible?** Yes. FACT. Twilio's `<Dial>` rings a number with a
private message on Amy's leg, and connects the caller only when that leg's TwiML lets it. Our code already
does this: `lib/telephony/twiml.ts:159` (ring), `:173` (the "press 1" whisper), `lib/server/voice.ts:382`
(press-1 accept) and `:397` (if not accepted, the AI takes the call).

**2. Can 512-339-9313 itself become the programmable number?** Yes, by porting it into Twilio. Porting
moves both voice and texting; at the end Twilio adds 9313 to the account. FACT (Twilio porting docs,
`port-9313-twilio-deep.md` §1).

**3. After porting, is any second number needed?** No public one. FACT. You can configure 9313's webhook
and fallback before the port date, so the first ported call already reaches Lightline. FACT. A throwaway
number is still useful **before** the port, for testing only, never published. INFERENCE.

**4. Can Amy still receive calls on her normal cell?** Yes. Twilio dials her cell on every call during her
ring hours. FACT. What her screen shows is a choice (see 7).

**5. Can the AI take over only when she fails to accept?** Yes. Twilio reports whether the caller was
connected (`DialBridged`); our code sends every "not connected" outcome to the AI: no answer, busy,
declined, voicemail, answered without pressing 1, hung up during the message, or a failed ring. FACT
(Twilio docs + `lib/telephony/decide.ts`).

**6. How do we stop her cell voicemail from stealing the call?** The press-1 gate. Her voicemail answers
the ring, hears "Press 1 to take it", can't press 1, and our message hangs up. Twilio reports
"completed, not connected", and the caller goes to the AI. The caller is never connected to her
voicemail. FACT. Side effect: her voicemail box collects short "press 1" recordings. INFERENCE. Optional:
Twilio's machine detection ($0.0075 a call) can cut those ~10 seconds, but only as a speed-up, never as
the gate (it's a guess; press 1 isn't). FACT (accuracy) + INFERENCE.

**7. Does the original caller ID survive?**
- Into Lightline and the AI: yes; the caller's number arrives with the call and is saved on the lead.
  FACT. (If the caller hides their number, it arrives as hidden; our spam gate handles that.)
- On Amy's phone: your choice. FACT (Twilio allows either).
  - **Show 9313** (recommended): it carries Twilio's top trust rating (A). It matches a contact she saves,
    so her phone never silences it. The whisper says which company. INFERENCE.
  - **Show the caller's number**: what she sees today. At best a B trust rating, and iPhone/Pixel
    unknown-caller screening can silence it, which turns ring-first into AI-first. INFERENCE.
  - With 9313 shown, her recent-calls list shows 9313; she calls back from the lead alert (tap to call),
    which has the caller's number. A change from today. OPEN (Amy's preference).

**8. How does the shared three-company routing work?** One number, one agent. FACT (code).
- When the AI picks up, the greeting asks which company. The `select_business` tool then loads that
  company's rules into the same agent: the full Christmas Light Guys policy, or safe message-taking for
  Sublime Patio and The Fridge (their answers stay pending until Amy approves them).
- Leads, alerts and dashboard tabs are kept per company. A caller who names the wrong company can be moved.
- One caller-ID name (15 characters) and one texting registration per number. So keep 9313 for calls
  only; alerts to Amy text from a separate number. FACT (Twilio/TCR rules) + INFERENCE.

**9. What if ElevenLabs is down?** The caller hears a short apology and leaves a recorded message. This
uses Twilio's own recorder, so it doesn't depend on ElevenLabs. Lightline gives ElevenLabs 4 seconds,
then a circuit breaker stops trying. The message becomes a lead and Amy is alerted. Built. FACT (code,
`docs/failure-matrix.md`).

**10. What if our app is down?** Twilio uses the number's fallback, a small recording script Twilio hosts
(a TwiML Bin). It can ring Amy with "press 1", then take a message. FACT (Twilio docs). Today's fallback
only records and names only The Christmas Light Guys; it must be rebuilt for the three-company number
before any port. FACT (file) + INFERENCE. Set short timeouts so the fallback starts within about 7 seconds,
not Twilio's default 15. FACT (Twilio timeout overrides). Whether the fallback also catches an app crash in
the middle of a call is undocumented. OPEN (test).

**11. What if Twilio is down?** For a ported 9313, nothing answers: no fallback, no recording, nothing
reaches Amy. Twilio documents no carrier-level backup for its numbers. FACT (absence). History (Jan 2025 –
Oct 2026): about 3–5 incidents of 1–5 hours that would have silenced or degraded incoming calls, at least
one in business hours; Twilio's guarantee covers its systems, not delivered calls, and pays a 10% bill
credit (about $2.50 for us). FACT (status history, SLA). Mitigations: an outside test call to 9313 every
5–10 minutes that alerts you and Amy; the Telnyx-held setup in §3 if this risk is unacceptable.
INFERENCE.

**12. How would rollback work?**
- **Instant:** one setting sends every 9313 call straight to Amy's cell, like today, with no app in the
  path (a pre-built "direct to Amy" script). Applies from the next call. INFERENCE (design on FACT
  behavior). Lightline's own kill switch (assistant off) also exists. FACT (code).
- **Full:** port 9313 back out to Bestline or another carrier. It needs a 4–5 digit port-out PIN from
  porting@twilio.com (get it the day the port lands, not mid-crisis), and takes 1–4 business days. Then
  Bestline rebuilds its forwarding. FACT (Twilio port-out docs, FCC timing) + INFERENCE.

**13. Exact one-time and monthly costs.**

| One-time | Cost | Label |
|---|---|---|
| Port 9313 into Twilio | $0 | FACT |
| Business profile (Trust Hub) | No fee found | OPEN |
| Caller-ID name (CNAM) | Free | FACT |
| Texting registration (only for the separate alert number) | $19.50 ($4.50 brand + $15 vetting) | FACT |

Monthly, worked example: 300 calls a month, 3 minutes each, 180 answered by Amy and 120 by the AI.
Twilio rounds each call leg up to the next full minute. FACT (prices, Aug 2026) + INFERENCE (traffic).

| Item | Math | $/month |
|---|---|---|
| Incoming, all calls | 300 × 4 min × $0.0085 | 10.20 |
| Ringing Amy, answered | 180 × 4 × $0.0140 | 10.08 |
| Ringing Amy, missed (upper bound) | 120 × 1 × $0.0140 | 1.68 |
| Audio stream to the AI | 120 × 4 × $0.0044 | 2.11 |
| Number 9313 | | 1.15 |
| **Twilio** | | **25.22** |
| ElevenLabs Creator ($22 for 275 min, then $0.08/min) | 360 AI minutes | 28.80 |
| AI model | ~$0.01/min | 3.60 |
| **Phone + AI** | | **≈ 57.60** |
| Hosting (Vercel $20 + Supabase $25) and alert texting ($1.50) | | 46.50 |
| **Total** | | **≈ $104** |

Not in the total: whatever Bestline costs today, which may drop if the line moves (OPEN). Telnyx is
cheaper per minute (about $0.0052 in, $0.007 out), but price shouldn't decide this. FACT + INFERENCE.

**14. Exact porting requirements.** From Amy or whoever holds the Bestline account:
- The account holder's name and business name, exactly as Bestline has them.
- The service address exactly as on Bestline's customer service record (CSR); a physical address, not a
  PO box.
- The Bestline account number and the account's main number (BTN).
- The port-out PIN, if Bestline set one.
- A Bestline bill from the last 30 days showing 9313.
- The CSR itself (the best defense against a rejection).
- The authorized signer's email and e-signature on Twilio's letter of authorization (LOA), within 30 days.
- Decisions: the port date (at least 7 days out), what stays at Bestline (desk phones? 512-923-9313?), and
  which Twilio account holds 9313 (the business's own).

All FACT (`keep-9313-options.md`). On our side, before the port date:
- The Twilio account is upgraded and the Business profile approved. Without it only 2 calls can run at
  once, and one ring-first call already uses 2.
- 9313's webhook, fallback and status callback are set.
- The three-company fallback and the "direct to Amy" script are built and tested.

FACT (limits) + INFERENCE.

**15. Expected timeline.** Twilio: 5–15 days, about 11 on average; a hosted business line like this is
likely "non-simple", so plan 15+ business days. A rejection (a name or address mismatch with Bestline's
record) adds 2–4 weeks. The switch happens on a weekday at 10:00–10:30 a.m. Austin time, and can land 1–3
days early; you can't choose the minute. FACT. Telnyx: about 7 business days if simple, 15+ if not, and
you can trigger the switch yourself between 6 a.m. and 8 p.m. CT on the port date, if the number
qualifies. FACT.

**16. Peak-season risk.** High. INFERENCE, from these FACTs:
- November–December is the year's call peak.
- The switch date is the losing carrier's call and can come early.
- All three companies move at the same moment.
- A rejection can push the switch into December.
- Lightline has not yet taken one real call.
- Amy has to learn a new habit (press 1).

Today there is even an open Twilio incident on calls to US phones, the exact leg that rings Amy (FACT,
status page).

**17. Now or January?** January. Submit around mid-January, after takedowns, so it lands in late January
or February at the quietest time of year. Use November–December to prove everything on a test number and
to collect Bestline's documents. INFERENCE.

**18. Compared with keeping Bestline forwarding (today).** Today's path has no AI and no Twilio
dependency: Bestline rings Amy's cell, and misses go to her voicemail, which is the problem. It works when
Bestline works. It catches nothing she misses. FACT (Amy's description) + INFERENCE.

**19. Compared with a hidden intermediary Twilio number.** Bestline forwards all 9313 calls to a
private Twilio number, and Lightline does the rest.
- For: works within days, with no port; customers keep 9313; undoing it is one Bestline setting. FACT
  (forwarding works; `carrier-options-2026.md` §5).
- Against:
  - It keeps Bestline in the path, which Amy asked to avoid.
  - Two platforms must both work, and each forwarded call is billed by both.
  - Whether Bestline passes the caller's real number on a forward is unknown and must be tested.
  - Bestline's own voicemail must not answer first.

  FACT + OPEN.
- Verdict: the only way to have the AI catch real 9313 calls **this season**, and only if Amy agrees to
  one Bestline setting and the caller-ID test passes. INFERENCE.

**20. Final architecture recommendation:** see §4.

## 3. Options compared

| | A. Port to Twilio | B. Port to Telnyx, route via Twilio | C. Hidden Twilio number behind Bestline | D. Throwaway number only | Today |
|---|---|---|---|---|---|
| Customers keep 9313 | Yes | Yes | Yes | Yes (unchanged, no AI) | Yes |
| Bestline in the long-term path | No | No | Yes | Yes | Yes |
| AI catches Amy's misses | Yes | Yes | Yes | No (tests only) | No |
| If Twilio is down | Line dead | Telnyx forwards to Amy's cell (pilot must prove it) | Bestline forward fails (OPEN) | Unchanged | Unaffected |
| If Bestline is down | Unaffected | Unaffected | Line dead | Line dead | Line dead |
| Moving parts | Fewest | Two carriers + a SIP link | Two platforms in series | — | One |
| Time to live | Port 3–5+ weeks | Port 2–4+ weeks + pilot | Days | Now | — |
| Peak-season risk | High if done now | High if done now | Low (instant undo) | None | None |
| Label | FACT + INFERENCE | FACT (features) + OPEN (pilot) | FACT + OPEN (caller ID) | INFERENCE | FACT |

Other options were rejected:
- Twilio Hosted Numbers: texting only, no voice control. FACT.
- Registering a server as a Bestline phone: we'd run a 24/7 server, and Amy's leg loses the caller ID.
  INFERENCE.
- ElevenLabs as number owner: impossible. FACT.
- Reception.ai: its "staff first" ring has no press-1, so Amy's voicemail can take calls. FACT.
- LiveKit numbers: no porting, inbound only. FACT.
- Moving routing to Telnyx: a rewrite, with no better voice record in 2026. INFERENCE.

## 4. Recommendation

**Simplest technically correct long-term architecture (FACT-backed, INFERENCE as a design):**

```
Caller → 512-339-9313 (ported to Twilio, business-owned account)
       → Lightline router (Twilio webhook)
         → spam gate (blocked → refused; hidden/failed caller ID → "press 1 or say yes")
         → in Amy's hours: ring Amy's cell ~18–20 s, shows 9313, whisper "<Company> call. Press 1."
             pressed 1 → connected to Amy
             anything else → ElevenLabs agent (one agent; asks which company; loads that company)
         → outside hours / closed days: ElevenLabs agent directly
         → ElevenLabs unreachable → Twilio-native recorded message
       → lead saved per company → Amy alerted (email now, text from a separate alert number later)
Fallbacks: app down → Twilio-hosted script (ring Amy with press 1, then record, all three companies)
           Twilio down → nothing answers (accepted risk; monitored), or option B if unacceptable
Rollback:  one setting → "direct to Amy" script; port-out PIN on file
```

**Safest thing to do this week (no customer impact):**
1. Prove it on a throwaway Twilio number in your own upgraded account, with `AI_MODE=overflow` (ring
   first). Run every case in §5 on **Amy's actual phone and carrier**: decline, call waiting, voicemail,
   unknown-caller silencing.
2. Close the gaps found here before any real customer depends on it:
   - "Amy is already on a call" check: call 2 skips her ring and goes to the AI. Not built. FACT.
   - Three-company app-down fallback (ring Amy with press 1, then record) and the "direct to Amy"
     rollback script. Not built. FACT.
   - Shared-line greeting when Amy missed it ("Hi, you've reached Amy's office. She's tied up…") with
     the required AI and recording disclosures. Partly built. FACT.
   - Fallback timeouts shortened (#ct/#rt), and an outside monitoring call. Not built. FACT.
3. Collect Bestline's documents (§2.14) during December, without changing anything.

**January:** business-owned Twilio account with an approved Business profile → submit the port →
switch lands late January/February → keep Bestline active until Twilio shows 9313's calls, then cancel.

**Only if Amy wants AI on 9313 before January:** option C, one Bestline forward to the hidden Twilio
number, after the pilot passes and only if her real caller ID survives.

## 5. Call sequences (after the port; `→` request, `⇒` audio connected)

**Normal: Amy answers**
```
Caller   → 9313 (Twilio) → Lightline: in hours, not spam → ring Amy (shows 9313)
Amy picks up → hears "Christmas Light Guys call. Press 1 to take it." → presses 1
Caller ⇒ Amy. Lightline logs "Amy answered"; no AI, no alert text (call is hers).
```

**Missed call → AI**
```
Caller → 9313 → Lightline → ring Amy ~20 s → no answer (DialCallStatus=no-answer, not bridged)
Lightline → ElevenLabs (register-call) → Caller ⇒ AI: "Hi, you've reached Amy's office… which company?"
AI → select_business → saves details → request_callback → finish_call
Transcript → Lightline → lead + "before you call" brief → Amy alerted.
```

**Amy's voicemail answers**
```
Caller → 9313 → Lightline → ring Amy → her voicemail answers the ring
Voicemail hears "Press 1…" → no key → our whisper hangs up (completed, not bridged)
Lightline → ElevenLabs → Caller ⇒ AI (as above). Amy's box gets a short "press 1" recording.
```

**After hours or a closed day**
```
Caller → 9313 → Lightline: outside ring hours (or closure) → no ring
Lightline → ElevenLabs → Caller ⇒ AI (knows the date and that the office is closed) → lead → alert.
```

**AI failure (ElevenLabs down or at capacity)**
```
Caller → 9313 → Lightline → ring Amy → missed → ElevenLabs request fails (4 s) or circuit open
Lightline → Twilio <Record>: short apology, "leave your name, number and what you need"
Recording → Lightline → lead → Amy alerted. (Twilio-native; no ElevenLabs needed.)
```

**App failure (Lightline down)**
```
Caller → 9313 (Twilio) → Lightline webhook fails (~7 s with shortened timeouts)
Twilio → fallback script (TwiML Bin): ring Amy with "Press 1" → pressed → Caller ⇒ Amy
                                      not pressed → three-company greeting → <Record>
Recording kept by Twilio; imported when Lightline is back. (Any key accepts here: Bins can't compare digits.)
```

**Second simultaneous call (Amy on call 1)**
```
Today's code: Caller 2 → 9313 → Lightline → rings Amy (call waiting beep or busy) → up to ~25 s → AI
After the fix: Lightline sees call 1 connected to Amy → skips the ring → Caller 2 ⇒ AI at once
                (entry "owner_on_another_call"; the greeting says Amy is on another call).
Needs an approved Business profile: one Amy call uses 2 of Twilio's concurrent call slots.
```

**Three companies calling at once (Amy free)**
```
Callers A, B, C → 9313 at the same moment → Lightline rings Amy for each (her phone shows one at a time)
Amy presses 1 on A → A ⇒ Amy
B and C → missed (or, after the fix, skip the ring) → AI ×2 (ElevenLabs Creator allows 10 at once)
  B: "Sublime Patio" → select_business → Sublime capture policy
  C: "The Fridge"    → select_business → Fridge capture policy
Leads land in each company's tab; alerts name the company first.
```

**Twilio down (accepted risk, for completeness)**
```
Caller → 9313 → Twilio voice platform unavailable → no instructions run → caller hears an error or
ringing → nothing reaches Amy or Lightline. Monitoring call fails → alert to Pavan and Amy.
(Option B instead: Telnyx forwards straight to Amy's cell; to be proven in a pilot.)
```

## 6. Open items before deciding

1. On Amy's real phone and carrier: what Decline does (busy or voicemail), call waiting behavior, and
   unknown-caller silencing. Run on the test number.
2. Does the fallback fire when the app dies mid-call? Test by stopping the app between ring and answer.
3. Who is the carrier of record behind Bestline, and is the line "simple" for porting? (A portability
   check from the business's Twilio account, once it exists.)
4. Is Bestline month-to-month, and is there an early-termination or port-out fee? What else is on the
   account (desk phones, 512-923-9313)?
5. Amy's preference: see 9313 plus the whisper, or the caller's own number?
6. Only for option C: does Bestline pass the caller's real number on a forward?
7. Only for option B: a pilot with Telnyx forward-on-failure, real caller ID on Amy's leg, and correct
   numbers at our webhook.
