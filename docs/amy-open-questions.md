# Questions for Amy (≈20 minutes)

> **Answered by Amy, 2026-10-22 (email).** In the system:
> - Ring Mon–Sat 9–6. The assistant answers evenings, Sundays and missed calls.
> - Transfers ring her same cell. Callbacks only, no booking. Stock voice (no clone).
> - Alerts by text to her cell. This needs A2P 10DLC registration before texts can be sent.
> - Intake mirrors her "Request an Estimate" form, plus email.
> - Facts in `lib/knowledge/tenants/clg-decisions.ts`, applied as hers through the approvals path:
>   - her price answer, word for word;
>   - 20 years in business; her 18 areas;
>   - insurance never said; free estimates; storage included;
>   - takedown from Jan 2 to mid-January; no permanent lighting until February;
>   - thelightguysaustin@gmail.com.
> - **January:** she plans to hire someone to take over after Jan 1. Change the owner name and ring phone then.
> - Still pending (she can decide at /approvals): free service calls, other lighting, office address, office hours,
>   the service list, home and business wording, sister company.

Each has the default we use until she answers. Nothing here blocks building;
items marked **launch** block real customers.

## The call

| # | Question | Default until answered |
|---|---|---|
| 1 | **launch** What hours should your phone ring first? | Mon–Sat 9 AM–6 PM Central |
| 2 | How many seconds should it ring before the assistant answers? | 18 s |
| 3 | After hours: assistant, or just a message? | Assistant (release stage 3 starts after-hours only) |
| 4 | What do you say first when you answer? | "Hi, thanks for calling The Christmas Light Guys…" |
| 5 | The 5 questions you almost always ask? | Home or business · new or returning · what to light · address · timing · name · callback time |
| 6 | When should the assistant try to put a caller through to you right away? | When they ask for you, or they're ready and want to talk now; in ring hours; once per call |
| 7 | **launch** Which number should transfers ring? Is it the same cell? | Same as the first ring |
| 8 | Should the assistant ever mention price? | Never a number. It may say you prepare every quote yourself (if you approve that sentence). |
| 9 | Book appointments, or only callbacks? | Callbacks only |

## The business facts (approve, edit or strike — from both websites)

These are answered in the console at `/approvals`, not on paper: 17 items, each
with what each site says, how a caller would ask, and a box for Amy's exact
words. Conflicts come first. Until she decides, the assistant defers.

| # | Statement | Why we ask |
|---|---|---|
| 10 | **launch** "We light both homes and businesses." | On both sites |
| 11 | **launch** "We design and install … rooflines, wreaths and garland, door and window trims, trees, hedges and walkways …" | On both sites |
| 12 | "We take everything down after the season." / Is it still Jan 2–15? | CLG lists dates; TLG doesn't |
| 13 | Is storage offered? Free? | Both say storage; "free" needs you |
| 14 | Are estimates free? | Both say so |
| 15 | **launch** Which cities/ZIPs do you serve? Lakeway, Bee Cave, Bastrop? | CLG lists 5 cities + 3 counties; TLG lists 18 cities |
| 16 | Years in business: 9 or 20? Insured/bonded wording? | The sites contradict |
| 17 | JellyFish dealer or "Permanent Inception LED"? | The sites contradict |
| 18 | Which inbox is watched: guys@thechristmaslightguys.com or thelightguysaustin@gmail.com? | Both published |

## Notifications and systems

| # | Question | Default |
|---|---|---|
| 19 | **launch** Where should new leads reach you: text, email, both? Which numbers/addresses? | Both |
| 20 | What CRM or list do you use today? | Lightline console only |
| 21 | What does a great lead look like for you? | Home, address, wants it before a date, asks for you |
| 22 | Services or areas to turn away automatically? | None: the assistant never turns anyone away; you decide |

## Consent and voice

| # | Question | Default |
|---|---|---|
| 23 | **launch** OK to record and transcribe the assistant's part of calls, with the notice at the start? | Yes, with notice (counsel to confirm wording) |
| 24 | Record calls you answer yourself? | No |
| 25 | Who are 3 friends who can make test calls this week? | Pavan + you |
| 26 | Later: create your own ElevenLabs account and a professional voice clone of your voice (needs ~30 min+ of clean recordings and ElevenLabs' verification)? | Stock voice until then |

## Also needed (not questions for Amy)

- Josh/the business: create the Twilio account in the business's name and submit the **Business profile** (lifts the 2–3 concurrent-call cap) and A2P 10DLC registration (texts to Amy).
- A Texas attorney: greeting wording, Ch. 302 telephone-solicitation exemption, recording consent (legal-compliance.md §10).
- Bestline: can no-answer/busy/after-hours on the shared line forward to the new number later? (Do **not** change Bestline routing in v1.) Full question list and options: docs/bestline-options.md.
