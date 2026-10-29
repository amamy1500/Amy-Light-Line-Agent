# Lightline brief: what this is, where it stands, what's next

Read this first when you pick up the project. It is the map; the details live in the
docs it points to. Updated 2026-10-24.

## 1. The job

Lightline is an AI phone receptionist for **The Christmas Light Guys** (CLG), a holiday-lighting
installer in Austin, Texas. Amy (office manager) misses calls because the office line is flooded
with spam, so real customers end up in voicemail and some never call back. Lightline answers the
business's calls, finds out what the caller wants, collects what Amy needs for a callback, puts the
caller through to Amy when she can take it, and texts or emails her every real lead. Amy works the
leads in a small web console. The same owner runs two more companies, **Sublime Patio** (patios) and
**The Fridge** (vending); the system is built for all three, CLG first.

The goal is **no lost call**: every caller ends up with Amy, the assistant, or a recorded message, and
every call becomes a lead Amy can see.

## 2. People

| Who | Role | What they decide |
|---|---|---|
| Amy Reilly | Office manager, CLG; the person the assistant works for | What the assistant may say (Approvals), her hours, who rings, alerts |
| Josh | Business owner | Accounts in the business's name, spending, legal sign-off |
| Pavan | Builds and runs Lightline (not an employee) | Technical choices, after research; never holds the business's passwords |

The assistant is "Amy's AI assistant" and never claims to be Amy or a person. Amy declined a clone of
her voice; it uses a stock voice. In January Amy hands the phones to a new hire; that is one save in
Settings (owner name and ring phone), with no other change needed.

## 3. Ground rules (each has a reason; keep them)

- **Approved words only.** The assistant states a fact about the business only if Amy approved those
  exact words in the console (`/approvals`). Everything said on the business's behalf binds the
  business, and the two CLG websites contradict each other (years in business, area, insurance).
- **No prices, dates, bookings, discounts, warranties or insurance claims**, however hard a caller
  pushes. Amy prepares every quote and checks every date herself. A scanner checks every transcript
  for these and flags the lead for review.
- **No lost call.** Every failure path (AI off, vendor down, at capacity, app down) ends in a recorded
  message, never silence. The Twilio number's fallback is a static recorder that works without our app.
- **Business-owned accounts.** Twilio, ElevenLabs, database and hosting belong to the business. Pavan
  works inside them as an admin. Keys go into the server's environment only, typed into
  `scripts/live/wizard.sh` (hidden input), never into chat or files under git.
- **Research before decisions.** Pavan wants evidence and options before a major choice. Research
  notes live in `docs/research/`, every claim labeled FACT, INFERENCE or OPEN, with sources.
- **When in doubt, tell Amy.** The AI's "spam" verdict is a guess. A call is held back from a text only
  when it looked like spam AND the caller said nothing a customer would say; those go into a daily
  summary instead. Every other call texts or emails her.
- **Nothing goes out in Pavan's name** (no messages, emails or signups) without his explicit OK; drafts
  only.

## 4. Decisions so far

| Decision | When | Why | Record |
|---|---|---|---|
| ElevenLabs Agents (register-call) for voice, Twilio for phone | Oct 22 | Best fit in a scored comparison; we keep our own tools, data and hand-off | `docs/adr/0003-voice-stack.md` |
| Facts live in an approvals queue, not in the prompt | Oct 22 | Amy controls every word; no re-publish when she approves | `docs/adr/0005-truth-layers.md` |
| One assistant for three companies; a shared line asks which one | Oct 22 | One office, one Amy | `docs/adr/0006-one-office-three-companies.md` |
| **Leave Bestline out** | Oct 23 (Amy) | Her request; 9313 is spam-flooded and goes to voicemail | `docs/research/keep-9313-options.md` |
| **Christmas Light Guys get their own number, 737-339-8333; 512-339-9313 is never touched** (replaces "port 9313 in January") | Oct 28 (Amy) | 9313 now serves four businesses and Amy runs her own forwarding, texts and voicemail on it; she doesn't want it changed. The 737 number (Twilio had no 512 left) goes on the new Christmas site, TV and QR only after real test calls, hosting and the Twilio fallback are done. Calls to it are clearly Christmas Light Guys. | `docs/architecture.md` (decision diagram) |
| Twilio business profile approved, filed as ISV Reseller with Amy Reilly as contact | Oct 28 | ISV can later register texting for each company's own EIN; company type says Corporation though LGHG is an LLC (check before texting registration) | Twilio console → Trust Hub |
| `/system` page for the operator: readiness, where calls and alerts go, traffic, failures, unanswered questions | Oct 28 | One place to see if it's ready and what's wrong, without touching settings | `app/system/page.tsx`, `tests/flow/system-health.test.ts` |
| Assistant answers first, offers Amy at once (recommended) | Oct 23 | Spam-flooded line; Amy can't answer everything. **Amy must confirm**; her email said ring-first Mon–Sat 9–6. One switch either way. | `docs/research/ai-first-vs-ring-first.md` |
| **Ring Amy first in her hours (Mon–Sat 9–5 by default); any key takes the call; the assistant takes misses, nights and Sundays** | Oct 25 (Pavan) | Simplest for Amy: one tap, nothing to remember. A keypress is still required, because her voicemail would otherwise "answer" and swallow the caller. While she's on one of our calls the next caller goes straight to the assistant ("Amy's on another call"). Hours are a Setting; Amy to confirm. | `tests/flow/owner-busy.test.ts`, `docs/research/phone-architecture-decision.md` |
| Agent prompt v4.2: four essentials before goodbye (name, what, where, best time), discovery by job type, say the picture back, close on the callback with Amy (D89–D91) | Oct 28 | Busy callers still leave a usable lead; the caller hears their own vision back; Amy does the selling | `lib/agents/policy.ts` |
| Agent prompt v4.1: natural-flow rules (don't re-ask, answer mid-intake questions, corrections, vague yes, "just have her call me", "can I hold?", repeat callers, early goodbyes) | Oct 25 | Sound like the best front-desk person, not a form | `lib/agents/policy.ts`, scenarios D82–D88 |
| Spam screening: blocks, a press-1 gate for hidden or failed-caller-ID numbers, daily summary | Oct 23 | Fails toward Amy hearing about the call | `docs/research/spam-screening.md` |
| Business owns the Twilio account; Pavan is invited as **Administrator** | Oct 24 | Numbers and registrations stay with the account that made them; only Owner/Administrator can do the business registration | `docs/research/twilio-account-setup.md` |
| Console styled after 21st.dev, rebuilt in our own CSS | Oct 23 | No API key, quota or license risk; no new packages | `docs/research/ui-21st-dev.md` |
| Agent prompt v4: persona, humor rules, honest objection replies, ~100 special-call rules | Oct 23 | Research on customer questions and humane phone manner | `docs/research/humane-voice-and-humor.md`, `docs/research/clg-customer-questions.md` |

## 5. How a call works

1. The caller dials the CLG Twilio number. Twilio asks our app (Next.js) what to do.
2. The app screens spam (blocked → refused; hidden or failed caller ID → "press 1 or say yes"), then
   routes by Amy's settings: assistant first, or her phone first with the assistant catching misses.
   Her phone shows the business number and whispers "<Company> call. Press any key to take it."; no key
   (missed, declined, voicemail) → the assistant. Already on one of our calls → the assistant at once.
   Every call she takes is saved as a lead and sent to her by text and email ("You took a call from…").
3. The ElevenLabs agent talks (stock voice; the thinking is done by Claude Haiku 5.5). It calls our
   tools to look up approved answers, save details, flag urgent calls, set callbacks, or transfer to Amy.
4. After the call, ElevenLabs posts the transcript; a job scans it, classifies the lead, and queues
   Amy's text/email (or holds likely spam for the 8 AM summary).
5. Amy opens the console: the lead, a "Before you call" brief, one-click call-back from the business
   number, block/unblock.

Full flow, state machine and invariants: `docs/architecture.md`. Every failure and its fallback:
`docs/failure-matrix.md`.

## 6. What's built (all in this folder; tested on simulated calls)

| Area | State | Proof |
|---|---|---|
| Call routing, transfer to Amy and back, capture fallback | Done | `tests/flow/agent-flow.test.ts`, `call-flow.test.ts` |
| Three companies, shared line, move/merge leads | Done | `tests/flow/office-flow.test.ts` |
| Approvals: site claims + 39 common customer questions as [bracket] templates | Done | `tests/db/question-bank.test.ts`, `evals/knowledge.test.ts` |
| Spam screening, daily summary, texts to our numbers kept | Done | `tests/flow/screening.test.ts` |
| Urgent alerts (danger → 911 line first; complaints, threats, officials) | Done | `tests/agents/edge-cases.test.ts` |
| Card numbers removed before storage | Done | same |
| Settings for everything except API keys, versioned with restore | Done | `tests/settings/office-settings.test.ts` |
| Console (dashboard, lead page + brief, approvals, settings), light/dark, phone width | Done | checked in the browser |
| Agent prompt v4 and tools (9 tools) | Done | `lib/agents/policy.ts`, `lib/agents/tools.ts` |
| Scenario evals: 81 dev + 19 held-out calls, 497 checks | Passing | `evals/replay.test.ts` → `evals/out/replay-report.json` |
| Live-agent test files for ElevenLabs (judge text per scenario) | Exported | `evals/out/elevenlabs-tests.*.json` |
| Real phone calls | **Not yet** | needs an upgraded Twilio account and an ElevenLabs key |

Totals on 2026-10-24: 523 tests pass, plus 4 against a real PostgreSQL 17; the production build passes.

## 7. Where we are right now (2026-10-24)

**Built and tested on simulated calls; no real call yet.** The next step is accounts, then the first
real call. Waiting on:

1. **Amy's six launch answers** (assistant-first or phone-first; her cell and alert email; OK to record
   with notice; who sets up accounts; who updates the websites/Google listing; a lawyer for the
   greeting wording). Plain-language page for her: `docs/amy-update.md` (shareable copy linked in §12).
2. **The business's Twilio account**, with Pavan invited as Administrator, and the business details
   Twilio needs (legal name from the IRS EIN letter, EIN, entity type, IRS address, Josh's and Amy's
   names/titles/cells/emails, website, whether Sublime Patio and The Fridge are separate companies).
3. **Texting registration (A2P 10DLC)**: $19.50 one-time ($4.50 brand + $15 vetting) + $1.50/mo, 5–10 business days, plus a
   privacy page and terms page on the website and Amy's written OK to receive texts. Email alerts
   until then.

Pavan can start testing today in his **own** Twilio account (upgraded, ~$20; a trial account blocks
the voice connection) with an ElevenLabs **free** account (15 min/month). That test number is
throwaway; never publish it.

## 8. Next steps, in order

Each step is done when its check is true.

1. **First real call (Pavan's test account).** Run `bash scripts/live/wizard.sh`, then
   `npm run live -- --fresh`. Done when a call to the test number reaches the assistant, the lead shows
   on `/dashboard`, and the transcript arrives.
2. **Business Twilio account.** Amy or Josh signs up, upgrades, invites Pavan as Administrator. Pavan
   buys the CLG number, submits the Business profile (lifts the 2-concurrent-call cap, ~1–2 days) and
   the A2P brand + Low-Volume Mixed campaign. Done when the profile is approved and the campaign is
   submitted.
3. **Close the three deploy gaps.** Put the project in git (no commit without Pavan's OK); add
   `vercel.json` with the every-minute `/api/jobs/run` cron (needs Vercel Pro); rewrite
   `docs/go-live.md` for the no-Bestline plan and the provisioning script. Done when `next build`
   passes and the cron is declared.
4. **Deploy.** Supabase (Postgres) via `scripts/db-setup.ts`; Vercel with the environment from
   `.env.example`; `PUBLIC_BASE_URL=https://<domain> npm run live:setup` to create the agent and point
   the number; Twilio fallback recorder. Done when the prove-it calls in `docs/go-live.md` §3 pass.
5. **Before real callers.** Counsel signs off the greeting and recording notice; Amy approves the basic
   "what we do" answers and sets closed days; Amy confirms assistant-first or phone-first. Then publish
   the new number on the websites and as the Google Business Profile's primary number, keeping 9313 as
   an additional phone (`docs/research/new-number-rollout.md`).

## 9. Looked at and set aside

| Option | Verdict | Why |
|---|---|---|
| Callingly (callingly.com) | Not now | Built for sales teams calling web leads fast, not for answering calls under Amy's rules. From $100/mo, about $0.50 per AI call; books appointments (Amy wants callbacks only); generic AI with no approvals or claim checks. Possible later add-on: instant callback for website form leads (needs consent wording for AI-voiced calls). |
| Moving 9313 to Twilio now | January | See §4 |
| Routing through Bestline | Out | Amy's request |
| Google Voice | Out | No call-control API |
| Amy's voice clone | Out | Amy declined |
| Tailwind / 21st.dev packages | Out | §4 |
| Retell, Twilio ConversationRelay | Fallbacks | Named fallbacks behind `lib/agents/connector.ts`; not built |

## 10. Open questions

- Amy: the six launch answers (§7.1); insurance-certificate requests (priority callback or not; never
  mention insurance); humor on Sublime Patio / The Fridge calls (off now); texting customers (noted,
  never promised); the 39 common questions; closed days; utility companies for the suburbs.
- Unknown until a live test: relay-service (TTY) calls vs the spam gate and the 60 s silence cut-off;
  whether ElevenLabs' safety filter ends calls that mention injuries; real latency.
- Spanish stays off until a native speaker checks the greeting (`lib/agents/lines.ts`).

## 11. Working in this repo

- **Current copy:** `C:\Users\Pavan Kalyan\OneDrive\Documents\Desktop\Christmas Agent\lightline`. An
  older copy in a Claude session folder is stale; never edit it.
- Commands are in `package.json`; environment variables in `.env.example`; the dev database is a file in
  `.data/` that seeds itself on startup (new knowledge items reach old databases on reseed).
- The browser preview runs `scripts/dev-here.mjs` so `next dev` starts in this folder whatever launched it.
- Real-Postgres tests need the local cluster: `PG_TEST_URL=postgres://postgres@127.0.0.1:54331/postgres`
  (data dir `C:/Temp/llpg`; start it in the background, it holds the shell's output open).
- On Windows, Git Bash heredocs mangle backslashes and non-ASCII text: write edit scripts to a file and run
  them with `python -I`.
- Changes to what the assistant says: `lib/agents/policy.ts` (bump `POLICY_VERSION`), then run
  `npx vitest run` and `evals/export-elevenlabs-tests.ts`. Every humor or scripted line must pass the
  compliance scanner (`tests/agents/edge-cases.test.ts` checks this).
- Pavan commits and pushes himself; leave git alone unless he asks.

## 12. Where to look

| Need | File |
|---|---|
| Run it, what's proven | `README.md` |
| Architecture and invariants | `docs/architecture.md`, `docs/adr/` |
| Every failure and its fallback | `docs/failure-matrix.md` |
| Costs | `docs/cost-model.md` |
| Going live checklist (needs refresh, §8.3) | `docs/go-live.md` |
| Amy's answers so far | `docs/amy-open-questions.md` |
| Plain-language update for Amy (shareable copy: https://claude.ai/artifact/DvdZiCZgZwLtwPr8Lwg6rU) | `docs/amy-update.md` |
| Number and Twilio account choices | `docs/research/keep-9313-options.md`, `docs/research/twilio-account-setup.md` |
| What callers ask; how the assistant talks | `docs/research/clg-customer-questions.md`, `docs/research/humane-voice-and-humor.md`, `docs/research/voice-agent-edge-cases.md` |
| Legal (disclosure, recording, Texas) | `docs/research/legal-compliance.md` |

## 13. Words used here

- **AI-first / ring-first**: the assistant answers every call first, or Amy's phone rings first and the
  assistant catches what she misses (`AI_MODE` always / overflow).
- **Approvals / knowledge item**: a caller question plus the exact words Amy approved for the assistant.
  **Question bank**: 39 common questions with [bracket] templates; a [blank] can never be approved.
- **A2P 10DLC**: US carrier registration required before an app may text from a normal 10-digit number.
- **Business profile (Trust Hub)**: Twilio's record of the business; lifts call limits and enables
  trusted caller ID.
- **Register-call**: how our app hands a live Twilio call to the ElevenLabs agent.
- **Kill switch**: "Assistant off" in the console; calls ring Amy in her hours and take messages otherwise.
- **Brief**: the "Before you call" panel on a lead page.
