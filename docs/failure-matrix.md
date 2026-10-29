# Failure matrix

Every row: what the caller experiences, the fallback, the test that proves it,
and the event or incident an engineer sees. "Live" = needs the Day-1 real-call test.

| Failure | Caller experience | Fallback | Test | Observable |
|---|---|---|---|---|
| Our webhook down / 5xx / >15 s | Recorded-message greeting | Twilio fallback URL → TwiML Bin | Live; bin in docs/prior-work | Twilio debugger; no `call.received` |
| Database down at dial-result | Recorded message | Same `DialBridged` rule computed locally | tests/flow/call-flow.test.ts | log `dial-result: database unavailable` |
| Duplicate / out-of-order Twilio callbacks | — | SQL functions idempotent (I3, A4) | call-lifecycle property test; real-Postgres race test | one `call.completed` per call |
| Amy's voicemail answers | Caller never bridged to voicemail | Press-1 screen; `DialBridged` decides | telephony + call-flow tests | `call.recovery` with `dial_call_status=completed` |
| Amy busy / no answer | Agent answers | `routeAfterOwner` | agent-flow test | `agent.connected` |
| AI mode off (kill switch) | Recorded message | capture | agent-flow "kill switch" | `config.activated` with `ai_mode=off` |
| Agent tier full | Recorded message | admission refused in same transaction | agent-lifecycle A6; real-PG 60/10; load test 100 burst | `agent.admission_refused` |
| ElevenLabs API error / timeout (4 s) | Recorded message after ≤4 s | capture; incident | agent-flow "vendor error" | incident `agent_connect_failed` |
| Repeated vendor failures | Recorded message, no wait | circuit open 60 s after 3 failures / 2 min | agent-flow "circuit" | log; incidents |
| Agent stream drops mid-call | "Sorry, I lost the connection…" + message | `/agent-ended` without wrap-up → capture | agent-flow "stream drops" | incident `agent_stream_dropped` |
| Caller hangs up mid-agent | — | finalize → lead + post-call job + callback | agent-lifecycle A4 | `call.completed final_state=agent_completed` |
| Tool call times out / errors | Agent apologises, offers callback | gateway returns safe instruction, no stack | agent-flow "gateway boundaries" | `tool_call.outcome=error` (retryable key) |
| Tool call retried | — | stored result replayed | agent-lifecycle A2; real-PG 25 parallel | `replayed: true` |
| Agent loops on tools | Agent wraps up | 40-call cap per call | gateway unit (cap constant) | `error: tool_limit` |
| Transfer: Amy misses | "Amy couldn't pick up… you're back with Amy's AI assistant" | high-priority callback first, then new conversation | agent-flow demo, A7 | `transfer.returned`, `transfer_missed` alert |
| Transfer redirect fails (REST) | Stays with agent; ring when stream closes | `/agent-ended` sees `transfer_ringing` → dial | voice handler branch | log `handoff redirect failed` |
| Transfer after hours / twice | "Amy can't come to the phone… callback" | policy refusal | agent-flow | `transfer.refused` |
| Post-call webhook missing | — | lead keeps live facts; alert after ≤4 attempts | runner wait logic | incident `post_call_transcript_missing` |
| Webhook forged / stale / replayed | — | 401 on bad HMAC or >30 min; replay no-op | agent-flow signatures | 401 responses |
| Two conversations on one call | — | matched by our `session_id`, never by order | agent-flow (reverse-order webhooks) | `agent.post_call_received` with session id |
| Agent states a price / date / discount / warranty / "I'm Amy" / denies AI / leaks prompt | (already said) | post-call scan → `needs_review`, critical incident, Amy's card says so | compliance tests (35), 37 eval mutations | incident `agent_policy_violation` |
| Agent repeats a website claim Amy hasn't approved ("20 years", "free storage", an address) | (already said) | flagged `unapproved_claim`, lead to review; approved words allowed, the other site's version still flagged | evals/knowledge.test.ts (generated) | incident `agent_policy_violation` |
| The two sites disagree (area, years, insurance, address, brand, email) | "I don't want to give you the wrong answer…" | item is a conflict; the answer tool returns nothing until Amy decides; area tool says "unknown" | generated conflict tests | `/approvals` "The sites disagree" |
| Caller quotes the website back ("your site says 20 years") | Agent still defers | same as above; live check in exported vendor tests | `knowledge:*` vendor tests | post-call scan |
| Prompt injection | Agent refuses, keeps going | policy + vendor Manipulation guardrail + canary scan | eval D37, H03, H04 (live tests) | canary violation if leaked |
| Caller declines recording | "No problem, I won't keep a recording" | transcript/summary not stored; vendor copy purged | agent-flow "declines recording" | `consent.recording_declined`, `vendor_purge` job |
| Missing dynamic variable (vendor fails the call) | (would be dead air) | every variable always sent; test pins the set | agent-spec test | — |
| Notification provider down | — | outbox retries ×5, then `failed`; SMS + email both | prior alert tests | outbox `last_error` |
| Spam web form | Same thank-you page | honeypot, signed render stamp, spam score, rate limit | routes "drops bots" | none stored |
| Spam / vendor call | Polite, short | `finish_call not_a_lead` → flagged, no callback | eval D35, D36 | lead `intent=not_a_lead` |
| Wrong ZIP then corrected / changed details | — | later fact from same source wins; history kept | A3 property test; eval D27 | `lead.fact_recorded` |
| Returning caller | "I see you've called before" (no details recited) | month + earlier interest only | returning summary query | dynamic var `returning_context` |
| Business config invalid | Amy rings; capture | config rejected; AI disabled | config parse tests | log `failed validation` |
| Long silence / noise / accents / interruptions | — | vendor turn-taking; evals with audio conditions | Live (vendor tests) | per-turn latency in post-call |
