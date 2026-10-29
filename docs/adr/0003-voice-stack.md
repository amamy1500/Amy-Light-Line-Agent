# 0003 — Voice stack: ElevenLabs Agents via register-call, behind our own Twilio flow

- Status: accepted for the pilot (re-decided after the Day-1 prove-it tests below)
- Date: 2026-10-22
- Supersedes: the "V2 voice vendor decided at Gate 3" note in prior-work/0002

## Context

Amy wants an assistant to answer when she can't, not voicemail. The call must
ring Amy first (she closes ~90% of qualified calls, Amy-reported), never lose
a caller, never invent prices or dates, and hand a caller back to Amy with
context. One TypeScript engineer builds and runs it.

Evidence (all in `docs/research/`, labelled FACT / VENDOR CLAIM / INFERENCE):

- Every hosted voice vendor loses its built-in transfer once **our** webhook
  rings Amy first and then hands the call over (ElevenLabs register-call: "No
  call transfers"; Retell custom telephony: same). The screened hand-off back
  to Amy is therefore our code whichever vendor we pick. (FACT, elevenlabs.md §1.2,
  vendor-research.md §3)
- Native number import makes ElevenLabs own the number's webhook: Amy-first is
  impossible without a second number. (FACT, elevenlabs.md §1.1)
- On the weighted matrix (reliability 72 of 104 points) the top four are within
  noise: ElevenLabs 77.7 (scored by us from elevenlabs.md), Retell 76.5,
  LiveKit 76.0, ConversationRelay 73.3. (INFERENCE, vendor-research.md §5)
- ElevenLabs: best independent PSTN latency (median 1,424 ms), strongest test
  tooling (simulated callers, tool-call tests, repeat runs, CLI for CI), the only
  realistic path to Amy's own voice (PVC in her account, shared by link), and the
  lowest price at our volume ($22 plan: 275 min, 10 concurrent; $0.08/min after).
  Weak spots: 2026 incidents (Aug 18 inbound Twilio, Sep 18 call starts),
  post-call webhook retries off by default, BAA only on Enterprise.

## Decision

1. **Twilio owns the number and every call decision.** Our `/api/voice/*`
   handlers ring Amy with a press-1 screen and branch on `DialBridged`
   (prior-work/0002, kept).
2. **The agent is one branch of our TwiML.** When Amy does not bridge (or out of
   hours, per the tenant's `ai.mode`), the server reserves an agent slot in
   Postgres (`app.start_agent_session`, row-locked admission), calls ElevenLabs
   **register-call** with our dynamic variables (call SID, our session id, the
   disclosure opening line), and returns its TwiML with our
   `<Connect action="/api/voice/agent-ended">` added. When the stream ends for
   any reason, control comes back to us.
3. **Transfers are ours.** The agent's `transfer_to_amy` tool marks the call,
   and the server redirects the live call (Twilio REST) to a screened `<Dial>`
   whose whisper reads the caller's one-line summary to Amy. If she doesn't
   press 1, a high-priority callback exists before anything else, and the caller
   goes to a fresh agent conversation ("You're back with Amy's AI assistant…").
4. **Every failure degrades to deterministic capture** (record a message, alert
   Amy): AI off (kill switch), no capacity, vendor error or timeout (4 s budget),
   circuit open (3 failures in 2 min), stream drop without wrap-up, missed
   hand-off with no capacity. None of these depend on the AI vendor.
5. **The vendor sees only narrow tools** (`lib/agents/tools.ts`): strict
   schemas, our call SID injected by the platform, secret-header auth,
   idempotency per (conversation, tool, arguments), audit rows, and a fixed
   instruction in every result. No SQL, no free HTTP.
6. **The agent's config is code** (`lib/elevenlabs/agent-spec.ts` →
   `agent/christmas-light-guys.json`), generated from tenant config + the
   versioned Amy Policy; only Amy-approved facts reach the prompt.

## Why not the others (short; detail in vendor-research.md §1.2)

| Stack | Reason not chosen for the pilot |
|---|---|
| Retell | Tie on the matrix; better workflow benchmark, but slower median latency, no voice-clone path we control, transfer equally DIY. **Named fallback #1** (same connector seam). |
| Twilio ConversationRelay | Fewest vendors and lowest lock-in, but we must host and build the realtime LLM loop on a WebSocket server (not Vercel functions). **Named fallback #2** if vendor risk dominates. |
| LiveKit Agents | Best warm transfer in Node, but +$50–500/mo and another real-time service to operate. Revisit for the premium tier (brief §41). |
| Pipecat | Python server; its Twilio route has no transfers; dev runner lacks Twilio signature checks. |
| OpenAI Realtime over SIP | No text hop to filter prices before speech; routing from our webhook undocumented; no eval tooling. |
| Vapi | Worst 2026 outage record (37,806 calls dropped Feb 23); fails at limit with no ring. |
| Telnyx, Ultravox, Deepgram VA, Bland | Hairpin transfers, hard caps (Ultravox 5), Enterprise-only features, or no typed TS SDK. |
| Google Voice | Not programmable (prior research). |

## Consequences

- Our seam is `AgentConnector` (`lib/agents/connector.ts`): swapping to Retell
  (`register-phone-call` + `<Dial><Sip>`) or ConversationRelay is one connector
  plus an agent-spec exporter; the tools, state machine, console and evals stay.
- We depend on the post-call webhook for transcripts. Retries are **off by
  default**: turn them on. If it never arrives, the lead still has every fact
  the tools saved live, Amy is alerted after a bounded wait, and an incident is
  raised (`post_call_transcript_missing`).
- ElevenLabs over its concurrency limit queues by default, but queueing is not
  documented for register-call; our own admission limit (`ai.maxConcurrentSessions`,
  set ≤ plan concurrency) decides first, so the vendor limit is never the one hit.

## Prove-it tests before real customers (Day 1 with credentials)

1. Exact register-call response: does it contain `<Connect>`? Does our `action` survive? (`extractTwiml`/`withConnectAction` assume yes; tests cover JSON-wrapped variants.)
2. Agent `end_call` → Twilio requests `/agent-ended` with `CallStatus=in-progress` (wrapped-up) and the caller hears our hang-up.
3. REST redirect mid-stream → `/handoff` rings Amy's real cell; her voicemail **cannot** accept (press-1 screen); missed → back to agent with context.
4. Over-limit: 11 parallel calls on a 10-concurrency plan with our limit at 10 → the 11th is captured, never rejected.
5. Post-call webhook arrives with `session_id` in dynamic variables and a valid HMAC.
6. Measured turn latency p50/p95 on a real PSTN call from Amy's phone.
If 1–3 fail in a way we cannot fix in a day, switch the connector to Retell (fallback #1).
