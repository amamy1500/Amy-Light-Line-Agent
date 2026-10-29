# Quality gates and release ladder

Status as of 2026-10-22. "Local" = proven here with simulated calls; "Live" = needs
the real number, the ElevenLabs agent and Amy's phone.

## Gates before real customers

| Gate | Threshold | Measured | Status |
|---|---|---|---|
| Forbidden pricing | 0 price statements in all runs; critical scenarios ≥ 5 repeats each | Local: guard catches 100% of injected price/discount/date/warranty/identity/leak lines (37/37 mutations) | Local ✅ · Live pending |
| Invented availability / bookings | 0 | as above | Local ✅ · Live pending |
| Unapproved business claims | 0 site claims spoken before Amy approves; 100% of approved items answered with her exact words | 69 tests generated from 17 knowledge items (34 claims from 27 captured site facts): 17 ask, 29 repeat, 6 conflict, 17 approval, all pass; guard disabled → 42 checks fail | Local ✅ · Live pending (17 `knowledge:*` vendor tests) |
| Tenant isolation | 100% (RLS on every table; client sees only own business) | security tests | ✅ |
| Transfer destination | 100% to the tracking number's configured ring phone; never a number from the model | transfer has no number parameter; handoff dials `owner_ring_e164` | ✅ by construction |
| Intake persistence | ≥ 98% of fields the caller gave appear on the lead (live); 100% of tool-saved fields (local) | 66 scenario replays | Local ✅ · Live pending |
| Every call accounted for | 100% of completed calls have exactly one lead | property tests; 186-call load test 186/186 | ✅ |
| Duplicate safety | 0 duplicate leads/tasks/alerts under retries and parallel delivery | PGlite + real-Postgres races | ✅ |
| Provider outage | 100% of calls reach Amy, agent or capture when the vendor fails | vendor-error, circuit, drop tests | ✅ |
| Concurrency | No call fails because the AI tier is full; agent sessions ≤ limit | 100-call burst: 10 agent, 90 captured, 100 leads | ✅ |
| Webhook latency | p95 < 2 s, max < 5 s (Twilio budget 15 s) | prod build, local Postgres: p95 ≤ 0.70 s, max 0.75 s | ✅ (laptop; re-measure on Vercel) |
| Conversation latency | p50 < 1.5 s, p95 < 2.5 s caller-side | — | Live pending |
| Interruption handling | ≥ 95% of barge-ins stop the agent within 1 s | — | Live pending |
| Prompt leakage | 0 canary/instruction leaks | guard + canary tests | Local ✅ · Live pending |
| Webhook verification | 100% of unsigned/forged/stale requests rejected | route + webhook tests | ✅ |
| Secrets | none in repo or client bundle | grep + build output review | ✅ (re-check per release) |
| Held-out scenarios | ≥ 95% pass rate on vendor simulation; 100% on critical safety criteria | — | Live pending |

## Release ladder

| Stage | Who calls | AI mode | Exit criterion |
|---|---|---|---|
| 0 Developer | Pavan | overflow, test number | all local gates ✅ (done) |
| 1 Amy & friends | 3–5 known callers | overflow | Day-1 prove-it tests pass; Amy likes it |
| 2 Simulated evals | vendor tests | — | dev ≥ 95%, held-out ≥ 95%, critical 100% |
| 3 After hours only | real callers on the test/web number | after_hours_only | 2 weeks, 0 critical incidents |
| 4 Dedicated campaign number | TV / postcard number | overflow | ≥ 95% leads complete; Amy's callback rate ≥ 90% |
| 5 Overflow on main traffic | Bestline forwards no-answer (with approval) | overflow | 4 weeks clean |
| 6 Broader | — | overflow | owner sign-off |
| 7 More autonomy (FAQ, scheduling) | — | — | only if data shows no conversion loss vs. Amy |

**Kill switch:** console → "Phone assistant" → "AI off" (new config version, audited). Takes
effect on the next call. Deterministic capture needs no AI vendor.
