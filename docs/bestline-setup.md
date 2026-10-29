# Bestline setup: Amy's phone assistant on 512-339-9313

**For:** Bestline Solutions support (800-365-6030, support@bestline.net), with Amy Reilly's OK as the account holder.
**The ask:** one call-forwarding setting on Amy's line. Nothing is ported. Nothing changes for callers.

`npm run live` prints this with the real numbers filled in. Until then they are **[Number B]** (and, for the optional
app setup, **[Number A]**): Twilio numbers we own, never published.

## What stays the same

- Callers dial **512-339-9313**, as today, for all three companies.
- Amy's cell rings first during her hours, Mon–Sat 9 AM–6 PM.
- The numbers on the websites, trucks and ads don't change.

## What changes

The calls Amy doesn't take, and calls in the evening and on Sundays, go to her AI assistant instead of voicemail.

- The assistant says up front that it is an AI assistant, and that the call is recorded and transcribed.
- It asks which company the call is for: The Christmas Light Guys, Sublime Patio or The Fridge.
- It asks Amy's quote-form questions, can try to put the caller through to Amy, and never gives prices or dates.
- Amy gets a text per call, and every call is listed in her console.

## The setting on 512-339-9313 (recommended)

| Setting | Value |
|---|---|
| Forward all calls | **On, to [Number B]** (today: on, to Amy's cell) |
| Do Not Disturb | Off |
| Anonymous caller rejection | Off |

What [Number B] does with each call:

- **Mon–Sat 9–6:** rings Amy's cell. She hears "Amy's office line call, press 1" and presses 1 to take it.
- **Not answered:** if Amy doesn't press 1, or her voicemail picks up, the assistant answers.
- **Evenings and Sundays:** the assistant answers straight away, and Amy's phone doesn't ring.

This matches Amy's hours exactly, and she needs no app.

## Alternative: Amy answers in the MaX UC Mobile app

This option means no "press 1", but her phone also rings in the evenings unless Bestline can schedule forwarding by time of day.

| Setting | Value |
|---|---|
| Forward all calls | Off |
| Ring | Amy's MaX UC Mobile app |
| If no answer after **20 seconds** | Forward to **[Number A]** (the assistant answers at once) |
| If busy | Forward to **[Number A]** |
| If unavailable (app offline) | Forward to **[Number B]** |

## Undo

- Set **Forward all calls** back to Amy's cell. That is one setting, in CommPortal or by star code.
- If our system is down, Twilio's own backup rings Amy's cell, then takes a message.

## Before switching

We test by calling [Number B] directly. That is exactly what a forwarded call looks like, and 512-339-9313 is untouched while we do it.

## After switching (10 minutes, test phones only)

1. Call 512-339-9313 in Amy's hours. Her cell rings with "press 1". Check that our side sees **the caller's own number**, not 512-339-9313.
2. Amy doesn't press 1. The assistant answers.
3. Call after 6 PM. The assistant answers, and Amy's phone doesn't ring.
4. Two calls at once. Both reach Amy or the assistant.
5. A blocked-caller-ID call reaches the assistant.

## Questions for Bestline

1. On a forwarded call, do we receive the **caller's own number** as caller ID, not 512-339-9313?
2. If [Number B] can't be reached, what does the caller hear? Can it fall back to Amy's voicemail?
3. How many calls can 512-339-9313 forward at the same time? Can it be raised for December?
4. Any per-minute charge on forwarded calls?
5. What star code turns forward-all on and off, so Amy can undo it quickly?
6. Can you schedule forwarding by time of day? (Only matters for the app alternative.)
7. Could you send forwarded calls to an internet (SIP) address instead of a phone number? Optional; not needed.

Research behind this: docs/research/bestline-metaswitch.md §7 and docs/research/telephony-receive-options.md.
