# Going live on Render

One Render web service runs everything: the screens, the API, and the call
webhooks. It's always on, so your computer can be off. It runs in Ohio, next
to Supabase.

## What it costs

| Item | Plan | Why |
|---|---|---|
| Render workspace | **Hobby** (no monthly fee) | Enough when one person runs the account. Choose **Pro** only if the business owns the account and you are added as a teammate (Hobby allows one member). |
| Render web service | **Starter** (0.5 CPU, 512 MB) | Always on. Render shows the monthly price at checkout. If the app runs out of memory, move to **Standard** (1 CPU, 2 GB). |

Builds use Render's own build machines (8 GB), so 512 MB never limits a build.

## Your steps (about 15 minutes)

1. **Supabase: new database password.** The old one was exposed earlier.
   - Project Settings → Database → Reset database password. Save it in your password manager.
   - Connect → **Session pooler** → copy the string, and put the new password where it says `[YOUR-PASSWORD]`.
   - Use the Session pooler string, not "Direct connection". Render can't reach the direct one.
2. **Render account.** Sign up at render.com with GitHub. Add a card under Billing.
3. **Tell me to push.** The code goes to `main` on GitHub. Render deploys from there.
4. **Create the service from the Blueprint.**
   - Render → **New → Blueprint** → connect GitHub → pick only `Light-Line-Agent` → branch `main`.
   - Render reads `render.yaml` and asks for **DATABASE_URL**: paste the string from step 1.
   - Click **Deploy Blueprint**. Wait for **Live** (about 5–8 minutes).
5. **Render API key.**
   - Render → Account Settings → API Keys → Create API key.
   - Paste it into `.env.local` after `RENDER_API_KEY=`, then save. I never see it.
6. **Tell me "done".** I run `npm run deploy:render` (about 5 minutes). It:
   - creates the ElevenLabs agent, its tools and its webhook, all aimed at Render;
   - copies the Twilio and ElevenLabs keys from `.env.local` into Render, then redeploys;
   - only after that, points 737-339-8333 at Render.
7. **First test call.** Call 737-339-8333 from your phone.
   - Watch the lead come in at `https://<your-service>.onrender.com/dashboard`.
   - Access code: Render → lightline → Environment → `OPERATOR_TOKEN`.

## What happens on every deploy

- A push to `main` deploys only after the GitHub tests pass.
- Before the new version takes calls, `npm run db:deploy` runs. It applies database
  changes, adds any new knowledge items, and applies Amy's decisions to items still
  pending.
- If that step fails, the deploy stops, and the running version keeps answering.
- A deploy never undoes what Amy changed in Settings: AI on or off, hours, and voice.

## Before real customers

- [ ] **Twilio fallback** (Twilio → the number → "Primary handler fails"). Without it,
      callers hear Twilio's error message if Render is down. The text is in
      `docs/prior-work/fallback-twiml-bin.xml`.
- [ ] **ElevenLabs:** turn off "use my data for training".
- [ ] **Supabase Pro** (daily backups; the free plan can pause).
- [ ] **Amy's cell, for ring-first:** Render → Environment → `OWNER_RING_E164`, then
      redeploy. Then Amy picks the AI mode in Settings.
- [ ] **Email alerts:** Resend keys, then `ALERT_MODE=live`. Texts wait for A2P approval.
- [ ] **Counsel** signs off the greeting.

## If something goes wrong

| What you see | Usual cause | Fix |
|---|---|---|
| Deploy fails at "pre-deploy" | Wrong `DATABASE_URL` (direct string, or old password) | Paste the Session pooler string again in Render → Environment, then redeploy |
| Deploy fails at "build" | A code problem (the tests should have caught it) | Render → Events → Logs; tell me |
| Calls get Twilio's error message | The service is down | Render → lightline → Events; add the Twilio fallback |
| `npm run live` refuses to start | The numbers serve Render now | Use `npm run live -- --take-over` for a local test. Afterwards, `npm run deploy:render` points them back to Render |
