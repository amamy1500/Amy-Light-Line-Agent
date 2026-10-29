# CLG Caller Question Bank

- **Date:** 2026-10-23
- **For:** Lightline, the AI receptionist for The Christmas Light Guys (CLG), Austin TX.
- **Purpose:** List what holiday-lighting callers ask. Show how strong installers answer. Show what the assistant may say today.
- **Hard rule:** The assistant speaks only Amy-approved words. It never gives a price, a date, availability, a warranty, an insurance statement, a response time or a damage promise.
- **Related:** `lib/knowledge/tenants/clg-decisions.ts` (Amy's approved answers), `docs/amy-open-questions.md`, `docs/research/legal-compliance.md`.

## Labels

| Label | Meaning |
|---|---|
| **FACT [S#]** | Stated by the cited source. URLs are in Sources at the end. "(excerpt)" means only a search-result excerpt was readable. |
| **INFERENCE** | My reasoning from the sources or call-center practice. Not verified. |
| **SAY `key`** | The assistant can answer now with Amy's approved words (`clg-decisions.ts`). |
| **ASK `id`** | Needs Amy's exact words. The `id` is a new knowledge item proposed in section 5. Until then, defer. |
| **PEND `key`** | Already in the approvals queue and still pending. Until then, defer. |
| **DEFER** | Always Amy. Price, dates, availability, insurance, guarantees, response times. Never answered by the assistant. |

In the tables, the "Why they ask" column is INFERENCE unless it has a source tag. The "How leaders answer" column is FACT where tagged. It describes the pattern only. It does not give those companies' facts or prices.

## Method and limits

- FACT: Read the FAQ or service pages of Christmas Decor [S1], Brite Nites [S2–S5], five Austin installers [S6–S10] and Outdoor Lighting Perspectives [S11].
- FACT: Read consumer news guides [S15–S19], one installer forum thread [S20] and the CPSC [S21].
- FACT: Read CSR and sales guidance from ServiceTitan [S22], Housecall Pro [S23], Pipeline On [S24] and Hyperleap [S25]. Industry training came from Jobber Academy [S13]. CLIPA [S43] was seen only as excerpts.
- Limit: Reddit is blocked for both search and fetch in this environment. No r/homeowners or r/ChristmasLights thread was read. Homeowner voice comes from news interviews [S15–S19] and an installer forum [S20].
- Limit: Angi, HomeAdvisor, HomeGuide and Home Depot pages returned HTTP 403. Only search excerpts were used, and only for *what people ask*. No price appears in this document.
- Limit: No FAQ was found for Brite Ideas Decorating, Lights on Holiday, Holiday Bright Lights (404) or "Christmas Light Pros".
- Limit: Several excerpt-only sources are vendor marketing. They are used for patterns, not statistics.

---

## 1–2. Question bank (69 questions)

### Most-asked across the sources

INFERENCE: This ranking counts how often each topic appears across the FAQ and consumer-guide sources.

1. Is takedown included? (9 sources)
2. Are you insured? (7)
3. How much? (6)
4. Do you store the lights? (6)
5. When should I book? (5)
6. Do I own or rent the lights? Can you hang mine? (4)
7. What if a bulb or section goes out? (4)
8. LED? What kind and colors? (4)
9. Is the estimate free, and how does quoting work? (3)
10. How long does install take? Must I be home? (3)

CLG today: it can SAY #1, #4 and #9. #2 and #3 are DEFER, and so is the date side of #5. The rest are ASK or PEND.

### A. Price and quote

| # | Caller question | (a) Why they ask | (b) How leaders answer | (c) CLG | (d) Follow-up to move to callback |
|---|---|---|---|---|---|
| A1 | "How much do you charge?" | Fear of a surprise bill. Wants to size the budget. | Price depends on house size, roofline and design. They send the caller to a free custom quote [S1][S6][S9]. Some Austin sites publish a starting figure [S6][S7]. CLG must not. | DEFER. Speak `quote_process` verbatim. | "Is it mostly the roofline you're picturing, or trees and the yard too?" |
| A2 | "Just give me a ballpark / price per foot." | Wants to screen the cost before sharing details. | Some owners give a bracketed range by phone [S26]. AI-front-desk guidance: never present a preliminary figure as a quote [S25]. | DEFER (`quote_process`). | "If you have a budget in mind, I can pass it to Amy so she knows going in." |
| A3 | "Is the estimate free?" | Doesn't want to pay for a visit. | A free consult or quote is standard [S1][S6][S8]. | SAY `free_estimate`. | "What day and time would be good for Amy to call you back?" |
| A4 | "Can you quote from a photo or Google Maps?" | Busy. Prefers no visit. | Some quote from photos [S19]. Guides advise a visit for multi-story homes or big yards [S37][S17]. | SAY `quote_process` (names Google Maps or a site visit). | "What's the address, so Amy can pull it up on Google Maps?" |
| A5 | "Any discounts? Early booking, referral, returning?" | Price-shopping. | Early-bird, referral and December offers are common [S6][S8][S19]. | DEFER. ASK `discounts_and_promotions`. | "Have you used us before? I'll note it for Amy." |
| A6 | "Why pay a pro when lights are cheap at the store?" | Doubts the value. | They cite safety, commercial-grade custom-fit lights, upkeep, takedown and storage [S1][S4]. | SAY `storage` and `takedown_offered`. The rest is ASK `service_inclusions`. | "Which part is the bigger hassle for you, the ladder or the takedown?" |

### B. What's included

| # | Caller question | (a) Why they ask | (b) How leaders answer | (c) CLG | (d) Follow-up |
|---|---|---|---|---|---|
| B1 | "Do I buy the lights or rent them?" | Afraid of owning lights they can't store. What if they skip a year? | Two models. In a lease or rental, the company keeps the lights [S8][S13]. In the other, the client buys the lights in year one and renewals cost less [S7]. | ASK `lights_owned_or_leased`. | "Is this your first year having lights done professionally?" |
| B2 | "Can you hang lights I already own?" | Already spent money on lights. | Most Austin pros decline and install only their own lights [S6][S8][S10]. | ASK `customer_owned_lights`. | "What kind do you have now, big bulbs or mini lights?" |
| B3 | "Do you take them down?" | Dreads the January ladder. Doesn't want lights up in February. | Takedown is included nearly everywhere [S1][S9][S10]. Guides say to confirm it [S17]. | SAY `takedown_offered`. | "Great. Would this be for your home or a business?" |
| B4 | "Do you store them?" | Garage space. Tangled strands. | Storage is usually included, often climate-controlled [S1][S8]. | SAY `storage`. | "Do you have an idea yet of what you'd like lit?" |
| B5 | "What exactly is included?" | Hidden fees. | Lease bundles cover install, in-season upkeep, takedown and storage [S2][S13]. | Partly SAY (`storage`, `takedown_offered`). The rest is ASK `service_inclusions`. | "Amy can walk you through the rest. When's a good time to call?" |
| B6 | "Are they cut to fit? Clips, not nails?" | Worried about a sloppy look or roof holes. | Pros say custom-cut LEDs [S1] and plastic clips matched to each surface [S10][S32]. | ASK `custom_fit_lights` and `attachment_method`. | "Any part of the house you'd want us extra careful with?" |

### C. Design and colors

| # | Caller question | (a) Why they ask | (b) How leaders answer | (c) CLG | (d) Follow-up |
|---|---|---|---|---|---|
| C1 | "Warm white or multicolor?" | Taste. Fitting the street. | Designers offer both [S3][S10]. Over 80% of Brite Nites clients pick white [S5]. | ASK `color_options`. | "Are you picturing warm white or a bit of color?" |
| C2 | "Big C9 bulbs or mini lights?" | The look they want. | Retail guides put C9s on rooflines and minis on shrubs and small trees [S35]. | ASK `light_types_and_bulbs`. | "Is the roofline the main thing, or bushes and trees too?" |
| C3 | "Do you do trees, bushes, wreaths, garland, walkways?" | Wants more than the roofline. | The typical package is roofline, tree wraps, shrubs, and a wreath or garland [S5][S6]. | PEND `christmas_services`. | "Which trees or bushes would you want lit?" |
| C4 | "Can you help me design it? I saw a house I love." | Unsure what looks good. | Free design consultation, sometimes a mockup [S3][S8][S11]. | SAY `quote_process` ("discuss your vision"). SAY `contact_email` for photos. | "If you have a photo of a look you like, you can email it to Amy." |
| C5 | "Do you decorate indoors, like a tree or mantel?" | Wants one-stop holiday help. | Not found in the sources read. INFERENCE: some full-service decorators offer it. | ASK `indoor_decorating`. | "Is the outside the main priority for you?" |
| C6 | "Can you do just a wreath or one tree?" | Small budget or small space. | Some publish a minimum or starting point [S6]. | ASK `minimum_job_size`. | "What's the one thing you'd most like lit?" |

### D. Roof and house types

| # | Caller question | (a) Why they ask | (b) How leaders answer | (c) CLG | (d) Follow-up |
|---|---|---|---|---|---|
| D1 | "Can you do a two-story or steep roof?" | Exactly why they won't DIY. | Pros claim complex architecture [S6]. Some cite harnesses and OSHA training [S9]. Steep roofs carry a price premium [S13]. | ASK `roof_and_height_limits`. | "Is the house one story or two?" |
| D2 | "We have a tile or metal roof." | Afraid of broken tile or scratched panels. | Clips are matched to the surface, such as tile clips or magnets for metal [S32][S10]. | ASK `roof_and_height_limits` and `attachment_method`. | "What's the roof made of: shingle, tile or metal?" |
| D3 | "Will it damage my roof or gutters? Do you use nails?" | Leaks. A voided roof warranty. Nail holes can let water in [S33]. | Clips, not fasteners [S10][S32]. Careful removal protects gutters and roofing [S4]. | ASK `attachment_method` and `damage_concerns`. Never promise "no damage." | "Any spots you'd want Amy to know about before she looks?" |
| D4 | "No gutters. Can you still do the roofline?" | Assumes lights need gutters. | Attachment varies by surface [S32]. | ASK `attachment_method`. | "No problem, I'll note it. Is it the front roofline you want?" |
| D5 | "Can you light our big live oak?" | Big Austin trees. | Tree wraps are standard. On-demand marketplaces exclude tall trees and steep roofs [S44]. | ASK `roof_and_height_limits`. | "About how tall is the tree?" |

### E. Power and controls

| # | Caller question | (a) Why they ask | (b) How leaders answer | (c) CLG | (d) Follow-up |
|---|---|---|---|---|---|
| E1 | "Do I need an outdoor outlet?" | Afraid of an electrician bill. | They need a nearby outlet and can advise on adding one [S10]. Usually no electrical changes, and GFCI outlets are preferred [S12]. | ASK `power_requirements`. | "Do you know if there's an outlet outside near the front?" |
| E2 | "My lights trip the GFCI every time it rains." | Display goes dark. Safety fear. | Moisture at plugs is the usual cause [S34]. In a lease model it's a service call [S7]. | PEND `service_calls`. ASK `outage_first_steps`. No electrical advice beyond Amy's words. | "Is it the whole display or one section, and since when?" |
| E3 | "Do they come on by themselves? Timer?" | Doesn't want to plug in every night. | Timers are standard, and the client picks the schedule [S3][S6]. | ASK `timers_and_controls`. | "What time would you like them on each evening?" |
| E4 | "Can I control them from my phone?" | Smart-home habit. | Some offer smart controls [S1][S18]. | ASK `timers_and_controls`. | "Is phone control a must-have, or nice to have?" |
| E5 | "Will cords run across my yard or driveway?" | Tripping, mowing, looks. | Not covered in the sources read (INFERENCE). | ASK `power_requirements`. | "Where's the main area you'd want lit?" |
| E6 | "How much will my electric bill go up?" | Cost fear. | LEDs use far less power than incandescent [S1][S8][S42]. None estimate a bill. | ASK `energy_use`. Never estimate a bill. | "I'll have Amy cover that. Any other worries before she calls?" |

### F. Timing

| # | Caller question | (a) Why they ask | (b) How leaders answer | (c) CLG | (d) Follow-up |
|---|---|---|---|---|---|
| F1 | "When should I book?" | Fear of missing out. | Everyone says "book early" because schedules fill [S6][S11][S14]. | ASK `booking_lead_time`. | "Is there a date you'd love them up by?" |
| F2 | "Can they be up by Thanksgiving or my party?" | An event deadline. | The date is confirmed at the consultation [S1]. | DEFER (dates). | "What's the date, and is it firm?" |
| F3 | "Is it too late?" (December) | Shame and urgency. | Some book within the week up to a final install date [S10]. Some do post-Christmas installs [S14]. | DEFER. ASK `late_season_booking` for a stock line. | "What date were you hoping for? I'll flag it for Amy today." |
| F4 | "When do you start installing?" | Too early looks odd. HOA timing. | Starts range from September to October [S5][S6][S14]. | ASK `install_window`. | "Do you prefer before or after Thanksgiving?" |
| F5 | "How long does the install take?" | Planning their day. | From a few hours to a full day [S1][S8][S10]. | ASK `install_duration`. | "Are weekdays OK for the crew to be there?" |
| F6 | "When do you take them down?" | HOA rules. Holiday travel. | Takedown in early January is typical [S8][S13]. | SAY `takedown_dates`. | "Will you be in town in early January?" |
| F7 | "Can you take them down early, or leave them up longer?" | Travel or a late celebration. | Some run takedown into February [S8]. | ASK `takedown_flexibility`. | "What date works best for you? I'll note it for Amy." |

### G. Service during the season

| # | Caller question | (a) Why they ask | (b) How leaders answer | (c) CLG | (d) Follow-up |
|---|---|---|---|---|---|
| G1 | "A section went out. Will you fix it? Is it free?" | Paid for a working display. | The lease model promises free fixes, often within 24–48 hours [S7][S8][S10]. | PEND `service_calls`. | "Is it one section or the whole display?" |
| G2 | "Wind or a storm knocked lights down." | Safety. Damage. | They watch the weather and fix on call [S6]. | PEND `service_calls`. ASK `weather_policy`. | "Is anything hanging loose near a walkway?" |
| G3 | "How fast can someone come out?" | Guests are coming. | Many advertise 24–48 hour windows [S7][S8]. | DEFER. Never promise a response time. | "When are your guests arriving? I'll mark it for Amy." |
| G4 | "Do I need to be home for a service visit?" | Work schedule. | Usually not required [S7]. | ASK `property_access`. | "Is there a gate or a pet Amy should know about?" |
| G5 | "Can I add more after the install?" | Wants more after seeing it lit. | Yes, with a separate quote, up to a cutoff date [S6][S10]. | ASK `design_changes_midseason`. | "What would you like to add?" |

### H. Process

| # | Caller question | (a) Why they ask | (b) How leaders answer | (c) CLG | (d) Follow-up |
|---|---|---|---|---|---|
| H1 | "How does this work? What happens next?" | Uncertainty. | Consult, then design and quote, deposit, install, upkeep, takedown [S3]. | SAY `quote_process`. | "When's a good day and time for Amy to call?" |
| H2 | "When will Amy call me back?" | Wants a commitment. | Not covered in the sources read. | ASK `callback_expectation`. Never promise a time. | "What times are best for you?" |
| H3 | "Do you need a deposit?" | Scam fear. One guide says pay nothing before the job is done [S17]. | A deposit to hold a date is common [S3][S6][S18]. | ASK `deposit_and_payment_timing`. | "Amy will go over that. Is this number best for her?" |
| H4 | "What payment do you take?" | Convenience. | Not covered in the sources read. | ASK `payment_methods`. | Same as H3. |
| H5 | "Is there a contract? Can I cancel?" | Afraid of a multi-year lock-in. | Guides say get a written contract or estimate [S17][S36]. | ASK `contract_and_cancellation`. | "Is there anything you'd want spelled out in writing?" |
| H6 | "You did my lights last year. Do I start over?" | Wants it easy. | Brite Nites keeps returning designs on file [S2] (excerpt). Renewal outreach starts in late summer [S8][S13]. | ASK `returning_customer_renewal`. | "Same address and same look as last year?" |
| H7 | "Can I email photos or questions?" | Prefers writing. | n/a | SAY `contact_email`. | "Perfect. Want me to note that you'll send photos?" |
| H8 | "Do I need to be home for the visit or install?" | Work schedule. | Policies vary. Some prefer it, some don't need it [S8][S10]. | ASK `property_access`. | "What days are easiest for you?" |

### I. Commercial and HOA

| # | Caller question | (a) Why they ask | (b) How leaders answer | (c) CLG | (d) Follow-up |
|---|---|---|---|---|---|
| I1 | "Do you do businesses or HOA entrances?" | Qualifying the vendor. | Most serve both homes and businesses [S1][S6]. | PEND `residential_commercial`. | "Is it a storefront, an office or a neighborhood entrance?" |
| I2 | "Can you send a proposal for our board or manager?" | Needs approval. | Custom quote after a site visit [S9]. RFP process for public buyers [S1]. | ASK `commercial_proposal_process`. | "Who makes the final call, and when do they meet?" |
| I3 | "We need a COI, a W-9 or a vendor packet." | Vendor rules. Buyers commonly require additional-insured certificates [S38]. | Leaders state their coverage up front [S1][S9]. | DEFER. Never say "insurance." ASK `commercial_paperwork`, worded without insurance. | "What's the best email for the paperwork request?" |
| I4 | "Does my HOA allow this? Do you handle approval?" | Afraid of a fine. HOAs may limit timing and attachment [S31]. Permanent systems face review [S30]. | Not covered by an installer source. INFERENCE: pros point the caller to their HOA rules. | ASK `hoa_and_permits`. | "Do you know of any HOA rules about holiday lights?" |
| I5 | "Do we need a permit?" (business) | Compliance. | It varies by city, and the decorator checks the code [S1]. | ASK `hoa_and_permits`. | "Which city is the property in?" |

### J. Trust

| # | Caller question | (a) Why they ask | (b) How leaders answer | (c) CLG | (d) Follow-up |
|---|---|---|---|---|---|
| J1 | "Are you insured, licensed or bonded?" | Liability if a worker is hurt [S17][S18]. | Leaders say yes up front [S1][S6][S9]. | DEFER. `licensing_insurance` is rejected. Say nothing either way. | "I'll make sure Amy covers that on her call." |
| J2 | "How long have you been in business?" | Is this outfit fly-by-night? | Experience is a selling point [S6]. | SAY `years_in_business`. | "Would this be for your home or a business?" |
| J3 | "Do you come out to [town]?" | Qualifying. | n/a | SAY `service_area`. If the town isn't listed, defer. Never say no. | "What's the address or nearest cross street?" |
| J4 | "Where can I see photos or reviews?" | Guides say check reviews and past photos [S18]. | Portfolio and review links [S2][S6]. | ASK `reviews_and_photos`. | "Is there a style you're hoping to see?" |
| J5 | "Who installs? Your own crew?" | Strangers on the property. | Sites tout in-house technicians and background checks [S7][S8]. | ASK `crew_identity`. | "Anything about access Amy should know?" |
| J6 | "Do you guarantee your work?" | Fears a failed display. | Warranty and satisfaction claims are common [S6][S8]. | DEFER. ASK `satisfaction_guarantee`. | "Was there a problem in the past you want to avoid?" |

### K. Permanent lighting

| # | Caller question | (a) Why they ask | (b) How leaders answer | (c) CLG | (d) Follow-up |
|---|---|---|---|---|---|
| K1 | "Do you do permanent lights?" | Tired of installing every year. | Pitched as the year-round option [S11][S2]. | SAY `permanent_lighting_brand` (not now; February). | "Want me to note your interest for Amy?" |
| K2 | "Which brand? Jellyfish?" | Comparing systems. | n/a | SAY `permanent_lighting_brand` only. Never name a brand; the two sites conflict (`website-forensics.md`). | "Would you like Christmas lights this year in the meantime?" |

### L. Other holidays and events

| # | Caller question | (a) Why they ask | (b) How leaders answer | (c) CLG | (d) Follow-up |
|---|---|---|---|---|---|
| L1 | "Can you put lights up before Diwali and keep them through Christmas?" | One install for two festivals. Diwali 2026 is Sun Nov 8 [S39]. | Not covered in the sources read (INFERENCE). | ASK `other_holidays_early_install`. Dates are DEFER. | "What date would you want them on by?" |
| L2 | "Halloween, Hanukkah or game-day colors?" | Year-round decorating. | Permanent color-changing systems are pitched for every holiday [S11]. | ASK `other_holidays_early_install`. | "Is this for this season, or more of a year-round idea?" |
| L3 | "Weddings, parties, bistro lights?" | Events. | Some offer event lighting [S1]. | PEND `other_lighting`. | "What's the date and the venue?" |

### M. Special situations

| # | Caller question | (a) Why they ask | (b) How leaders answer | (c) CLG | (d) Follow-up |
|---|---|---|---|---|---|
| M1 | "Can I buy this as a gift for my parents?" | Aging parents on ladders. Falls are the top decorating injury [S21]. Customers hire to stay off the roof [S15]. | Some offer gift certificates [S41]. | ASK `gift_purchase`. | "Whose house is it, and would they like to join the design call?" |
| M2 | "I rent. Can I still get lights?" | Landlord permission. Damage deductions [S40]. | Not covered by an installer source (INFERENCE). | ASK `renter_or_landlord`. | "Have you had a chance to check with your landlord?" |
| M3 | "We have dogs and a locked gate." | Pet safety. Access. | n/a | ASK `property_access`. Never collect gate codes or alarm codes. | "I'll note the dogs. Amy will sort out access with you." |
| M4 | "Are LEDs better for the environment?" | Values. Power use. | LEDs use a fraction of incandescent power [S42][S8]. | ASK `energy_use`. | "Good question for Amy. What else is on your mind?" |

### Pattern for every DEFER and ASK (INFERENCE, shaped by [S22][S23][S25])

1. **Acknowledge** in one short clause, e.g. "Good question." [S23] "Acknowledging the customer's objection is the first step."
2. **Say what Amy will do.** Use `quote_process` for anything about price. Otherwise: "Amy will cover that on her call."
3. **Ask one capture question** from column (d).
4. **End with the callback.** Get a day, a time and a number. [S22] "Always end with a path forward."

- Never fill a gap with a "typical" industry answer. Patterns in column (b) are for Amy to choose from. The assistant never says them.
- Keep each reply to two sentences or fewer. Acknowledge before pivoting [S22].

---

## 3. Ten first-call objections

None of these lines states a price or a date. Each uses only approved facts: `free_estimate`, `storage`, `takedown_offered`, `contact_email` and `quote_process`.

| # | Objection | What's usually behind it | Honest pattern (source) | Example assistant line |
|---|---|---|---|---|
| 1 | "I just want a ballpark." | Afraid of wasting time, or of being sold. Price objections are mostly uncertainty about scope [S45]. | Acknowledge. Don't guess. Keep conditions attached [S25]. Some pros give ranges [S26]; CLG cannot. Hand off to the process and invite a budget. | "Totally fair. I can't give a number, and I'd hate to guess wrong. [`quote_process` verbatim.] If you have a budget in mind, I'll pass it to Amy." |
| 2 | "I'll think about it." | Hidden doubt, or simply not ready [S27]. | Ask one diagnostic question [S24]. Offer a no-commitment next step [S22]. Schedule a follow-up [S23]. | "Of course, no rush. Is there one thing you're unsure about that Amy could answer? Estimates are free, so there's no cost to hearing her ideas." |
| 3 | "It was too expensive last year." | Felt the value was missing, or the scope was wrong. | Acknowledge. Ask about budget and what mattered [S23]. Let the expert review options [S22]. Don't defend or discount. | "Thanks for telling me. That helps Amy. Was it the size of the design or the cost for what you got? I'll pass that along before she calls." |
| 4 | "I can do it myself." | Pride, cost, or past DIY years. | Respect it. Mention the trade-offs (time, takedown, storage) [S4], and offer a free, no-obligation option. Don't use injury stats to scare (INFERENCE). | "Lots of folks do, and that's great. If you'd like a second option, estimates are free, and our service includes takedown and storage." |
| 5 | "I need to ask my spouse." | A real shared decision. A vendor claims half the time it's another concern [S24]. | Validate. Offer to call when both can join, and send details they can share [S22][S27]. Skip the "three-way call now" push [S24]; it's pushy. | "That makes sense. When could Amy call so you're both there? I'll note anything your spouse will want answered." |
| 6 | "Can you text me instead?" | Busy, or dislikes calls. Consumers rank texting with local businesses highly [S28][S29]. | Record the preference and consent. Don't promise a channel Amy hasn't approved. SMS needs A2P 10DLC first (`legal-compliance.md`). | "I can note that you prefer a text. Is this the best number for that?" (Log the SMS consent turn.) |
| 7 | "I already got another quote." | Comparison shopping, which guides recommend [S17]. | Acknowledge the research. Name differences without knocking anyone [S22]. Suggest comparing inclusions [S24][S17]. | "Smart to compare. Estimates are free, so getting Amy's costs nothing. Worth checking if takedown and storage are included. Ours includes both." |
| 8 | "Just email me a price list." | Wants no pressure. | Respect the channel. Don't invent a price list. | "Pricing comes from Amy directly. You're welcome to email photos or questions to thelightguysaustin@gmail.com, and I'll note you'd like a reply by email." |
| 9 | "You're probably booked. Is it too late?" | Pre-emptive disappointment [S14][S15]. | Never guess about availability. Capture the target date and flag it. | "I honestly can't see Amy's schedule, so I won't guess either way. What date are you hoping for? I'll flag it so she can tell you straight." |
| 10 | "Is this a robot? I want a real person." | Distrust of bots. People respond better when they know a person is behind it [S46]. | Disclose honestly (`legal-compliance.md`). Confirm a human callback. In ring hours, offer the one allowed transfer. | "Yes, I'm Amy's AI assistant. Amy calls you back herself. I just make sure she has everything. [In ring hours: I can try to put you through now.]" |

---

## 4. Seasonal patterns (2026–27 season)

Key dates: Halloween is Sat Oct 31. Diwali is Sun Nov 8 [S39]. Thanksgiving is Thu Nov 26. Christmas is Fri Dec 25. Approved takedown runs Sat Jan 2 to mid-January.

| Phase | Who calls and what they worry about | Evidence | Assistant emphasis (INFERENCE) |
|---|---|---|---|
| **Now to Oct 31** (pre-Halloween) | Early planners, returning clients, businesses and HOAs. Diwali households want lights by early November. | Response is weak before Halloween because people focus on one holiday at a time [S13]. Businesses book by late summer or early fall [S1]. Book in late October or early November [S15]. | Take full scope, any deadline date and site-visit times. For commercial, ask who decides and when. For Diwali, capture the target date. |
| **Nov 1 to Nov 25** (peak) | New callers in volume. "Can it be up by Thanksgiving?" | Brite Nites: demand [S5] "really goes crazy after Halloween". Christmas Decor was booked solid around Nov 10 last year [S14]. The busiest stretch is [S13] "the two weeks before and after Thanksgiving". | Shorter calls. Lead with Amy's callback process. Always capture the deadline. Never promise a date. Set expectations only with approved `callback_expectation`. |
| **Thanksgiving week to mid-Dec** | "Is it too late?" Party and in-law deadlines. First outages from existing clients. | Calls are constant around Thanksgiving [S16] ("everyone is calling"). Many wait until Thanksgiving, which is often too late [S15]. One installer has a mid-December final install date [S10]. [S14] "When time runs out, time runs out." | First ask: "Have we done your lights before?" That splits service from sales. Use `late_season_booking`. Log the deadline date. |
| **Mid-Dec to Dec 31** | Mostly service: dark sections, GFCI trips after rain, wind, timers. Gift buyers. "Leave them up through New Year's?" | Installers report bulb service calls, even on Christmas Eve [S20]. Lease pros promise fast fixes [S7][S8]. | Triage existing customers first. Capture the symptom: whole display or one section, and since when. Stick to approved `outage_first_steps`. Never promise a response time. |
| **Jan 1 to mid-Jan** | Takedown timing. "Do I need to be home?" "Can you come earlier or later?" Rebooking. Permanent-light interest. | Teardown starts around Jan 2 and runs through the month [S13]. | SAY `takedown_dates`, `storage` and `permanent_lighting_brand`. Amy plans a new hire after Jan 1 (`amy-open-questions.md`), so update callback wording and the ring phone. |
| **Feb onward** | Permanent lighting. Off-season questions. | Pre-sales and renewals happen off-season [S13]. | Permanent lighting interest is approved as starting in February. Capture leads for Amy. |

- INFERENCE: "First cold snap" as a call trigger is plausible, but no source confirms it. Tag 2026 call logs by date and weather to test it.
- INFERENCE: Leaders' FAQs say "book early" more than anything else [S1][S6][S11]. CLG has no approved wording for urgency. Don't create urgency until Amy approves `booking_lead_time`.

---

## 5. Proposed knowledge items for Amy (39)

These are new items only. Existing pending keys are not repeated: `service_calls`, `christmas_services`, `residential_commercial`, `other_lighting`, `office_hours`, `sister_company` and `business_address`. Every answer is a blank template. **[Brackets] are Amy's to fill or strike.** Nothing here is a CLG fact.

| id | Caller question | Topics | Risk | Template answer |
|---|---|---|---|---|
| `lights_owned_or_leased` | Do I own the lights, or do you? | own the lights; rent; lease; keep the lights | high | "The lights [belong to us / belong to you after ___]. [What happens if a customer doesn't renew: ___]." |
| `customer_owned_lights` | Can you hang lights I already have? | my own lights; lights I bought; reuse | medium | "[We do / don't] install customer-owned lights. [Reason or condition: ___]." |
| `service_inclusions` | What does the service include? | included; what do I get; hidden fees | high | "Your service includes [design / lights / installation / ___]. Storage is included, and we take everything down at the end of the season." |
| `custom_fit_lights` | Are the lights cut to fit my house? | custom cut; measured; fit | low | "[Yes, we ___ / ___]." |
| `attachment_method` | How do you attach them? Nails? | clips; nails; staples; gutters | medium | "We attach lights with [___]. We [do / don't] use [nails / staples]." |
| `color_options` | What colors can I get? | warm white; multicolor; colors | low | "We offer [warm white / multicolor / ___]. Amy can help you pick on her call." |
| `light_types_and_bulbs` | What kind of lights do you use? | LED; C9; mini lights; bulbs | low | "We use [LED / ___] [C9 / C7 / mini] lights [on rooflines / trees / ___]." |
| `indoor_decorating` | Do you decorate inside the house? | indoor; tree; mantel; inside | low | "[Yes, we ___ / We focus on outdoor lighting.]" |
| `minimum_job_size` | Can you do just a wreath or one tree? | small job; just one; minimum | medium | "[Yes, we do small jobs / Our smallest job is ___]. Amy can go over options." |
| `roof_and_height_limits` | Can you do two-story, steep, tile or metal roofs, or tall trees? | two story; steep; tile roof; metal roof; tall tree | medium | "[We light ___]. For [___], Amy will take a look on Google Maps or at a site visit." |
| `damage_concerns` | Will it damage my roof or gutters? What if something breaks? | damage; roof; shingles; gutters | high | "[How we protect the house: ___]. If you ever notice a problem, [___]." |
| `power_requirements` | Do I need an outdoor outlet? Where do cords go? | outlet; power; extension cord; electrician | medium | "We need [___]. If you don't have [___], [___]." |
| `outage_first_steps` | My lights went out or the outlet tripped. What do I do? | went out; GFCI; tripped; rain; dark | high | "[First step Amy approves, or 'Please don't touch anything']. [Then: ___]. I'll get this to Amy right away." |
| `timers_and_controls` | Do they turn on by themselves? Can I use my phone? | timer; automatic; app; schedule | low | "[Your lights run on ___]. [On/off time: ___]. [Phone control: ___]." |
| `energy_use` | Will this raise my electric bill? Are they LED? | electric bill; energy; LED; environment | low | "[Our lights are ___]. Amy can talk through power use on her call." |
| `booking_lead_time` | How far ahead should I book? | book early; how soon; schedule | high | "[Our guidance: ___]. Amy confirms every install date herself." |
| `late_season_booking` | Is it too late to get lights this year? | too late; December; last minute | high | "[Stock line, e.g. 'It's not too late to ask.'] Amy will check her schedule and call you. What date were you hoping for?" |
| `install_window` | When do you start installing? | start; November; before Thanksgiving | high | "We usually install from [___] to [___]. Amy will confirm your date." |
| `install_duration` | How long does installation take? | how long; hours; all day | low | "Most installs take [___]. Amy will confirm for your home." |
| `takedown_flexibility` | Can you take them down earlier or later? | early takedown; leave up; February | medium | "[Our policy: ___]. Tell me your preferred date and I'll note it for Amy." |
| `weather_policy` | What if it rains or storms on install day, or damages the lights? | rain; storm; wind; weather | medium | "[If weather affects install: ___]. [If a storm affects lights: ___]." |
| `property_access` | Do I need to be home? What about gates and pets? | be home; gate; dog; access | low | "[You do / don't need to be home for ___]. We need [___]. Please [___ pets]." |
| `design_changes_midseason` | Can I add more after installation? | add more; change; extra | medium | "[Yes, ___ / ___]. Amy will go over any changes with you." |
| `callback_expectation` | When will Amy call me back? | call back; when; how soon | high | "Amy returns calls [___]. What time is best for you?" |
| `deposit_and_payment_timing` | Do you need a deposit? When do I pay? | deposit; pay; upfront; invoice | high | "[Deposit policy: ___]. [When payment is due: ___]." |
| `payment_methods` | What payment methods do you take? | card; check; Zelle; pay | medium | "We accept [___]." |
| `contract_and_cancellation` | Is there a contract? Can I cancel? | contract; cancel; agreement; sign | high | "[Agreement: ___]. [Cancellation: ___]." |
| `returning_customer_renewal` | You did my lights last year. Do I start over? | last year; returning; same design; renew | medium | "[How returning customers rebook: ___]. I'll note you're a returning customer for Amy." |
| `commercial_proposal_process` | Can you send a proposal for our business, HOA or board? | proposal; board; property manager; bid | medium | "For businesses and communities, Amy [___]. Who should she send it to?" |
| `commercial_paperwork` | Can you send our vendor paperwork, like a W-9 or certificates? | W-9; vendor packet; paperwork; COI | high | "Amy handles business paperwork directly. [___]. What's the best email for the request?" (Amy: decide whether COI requests flag a priority callback.) |
| `hoa_and_permits` | Does my HOA allow this? Do I need a permit? | HOA; permit; city rules; approval | medium | "[What we do about HOA rules: ___]. [Permits: ___]." |
| `reviews_and_photos` | Where can I see your work and reviews? | reviews; photos; examples; Google | low | "You can see [photos / reviews] at [___]." |
| `crew_identity` | Who does the installing? | crew; subcontractor; who comes; background | medium | "[Who installs: ___]." |
| `satisfaction_guarantee` | Do you guarantee your work? | guarantee; warranty; satisfaction | high | "[Amy's exact words, or 'Amy will go over that with you.']" |
| `discounts_and_promotions` | Do you have any discounts? | discount; deal; referral; early bird | high | "[Current offers: ___, or 'Amy can talk about pricing on her call.']" |
| `other_holidays_early_install` | Can you install early for Diwali, or do other holidays? | Diwali; Halloween; Hanukkah; early | medium | "[What we offer for other holidays: ___]. Amy will confirm dates." |
| `gift_purchase` | Can I buy this as a gift for someone else's home? | gift; parents; someone else; certificate | medium | "[Yes, ___ / ___]. We'll need [the homeowner's ___]." |
| `renter_or_landlord` | I rent. Can I still get lights? | rent; renter; landlord; apartment | medium | "[Our policy for rentals: ___]." |
| `text_contact` | Can Amy text me instead of calling? | text; SMS; message me | medium | "[Amy can text you at this number / Amy will call, and ___]." (Requires A2P 10DLC and recorded consent.) |

Risk key (INFERENCE): **high** means money, dates, liability, safety or legal exposure. **medium** means policy that could mislead if wrong. **low** means descriptive.

---

## Sources

| # | Source | URL |
|---|---|---|
| S1 | Christmas Decor FAQ (franchise) | https://www.christmasdecor.net/faq |
| S2 | Brite Nites homepage FAQ | https://www.britenites.com/ |
| S3 | Brite Nites: what to expect at a consultation | https://britenites.com/what-to-expect-during-a-professional-holiday-lighting-consultation |
| S4 | Brite Nites: professional vs DIY | https://britenites.com/why-choose-professional-holiday-lights-installation-over-diy |
| S5 | Freakonomics episode featuring Brite Nites | https://freakonomics.com/?p=143071 |
| S6 | Austin Custom Christmas Lights FAQ | https://atxcustomchristmaslights.com/faqs/ |
| S7 | The Perfect Light, Austin | https://theperfectlight.com/christmas-lighting/austin/ |
| S8 | Full Color Christmas Lights, Austin | https://fullcolorchristmaslights.com/ |
| S9 | Christmas Light Installers Austin Texas | https://www.christmaslightinstallersaustintexas.com/ |
| S10 | Lights Up, Austin | https://www.lightsup-usa.com/austin-christmas-light-installation/ |
| S11 | Outdoor Lighting Perspectives, holiday | https://www.outdoorlights.com/holiday-lighting/ |
| S12 | Home Depot install services (excerpt; page 403) | https://www.homedepot.com/services/c/christmas-light-installation/314fddada |
| S13 | Jobber Academy, holiday lighting business | https://getjobber.com/academy/holiday-lighting/christmas-light-installation-business-tips/ |
| S14 | 1851 Franchise, Christmas Decor timing | https://1851franchise.com/why-homeowners-should-schedule-their-christmas-decor-before-november-2716875 |
| S15 | KMUW (Wichita) | https://www.kmuw.org/the-range/2021-12-17/lighting-companies-keep-holidays-bright-and-wichitans-off-their-rooves |
| S16 | Valley News Live (Fargo) | https://www.valleynewslive.com/2025/11/23/local-holiday-lighting-businesses-prepare-busy-season-around-fargo-moorhead-area/ |
| S17 | KSAT (San Antonio) | https://ksat.com/news/local/2024/11/26/questions-to-ask-before-you-hire-someone-to-install-your-outdoor-lights-this-holiday |
| S18 | KY3 | https://www.ky3.com/2025/10/22/your-side-what-ask-before-you-hire-pro-hang-holiday-lights |
| S19 | KSHB | https://www.kshb.com/news/local-news/looking-to-hire-out-holiday-lights-heres-what-to-know |
| S20 | ArboristSite installer forum | https://arboristsite.com/threads/any-of-you-guys-hang-lights.114314 |
| S21 | CPSC holiday decorating injuries (falls 41%) | https://www.cpsc.gov/Newsroom/News-Releases/2018/Put-Safety-at-the-Top-of-Your-List-When-Decorating-this-Holiday-Season |
| S22 | ServiceTitan Voice Agent objection playbook | https://help.servicetitan.com/roofing/docs/voice-agent-objection-handling-playbook |
| S23 | Housecall Pro objection handling (AAA) | https://help.housecallpro.com/en/articles/9715453-mastering-objection-handling-to-close-more-sales |
| S24 | Pipeline On contractor objections | https://pipelineon.com/blog/contractor-objection-handling/ |
| S25 | Hyperleap AI front-desk quote scripts | https://hyperleap.ai/blog/ai-front-desk-quote-vs-estimate-scripts |
| S26 | Jobber community sales-call thread (excerpt) | https://community.getjobber.com/discussions/marketing-forum/sales-calls---how-are-you-stucturing-yours/10774 |
| S27 | Hatch objection handling (excerpt) | https://www.usehatchapp.com/blog/does-your-home-improvement-sales-team-suck-at-objection-handling |
| S28 | Podium messaging trends (excerpt) | https://www.podium.com/guides/business-messaging-trends/ |
| S29 | Cloudli texting survey (excerpt) | https://www.cloudli.com/survey-shows-93-want-to-text-and-talk-with-local-businesses |
| S30 | Trimlight: permanent lights and HOA | https://trimlight.com/blog/do-permanent-christmas-lights-violate-hoa-rules |
| S31 | FLB Law: HOA holiday displays (excerpt) | https://flblaw.com/keeping-the-holly-jolly-in-holiday-light-displays |
| S32 | HomeGnome: clips by roof type (excerpt) | https://homegnome.com/blog/roofing/how-to-hang-christmas-lights-on-roof/ |
| S33 | GAF: roof punctures (excerpt) | https://www.gaf.com/blog/your-home/5-tips-to-simplify-holiday-light-installation-281474980204780 |
| S34 | Christmas Light Emporium: GFCI in rain (excerpt; retailer) | https://thechristmaslightemporium.com/blogs/all-about-christmas-lights/how-to-stop-christmas-lights-from-tripping-gfci-in-rain-2025-guide |
| S35 | Christmas Light Emporium: choosing lights (excerpt; retailer) | https://thechristmaslightemporium.com/blogs/all-about-christmas-lights/choose-outdoor-christmas-lights-guide |
| S36 | Rosie on the House (excerpt) | https://www.rosieonthehouse.com/blog/hiring-someone-else-to-deck-the-halls |
| S37 | Thumbtack holiday lighting guide (excerpt; questions only) | https://thumbtack.com/p/christmas-light-installation-prices |
| S38 | City of Duvall vendor insurance form (excerpt) | https://duvallwa.gov/forms.aspx?FID=97 |
| S39 | Wilsonville: Diwali 2026 date (excerpt) | https://wilsonvilleoregon.gov/administration/page/diwali |
| S40 | Domu: renters and decorations (excerpt) | https://www.domu.com/blog/holiday-decorations-legal-risks-chicago-landlords-cant-ignore |
| S41 | Outdoor Lighting Perspectives Augusta: gifting (excerpt) | https://www.outdoorlights.com/augusta/resources/blogs/2012/december/augusta-outdoor-lighting-the-gift-that-keeps-on-/ |
| S42 | UF/IFAS citing DOE: LED vs incandescent (excerpt) | https://blogs.ifas.ufl.edu/pinellasco/2013/11/08/holiday-lights |
| S43 | CLIPA training (excerpt) | https://clipa.com/clipa-training-certification-master-holiday-permanent-lighting-installation/ |
| S44 | Angi on-demand install listing (excerpt) | https://www.samsclub.com/ip/Angi-Christmas-Light-Installation/13714569312 |
| S45 | Jobber guide to price objections (excerpt; PDF is image-only) | https://www.getjobber.com/wp-content/uploads/2026/02/Guide-to-Handling-Price-Objections-by-Jobber.pdf |
| S46 | Small Business Trends on Podium texting survey (excerpt) | https://smallbiztrends.com/2021/07/customers-prefer-texting-business-real-people.html |
