# Research: making the phone agent sound like Amy (ElevenLabs voice clone)

> **NOT LEGAL ADVICE.** Engineering research by a non-lawyer. It finds and labels
> sources. It does not apply law to facts with authority. Items in §8 go to a
> licensed Texas attorney before Amy records anything. Vendor terms and prices
> change often. Re-check before relying.

- Date: 2026-10-22. All pages below were opened on this date unless marked.
- Ask: the owner wants the inbound agent to use Amy's own cloned voice. Budget $50–100.
- Current agent: ElevenAgents over Twilio register-call, µ-law 8 kHz both ways, TTS `eleven_flash_v2`, LLM `claude-haiku-5-5`, stock voice from `ELEVENLABS_VOICE_ID` (`lib/elevenlabs/agent-spec.ts`, `scripts/live/setup.ts`).
- Read first: `docs/research/legal-compliance.md` (§2.2 greeting, §5 cloning law, §10 counsel list), `docs/research/elevenlabs.md` §11, `lib/agents/policy.ts`, `lib/agents/compliance.ts` (`IMPERSONATE` regex).
- Builds on, and does not repeat in full, legal-compliance.md §4 (AI disclosure) and §5 (cloning law).

## 0. Labels

| Label | Meaning |
|---|---|
| FACT | Read on a primary page today (vendor docs, terms, SDK source, statute, order, opinion). URL given. Vendor performance numbers are the vendor's own claims. |
| INFERENCE | Our reasoning from the facts. Needs a test or counsel. |
| OPEN QUESTION | Not documented, conflicting, or unsettled. Test, ask ElevenLabs support, or ask counsel. |

---

## 1. Bottom line

| # | Conclusion | Label |
|---|---|---|
| 1 | **Start with an Instant Voice Clone (IVC) on the Creator plan the business already budgets.** Incremental vendor cost: $0. Amy records about 3–5 minutes and uploads the best 1–2. | INFERENCE on FACTs (§2, §7) |
| 2 | IVC is faster at runtime than a Professional Voice Clone (PVC), and the phone line throws away most of the extra fidelity PVC buys. | FACT (latency) + INFERENCE (phone) (§3) |
| 3 | Go to PVC only if a blind phone test says the IVC does not sound like Amy. PVC needs 30+ minutes of clean audio and must be created and verified by Amy herself. | FACT (§2) |
| 4 | ElevenLabs allows cloning a staff member's voice with explicit, informed consent. Its own receptionist product invites cloning "a team member's" voice. | FACT (§4) |
| 5 | Turn the ElevenLabs training ("Data use") opt-out ON **before** uploading Amy's audio. The opt-out only works going forward. | FACT (§4.3) |
| 6 | The FCC AI-voice ruling covers calls the business *makes*. FCC says TCPA rules do not reach technology that *answers* inbound calls. Any future AI callback in Amy's voice would be an "artificial voice" call. | FACT (§5.1) |
| 7 | Texas has no living-person voice statute. Texas common-law misappropriation and the CUBI "voiceprint" rule are the live hooks. Written, specific consent covers both. | FACT + INFERENCE (§5.3) |
| 8 | The new risk is not Amy's consent. It is callers believing they talk to Amy. Add one plain sentence to the greeting: "I sound like Amy, but I'm an automated system, not Amy and not a person." | INFERENCE on FACTs (§5.5, §7.5) |
| 9 | Spec change: put Amy's voice id in `ELEVENLABS_VOICE_ID` (→ `conversationConfig.tts.voiceId`), keep `modelId: "eleven_flash_v2"` and `ulaw_8000`, add `stability`, `similarityBoost`, `speed`, and `agent.disableFirstMessageInterruptions: true`. | FACT (SDK fields) + INFERENCE (values) (§7.4) |

---

## 2. Q1. Instant vs Professional Voice Clone

### 2.1 Side by side

| Item | Instant Voice Clone (IVC) | Professional Voice Clone (PVC) | Label / source |
|---|---|---|---|
| Lowest plan | Starter ($6/mo). Free has none. | Creator ($22/mo). Free and Starter have none. | FACT. https://elevenlabs.io/pricing ; https://elevenlabs.io/docs/eleven-creative/voices/voice-cloning/professional-voice-cloning |
| Monthly price (monthly billing) | Starter $6, Creator $22, Pro $99, Scale $299, Business $990. Annual = 10× monthly. | Same plans from Creator up. | FACT. https://elevenlabs.io/pricing |
| Promos shown today | Starter "First month 83% off" ($1), "Until Nov 1". Creator "First month 50% off" ($11), no end date shown. | Same Creator promo. | FACT (banner text; year not shown). https://elevenlabs.io/pricing |
| How many per plan | Custom voice slots (all custom voices, incl. IVC): Free 3, Starter 10, Creator 30, Pro 160, Scale 660, Business 660. | PVC slots: Creator 1, Pro 1, Scale 3, Business 10, Enterprise custom. | FACT. https://elevenlabs.io/docs/help-center/account/general/how-many-voice-slots-do-i-get-per-tier-and-how-can-i-increase-it ; PVC page. |
| Slot conflict | The pricing page's comparison table appears to show Business 2,200 slots. Parsing of that table is uncertain. | — | OPEN QUESTION |
| Audio needed | 1–2 minutes of clean audio recommended. More than 2–3 minutes "will yield little improvement" and may reduce stability. Each file ≥ 5 s; total ≥ 10 s. | Bare minimum 30 minutes. Recommended at least 1 hour, ideally close to 3 hours. The page also says "30–180 minutes". | FACT. https://elevenlabs.io/docs/eleven-creative/voices/voice-cloning/instant-voice-cloning ; PVC page (the PVC page is internally inconsistent) |
| Format | MP3 at 192 kbps or above strongly recommended. WAV usually does not improve quality. | Same. WAV "can cause problems with the upload". | FACT. IVC and PVC pages |
| Levels | −23 to −18 dB RMS, true peak −3 dB. | Same. | FACT. IVC and PVC pages |
| Quality rule | Recording quality matters more than length. One speaker, no reverb, no background noise. The clone copies the performance: a slow monotone read produces a slow monotone voice. | Same, plus: one consistent style; pop filter; about "two fists" from the mic; acoustically treated room or a duvet; XLR mic into an interface suggested (AT2020 / Rode NT1 + Focusrite named). | FACT. IVC and PVC pages |
| Creation / training time | Near-instant. The concepts page contrasts PVC as taking "minutes rather than seconds". | Fine-tuning usually 3–6 hours; the page also says 6–24 h and "up to 24 hours". Email when ready. | FACT. https://elevenlabs.io/docs/eleven-api/concepts/voice-cloning ; https://elevenlabs.io/docs/help-center/product/voices/voice-cloning/what-is-the-difference-between-instant-voice-cloning-ivc-and-professional-voice-cloning-pvc |
| Consent step | Uploader confirms "the right and consent" to clone, then saves. | Speaker must verify. "Even with their consent, you cannot clone someone else's voice." | FACT. IVC page; PVC page; https://elevenlabs.io/docs/help-center/product/voices/voice-cloning/can-i-create-a-professional-voice-clone-of-someone-elses-voice |
| Verification | IVC page: none described. API returns `requires_verification` (bool). The concepts page says both IVC and PVC use "voice-captcha". | Captcha: the system shows several lines of text; the owner reads them aloud. ElevenLabs' voice guide says within a 10-second window, with 4 attempts. On failure wait 24 h or contact support. Manual verification by documents is a fallback. Verify with the same equipment as the samples. | FACT (conflict on IVC). https://elevenlabs.io/docs/api-reference/voices/ivc/create ; concepts page ; https://elevenlabs.io/docs/eleven-api/guides/how-to/voices/professional-voice-cloning ; https://elevenlabs.io/elevenlabs-voices-a-comprehensive-guide |
| Who may create it | Any account user with consent. | Only the speaker, on an account she controls. | FACT. Same pages |
| Sharing | Only with members of the same workspace. Cannot leave the workspace. | Workspace, a private "Anyone with the link" share, or the public Voice Library. | FACT. https://elevenlabs.io/docs/help-center/product/voices/my-voices/how-do-i-share-a-voice ; https://elevenlabs.io/docs/help-center/product/voices/my-voices/who-has-access-to-my-voices |
| Models trained | Zero-shot; works with Flash models (latency page pairs "Flash model with an IVC"). | Auto-trains on Flash v2.5, Turbo v2.5, Multilingual v2; English PVCs also on **Flash v2** and Turbo v2. Eleven v4 needs a separate fine-tune click. | FACT. PVC page; https://elevenlabs.io/docs/eleven-api/concepts/latency ; https://elevenlabs.io/docs/eleven-agents/customization/voice/expressive-mode |
| Export | Clones cannot be downloaded or exported. They stay in the account. | Same. | FACT. IVC page |

### 2.2 What this means for Lightline

- IVC lives in the business account. The business controls deletion. Amy cannot delete it herself unless she has a login. INFERENCE.
- PVC must be created by Amy. Two ways: INFERENCE.
  1. Amy is the human user of the business ElevenLabs account. She creates and verifies it there. Uses the Creator plan's one PVC slot. $0 extra.
  2. Amy has her own Creator account ($22/mo; $11 first month if the promo applies) and shares the PVC to the business by private link (`client.voices.share(publicUserId, voiceId, { newName })` in the SDK). She keeps control.
- With option 2: whether the business keeps access after Amy unshares, deletes, or downgrades is not documented. Whether a link-shared PVC uses a custom voice slot is not documented. OPEN QUESTION.
- If Amy downgrades, "your PVC will remain on your account". FACT (PVC page). Whether it still works for the business afterwards: OPEN QUESTION.

---

## 3. Q2. A cloned voice in ElevenAgents on phone calls

### 3.1 Model support

| Model id (SDK enum `TtsConversationalModel`) | Clone support | Model latency (vendor) | Status for us | Label / source |
|---|---|---|---|---|
| `eleven_flash_v2` (current) | IVC: works with Flash (INFERENCE from latency page). PVC: English PVCs auto-train on Flash v2 (FACT). | ~75 ms | English only. Lowest latency. Phoneme pronunciation tags only work on Flash v2. **Keep.** | FACT. https://elevenlabs.io/docs/overview/models ; PVC page ; https://elevenlabs.io/docs/eleven-agents/customization/voice |
| `eleven_flash_v2_5` | PVC auto-trains on it (FACT). IVC: Flash family (INFERENCE). | ~75 ms | Only needed for non-English. | FACT. Models page |
| `eleven_turbo_v2`, `eleven_turbo_v2_5` | PVC auto-trains on them. | Slower than Flash. | **Deprecated** in the SDK and models page. Do not use. | FACT. Models page; SDK `TtsConversationalModel.d.ts` |
| `eleven_multilingual_v2` | PVC trains on it. | "higher latency" than Flash | Listed for agents, but no reason for an English phone agent. | FACT. Models page |
| `eleven_v3_conversational` | Not stated. | ~280 ms | "Previous generation". Expressive tags. | FACT; clone support OPEN QUESTION |
| `eleven_v4_turbo` | "works with both" IVC and PVC; PVC needs a v4 fine-tune. Expressive mode switches on automatically. | ~100 ms median | Candidate for an A/B test only. | FACT. https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4 ; expressive-mode page |
| `eleven_v4` | Supports IVC and PVC. | Not stated | Content model, not real time. | FACT. Models page |

- Agent pricing is one per-minute rate regardless of TTS model or voice type. No clone surcharge is listed. FACT. https://elevenlabs.io/pricing/agents ; expressive-mode page ("no separate rate ... for the TTS model").
- "Voices with live moderation enabled cannot be used in ElevenAgents." That applies to some Voice Library voices, not to our own clone. FACT (voice page) + INFERENCE.

### 3.2 Latency penalty

- Default voices, synthetic voices and IVCs "generally produce audio faster" than PVCs. PVCs add per-generation overhead. FACT. https://elevenlabs.io/docs/eleven-api/concepts/latency
- No millisecond figure is published for the PVC penalty. OPEN QUESTION. Measure it.
- IVC on Flash v2 should cost about the same latency as today's stock voice. INFERENCE. Measure it.

### 3.3 Quality over 8 kHz µ-law

- Twilio Media Streams audio is always `audio/x-mulaw`, 8000 Hz, mono, both directions. FACT. https://www.twilio.com/docs/voice/media-streams/websocket-messages
- G.711 is "PCM of voice frequencies". FACT. https://www.itu.int/rec/T-REC-G.711
- 8 kHz sampling cannot carry sound above 4 kHz (Nyquist). Breathiness, sibilance detail and "air" are lost. Pitch, accent, rhythm and vowel colour survive. INFERENCE.
- So callers mostly hear Amy's pitch, pace, accent and phrasing. IVC captures those. PVC's extra fidelity is mostly the part the phone discards. INFERENCE. Prove it with the blind test in §6.6.
- The dashboard's web test plays wideband audio. It overstates similarity. Test over a real phone call. INFERENCE.
- Do not turn on the "phone-style" voice filter (`tts.audio_effects.filter_preset_id: "phone"`). It is meant to make wideband audio sound like a phone. Our audio already is one. FACT (setting) + INFERENCE. https://elevenlabs.io/docs/eleven-agents/customization/voice/audio-environment

### 3.4 Settings to tune

| SDK field (`conversationConfig.tts.*`) | Wire name | Range / guidance | Start value | Label / source |
|---|---|---|---|---|
| `voiceId` | `voice_id` | Amy's clone id | from `ELEVENLABS_VOICE_ID` | FACT (SDK `TtsConversationalConfigInput.d.ts`) |
| `modelId` | `model_id` | see 3.1 | `"eleven_flash_v2"` | FACT (SDK) |
| `stability` | `stability` | 0.30–0.50 more emotional, "may occasionally sound unstable"; 0.60–0.85 consistent, possibly monotonous. | 0.55 | FACT (ranges) https://elevenlabs.io/docs/eleven-agents/customization/voice/best-practices/conversational-voice-design ; INFERENCE (value) |
| `similarityBoost` | `similarity_boost` | Higher = clearer, more consistent; "very high values" may distort. | 0.80 | FACT (guidance) same page; INFERENCE (value) |
| `speed` | `speed` | 0.7–1.2; default 1.0; natural talk 0.9–1.1. | 1.0 | FACT. https://elevenlabs.io/docs/eleven-agents/customization/voice/speed-control |
| `agentOutputAudioFormat` | `agent_output_audio_format` | — | `"ulaw_8000"` (unchanged) | FACT (SDK; register-call requirement in elevenlabs.md §1.2) |
| `pronunciationDictionaryLocators` | `pronunciation_dictionary_locators` | IPA/CMU rules; phoneme control only on Flash v2. | Add later for Austin place names (§6.4). | FACT. Voice page |
| `textNormalisationType` | `text_normalisation_type` | `"system_prompt"` or `"elevenlabs"` (the latter adds latency). Platform default not documented. | Leave unset; test numbers first. | FACT (SDK enum) ; OPEN QUESTION (default) |
| `optimizeStreamingLatency` | — | "Deprecated: ... no-op". | Do not set. | FACT (SDK) |
| `conversationConfig.agent.disableFirstMessageInterruptions` | `disable_first_message_interruptions` | Caller cannot talk over the first message. | `true` | FACT (SDK `AgentConfig.d.ts`) ; INFERENCE (value) |

- ElevenLabs' receptionist product offers the same idea ("Always finish the first message") for greetings "that include a required disclosure". FACT. https://elevenlabs.io/docs/reception-ai/receptionist/voice-and-personality
- The SDK voice-settings type also has `style` and `useSpeakerBoost`. The agent TTS config does not expose them. FACT (SDK `TtsVoiceSettings.d.ts` vs `TtsConversationalConfigInput.d.ts`).

### 3.5 Attaching the voice by API (`@elevenlabs/elevenlabs-js` 2.74.0, read from `node_modules`)

| Step | SDK call | Label |
|---|---|---|
| Create IVC | `client.voices.ivc.create({ name, files, removeBackgroundNoise?, description?, labels? })` → `{ voiceId, requiresVerification }`. Leave `removeBackgroundNoise` off for clean audio; it "can make the quality worse". | FACT (SDK types) |
| Create PVC | `client.voices.pvc.create` → `pvc.samples.create` → `pvc.verification.captcha.get` / `.verify` (or `pvc.verification.request` for manual) → `pvc.train(voiceId, { modelId })` → poll `client.voices.get(voiceId)` `fineTuning.state`. | FACT. PVC quickstart |
| Add a link-shared PVC | `client.voices.share(publicUserId, voiceId, { newName })` | FACT (SDK reference.md) |
| Attach to agent | `conversationConfig.tts.voiceId` in `client.conversationalAi.agents.create` / `.update(agentId, request)` (`scripts/live/setup.ts` already calls both). | FACT (SDK; code) |
| Our code path | `ELEVENLABS_VOICE_ID` wins over the cached stock voice in `pickVoice()`; it flows to `AgentSpecOptions.voiceId` → `tts.voiceId`. No code change needed to swap the voice. | FACT (code: `scripts/live/setup.ts` line 110, `lib/elevenlabs/agent-spec.ts` line 134) |
| Delete | `client.voices.delete(voiceId)` | FACT (SDK) |

---

## 4. Q3. ElevenLabs policies

### 4.1 Consent and prohibited uses (Prohibited Use Policy, updated Oct 9, 2026)

| Rule | Label / source |
|---|---|
| §3: no cloning, synthesizing or impersonating a living person's voice without "explicit and informed consent or other valid authorization". | FACT. https://elevenlabs.io/use-policy |
| §3: no impersonating "any organization", no false endorsement or affiliation. §3 and §8: no fraud. | FACT. same |
| §9: no use of a person's voice or likeness without authorization (publicity rights). | FACT. same |
| §10: disclose AI where law requires it or where silence would materially mislead. Do not strip ElevenLabs watermarks or provenance. | FACT. same |
| §2: no automated calling that is unlawful or lacks legally required consent. | FACT. same |
| §1: no voice recordings of anyone under 18. | FACT. same |
| Terms §4(b): voice models may be of "your voice" or a voice "you are authorized to share". §4(g): you warrant you hold all rights. | FACT. https://elevenlabs.io/terms-of-use (updated Oct 9, 2026) |
| ElevenAgents Terms §3.5: tell each caller, before access, they deal with AI not a human, that ElevenLabs and its providers process the call, and that it is recorded. Keep consent proof the longer of the legal period or 5 years. No voice-clone-specific clause. | FACT. https://elevenlabs.io/agents-terms (updated Oct 9, 2026) |
| Twilio AUP: no "false identity" or attempts to mislead as to the sender's identity. No AI-voice clause. | FACT. https://www.twilio.com/en-us/legal/aup (updated May 12, 2025) |

### 4.2 Is a staff member's clone allowed for a customer-facing agent?

- Yes, with explicit, informed consent. FACT (Use Policy §3, Terms §4(b)).
- ElevenLabs' own Reception product says to clone "your own or a team member's" voice and to confirm consent. FACT. https://elevenlabs.io/docs/reception-ai/receptionist/voice-and-personality
- The clone must not be used to claim to be Amy. That would be impersonation of a living person beyond her consent, and deception under §10. INFERENCE.

### 4.3 Safeguards and the voice owner's rights

| Topic | Finding | Label / source |
|---|---|---|
| No-go voices | Blocks clones that approximate prominent public figures. No process for private people to be added. Not relevant to Amy. | FACT. https://elevenlabs.io/docs/help-center/legal/what-are-no-go-voices |
| Other safeguards | PVC verification; customer vetting; classifiers and human review; C2PA provenance; public AI speech classifier; abuse reporting. | FACT. https://elevenlabs.io/safety |
| Traceability | All generated audio can be traced to the generating user. | FACT. https://elevenlabs.io/docs/help-center/product/voices/voice-cloning/are-there-any-restrictions-on-what-voices-i-can-upload-for-voice-cloning |
| Delete a clone | My Voices → More actions → Delete voice. Cannot be undone. Unverified PVC: 24 h after last verification attempt, or via support. | FACT. https://elevenlabs.io/docs/help-center/product/voices/my-voices/how-do-i-delete-voices-from-my-voices |
| Deletion right | §4(b): you may request deletion of User Voice Models through your account. | FACT. Terms |
| Training licence | §4(d): licence to Content, including voice, to improve services, "perpetual and irrevocable". No standalone commercialization of a voice without permission. | FACT. Terms |
| Opt-out | §4(i): "Data use" opt-out stops future training. It does not reach uses before the opt-out date. | FACT. Terms |
| Voice data retention | Data generated about a voice kept no longer than 3 years after last interaction, unless law requires otherwise. Ownership checks may involve biometric data "under some laws". | FACT. https://elevenlabs.io/privacy-policy (updated Oct 9, 2026) |
| Privacy requests | Online form or dpo@elevenlabs.io. | FACT. Privacy policy |
| "Voice Processing Notice" | Terms point to it inside the Privacy Policy. Not found as a separate section today. | OPEN QUESTION |
| Revoking a link share | Not documented. Library voices have 30-day to 2-year notice periods; that is for public Library voices. | FACT (Library) ; OPEN QUESTION (private link). https://elevenlabs.io/docs/eleven-creative/voices/voice-library |

- Consequence: deleting the clone stops future use by us. It may not erase every derived copy at ElevenLabs. Amy must be told this before she records. INFERENCE.

---

## 5. Q4. Law and disclosure (inbound calls, Texas business, callers anywhere)

### 5.1 Federal: TCPA and the FCC

| Claim | Label / source |
|---|---|
| FCC 24-17 (adopted Feb 2, released Feb 8, 2024): TCPA "artificial or prerecorded voice" covers "current AI technologies that generate human voices". Voice cloning is "artificial" because "a person is not speaking". Callers need prior express consent "to initiate such calls". | FACT. https://docs.fcc.gov/public/attachments/FCC-24-17A1.pdf |
| FCC 24-84 NPRM (Aug 8, 2024): the artificial-voice ban "extends only to outbound calls that are 'made' or 'initiated'". "The TCPA's requirements do not extend to technologies used to answer inbound calls." | FACT. https://docs.fcc.gov/public/attachments/FCC-24-84A1.pdf |
| 24-84 is a proposal, still pending. Courts are not bound by FCC readings (McLaughlin v. McKesson, 2025). | FACT (per legal-compliance.md §4.1) |
| An inbound agent in Amy's voice is outside the TCPA. A future AI **callback** in Amy's voice is an artificial-voice call: prior express consent; written consent if telemarketing; 47 CFR 64.1200(b) identification. | INFERENCE on FACTs (legal-compliance.md §6.5) |
| FTC Impersonation Rule (16 CFR 461) covers government and business impersonation. The 2024 proposal to add individuals is not final. A new ANPRM (Oct 1, 2026) targets platforms that enable scams, not AI voices. | FACT (part 461; ANPRM https://www.federalregister.gov/api/v1/documents/2026-20143.json) ; OPEN QUESTION (individual extension status) |
| FTC deception test: a practice "likely to mislead the consumer acting reasonably", judged by "net impression". "Pro forma statements or disclaimers may not cure" deception. A deceptive first contact can violate the law even if the truth comes out later. | FACT. https://www.ftc.gov/system/files/documents/public_statements/410531/831014deceptionstmt.pdf |
| A familiar staff voice raises the chance a caller's net impression is "this is Amy". A rushed or buried disclosure may not cure it. The disclosure must be first, plain and unhurried. | INFERENCE |

### 5.2 Texas: Amy's rights in her voice

| Claim | Label / source |
|---|---|
| Property Code ch. 26 creates a property right in name, voice and likeness **after death** only. §26.011: post-death use needs written consent of the right holder. Living persons fall outside it. | FACT. https://tcss.legis.texas.gov/resources/PR/htm/PR.26.htm |
| So the licence should end at Amy's death, with deletion, unless her heirs sign. | INFERENCE |
| Living persons: Texas common-law misappropriation. Elements: defendant appropriated name or likeness "for the value associated with it"; plaintiff identifiable; some benefit to defendant (Matthews v. Wozencraft, 15 F.3d 432, 5th Cir. 1994). The opinion cites "a singer's distinctive voice" as a likeness. | FACT. https://law.resource.org/pub/us/case/reporter/F3/015/15.F3d.432.93-4434.html |
| A business using Amy's voice to serve its customers fits "value associated with it". Consent is the defence. Scope beyond the consent is the risk. | INFERENCE |
| No Texas living-person digital-replica statute (SB 1960, 2025, died). | SECONDARY via legal-compliance.md §5.1 ; OPEN QUESTION |
| CUBI §503.001: "voiceprint" is a biometric identifier. Capture for a commercial purpose needs notice and consent first. No sale. Destroy within a reasonable time, max one year after the purpose ends. Up to $25,000 per violation (AG). (e)(2)/(f) AI-training carve-out and clawback. | FACT. https://tcss.legis.texas.gov/resources/BC/htm/BC.503.htm |
| Whether a voice clone is a "voiceprint" is unsettled. ElevenLabs says its ownership check may be biometric "under some laws". Comply anyway: notice, consent, no sale, delete within a year of revocation or departure. | OPEN QUESTION + INFERENCE |
| Penal Code §33.07 (online impersonation) needs no consent plus intent to harm or defraud. It names web pages, social media, email, IM and text, not voice calls. Not triggered with consent and honest use. | FACT (text) https://tcss.legis.texas.gov/resources/PE/htm/PE.33.htm ; INFERENCE (application) |
| TRAIGA (HB 149) has no AI-disclosure duty for private non-health businesses. | FACT (per legal-compliance.md §4.4) |
| No Texas statute found on an employer's use of an employee's voice. Consent from an employee can look coerced. Make it voluntary and not a condition of the job. | OPEN QUESTION + INFERENCE |
| If Amy lived in CA, NY, IL or TN, their voice/replica statutes would add terms (legal-compliance.md §5.1). She is in Texas. | INFERENCE |

### 5.3 Callers' states: AI-disclosure laws

| Law | Effect when the voice is a real employee's | Label / source |
|---|---|---|
| Maine 10 M.R.S. §1500-DD | Bans AI ("aural communications" included) used "in a manner that may mislead or deceive a reasonable consumer" into thinking they deal with a human, unless notified "in a clear and conspicuous manner". Violation = Maine UTPA. A cloned known voice makes "may mislead" easier to show; the notice is the cure. | FACT. https://legislature.maine.gov/statutes/10/title10sec1500-DD-1.html ; INFERENCE |
| Utah Code §13-77-103/104 | Truthful answer to a clear "am I talking to AI?" Safe harbor: disclose at the outset and throughout. | FACT (per legal-compliance.md §4.3) |
| California, Colorado, others | No general inbound-phone AI-disclosure rule for our tenants. | FACT (per legal-compliance.md §4.2, §4.5, §4.7) |
| ElevenAgents §3.5 | Contractual AI-not-human disclosure on every call. | FACT. https://elevenlabs.io/agents-terms |

### 5.4 Specific risk: callers believe they are talking to Amy

| Risk | Why it is new with Amy's voice | Mitigation | Label |
|---|---|---|---|
| Returning customers hear Amy, tune out the greeting, or think she is joking. | Familiar voice sets the net impression. | Greeting says "I sound like Amy, but I'm not Amy". `disableFirstMessageInterruptions: true`. | INFERENCE |
| "Is this Amy?" | A stock voice never got this question. | Fixed answer: "No, I'm Amy's AI assistant. I use a copy of her voice, but I'm not Amy." Never deny being AI. | INFERENCE on Utah/FTC FACTs |
| First-person promises ("I'll call you back tomorrow") sound like Amy's promise. | The speaker sounds like the person who acts. | Always talk about Amy in the third person: "Amy will call you back." Add a scan. | INFERENCE |
| Transfer confusion: the AI says "let me get Amy", then the same voice answers. | Two speakers, one voice. | Say "Let me try to reach Amy herself." Amy answers transfers with "Hi, this is Amy" (the human may say this). | INFERENCE |
| Disputes: "Amy told me $X" or "Amy promised a date". | Statements attributed to the person. | Keep the existing no-price, no-date guardrails; keep transcripts (legal-compliance.md §2.1). | INFERENCE |
| Amy's reputation: words in her voice she never said. | Her identity is attached to every call. | Scope limits; Amy may review transcripts and veto; business indemnifies her. | INFERENCE |
| After Amy leaves, the voice keeps talking. | Authorization ends. | Revocation runbook (§7.6); swap to stock voice same day. | INFERENCE on ELVIS/CUBI-style FACTs |
| Account takeover: a stolen API key can make "Amy" say anything, e.g. to a bank or vendor. | Clone of a known office manager is a social-engineering tool. | Scoped API keys, IP allowlist, no TTS endpoints for the agent's key, clone used only by the agent. (Key-scope features: elevenlabs.md §13.) | INFERENCE |

### 5.5 Written consent from Amy: elements only

Counsel drafts. Builds on legal-compliance.md §5.3.

1. Parties: Amy (voice owner); the licensee entity (which of the three companies, or a parent); Lightline as processor; ElevenLabs named as sub-processor.
2. Voluntary: not a condition of employment, pay or promotion. Refusal or revocation has no penalty. Separate document from any job paperwork.
3. Compensation, or a statement that none is owed.
4. Exact scope: answering **inbound** calls on listed numbers for listed companies. Not outbound, not ads, not voicemail drops, not social media, not internal messages, not any text-to-speech outside the agent.
5. Required disclosure: the agent always says it is an AI assistant that sounds like Amy and is not Amy. It never says "I'm Amy". Script version attached.
6. What is recorded: the session, file list, where kept, who can access, deletion date for raw recordings.
7. Vendor facts in plain words: ElevenLabs' perpetual training licence; opt-out status and date; ElevenLabs' up-to-3-year voice-data retention; clones cannot be exported.
8. Texas CUBI notice (voiceprint capture for a commercial purpose) and consent. No sale or lease of her voice data.
9. Amy's controls: hear test calls before launch; approve or veto; read transcripts on request; ask for changes to scripted lines.
10. Term (e.g. 12 months, renewable in writing) and periodic re-confirmation.
11. Revocation: any time, in writing or email. Switch to stock voice within 1 business day. Delete the clone, samples and local recordings within 30 days. Written confirmation to Amy. CUBI 1-year outer limit.
12. Ending events: leaving the company, death (Property Code ch. 26), sale of the business. No transfer of the licence without her new written consent.
13. Indemnity: the business answers for what the agent says.
14. Security: who holds the ElevenLabs account and keys; Amy notified of any breach involving her voice.
15. Signature with date and e-sign audit trail. Copy to Amy. Keep ≥ 5 years after the licence ends (ElevenAgents §3.5).
16. Offer of independent counsel.

---

## 6. Q5. Recording guide and script for Amy

### 6.1 Setup

| Item | Do | Label |
|---|---|---|
| Room | Small room full of soft things: a walk-in closet with clothes, or a bedroom with a duvet hung behind the mic. Door shut. AC, fans, fridge, dishwasher off. Phones on silent. Pets out. | FACT (no reverb, no noise; duvet idea) IVC/PVC pages ; INFERENCE (closet) |
| Mic, best | XLR condenser into a USB interface (ElevenLabs names AT2020 / Rode NT1 + Focusrite). | FACT. PVC page |
| Mic, budget | A USB condenser mic. Prices not checked; expect roughly $50–100. | INFERENCE |
| Mic, fallback for IVC | A recent smartphone's voice-memo app, held 6–8 inches from the mouth, in the closet. Not a phone call. | INFERENCE |
| Never | Do not record over a phone call or from voicemail. That audio is already 8 kHz. The clone would start muffled and be squeezed again on every call. | FACT (8 kHz) + INFERENCE |
| Distance | About two fists from the mic, slightly off-axis. Pop filter. | FACT. PVC page |
| Levels | Speak at normal phone volume. Aim −23 to −18 dB RMS, peaks no higher than −3 dB. | FACT. IVC/PVC pages |
| File | Record at the device default (44.1 or 48 kHz). Export MP3 at 192 kbps or higher. | FACT (MP3 ≥ 192 kbps) ; INFERENCE (capture rate) |
| Editing | Trim long silences, coughs and mistakes only. No music, no heavy noise reduction, no EQ or compression. Leave ElevenLabs' `removeBackgroundNoise` off if the room was quiet. | FACT (avoid long silences; noise removal can worsen clean audio) ; INFERENCE (no processing) |
| Voice | Amy's real phone voice: warm, unhurried, Texas-friendly. Same energy start to finish. Sit the way she sits at her desk. Water nearby; record before she is tired. | FACT (clone copies the performance; keep it consistent) ; INFERENCE |
| Same gear twice | For PVC, verify with the same mic and room. | FACT. PVC page |

### 6.2 Session plan

| Clone | Record | Upload | Time for Amy |
|---|---|---|---|
| IVC | Blocks A–G once or twice (about 4–6 min) plus 2 minutes of free talk. | Best 90–150 seconds total, one to three files. Never over 3 minutes. | About 30 minutes |
| PVC (only if needed) | Blocks A–G three times with natural variation, plus 25–60 minutes of free talk and reading (Block H). | 30 minutes minimum; aim for 60+. | 2–3 hours over two sessions, same room and mic |

Content note: the clone learns *how* Amy sounds, not the sentences. Reading the agent's lines gets her into the right register. It does not pre-bake those lines. Pronunciation of local names comes from a pronunciation dictionary, not the samples. INFERENCE.

### 6.3 Script

Read at a comfortable phone pace. Smile slightly. Pause naturally between lines. Say the company names the way she says them on the phone. Replace `[Company 2]` and `[Company 3]` with the other two businesses. Phone numbers below use the fictional 555-01xx range.

**Block A. Warm-up (not uploaded).**
Chat for a minute about her morning, then count from one to twenty.

**Block B. Greeting and disclosure.**
- "Hi, thanks for calling The Christmas Light Guys. I'm Amy's AI assistant. I sound like Amy, but I'm an automated system, not Amy and not a person."
- "This call is recorded and transcribed, and our AI service providers process it to help us respond. If you'd rather not be recorded, just say so."
- "Amy's out for the day, but I can get everything started for you. What can I help you with?"
- "Amy's tied up right now, but I can get everything started for you."
- "Hi, thanks for calling [Company 2]. How can I help you today?"
- "Hi, thanks for calling [Company 3]. What can I do for you?"

**Block C. Listening and asking.**
- "Sure, I can help with that."
- "Got it, the front of the house and the roofline."
- "Okay, two trees out front and the hedges along the walkway. Anything else?"
- "Is this for your home, or for a business?"
- "Have you used us before, or would this be your first time?"
- "What's the address of the property you'd like lit?"
- "And what's the ZIP code there?"
- "Do you have a date in mind? I can't promise one yet, but I'll pass it along."
- "And who am I speaking with?"
- "What's the best time for Amy to give you a call back?"
- "Just out of curiosity, how did you hear about us?"

**Block D. Callback and hand-off.**
- "Let me have Amy call you back."
- "Amy will call you back as soon as she can. Is the number you're calling from the best one to reach you?"
- "Let me try to reach Amy herself. One moment."
- "Sorry about that, Amy couldn't pick up. You're back with her AI assistant, and I've kept everything you told me."
- "I can't promise a date until Amy checks the schedule, but I'll let her know you'd like it by then."
- "I don't want to give you the wrong answer on that. I'll make sure Amy covers it when she calls."

**Block E. Numbers and read-backs.**
- "Let me read that back. Five one two... five five five... zero one four two. Did I get that right?"
- "Seven three seven... five five five... zero one eight seven."
- "That's ZIP code seven eight seven zero four."
- "Seven eight seven four five. Seven eight six six zero. Seven eight six one three."
- "Twelve-oh-four West Thirty-Eighth Street."
- "Eighty-eight fifteen Burnet Road, suite one-ten."
- "Eleven thousand five hundred two Manchaca Road."
- "Tomorrow morning, between nine and eleven."
- "Thursday afternoon, around two-thirty."
- "Sometime before Thanksgiving. The first week of December. December twelfth."

**Block F. Spelling.**
- "Let me spell that back to make sure. R, O, D, R, I, G, U, E, Z. Rodriguez."
- "Is that Smith with an I or a Y?"
- "Was that B as in boy, or D as in David?"
- "M as in Mary, C, D, O, N, A, L, D."
- "Is that Street, Lane, or Drive?"
- "And is that Pflugerville, or Round Rock?"

**Block G. Hard questions and goodbyes.**
- "Yes, I'm an AI assistant, not a person. I can still get everything started for you."
- "No, I'm not Amy. I'm her AI assistant. I use a copy of her voice."
- "I can't share how I'm set up, but I'm happy to help with your lights."
- "No problem. I'll stop here and won't keep this call."
- "I'm sorry about that. Let me get your details, and I'll have Amy reach out."
- "Thanks so much for calling. Amy will be in touch soon."
- "Have a good one." / "Y'all have a great evening." (only if Amy says it naturally) / "Merry Christmas, and thanks again."

**Block H. Free talk (best material for both clone types).**
Amy talks, unscripted, 1–2 minutes each, as if to a friendly caller:
- What a typical install day looks like.
- What people ask most in the first week of November.
- How she'd explain the difference between a one-season install and permanent lights. (Training audio only. The agent never says this.)
- Favourite neighbourhood displays in Austin.

### 6.4 Austin names for the pronunciation dictionary

Amy reads each name once in her normal voice. We copy her pronunciation into IPA or CMU rules. INFERENCE: these are common local pronunciations; Amy's version wins.

| Name | Common local pronunciation |
|---|---|
| Manchaca | MAN-shack |
| Pflugerville | FLOO-ger-vill |
| Buda | BYOO-duh |
| Manor | MAY-ner |
| Del Valle | del VAL-ee |
| Burnet (Road) | BURN-it |
| Guadalupe (Street) | GWAH-duh-loop |
| Koenig (Lane) | KAY-nig |
| Leander | lee-AN-der |
| Hutto | HUH-toe |
| Elgin | EL-gin (hard g) |

- Field: `conversationConfig.tts.pronunciationDictionaryLocators`. Phoneme rules work only on Flash v2, which we use. FACT. https://elevenlabs.io/docs/eleven-agents/customization/voice

### 6.5 Upload checklist

- [ ] Signed consent on file (§5.5). Counsel has approved it.
- [ ] ElevenLabs "Data use" training opt-out is ON, with a screenshot and date. FACT basis: Terms §4(i).
- [ ] Files: MP3 ≥ 192 kbps, one speaker, no music, total 90–150 s for IVC.
- [ ] Amy is present and ticks the consent box herself. If a captcha appears, she reads it.
- [ ] Voice name: `Amy - phone - IVC v1 - 2026-MM-DD`. Labels: `language: en`, `accent: american`.
- [ ] Record the voice id, date and consent reference in the consent-evidence store.

### 6.6 Phone test before launch

| Test | Pass bar | Label |
|---|---|---|
| Blind similarity | Over real phone calls, 3–5 people who know Amy hear 6 short clips (real Amy over the phone, the clone, the stock voice, shuffled). Score "sounds like Amy" 1–5. Pass: clone averages ≥ 4 and beats stock clearly. | INFERENCE |
| Disclosure heard | 5 fresh listeners repeat back what the greeting said. All 5 report "not Amy, an AI". | INFERENCE |
| Numbers | Clone reads 10 phone numbers, ZIPs and addresses correctly over µ-law. | INFERENCE |
| Latency | Turn latency within ~100 ms of the stock voice on the same calls (ElevenLabs conversation logs). | INFERENCE ; OPEN QUESTION (which log field) |
| Amy's approval | Amy listens to 3 full test calls and signs off. | INFERENCE |

If the IVC fails similarity after tuning `stability` and `similarityBoost`: re-record with better audio once. Still failing: PVC. INFERENCE.

---

## 7. Q6. Recommended plan

### 7.1 Decision

- **Clone type: IVC first.** Cheap, quick, business-controlled, lowest latency on Flash v2. PVC is the fallback. INFERENCE on §2–§3 FACTs.
- **Plan: Creator** ($22/mo), the plan go-live already uses. It covers IVC now and one PVC later. Pro adds nothing we need for this. FACT (plans) + INFERENCE.
- **Model: keep `eleven_flash_v2`.** Optional A/B against `eleven_v4_turbo` later (vendor says IVCs are "more accurate than ever" on v4; ~25 ms more model latency). FACT (vendor claims) + INFERENCE.

### 7.2 Cost, first 1–2 months

| Item | IVC path | PVC fallback | Label |
|---|---|---|---|
| ElevenLabs Creator (business account) | Already in `docs/cost-model.md`: $11 month 1 (if the promo applies), $22 month 2. Incremental for the clone: **$0**. | Same plan, 1 PVC slot: **$0** if Amy is the account's user. | FACT (prices) + INFERENCE |
| Amy's own Creator account (PVC option 2 only) | — | $11 + $22 = **$33** over 2 months | FACT (prices) |
| Microphone | $0 (phone voice memo) to ~$100 (USB mic) | ~$100 or more for better gear | INFERENCE (prices not checked) |
| Agent minutes for tests | Inside plan minutes (275/mo on Creator). Same per-minute rate for clones. | Same | FACT. https://elevenlabs.io/pricing/agents |
| Counsel review of consent + greeting | Not in the $50–100 budget. | Same | OPEN QUESTION |
| **Total new spend** | **$0–100** | **$0–133** (the top end exceeds budget only with new gear and a second account) | INFERENCE |

### 7.3 Steps in order

1. Counsel approves the consent form (§5.5) and the clone-mode greeting (§7.5). Adds to legal-compliance.md §10 item 9.
2. Amy decides freely. If no, stay on the stock voice. Nothing else changes.
3. ElevenLabs settings: "Data use" training opt-out ON; screenshot. Confirm agent retention 30 days (already in spec).
4. Amy signs consent (with CUBI notice). File it with the call-consent evidence.
5. Record (§6.1–§6.3). Pick the best 90–150 s.
6. Amy, in the business ElevenLabs account, creates the IVC and ticks the consent box (§6.5). Note the voice id.
7. Code (separate change, POLICY_VERSION bump, evals): clone-mode greeting and prompt rules (§7.5); spec fields (§7.4); compliance scan for first-person callback promises.
8. Set `ELEVENLABS_VOICE_ID` to Amy's voice id in the environment used by `scripts/live/setup.ts` / `scripts/export-agent.ts`. Re-export and update the agent.
9. Phone tests (§6.6). Tune `stability` and `similarityBoost` in 0.05 steps. Amy signs off.
10. Go live behind the existing release ladder. Review 20 transcripts in week 1 for "is this Amy?" moments.
11. Only if step 9 fails twice: PVC with Amy as the creator (§2.2), then repeat steps 8–9 and measure the latency change.
12. Every renewal date: Amy re-confirms in writing, or the voice goes back to stock.

### 7.4 Agent spec change (`lib/elevenlabs/agent-spec.ts`, `buildAgentRequest`)

Field names are from the installed SDK 2.74.0 types (FACT). Values are starting points (INFERENCE).

```ts
conversationConfig: {
  agent: {
    firstMessage: "{{opening}}",
    // New: the caller cannot talk over the AI disclosure. Matters more when the voice is Amy's.
    disableFirstMessageInterruptions: true,
    language: "en",
    // ...unchanged
  },
  tts: {
    voiceId: options.voiceId,            // Amy's IVC id, via ELEVENLABS_VOICE_ID (no code change)
    modelId: "eleven_flash_v2",          // unchanged: lowest latency; English PVCs also train on it
    agentOutputAudioFormat: "ulaw_8000", // unchanged: register-call requirement
    stability: 0.55,                     // new: tune 0.50–0.65 by phone test
    similarityBoost: 0.8,                // new: tune 0.70–0.85; very high values can distort
    speed: 1.0,                          // new: explicit default; platform range 0.7–1.2
  },
  asr: { userInputAudioFormat: "ulaw_8000" },
},
```

Also:

| Where | Change | Label |
|---|---|---|
| `tags` | Add a voice tag, e.g. `"voice:amy-ivc-1"`, so every agent version shows which voice it used. | INFERENCE |
| `platformSettings.evaluation.criteria` `disclosed_ai` | Goal prompt: "...said it is an AI assistant at the start, said it is not Amy when the voice is Amy's, and never claimed to be a person or Amy." | INFERENCE |
| Config (suggested) | A typed voice setting, e.g. `brand.voice: { kind: "stock" } \| { kind: "owner_clone", consentRef }`, so the greeting variant and the scans switch with the voice, not by hand. | INFERENCE |
| Do not set | `optimizeStreamingLatency` (no-op), `audioEffects.filterPresetId: "phone"`. | FACT (SDK; audio-environment page) |

### 7.5 Greeting and policy wording when the voice is Amy's

**Yes, change it.** Keep all three existing parts. Add one sentence that names the voice. INFERENCE on Maine §1500-DD, the FTC net-impression test and ElevenLabs Use Policy §10.

Proposed opening (`openingLine`, clone mode):

> "Hi, thanks for calling The Christmas Light Guys. I'm Amy's AI assistant. I sound like Amy, but I'm an automated system, not Amy and not a person. This call is recorded and transcribed, and our AI service providers process it to help us respond. If you'd rather not be recorded, just say so. [situation] What can I help you with?"

- Adds about 3 seconds. Plain words. No "digital replica" jargon. INFERENCE.
- `assistantRole` stays `"Amy's AI assistant"`. INFERENCE.

Other lines:

| Path | Proposed wording | Label |
|---|---|---|
| `handoff_failed` | "Sorry about that, Amy couldn't pick up. You're back with her AI assistant, and I've kept everything you told me. When's a good time for her to call you back?" | INFERENCE |
| Transfer | "Let me try to reach Amy herself. One moment." | INFERENCE |
| "Is this Amy?" | "No, I'm Amy's AI assistant. I use a copy of her voice, but I'm not Amy. I can have her call you back." | INFERENCE |
| "Are you a robot / AI?" | Unchanged: "Yes, I'm an AI assistant, not a person. I can still get everything started for you." | FACT basis: Utah §13-77-103 (legal-compliance.md §4.3) |
| New prompt rule | "Talk about Amy in the third person. Never promise anything as if you were Amy: say 'Amy will call you back', never 'I'll call you back'." | INFERENCE |

Scanner check (run today with node against `IMPERSONATE` in `lib/agents/compliance.ts`): none of the lines above trip it ("I'm Amy's...", "not Amy", "Amy herself" all pass). "Yes, this is Amy" still trips it. FACT (local test).

Suggested new scan in clone mode: flag first-person callback promises, e.g. `/\bI(?:'|’)ll (?:call|ring|phone) you\b|\bI will call you\b/i`. INFERENCE.

### 7.6 Revocation or departure runbook

1. Same day: set `ELEVENLABS_VOICE_ID` back to the approved stock voice; re-export and update the agent; switch the greeting to stock mode. INFERENCE.
2. Delete the clone: `client.voices.delete(voiceId)` or My Voices → Delete voice (irreversible). FACT (SDK; help page).
3. Delete local recordings and any copies in shared drives. INFERENCE.
4. Send an ElevenLabs privacy request (form or dpo@elevenlabs.io) to delete voice data. Note: training use before the opt-out cannot be reversed (Terms §4(d), §4(i)). FACT.
5. Written confirmation to Amy within 30 days. CUBI outer limit is one year after the purpose ends. FACT (CUBI) + INFERENCE (30 days).
6. Keep the consent record and the deletion confirmation ≥ 5 years. FACT (ElevenAgents §3.5).

---

## 8. COUNSEL REVIEW NEEDED

| # | Pri | Question |
|---|---|---|
| 1 | P1 | Approve the consent form elements (§5.5). Is an employee's consent here voluntary enough? Any Texas employment-law limit? |
| 2 | P1 | Approve the clone-mode greeting (§7.5). Does "I sound like Amy, but I'm ... not Amy and not a person" meet Maine §1500-DD, the FTC net-impression test and ElevenAgents §3.5? |
| 3 | P2 | Is a voice clone, or ElevenLabs' verification, a CUBI "voiceprint" capture by the business? Do CUBI (e)(2)/(f) apply? |
| 4 | P2 | Texas common-law misappropriation: does the consent's scope fully cover inbound reception? Any post-employment claim if use stops late? |
| 5 | P2 | Which entity holds the licence across three companies? Can it be assigned on a sale? |
| 6 | P2 | ElevenLabs' perpetual training licence (Terms §4(d)): must Amy be told in the consent, and is that enough? |
| 7 | P3 | Any future AI outbound callback in Amy's voice: TCPA artificial-voice consent and 64.1200(b) script (legal-compliance.md §6.5). |
| 8 | P3 | Callers in CA/NY/IL/TN: do those states' voice/replica laws reach a Texas employee's voice used on calls to their residents? |

---

## 9. Not verified, conflicts and failed reads

| Item | Status |
|---|---|
| IVC verification | IVC page: consent checkbox only. Concepts page: voice-captcha for both. API: `requires_verification`. Test or ask support. OPEN QUESTION |
| Custom voice slots on Business | Help center 660; pricing table possibly 2,200. OPEN QUESTION |
| PVC audio and training-time figures | PVC page gives several ranges (30 min to 3 h; 3–6 h to 24 h). Used the most conservative. FACT (inconsistent source) |
| PVC per-generation latency penalty in ms | Not published. OPEN QUESTION |
| IVC with `eleven_flash_v2` specifically | Implied by the latency page ("Flash model with an IVC"); not stated per model. Test. OPEN QUESTION |
| v3 Conversational clone support | Not stated. OPEN QUESTION |
| Link-shared PVC: slots, revocation, effect of owner downgrade | Not documented. OPEN QUESTION |
| ElevenLabs "Voice Processing Notice" | Referenced by Terms; not found as a separate section. OPEN QUESTION |
| FTC individual-impersonation rule | Proposed Feb 2024; final status not confirmed. OPEN QUESTION |
| Matthews v. Wozencraft | Read on law.resource.org (unofficial reporter copy). FACT (mirror) |
| Texas SB 1960 (2025) death | Secondary only (legal-compliance.md). OPEN QUESTION |
| Microphone prices | Not checked. INFERENCE |
| FCC PDFs; FTC 1983 statement | WebFetch could not read them; text extracted locally with pypdf. FACT |
| federalregister.gov HTML | Redirected to a block page; used the Federal Register JSON API. FACT |
