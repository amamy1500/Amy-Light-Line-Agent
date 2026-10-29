# Phone setup: Bestline, Google Voice or Twilio (2026-10-22)

Labels: **FACT** (said by Amy or written in a source), **INFERENCE** (our judgement), **OPEN** (ask Bestline).

## What we know

- **FACT (Amy, 2026-10-22):**
  - 512-339-9313 is a Bestline Solutions line.
  - It is shared by Sublime Patio, The Fridge and The Light Guys / Christmas Light Guys.
  - Bestline forwards every call to Amy's cell.
  - For each missed call she gets a text and a voice message.
  - Bestline offered to help with the agent setup.
- **FACT (Bestline "MaX UC Mobile Quick Start Guide", file dated 2021-10-14):**
  - The MaX UC Mobile app rings the Bestline number on a phone over Wi-Fi or data.
  - Calls placed from the app show the Bestline business number.
  - Call Manager has three choices: Available, Do not disturb, Forward all calls.
  - The app also does transfers and Multi Line Hunt Groups.
  - Support: 800-365-6030, support@bestline.net. Amy never set the app up.
- **INFERENCE:** MaX UC and CommPortal are Metaswitch product names. Bestline therefore runs a carrier-grade hosted PBX. Such systems usually offer forward-on-no-answer, forward-on-busy and auto attendants. Confirm with Bestline.
- **FACT (earlier site audit):** thefridgevending.com shows 512-**923**-9313. It is either a typo or a second number.
- **INFERENCE (the key point):** with "forward all calls" to her cell, Amy's own cell voicemail answers a missed call. Bestline sees an answered call, so it can never send a missed call anywhere else. This is the same trap our press-1 screen solves on the Twilio number.

## Options

| Option | Own CLG number | AI can answer | Bestline change | Verdict |
|---|---|---|---|---|
| A. Google Voice number | Yes | **No.** INFERENCE: no public call-control API; it can only forward to linked phones | None | Dead end for the agent |
| B. Twilio number (built: `npm run live`) | Yes | Yes. Rings Amy first, press 1 to take it, else the AI answers | None | **Do now** |
| C. New Bestline number for CLG, forward-on-no-answer to Twilio | Yes | Yes, via the forward | Small | Fine if Bestline can do it cheaply |
| D. Main 9313 forward-on-no-answer to Twilio | Covers every call | Yes | Yes | **Phase 2**, with Amy's and the owner's approval |

Costs (docs/cost-model.md): Twilio number $1.15/mo, inbound $0.0085/min.

## Recommendation

1. **Now: B.** Amy's "separate number" idea is right. Twilio is the programmable version of it.
   - Put the number on both CLG sites, the Google Business Profile and new ads.
   - 9313 stays exactly as it is (the v1 rule).
2. **After the Bestline call: D,** only if both are true:
   - Bestline can forward **only on no answer or busy**, not forward-all. The best version is the MaX UC app on Amy's phone instead of forwarding to her cell, so Bestline itself sees the no-answer.
   - The caller's own number is kept as caller ID on the forwarded call.

   Then the AI covers missed calls for all three companies. CLG gets full intake. Sublime Patio and The Fridge get a message-taking flow until Amy approves facts for them.
3. **Never port 9313** (including to Google Voice). It would move all three companies' phones at once.

## Questions for Bestline (Amy's call)

1. Today, is 9313 set to forward all calls to Amy's cell? To which number? Does anything else ring?
2. Is the text + voice message per call Bestline voicemail, or her cell carrier's?
3. Can 9313 forward only when unanswered (after ~20 s) or busy, to an outside number?
4. If Amy uses the MaX UC Mobile app instead of forwarding to her cell, does an unanswered app call trigger that forward?
5. On a forwarded call, does the caller's own number show as caller ID (not 9313)?
6. Can they add a second number just for Christmas Light Guys on the same account? Monthly cost?
7. Can 9313 play a menu ("1 Christmas lights, 2 Sublime Patio, 3 The Fridge")? Cost?
8. Is 512-923-9313 (on The Fridge site) also on the account?
9. Is there a per-minute charge when calls forward to an outside number?

## Code changes Option D would need (not built)

- A line flag for "already rang Amy at Bestline", so the AI answers directly, with no second ring.
- A shared-line greeting that asks which company. Non-CLG callers get message capture plus a callback task.
- Read Twilio's `ForwardedFrom` (if Bestline sends a Diversion header) to tell 9313 traffic apart.
- No double alerts: Bestline's voicemail text and our lead alert must not both fire for one call.
