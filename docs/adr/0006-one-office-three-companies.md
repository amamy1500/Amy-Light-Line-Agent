# ADR 0006: One office, three companies

Date: 2026-10-22. Status: accepted (built; not yet tested on a real call).

## Context

- Amy answers the phones for three companies run by one owner:
  - The Christmas Light Guys / The Light Guys
  - Sublime Patio
  - The Fridge
- They share one Bestline number, 512-339-9313. It forwards every call to Amy's cell.
- The owner wants one assistant, in Amy's voice, for all three. It should answer only when Amy can't, never invent facts, and save every call for Amy.
- Research: `docs/research/one-number-three-businesses.md`, `telephony-receive-options.md`, `bestline-metaswitch.md`, `sublime-fridge-knowledge.md`, `amy-voice-clone.md`, `repo-scan-2.md`.

## Decision

1. **One tenant, three businesses.** Each business has its own config, knowledge items, approvals, leads and alerts. A fourth business of kind `front_desk` owns a shared line until the caller says which company.
2. **The number decides the company.**
   - Each company's Twilio number is mapped to it, so the assistant greets it by name and asks nothing.
   - The shared line's greeting ends with "Which company are you calling about?". `ForwardedFrom` never routes: Twilio says it depends on the carrier.
3. **One ElevenLabs agent.**
   - The prompt names no company. Each call gets `{{company_name}}` and `{{company_context}}` from the line's config.
   - On the shared line, the agent calls the new `select_business` tool with the caller's words.
   - Our code decides the company (`resolveCompany`: a name first, then a need that points to one company; a need that fits two companies means one question). `app.assign_business` then moves the call and lead, or merges them into the caller's open lead in that company.
   - No agent-to-agent transfer. It is unverified under register-call, and every tool needs `call_sid`.
4. **Amy-first stays.**
   - A line rings Amy first, as before.
   - A line marked `ring_owner = false` skips that ring and goes straight to the AI. That marks a number Bestline forwards to only after Amy didn't answer, so she is never rung twice.
5. **One AI plan.** Admission locks and counts at the tenant, so three companies can't exceed one vendor plan.
6. **Scanning across companies.**
   - Every call is scanned against every company's unapproved claims.
   - Company names and the required disclosure wording are masked before matching, so the scripted lines can't flag themselves.
   - A generated test (`tests/agents/office-scan.test.ts`) runs every scripted line against all three companies' claims.
7. **Amy's voice is opt-in.**
   - `ai.voice = owner_clone` requires a cloned voice and changes the greeting to "I sound like Amy, but I'm an automated system, not Amy and not a person."
   - `scripts/live/clone-voice.ts` refuses to run without her signed consent file, records its SHA-256, and has `--revoke`.

## Consequences

- **Amy sees:** company tabs, a company badge on every lead, "Company not given" for shared-line callers who never said, a one-click "Which company is this for?", approvals per company, a CSV of all calls, and alerts that start with the company name.
- **Bugs found while building:**
  - The tool replay key ignored the company.
  - Capacity was counted per business.
  - `agent_lead` / `transfer_missed` / `callback` / `review` alerts rendered "undefined". They had never been rendered before.
  - Two site claims flagged the disclosure and a company name.
- **Not proven:** a real call; agent quality on three companies in one prompt; Bestline forward behaviour and caller ID. The research docs list the questions.
