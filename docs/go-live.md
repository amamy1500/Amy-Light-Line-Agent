# Going live (stage 1: Amy & friends)

> Hosting moved to Render (2026-10-29): follow `docs/render-setup.md`. It replaces the
> Vercel project, the Vercel environment, the manual database load and the Vercel Cron
> below; `npm run deploy:render` does steps 2.2–2.4.

Accounts must belong to the business (Josh/Amy). Pavan configures; he never
holds the business's passwords.

## 1. Accounts (business owner does these)

- [ ] Twilio account in the business's name; upgrade from trial; submit the **Business
      primary customer profile** (without it: 2–3 simultaneous calls total).
- [ ] Buy one local 512 number for testing (later: TV, web, print numbers).
- [ ] A2P 10DLC: Low-Volume Standard brand + low-volume mixed campaign (up to 5 business
      days). Until approved, alerts go by email only.
- [ ] ElevenLabs account (Creator plan to start). Settings: data-use / model-training
      opt-out ON; post-call webhook **retries ON**; HMAC secret generated.
- [ ] Supabase project (Pro before real customers), us-east-1.
- [ ] Vercel Pro project, region `iad1`.
- [ ] Resend domain for alert email.

## 2. Configure

1. Database: `DATABASE_URL=… npx tsx scripts/db-setup.ts` (no `--local-shim`, no demo seed),
   then insert the tenant, number(s), Amy's ring number and alert contacts, and activate the
   config with Amy's approved answers (docs/amy-open-questions.md).
2. Vercel environment: `PUBLIC_BASE_URL`, `DATABASE_URL`, `TWILIO_ACCOUNT_SID`,
   `TWILIO_AUTH_TOKEN`, `TWILIO_ALERT_FROM`, `AGENT_PROVIDER=elevenlabs`,
   `ELEVENLABS_API_KEY`, `ELEVENLABS_WEBHOOK_SECRET`, `AGENT_TOOL_SECRET`, `CRON_SECRET`,
   `FORM_SECRET`, `OPERATOR_TOKEN`, `ALERT_MODE=live`, `RESEND_API_KEY`, `ALERT_EMAIL_FROM`.
3. ElevenLabs: store `AGENT_TOOL_SECRET` as a workspace secret; `npx tsx scripts/export-agent.ts
   https://<domain>` with the secret id and an approved stock voice; create the agent from
   `agent/christmas-light-guys.json` (verify field names against the live API first); set the
   agent's post-call webhook to `https://<domain>/api/webhooks/elevenlabs`; put the agent id in
   the business config (`ai.agentId`).
4. Twilio number: *A call comes in* → `https://<domain>/api/voice/inbound` (POST);
   *Primary handler fails* → TwiML Bin from `docs/prior-work/fallback-twiml-bin.xml`;
   *Call status changes* → `https://<domain>/api/voice/status`. Media URLs: HTTP auth ON.
5. Vercel Cron: `GET /api/jobs/run` every minute with `Authorization: Bearer $CRON_SECRET`.

## 3. Prove-it calls (ADR 0003) — from Amy's phone and a friend's

- [ ] Amy answers and presses 1 → bridged; console shows "You answered".
- [ ] Amy ignores → agent answers with the full disclosure; Sarah-style call end to end.
- [ ] Caller asks for Amy → Amy's phone rings with the summary whisper; Amy lets it go to her
      voicemail → caller is back with the assistant; callback exists; Amy got the alert.
- [ ] Caller says "don't record this" → no transcript stored; purge job done.
- [ ] Kill switch "AI off" → next unanswered call records a message.
- [ ] 11 calls in parallel (friends + a script against a staging number) → 10 agent, 1 capture.
- [ ] Measure caller-side latency (p50/p95) and note it in quality-gates.md.

## 4. Before stage 3 (after-hours real callers)

- [ ] Counsel signs off: greeting wording, recording consent, Texas Ch. 302 exemption.
- [ ] Vendor simulation suites pass (dev ≥ 95%, held-out ≥ 95%, critical safety 100%).
- [ ] Amy has approved the facts she wants spoken; everything else stays draft.
