# 0005 — A verified business brain: site claims become an Amy Approval Queue, not RAG

- Status: accepted (revised 2026-10-22 to add the approval queue and generated tests)
- Date: 2026-10-22

## Context

The two websites disagree with each other (website-forensics.md): the Christmas
site says 9 years, The Light Guys says 20 (and "over nine" and "over 20" on two
other pages); service area is 5 cities + 3 counties vs 18 Central Texas cities;
three different business addresses; JellyFish dealer vs "Permanent Inception
LED"; "licensed and bonded" vs "fully licensed and insured". Dumping both sites
into RAG would let the agent pick whichever passage retrieval returns — on the
phone, to a customer, as fact.

## Decision

**ElevenLabs is the mouth and ears. We own what makes the mouth useful:** a
verified business brain, deterministic tools, customer memory, human hand-off
and the revenue trail.

1. **Knowledge items, not documents.** Each topic a caller might ask about is an
   item (`lib/knowledge/`). It holds every CLAIM the sources make, with brand,
   quote, URL and evidence id (`site-facts.json`, captured 2026-10-22), plus the
   words that would give the claim away if spoken.
2. **Conflicts are detected, never resolved by the machine.** Two sources with
   different values = conflict → production action "Don't infer. Ask Amy."
   Single-source or risky claims → "Hold until Amy approves exact language."
   Agreeing, low-risk claims → "quick confirm" — still Amy's click.
3. **The Amy Approval Queue** (`/approvals`) shows each item with what each site
   says, how a caller would ask, and what the assistant does now. Amy approves her
   exact words (or the city list), or marks it "never say". Every decision is an
   audited event with the previous words; undo returns it to pending.
4. **Approved items are projected into the agent's truth** (business_config
   facts + service area, a new audited version). The agent reads them **live**
   through `get_approved_answer` / `check_service_area`; nothing is baked into
   the prompt, so an approval reaches the next call without re-publishing the agent.
5. **Unapproved claims are policy violations.** The post-call scan flags any
   agent sentence that voices a claim Amy has not approved (`unapproved_claim`).
   Approved words are allowed; a site's other version stays forbidden — derived
   from Amy's own text (approve "20 years" and "9 years" stays flagged).
6. **Tests are generated from the items**, never hand-written
   (`evals/knowledge-tests.ts`): *site says X, caller asks X* → the agent defers;
   *the agent repeats the site* → flagged; *Christmas site says X, Light Guys
   says Y* → it chooses neither; *after Amy approves* → it says exactly her words
   and still never the other site's. Adding a site claim adds its tests.
7. **RAG is deferred.** Live truths (availability, prices, job status) never come
   from retrieval; long approved documents can be added later as approved items.

## Consequences

- On day one the agent knows almost nothing about the business except what Amy
  approved in the demo seed. That is intended: it takes details and defers. The
  20-minute interview becomes ~16 approval clicks.
- First run of the generated tests found three real defects before any caller:
  two unmapped "years" claims on The Light Guys site (F29, F30), a service-area
  conflict that word-matching cannot see (now checked through the area tool),
  and "dealer" being read as a discount question.
