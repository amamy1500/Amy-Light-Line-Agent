# Cost model (prices as of 2026-10-20/22; every unit price is cited in docs/research)

## Unit prices

| Item | Price | Source |
|---|---|---|
| Twilio local number | $1.15/mo | twilio.com/en-us/voice/pricing/us |
| Twilio inbound, local | $0.0085/min | same |
| Twilio Media Streams (every AI minute) | $0.0044/min | docs/research/telephony-receive-options.md |
| Twilio outbound (ring Amy, transfer leg) | $0.014/min | same |
| Twilio recording (capture path) | $0.0025/min | same |
| Twilio SMS | $0.0083/segment + carrier ~$0.004 | twilio.com/en-us/sms/pricing/us |
| A2P 10DLC (low-volume) | $4.50 brand + $15 vetting once; $1.50/mo | Twilio support article (prior-work/07) |
| ElevenLabs Agents Creator | $22/mo ($11 first month), 275 min, 10 concurrent | elevenlabs.io/pricing/agents |
| ElevenLabs Pro / Scale | $99 (1,238 min, 20) / $299 (3,738 min, 30) | same |
| ElevenLabs extra minutes | $0.08/min; burst calls $0.16/min | same |
| LLM (pass-through) | ≈ $0.005–0.015/min for a small fast model (INFERENCE) | elevenlabs.md §4 |
| Vercel Pro | $20/mo (Hobby is non-commercial) | vercel.com/docs |
| Supabase Pro | $25/mo (Free pauses after 7 idle days) | supabase.com/pricing |
| Resend | Free 3,000 emails/mo | resend.com/pricing |

## Formulas (m = AI minutes per month)

- Twilio bills every call leg **rounded up to the full minute** (a 2 min 10 s call is billed 3 min).
- AI minute, variable: Twilio inbound $0.0085 + Media Streams $0.0044 + LLM ~$0.01
  (+ ElevenLabs $0.08 once plan minutes are used).
- Amy-first ring before overflow (≈18 s): +$0.014 per overflow call (one full outbound minute).
- Spam gate ("press 1"): a gated call that never answers bills 1 inbound minute, $0.0085.
  A call Amy blocked is rejected before answer: $0.
- "Call back from the business number": two outbound legs (Amy, customer) at $0.014/min each.
- Daily summary: one SMS per company per day with held calls (≈ $0.01 incl. carrier fees).
- Platform baseline: Vercel $20 + Supabase $25 + number $1.15 + 10DLC $1.50 = **$47.65/mo**.

| AI min/mo | Plan | ElevenLabs | Twilio + LLM | Platform | **Total/mo** |
|---|---|---|---|---|---|
| 100 | Creator | $22 | $2.29 | $47.65 | **≈ $72** |
| 500 | Creator | $22 + 225×$0.08 = $40 | $11.45 | $47.65 | **≈ $99** |
| 1,000 | Creator | $22 + 725×$0.08 = $80 | $22.90 | $47.65 | **≈ $151** |
| 5,000 | Scale (30 concurrent) | $299 + 1,262×$0.08 = $400 | $114.50 | $47.65 | **≈ $562** |

Billed minutes, not talk minutes: with per-call rounding, expect billed Twilio
minutes ≈ talk minutes + 0.5 × calls. With AI answering every call (`AI_MODE=always`),
spam that reaches the assistant costs AI minutes too; the assistant is told to
end those within about 20 s (not yet measured on real calls) and the screening above keeps the worst of it off the line.

## Per call and per lead (INFERENCE; to be replaced by measured averages)

- Average AI call 2.5 min → **≈ $0.25** at the $0.08 overage rate, ≈ $0.05 inside plan minutes.
- If 60% of AI calls are real prospects → **≈ $0.42 per AI-captured lead**.
- Recovered lead value = (Amy's close rate on callbacks) × (average job value). Both are Amy's
  numbers; the console will measure them (won leads with dollar amounts). Not guessed here.

## Prototype spend (first month)

| Item | Cost |
|---|---|
| Twilio: number, ~150 test minutes, 10DLC one-time | ≈ $27 |
| ElevenLabs Creator first month | $11 |
| Vercel Pro | $20 |
| Supabase (Free for the prototype; Pro before real customers) | $0–25 |
| LLM pass-through + test runs | ≈ $5–15 |
| **Total** | **≈ $63–98** (inside the $75–150 target) |

## Spend alerts

- ElevenLabs: usage alerts at 80% of plan minutes; burst off unless Amy chooses it for TV week.
- Twilio: usage trigger at $25 and $50 (Console → Usage Triggers).
- Vercel and Supabase: spend alerts on; **do not** use Vercel's spend-limit pause (it takes every project offline).
