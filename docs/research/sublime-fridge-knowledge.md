# Knowledge capture: Sublime Patio + The Fridge

- **Date:** 2026-10-22
- **Sites:** `https://sublimepatio.com/` (SP) and `https://thefridgevending.com/` (TF)
- **Why:** the shared line now answers for these two companies as well as The Christmas Light Guys (CLG) and The Light Guys (TLG). Same owner, same office manager (Amy).
- **Rule carried over:** website text is a draft. The agent says only Amy's approved words. See `lib/knowledge/model.ts`.
- **Companions:** `website-forensics.md` (CLG/TLG facts F01–F62), `../prior-work/08-client-audits.md` §2.4–2.5, §3.1.

## Labels

| Label | Meaning |
|---|---|
| **FACT-ON-SITE** | The quote is on the page today. Benign topic. Still needs Amy's click before the agent says it. |
| **CONFLICT** | The site (or another brand's site) says something different about the same topic. The agent says neither. |
| **RISKY** | Price, discount, free offer, warranty or guarantee, availability or timing, licensing, performance or reputation claims. The agent never says these without Amy's exact words. |
| **I** | Inference from evidence. Not verified. |
| **U** | Unknown. Only Amy can answer. |

## Method and limits

- GET requests only. No form was submitted. No number was called. Nothing was signed up for.
- **sublimepatio.com:** fetched all 12 URLs in the Rank Math sitemap (`/page-sitemap.xml`, the only child of `/sitemap_index.xml`). Parsed visible text, links, `<meta>` and JSON-LD.
  - Probed `/faq/`, `/testimonials/`, `/financing/`, `/warranty/`, `/service-area/`, `/pricing/`, `/blog/`, `/privacy-policy/`. All **404**.
  - FAQ, financing, warranty and pricing content lives inside the service pages' FAQ blocks. It is captured below.
- **thefridgevending.com:** the server returns a 1.9 KB React shell. Fetched the shell, then the 526 KB bundle `/assets/index-DVz8jp7-.js` (Last-Modified 2026-07-31).
  - Rendered the page once in the built-in browser to read visible text and every `tel:` link. No clicks and no form input.
  - Probed `/robots.txt`, `/sitemap.xml`, `/about`, `/contact`, `/faq`, `/services`, `/privacy`, `/terms`, `/manifest.json`. All **404**. It is a one-page site.
- DNS MX and RDAP (registry) lookups for both domains.
- Re-fetched 4 TLG pages and 2 CLG pages only to search for cross-brand names (Bailey, Sublime, Fridge, 923).
- Limit: no Google Business Profile, review site or social page was opened. GBP details are **U**.

---

## 0. Summary

1. **Phone (FACT):** The Fridge shows **only 512-923-9313**, in 6 rendered `tel:` links. Every other brand shows **512-339-9313**. See §1.
2. **Owner (FACT):** "Joshua Bailey" is Sublime's founder ("founded in 2002 by Joshua Bailey") and The Fridge's "President". CLG and TLG testimonials name a "Joshua"/"Josh". No site names Amy. No site says the companies are related.
3. **Shared address (FACT):** Sublime uses the same PO Box 90305, Austin 78709 as CLG and TLG. The Fridge shows no address at all.
4. **Sublime contradicts itself on its history (FACT):** "since 2002", "20+ Years Experience", a "Years in Business" counter of **23**, and "for over 15 years". All four are on the site today.
5. **Sublime publishes price ranges, warranties and financing (FACT, RISKY):** for example, kitchens "$10,000 to $60,000+" and pergolas "$6,000 and $35,000". It says louvered roofs and turf carry manufacturer warranties plus "our own workmanship guarantee". Financing "during your free consultation". None of this may be spoken.
6. **Sublime service area (FACT, CONFLICT):** five different lists. The Contact list is TLG's 18-city list with the last three cut off, in the same order.
7. **Cross-brand overlap (FACT):** Sublime's lighting FAQ answers "Yes" to seasonal or holiday lighting, which is CLG's business. Sublime and TLG both sell landscape lighting. Amy must set a routing rule.
8. **The Fridge is thin and new (FACT/I):** no service area, hours, address, prices, contract terms, payment methods or refund process. The domain was registered **2026-06-09**. Yet the page shows a "Live placement" photo caption.
9. **The Fridge's form loses leads (FACT):** "Send Request" only opens a `mailto:` draft to hello@thefridgevending.com. That address is never shown as text. A caller who "filled out the form" may have sent nothing.
10. **Sublime is hidden from Google (FACT):** every page has `<meta name="robots" content="nofollow, noindex">`. I: few callers will find Sublime through organic search.

**Claim counts:** Sublime 66 claims (28 FACT-ON-SITE, 13 CONFLICT, 25 RISKY). The Fridge 25 claims (16 FACT-ON-SITE, 1 CONFLICT, 8 RISKY). Cross-company conflicts: 12 (§4).

---

## 1. Phone numbers

| Site | Number shown | `tel:` link? | Where (FACT) |
|---|---|---|---|
| sublimepatio.com | **(512) 339-9313** | Yes: `tel:512-339-9313`. 2 per page on most pages, 3 on Contact. The header bar is **not** a link (`<a href="">`). | Header bar "(512) 339-9313 - Free Estimates Available" (every page, empty href). Footer (every page, tel:). CTA "Call (512) 339-9313" (tel:). Contact "Call or Text" (tel:). FAQ answers (plain text). Form placeholder "+1 512-000-0000" is a dummy. |
| thefridgevending.com | **512-923-9313** | Yes: all `tel:+15129239313` | Rendered `tel:` links: desktop nav, mobile menu, "Bring The Fridge to your location" CTA band, contact panel "Call Joshua Bailey, President", contact line "Prefer to talk now? Call Joshua Bailey, President, at 512-923-9313.", footer. A 7th sits in the form's success message. "339-9313" appears **0** times in the bundle. Placeholder "(512) 000-0000" is a dummy. |
| thechristmaslightguys.com | 512-339-9313 | No | Contact and Quote pages only (`website-forensics.md` §5.2). |
| thelightguysaustintx.com | 512-339-9313 | No | Header and footer of every page, JSON-LD (`website-forensics.md` §6.2). |

**Finding (FACT):** yes, thefridgevending.com shows 512-**923**-9313 everywhere, and nowhere 512-**339**-9313. Sublime, CLG and TLG show only 512-339-9313. The last four digits match; the exchange differs.

- FACT: the number is hard-coded **twice** in the bundle. One copy is the site constant (`phone:"512-923-9313",phoneHref:"tel:+15129239313"`). The other is a literal in the CTA band. A fix needs both edits.
- I: it is either a typo or a second line. We did not call it (out of scope). `docs/bestline-options.md` Q8 already asks Bestline whether 923-9313 is on the account.
- Lightline impact:
  - If 923-9313 is a real DID that forwards to the shared line, the dialed number (`call.to_e164`) can identify Fridge calls without asking.
  - If it is a typo, Fridge prospects are dialing a stranger today. The agent cannot fix that; the site must.
  - The agent must not read either number to a Fridge caller until Amy picks one (item `tf.phone_number`).

---

## 2. Sublime Patio claim register

Paths are under `https://sublimepatio.com`. "All pages" means the shared header, footer or estimate pop-up. Quotes are exact (typographic apostrophes kept).

### 2.1 Identity and contact

| id | Topic | Quote (exact, short) | Page | Class |
|---|---|---|---|---|
| SP01 | Business name | "© 2026 Sublime Patio & Outdoor Living. All rights reserved. \| Austin, Texas" | all pages (footer) | FACT-ON-SITE |
| SP02 | Name in the map embed | `title="Sublime Patio &amp; Landscape, Austin"` (Google Maps iframe query) | /contact-us/ | CONFLICT (vs SP01). I: the Google listing may use the old name. |
| SP03 | Phone | "(512) 339-9313 - Free Estimates Available" | all pages (header) | FACT-ON-SITE (shared line) |
| SP04 | Texting | "Call or Text (512) 339-9313 Fastest way to reach us" | /contact-us/ | RISKY (can the shared line receive texts?) |
| SP05 | Email | "sublimepatio@gmail.com" (mailto:) | all pages (footer), /contact-us/ | FACT-ON-SITE |
| SP06 | Email reply time | "We respond within one business day" | /contact-us/ | RISKY |
| SP07 | Form callback promise | "Josh or a member of the Sublime team will reach out within one business day to schedule your on-site consultation." | all pages (pop-up) | RISKY |
| SP08 | Mailing address | "PO Box 90305 Austin, Texas 78709" | all pages (footer), /contact-us/ | FACT-ON-SITE (shared with CLG F05 and TLG) |
| SP09 | No office visits | "By appointment we come to you" | /contact-us/ | FACT-ON-SITE |
| SP10 | Locally owned | "Austin, TX Locally Owned" | / (trust bar) | FACT-ON-SITE |
| SP11 | Family-run | "Austin's trusted, family-run patio & pergola builder since 2002" | /about-us/ (meta description only) | FACT-ON-SITE (meta only; confirm) |

### 2.2 History, people, reputation

| id | Topic | Quote | Page | Class |
|---|---|---|---|---|
| SP12 | Founded 2002 by Joshua Bailey | "Sublime Patio & Outdoor Living was founded in 2002 by Joshua Bailey." | / (body and FAQPage JSON-LD) | CONFLICT (years: SP13–SP16) |
| SP13 | "Since 2002" | "Austin's Trusted Outdoor Living Contractor Since 2002" / "Austin’s trusted outdoor living contractor since 2002." | /, /about-us/ (title), footer, /outdoor-kitchens/, /pergolas-covered-patios/, /stone-gravel-pathways/ | CONFLICT |
| SP14 | 20+ years | "20+ Years Experience" / "over 20 years of hands-on experience" / "20+ Years of Proven Expertise" | / (trust bar, FAQ), /about-us/ | CONFLICT |
| SP15 | 23 years | "Years in Business" counter, `data-to-value="23"` with "+" | / | CONFLICT (2002 → 24 in 2026) |
| SP16 | Over 15 years | "crafting exceptional outdoor spaces for Austin homeowners for over 15 years" | /about-us/ (FAQ) | CONFLICT |
| SP17 | Origin | "What began as a small outdoor construction company in Central Austin" | /about-us/ | FACT-ON-SITE |
| SP18 | Founder background | "His extensive experience in the industry, including landscaping, patio design, deck construction & outdoor lighting" | / | FACT-ON-SITE |
| SP19 | Volume | "500+ Happy Clients" / "Projects Completed" counter 500+ / "completed more than 500 luxury outdoor living projects" / "Join hundreds of Austin homeowners" | /, /about-us/ | RISKY (clients vs projects; unverifiable) |
| SP20 | Reviews | "5-Star Reviews" / "driven by word of mouth and 5-star reviews" | /, /about-us/ | RISKY (no review source; "Testimonials" menu links to `#`) |
| SP21 | Superlatives | "the region’s most trusted outdoor living specialist" / "Austin's Premier Outdoor Kitchen Builder" | /about-us/, /outdoor-kitchens/ | RISKY |
| SP22 | Guarantees | "Quality Guaranteed" / "Satisfaction Goal" counter 100% / "we stand behind every project" | /, /about-us/ | RISKY |
| SP23 | Testimonials | "I have been very impressed with Sublime Patio from the initial meeting with Josh." (Karen, Round Rock; also Andy, Austin; Juan, Pflugerville) | / and every service page | RISKY (undated, no source; precedent F51) |

### 2.3 Licensing

| id | Topic | Quote | Page | Class |
|---|---|---|---|---|
| SP24 | Licensed and insured | "Licensed & Insured" / "Sublime Patio is a fully licensed and insured outdoor living contractor." / "We’re a fully licensed and insured contractor in Texas" | / (trust bar, FAQ), /outdoor-kitchens/ | RISKY. I: Texas has no statewide general-contractor licence, so "licensed" needs Amy to say by whom. |
| SP25 | Electrician | "A licensed electrician handles all wiring" | /pergolas-covered-patios/ | RISKY |

### 2.4 Services and scope

| id | Topic | Quote | Page | Class |
|---|---|---|---|---|
| SP26 | Service list (8) | "Outdoor Kitchens · Pergolas & Covered Patios · Stone & Gravel Pathways · Patios, Masonry & Decking · Landscape & Patio Lighting · Louvered Shade Systems · Landscaping · Artificial Turf & Golf Greens" | all pages (nav), / (FAQ) | FACT-ON-SITE |
| SP27 | Homeowners | "Trusted By Austin Homeowners" (no commercial claim anywhere; some image files are named "COMMERICAL-PHOTO-…") | / | FACT-ON-SITE (residential; commercial is U) |
| SP28 | Fully custom | "Every single project we take on is fully custom-built." | / (FAQ) | FACT-ON-SITE |
| SP29 | 3D design | "Our team creates detailed 3D plans" / "Our in-house design team creates detailed 3D renderings" | /about-us/ | FACT-ON-SITE (confirm) |
| SP30 | Permits | "We handle all permits, materials, and scheduling" / "All permits pulled and inspections handled" | /about-us/, /pergolas-covered-patios/ | FACT-ON-SITE |
| SP31 | HOA / engineering | "Sublime Patio handles the structural planning and necessary engineering blueprints" | /patios-masonry-decking/ | FACT-ON-SITE |
| SP32 | Kitchens end to end | "We handle everything from design and permits through structural construction, gas line, plumbing, electrical, and appliance installation." | /outdoor-kitchens/ | FACT-ON-SITE |
| SP33 | Kitchen features | "Built-in grills, countertops, cabinetry, refrigeration & more" | /outdoor-kitchens/ | FACT-ON-SITE |
| SP34 | Pergola types | "Wood, aluminum & steel structures" / "Attached and freestanding designs available" | /pergolas-covered-patios/ | FACT-ON-SITE |
| SP35 | Pergola inclusions | "Integrated fans, lighting & electrical included" | /pergolas-covered-patios/ | RISKY ("included" = price scope) |
| SP36 | Stone and gravel | "Expertly laid flagstone, pavers, pea gravel, and customized borders" | /stone-gravel-pathways/ | FACT-ON-SITE |
| SP37 | Masonry, decks, brands | "Composite decking (like Trex or TimberTech)" / "outdoor fireplaces and fire pits are among our most popular custom masonry features" | /patios-masonry-decking/ | FACT-ON-SITE (brands are examples, not a dealer claim) |
| SP38 | Lighting | "custom, low-voltage architectural LED installations" / "Smart controls, multi-zone setups, and integrated automation systems" | /landscape-patio-lighting/ | FACT-ON-SITE |
| SP39 | Lighting performance | "consume up to 80% less energy than old halogen bulbs" / "roughly 40,000 to 50,000 hours" / "completely zero risk of shock" | /landscape-patio-lighting/ | RISKY |
| SP40 | Holiday lighting | "many of our clients pair their permanent architectural lighting system with seasonal accent lighting for holidays or special events" (answer to "Do you offer seasonal or holiday lighting…?": "Yes") | /landscape-patio-lighting/ | CONFLICT (cross-brand: CLG) |
| SP41 | Louvered systems | "we install premium, motorized louvered roof systems" / "Every system comes with a smartphone control app and handheld remote" | /louvered-shade-systems/ | FACT-ON-SITE (no manufacturer named) |
| SP42 | Louvered performance | "wind loads up to 110+ mph" / "completely waterproof when closed?" answered "Yes" | /louvered-shade-systems/ | RISKY |
| SP43 | Landscaping | "We exclusively design using resilient native and adapted plants" / "custom French drains, surface swales, dry creek beds" | /landscaping/ | FACT-ON-SITE |
| SP44 | No ongoing maintenance | "Our primary focus is design and installation" | /landscaping/ | FACT-ON-SITE |
| SP45 | Turf | "custom pet turf setups, and professional-grade backyard putting greens" | /artificial-turf-golf-greens/ | FACT-ON-SITE |
| SP46 | Turf performance | "last 15 to 20+ years" / "over 30+ inches per hour" / "100% non-toxic, hypoallergenic, and entirely free of lead" | /artificial-turf-golf-greens/ | RISKY |

### 2.5 Price, financing, warranty, timing

| id | Topic | Quote | Page | Class |
|---|---|---|---|---|
| SP47 | Kitchen price | "typically range from $10,000 to $60,000+" / "A basic built-in grill island starts around $8,000–$15,000" | /outdoor-kitchens/ | RISKY. Also inconsistent: "from $10,000" but islands "around $8,000". |
| SP48 | Pergola price | "typically costs between $6,000 and $35,000" / "A simple wood pergola starts around $6,000–$12,000" | /pergolas-covered-patios/ | RISKY |
| SP49 | Other price wording | "range from a few thousand dollars for smaller paver installations" / "Every patio and masonry project is priced individually" / "a premium investment" | /patios-masonry-decking/, /stone-gravel-pathways/, /artificial-turf-golf-greens/, /louvered-shade-systems/ | RISKY |
| SP50 | Resale value | "increase a home’s resale value by $15,000–$50,000 or more" / "by $8,000 to $25,000 or more" | /outdoor-kitchens/, /pergolas-covered-patios/ | RISKY |
| SP51 | Pricing promise | "Transparent pricing no hidden costs" | / | RISKY |
| SP52 | Budget bands (to ask, not say) | "Under $10,000 · $10,000 – $25,000 · $25,000 – $50,000 · $50,000 – $100,000 · $100,000+ · Not sure yet" | all pages (pop-up), /contact-us/ | FACT-ON-SITE. No minimum job size is stated. |
| SP53 | Free estimate | "Free Estimates Available" / "a free, no-obligation estimate" / "complimentary on-site design consultations for all prospective clients" | all pages, /, /about-us/ | RISKY (precedent F18) |
| SP54 | Financing | "we can discuss financing options during your free consultation" / "available payment and financing plans" | /outdoor-kitchens/ | RISKY |
| SP55 | Louvered warranty | "backed by manufacturer warranties, and our installation work is covered by our own workmanship guarantee" | /louvered-shade-systems/ | RISKY |
| SP56 | Turf warranty | "backed by a manufacturer’s product warranty covering material defects, along with our own workmanship guarantee" | /artificial-turf-golf-greens/ | RISKY |
| SP57 | Plant warranty | "Ask your design consultant about specific plant warranty or replacement terms" | /landscaping/ | RISKY |
| SP58 | Build durations | Kitchens "between 2 and 6 weeks from build start"; pergolas "between 1 and 4 weeks"; patios/masonry "between 1 and 3 weeks"; stone "within 2 to 5 days"; lighting "in 1 to 3 days"; louvered "3 to 7 days"; landscaping "between 3 and 10 days"; turf "within 2 to 5 days" | each service page FAQ | RISKY. No lead time to **start** is stated anywhere. |

### 2.6 Process and service area

| id | Topic | Quote | Page | Class |
|---|---|---|---|---|
| SP59 | Five steps | "Free Consultation → Custom Design → Planning & Permits → Expert Construction → Final Walkthrough" | /about-us/, /outdoor-kitchens/, /pergolas-covered-patios/, /stone-gravel-pathways/ | FACT-ON-SITE. Note: the Stone page reuses the pergola copy ("detailed plans for your pergola or patio cover"). |
| SP60 | First step is a site visit | "We visit your property, listen carefully, and assess the space with expert eyes." | /about-us/ | FACT-ON-SITE |
| SP61 | Area: Contact list (15) | "Austin · Round Rock · Pflugerville · Georgetown · Leander · Westlake Hills · Lakeway · Bee Cave · Rollingwood · Spicewood · Cedar Park · Buda · Kyle · Bastrop · Jonestown" | /contact-us/ | CONFLICT |
| SP62 | Area: About body (4) | "We serve homeowners across Austin, Round Rock, Cedar Park, Georgetown, and the broader Central Texas region." | /about-us/ | CONFLICT |
| SP63 | Area: FAQ (7) | "Austin, Round Rock, Cedar Park, Georgetown, Lakeway, Bee Cave, Pflugerville, and surrounding Central Texas communities. Not sure if we cover your area? Give us a call — we likely do." | /about-us/, /outdoor-kitchens/ | CONFLICT |
| SP64 | Area: service pages (4) | "Serving Austin, Round Rock, Cedar Park, Georgetown & surrounding areas" | 7 service pages | CONFLICT |
| SP65 | Area: Hill Country | "homeowners across Austin and the Texas Hill Country" | /artificial-turf-golf-greens/ | CONFLICT |
| SP66 | Area: Home | "Serving Austin and surrounding areas" | / | CONFLICT |

### 2.7 Asked by callers, not on the site (U)

Office hours · any street address or showroom · commercial work · start lead time or current backlog · minimum job size · deposit and payment schedule · financing partner · warranty terms and length · manufacturers for louvered roofs, turf and lighting fixtures · whether the shared line takes texts · who calls back (Josh, Amy, a designer).

### 2.8 Site defects that affect callers (FACT)

- "Testimonials" menu item links to `#`. Facebook, X and YouTube icons have no `href`. "Privacy Policy" and "Terms of Service" are plain text, not links.
- No LocalBusiness schema, no hours, no rating widget. The only Google element is the map embed (SP02).
- Every page is `noindex, nofollow`.
- Rebuilt in 2026: pages published 2026-06-09, modified up to 2026-08-25. Domain registered 2012-05-29 (RDAP), so nothing online proves "2002".

---

## 3. The Fridge claim register

One page: `https://thefridgevending.com/`. Section anchors: `#what`, `#perfect-for`, `#stock`, `#how`, `#why`, `#contact`. Some text is held in the JS bundle and shown in tabs or after an animation; it is marked "(bundle)".

| id | Topic | Quote (exact, short) | Where on the page | Class |
|---|---|---|---|---|
| TF01 | Business name | "© 2026 The Fridge Vending. All rights reserved." | footer | FACT-ON-SITE |
| TF02 | Phone | "512-923-9313" (`tel:+15129239313`) | nav, CTA band, #contact ×2, footer | **CONFLICT** (shared line is 512-339-9313; §1) |
| TF03 | Contact person | "Call Joshua Bailey, President" | #contact, footer ("Joshua Bailey · President") | FACT-ON-SITE (naming him is Amy's call) |
| TF04 | Email | `hello@thefridgevending.com` (only as the form's `mailto:` target; never shown as text) | #contact form (bundle) | FACT-ON-SITE. MX is Google Workspace. Whether anyone reads it is U. |
| TF05 | Website | "TheFridgeVending.com" (text, not a link) | #contact, footer | FACT-ON-SITE |
| TF06 | What it is | "AI smart vending machines placed in local businesses at no charge" / "The Fridge uses modern smart-vending technology" | meta description, footer, AI section | FACT-ON-SITE for "smart vending machines". The "AI" label and "at no charge" are not (TF07). |
| TF07 | Free to host | "$0 Cost to host" / "The machine is placed at no charge" / "Placement is free, and there’s no obligation." / "And it costs you nothing." | hero, #how step 03, #why, #contact | RISKY |
| TF08 | Host workload | "Delivered, installed, stocked & serviced." / "without buying or maintaining a machine" / "without adding any extra work for your team" | #why, hero ("Stocked & serviced for you") | RISKY |
| TF09 | No obligation | "Free placement · No obligation · We reply within one business day." | #contact | RISKY |
| TF10 | Reply time | "We reply within one business day." | #contact | RISKY |
| TF11 | Target locations | "Ideal for repair shops, tire shops, service centers, and dealerships with waiting rooms." / Apartments: "Clubhouses · Leasing offices · Fitness centers · Mailroom & package areas · Shared resident spaces" / Employee Spaces: "Break rooms · Warehouses & shops · Offices & studios · High-traffic staff areas" (bundle tab) | #perfect-for | FACT-ON-SITE |
| TF12 | Location types (form) | "Auto repair shop · Tire shop / service center · Car dealership · Apartment community · Office / employee break room · Gym / fitness center · Other high-traffic location" | #contact form | FACT-ON-SITE (use as intake options) |
| TF13 | What is stocked | "Energy drinks, bottled water, sparkling water, sodas, teas, juices, and sports drinks" / "Sandwiches, wraps, salads, fresh snacks, and ready-to-eat meal boxes" / "Small toys, puzzles, and activity items" | #stock | FACT-ON-SITE |
| TF14 | Stock anything | "If your people want it, we can stock it." / "Adjusted anytime around real demand." | #stock | RISKY |
| TF15 | Custom mix | "The selection is built around your space" / "100% Customized to you" | #how step 02, hero stats | FACT-ON-SITE ("built around your space"); the "100%" is RISKY |
| TF16 | Always open | "24/7 Always open" (counter renders "0/7" until it animates) | hero stats | RISKY (depends on the host's opening hours) |
| TF17 | Checkout speed | "60s Tap-to-go checkout" / "Tap. Grab. Gone in sixty seconds." | hero stats, ticker | RISKY |
| TF18 | Payment | "No clunky old machine, no attendant, no coins." | "Seeing is believing" section | FACT-ON-SITE (accepted payment methods are U) |
| TF19 | Four steps | "Tell us about your location → We customize the product mix → The machine is placed at no charge → People grab what they want" | #how | FACT-ON-SITE (step 3 wording is RISKY via TF07) |
| TF20 | Existing installs | "Live placement" / "An employee break room, stocked and ready." (photo caption) | "Seeing is believing" section | RISKY. I: the domain was registered 2026-06-09; how many live placements exist is U. |
| TF21 | Area | "placed in local businesses" (no city, county or state anywhere in HTML or bundle) | meta, footer | FACT-ON-SITE (the area itself is U) |
| TF22 | Versus old vending | "A cleaner, faster, more flexible grab-and-go experience than traditional vending." | #why | FACT-ON-SITE (marketing) |
| TF23 | Form fields | "Name * · Business / Property · Phone · Email · Location type · Message" / "Please add your name and at least a phone or email so we can reach you." | #contact | FACT-ON-SITE |
| TF24 | Form delivery | Submit runs `window.location.href = mailto:${email}?subject=…` then shows "Your email app should have opened with the details filled in." | #contact (bundle) | FACT-ON-SITE (no server capture) |
| TF25 | Tagline | "Fresh Snacks, Cold Drinks, Happy Teams." | footer | FACT-ON-SITE |

### 3.1 Asked by callers, not on the site (U)

Service area · office hours · any address · years in business · insurance · machine brand and size · power, space and Wi-Fi needs · minimum foot traffic or headcount · contract length and removal terms · commission or revenue share to the host · product prices in the machine · payment methods (card, phone wallet, app) · refunds when a machine fails · restock frequency · who to call when a machine is down · lead time from "yes" to installed.

---

## 4. Conflicts across the companies

| # | Topic | CLG | TLG | Sublime | The Fridge | Label |
|---|---|---|---|---|---|---|
| X1 | Phone | 512-339-9313 | 512-339-9313 | (512) 339-9313 | **512-923-9313** | FACT |
| X2 | Owner / people | "Joshua suggested…" (testimonial, F50) | "Josh really heard me out" (testimonial) | "founded in 2002 by Joshua Bailey"; "Contact Josh and the Sublime Patio team" | "Call Joshua Bailey, President" | FACT. I: one Joshua Bailey runs all four. No site says so. Amy appears on none. |
| X3 | Address | PO Box 90305, Austin 78709 | Same PO Box; also 2009 Pyramid Dr and 9518 Hwy 290 W (F05–F07) | Same PO Box | none | FACT |
| X4 | Email | guys@thechristmaslightguys.com | thelightguysaustin@gmail.com | sublimepatio@gmail.com | hello@thefridgevending.com (hidden mailto) | FACT. Four inboxes; the agent must give the one for the brand on the call. |
| X5 | Service-area copy | 5 cities + Travis/Williamson/Hays counties | 18 cities | Contact list = TLG's first 15, same order (drops Lago Vista, Volente, Dripping Springs); 4 other lists | none | FACT (lists). I: Sublime's list was copied from TLG. |
| X6 | Experience | "9 years" | "20 years"; "over nine years… landscape design maintenance" | 2002; 20+; 23; "over 15 years" | none (domain from 2026-06-09) | FACT. I: if the same team, TLG's "over nine years" of landscape work clashes with Sublime's landscaping "since 2002". |
| X7 | Landscape lighting | "The Light Guys provide top of line event, bistro, and landscape lighting" (F42) | "BISTRO POOL AND LANDSCAPE LIGHTING" (F47) | "Landscape & Patio Lighting" service | — | FACT. Same service sold by two brands. Routing needed. |
| X8 | Holiday lighting | Core business (F12) | Christmas page | FAQ: "Yes" to "seasonal or holiday lighting" | — | FACT. Routing needed. |
| X9 | Landscaping | — | "residential and commercial landscape design maintenance" (F29) | "Landscaping" service; "Our primary focus is design and installation" | — | FACT. TLG says maintenance; Sublime implies none. |
| X10 | Licensing wording | "Licensed and Bonded"; "fully bonded and insured" | "fully licensed and insured" | "fully licensed and insured outdoor living contractor" | none | FACT |
| X11 | Hours and response | none | Mon–Fri 08:00–17:00 (JSON-LD only, F48) | none; "within one business day" | "24/7 Always open" (machines); "within one business day" | FACT. Risk: the agent repeats "24/7" as office hours, or TLG's hours for Sublime. |
| X12 | "Free" offers | free estimate, free storage, free service calls | free consultation/estimate | free estimates, free design consultation | free placement, "$0 to host" | FACT. Each "free" is brand-specific. None is approved. |

Also (FACT): Sublime's pages were first published **2026-06-09**, the same day thefridgevending.com was registered. I: one web project built both.

---

## 5. Draft knowledge items

Same shape as `lib/knowledge/tenants/christmas-light-guys.ts`. **Not created as source files.** Every item starts `pending`. Claim `siteFactId` values are the register ids above; promote §2 and §3 to `lib/knowledge/sources/sublime-site-facts.json` and `fridge-site-facts.json` when these become real files.

### 5.1 Model changes these snippets assume (not made)

```ts
// lib/knowledge/model.ts
export type Brand = "clg" | "tlg" | "sp" | "tf" | "policy";
```

- `bothSitesAgree()` checks `clg` and `tlg` only. A single-site tenant never reaches `quick_confirm`, so every SP/TF item lands in `exact_words` or `conflict`. That is the conservative outcome; keep it.
- `isConflict()` already catches Sublime's internal contradictions (years, area). Claims that do not disagree share one `value` (for example "published price figures") so they land in `exact_words`, not `conflict`. Genuinely different topics are split into separate items.
- **One line, four brands:** `forbiddenClaims()` should run over the union of all brands' items on every call, and an approved text should only unblock markers on calls for its own brand. Otherwise Sublime's "since 2002" could be voiced on a CLG call, or CLG's "free storage" on a Fridge call.

### 5.2 Shared helpers (proposed `lib/knowledge/tenants/capture.ts`)

```ts
import type { Brand, Claim, ItemKind, KnowledgeItem, Risk } from "../model";

/** A claim copied from a public page. `id` is its register id in the research doc. */
export function captured(
  id: string,
  brand: Brand,
  value: string,
  quote: string,
  sourceUrl: string,
  markers: string[],
  spoken?: string,
): Claim {
  return { brand, value, quote, sourceUrl, siteFactId: id, spoken: spoken ?? quote, markers };
}

/** No site answers this topic. Lightline proposes the wording; Amy decides. */
export function proposed(value: string, spoken: string, markers: string[] = []): Claim {
  return {
    brand: "policy",
    value,
    quote: "Proposed by Lightline; not on the site.",
    sourceUrl: null,
    siteFactId: null,
    spoken,
    markers,
  };
}

export function pendingItem(def: {
  key: string;
  title: string;
  kind?: ItemKind;
  risk: Risk;
  topics: string[];
  callerQuestion: string;
  claims: Claim[];
  suggestedText?: string;
}): KnowledgeItem {
  return {
    kind: "fact",
    suggestedText: null,
    status: "pending",
    approvedText: null,
    approvedValue: null,
    decidedBy: null,
    decidedAt: null,
    ...def,
  };
}

/** Marker sets reused by both tenants. Case-insensitive regex sources. */
export const MONEY = [
  "\\$\\s?\\d",
  "\\b\\d{1,3},\\d{3}\\b",
  "\\b(six|eight|ten|twelve|fifteen|eighteen|twenty[- ]?five|thirty[- ]?five|fifty|sixty) thousand\\b",
  "a few thousand",
];
export const DURATION = [
  "\\b(\\d+|one|two|three) ?(to|-|–) ?(\\d+|three|four|five|six|seven|ten) (days|weeks)\\b",
];
export const ONE_BUSINESS_DAY = ["one business day", "within (a|one|1) (business )?day", "24 hours"];
export const RELATIONSHIP = [
  "sister compan(y|ies)",
  "same (company|companies|owner|owners|people|team)",
  "(owns|runs) (both|all)",
];
```

### 5.3 Sublime Patio (proposed `lib/knowledge/tenants/sublime-patio.ts`)

```ts
import type { KnowledgeItem } from "../model";
import { DURATION, MONEY, ONE_BUSINESS_DAY, RELATIONSHIP, captured, pendingItem, proposed } from "./capture";

/**
 * Sublime Patio's knowledge items, from sublimepatio.com as captured on
 * 2026-10-22 (12 sitemap pages; register SP01–SP66 in
 * docs/research/sublime-fridge-knowledge.md). All items start pending.
 */

const SP = "https://sublimepatio.com";
const HOME = `${SP}/`;
const ABOUT = `${SP}/about-us/`;
const CONTACT = `${SP}/contact-us/`;
const KITCHENS = `${SP}/outdoor-kitchens/`;
const PERGOLAS = `${SP}/pergolas-covered-patios/`;
const STONE = `${SP}/stone-gravel-pathways/`;
const PATIOS = `${SP}/patios-masonry-decking/`;
const LIGHTING = `${SP}/landscape-patio-lighting/`;
const LOUVERED = `${SP}/louvered-shade-systems/`;
const LANDSCAPING = `${SP}/landscaping/`;
const TURF = `${SP}/artificial-turf-golf-greens/`;

const AREA_EXTRA_CITIES = [
  "\\bleander\\b",
  "\\bwestlake\\b",
  "\\brollingwood\\b",
  "\\bspicewood\\b",
  "\\bbuda\\b",
  "\\bkyle\\b",
  "\\bbastrop\\b",
  "\\bjonestown\\b",
];

export const SUBLIME_KNOWLEDGE: KnowledgeItem[] = [
  pendingItem({
    key: "sp.services",
    title: "What Sublime builds",
    risk: "low",
    topics: ["services", "what do you do", "kitchen", "pergola", "patio", "deck", "turf", "putting green", "louvered", "landscaping"],
    callerQuestion: "What kind of work do you guys do?",
    claims: [
      captured("SP26", "sp", "8 outdoor-living services", "Outdoor Kitchens · Pergolas & Covered Patios · Stone & Gravel Pathways · Patios, Masonry & Decking · Landscape & Patio Lighting · Louvered Shade Systems · Landscaping · Artificial Turf & Golf Greens", HOME, []),
      captured("SP28", "sp", "8 outdoor-living services", "Every single project we take on is fully custom-built.", HOME, []),
    ],
    suggestedText:
      "Sublime Patio designs and builds outdoor living spaces: outdoor kitchens, pergolas and covered patios, patios, masonry and decks, stone and gravel paths, landscape lighting, louvered shade systems, landscaping, and artificial turf and putting greens. Every project is custom.",
  }),
  pendingItem({
    key: "sp.service_area",
    title: "Service area",
    kind: "service_area",
    risk: "high",
    topics: ["service area", "come out", "serve", "area", "location", "far"],
    callerQuestion: "Do you guys do projects out in Dripping Springs?",
    claims: [
      captured("SP61", "sp", "15 cities (Contact page)", "Austin · Round Rock · Pflugerville · Georgetown · Leander · Westlake Hills · Lakeway · Bee Cave · Rollingwood · Spicewood · Cedar Park · Buda · Kyle · Bastrop · Jonestown", CONTACT, AREA_EXTRA_CITIES),
      captured("SP62", "sp", "Austin, Round Rock, Cedar Park, Georgetown + Central Texas", "We serve homeowners across Austin, Round Rock, Cedar Park, Georgetown, and the broader Central Texas region.", ABOUT, ["central texas"]),
      captured("SP63", "sp", "7 cities + 'we likely do'", "Not sure if we cover your area? Give us a call — we likely do.", ABOUT, ["we (likely|probably) (do|serve|cover)", "\\blakeway\\b", "bee cave"]),
      captured("SP64", "sp", "Austin, Round Rock, Cedar Park, Georgetown + surrounding", "Serving Austin, Round Rock, Cedar Park, Georgetown & surrounding areas", KITCHENS, ["surrounding areas"]),
      captured("SP65", "sp", "Austin + Texas Hill Country (turf)", "homeowners across Austin and the Texas Hill Country", TURF, ["hill country"]),
    ],
  }),
  pendingItem({
    key: "sp.years_in_business",
    title: "Business history",
    risk: "high",
    topics: ["how long", "years", "experience", "in business", "history", "founded"],
    callerQuestion: "How long has Sublime been around?",
    claims: [
      captured("SP13", "sp", "since 2002", "Austin’s trusted outdoor living contractor since 2002.", HOME, ["\\b2002\\b", "two thousand (and )?two"]),
      captured("SP14", "sp", "20+ years", "20+ Years Experience", HOME, ["\\b(20|twenty)\\+? years\\b", "over (20|twenty) years"]),
      captured("SP15", "sp", "23+ years (counter)", "Years in Business 23+", HOME, ["\\b(23|twenty[- ]three)\\+? years\\b"]),
      captured("SP16", "sp", "over 15 years", "for over 15 years", ABOUT, ["\\b(15|fifteen) years\\b"]),
    ],
  }),
  pendingItem({
    key: "sp.founder",
    title: "Owner and founder (and whether to name him)",
    risk: "high",
    topics: ["owner", "founder", "josh", "joshua", "bailey", "who runs", "speak to"],
    callerQuestion: "Is Josh the owner? Can I talk to him?",
    claims: [
      captured("SP12", "sp", "founded by Joshua Bailey", "Sublime Patio & Outdoor Living was founded in 2002 by Joshua Bailey.", HOME, ["joshua bailey", "\\bbailey\\b", "founded (it|the company)"]),
      captured("SP18", "sp", "founded by Joshua Bailey", "His extensive experience in the industry, including landscaping, patio design, deck construction & outdoor lighting", HOME, []),
    ],
  }),
  pendingItem({
    key: "sp.licensing_insurance",
    title: "Licensing and insurance",
    risk: "high",
    topics: ["licensed", "license", "insured", "insurance", "bonded", "electrician"],
    callerQuestion: "Are you licensed and insured?",
    claims: [
      captured("SP24", "sp", "licensed and insured; scope unstated", "Sublime Patio is a fully licensed and insured outdoor living contractor.", HOME, ["\\blicensed\\b", "\\binsured\\b"]),
      captured("SP25", "sp", "licensed and insured; scope unstated", "A licensed electrician handles all wiring", PERGOLAS, ["licensed electrician"]),
    ],
  }),
  pendingItem({
    key: "sp.free_estimate",
    title: "Free estimates and consultations",
    risk: "high",
    topics: ["estimate", "consultation", "free", "come look", "site visit", "quote"],
    callerQuestion: "Is the estimate free?",
    claims: [
      captured("SP53", "sp", "free on-site estimate, no obligation", "Free Estimates Available", HOME, ["free (estimate|consultation|quote|design consultation)s?", "estimates? (is|are) free", "no[- ]obligation", "complimentary"]),
      captured("SP53", "sp", "free on-site estimate, no obligation", "complimentary on-site design consultations for all prospective clients", ABOUT, ["complimentary"]),
    ],
  }),
  pendingItem({
    key: "sp.quote_process",
    title: "How pricing works",
    kind: "policy",
    risk: "low",
    topics: ["price", "cost", "how much", "quote", "estimate", "ballpark"],
    callerQuestion: "Roughly how much would a covered patio run?",
    claims: [
      captured("SP49", "sp", "every project priced individually", "Every patio and masonry project is priced individually", PATIOS, []),
      captured("SP49", "sp", "every project priced individually", "Every flagstone walkway Austin project is priced individually", STONE, []),
    ],
    suggestedText:
      "Every project is priced individually, so the team needs to learn about your property and what you'd like built before giving a number. I can have them call you to set that up.",
  }),
  pendingItem({
    key: "sp.price_ranges",
    title: "Published price ranges and resale claims",
    risk: "high",
    topics: ["price", "cost", "how much", "range", "budget", "resale", "value", "worth it"],
    callerQuestion: "What's a typical outdoor kitchen cost with you?",
    claims: [
      // One shared value: the pages do not disagree, they publish figures Amy has not approved.
      captured("SP47", "sp", "published price figures", "typically range from $10,000 to $60,000+", KITCHENS, MONEY),
      captured("SP48", "sp", "published price figures", "typically costs between $6,000 and $35,000", PERGOLAS, MONEY),
      captured("SP49", "sp", "published price figures", "range from a few thousand dollars for smaller paver installations", PATIOS, MONEY),
      captured("SP50", "sp", "published price figures", "increase a home’s resale value by $15,000–$50,000 or more", KITCHENS, [...MONEY, "resale value", "\\bROI\\b"]),
      captured("SP51", "sp", "published price figures", "Transparent pricing no hidden costs", HOME, ["hidden (costs|fees)", "transparent pricing"]),
    ],
    // Recommendation for Amy: reject. The agent never states a range (docs/amy-open-questions.md Q8).
  }),
  pendingItem({
    key: "sp.financing",
    title: "Financing",
    risk: "high",
    topics: ["financing", "finance", "payment plan", "monthly", "loan", "pay over time"],
    callerQuestion: "Do you offer financing?",
    claims: [
      captured("SP54", "sp", "financing discussed at consultation", "we can discuss financing options during your free consultation", KITCHENS, ["financ(e|ing)", "payment plans?", "pay (it )?over time"]),
    ],
  }),
  pendingItem({
    key: "sp.warranty",
    title: "Warranties and guarantees",
    risk: "high",
    topics: ["warranty", "guarantee", "covered", "if it breaks", "workmanship"],
    callerQuestion: "What kind of warranty comes with a louvered roof?",
    claims: [
      captured("SP55", "sp", "warranty or guarantee claimed; terms unpublished", "backed by manufacturer warranties, and our installation work is covered by our own workmanship guarantee", LOUVERED, ["warrant(y|ies|ied)", "workmanship", "guarantee"]),
      captured("SP56", "sp", "warranty or guarantee claimed; terms unpublished", "backed by a manufacturer’s product warranty covering material defects, along with our own workmanship guarantee", TURF, ["warrant(y|ies|ied)", "workmanship", "guarantee"]),
      captured("SP57", "sp", "warranty or guarantee claimed; terms unpublished", "Ask your design consultant about specific plant warranty or replacement terms", LANDSCAPING, ["plant (warranty|replacement)"]),
      captured("SP22", "sp", "warranty or guarantee claimed; terms unpublished", "Quality Guaranteed", HOME, ["quality guaranteed", "satisfaction", "stand behind"]),
    ],
  }),
  pendingItem({
    key: "sp.project_duration",
    title: "How long a build takes (and how soon it can start)",
    risk: "high",
    topics: ["how long", "timeline", "weeks", "days", "start", "schedule", "backlog", "how soon"],
    callerQuestion: "How long would a pergola take, and when could you start?",
    claims: [
      captured("SP58", "sp", "per-service build durations (site FAQs)", "between 2 and 6 weeks from build start", KITCHENS, DURATION),
      captured("SP58", "sp", "per-service build durations (site FAQs)", "between 1 and 4 weeks", PERGOLAS, DURATION),
      captured("SP58", "sp", "per-service build durations (site FAQs)", "Most louvered shade system installations take 3 to 7 days", LOUVERED, DURATION),
      captured("SP58", "sp", "per-service build durations (site FAQs)", "Most residential installations are completed within 2 to 5 days", TURF, DURATION),
    ],
  }),
  pendingItem({
    key: "sp.process",
    title: "How a project works",
    risk: "low",
    topics: ["process", "how does it work", "steps", "design", "first step", "what happens next"],
    callerQuestion: "What's the process if I want to get started?",
    claims: [
      captured("SP59", "sp", "consultation, design, permits, build, walkthrough", "Free Consultation → Custom Design → Planning & Permits → Expert Construction → Final Walkthrough", ABOUT, []),
      captured("SP60", "sp", "consultation, design, permits, build, walkthrough", "We visit your property, listen carefully, and assess the space with expert eyes.", ABOUT, []),
    ],
    // Suggested text deliberately omits "free", "3D" and permits; those stay with their own high-risk items.
    suggestedText:
      "It starts with a visit to your property to see the space and hear what you want. The team then designs it, plans the build, builds it, and walks the finished space with you.",
  }),
  pendingItem({
    key: "sp.design_renderings",
    title: "3D designs before the build",
    risk: "high",
    topics: ["3d", "rendering", "drawing", "design", "see it first", "plans"],
    callerQuestion: "Will I get to see a 3D drawing before you build it?",
    claims: [
      captured("SP29", "sp", "in-house 3D plans and renderings", "Our in-house design team creates detailed 3D renderings", ABOUT, ["\\b3[- ]?d\\b", "render(ing|ings)"]),
      captured("SP29", "sp", "in-house 3D plans and renderings", "Our team creates detailed 3D plans and material selections", ABOUT, ["\\b3[- ]?d\\b"]),
    ],
  }),
  pendingItem({
    key: "sp.permits_hoa",
    title: "Permits and HOA approval",
    risk: "high",
    topics: ["permit", "city", "hoa", "inspection", "approval", "engineering"],
    callerQuestion: "Do you handle the permit and my HOA?",
    claims: [
      captured("SP30", "sp", "handles permits, inspections and approvals", "All permits pulled and inspections handled", PERGOLAS, ["permits? (pulled|handled)", "we (pull|handle) (the |all )?permits?"]),
      captured("SP31", "sp", "handles permits, inspections and approvals", "Sublime Patio handles the structural planning and necessary engineering blueprints", PATIOS, ["\\bhoa\\b", "engineering blueprints"]),
    ],
  }),
  pendingItem({
    key: "sp.response_time",
    title: "How fast the team calls back",
    risk: "high",
    topics: ["call back", "hear back", "how soon", "respond", "when will"],
    callerQuestion: "When will someone call me back?",
    claims: [
      captured("SP07", "sp", "within one business day", "Josh or a member of the Sublime team will reach out within one business day to schedule your on-site consultation.", HOME, ONE_BUSINESS_DAY),
      captured("SP06", "sp", "within one business day", "We respond within one business day", CONTACT, ONE_BUSINESS_DAY),
    ],
  }),
  pendingItem({
    key: "sp.texting",
    title: "Can callers text this number",
    risk: "high",
    topics: ["text", "sms", "send photos", "message"],
    callerQuestion: "Can I just text you some pictures of my backyard?",
    claims: [captured("SP04", "sp", "call or text the shared line", "Call or Text (512) 339-9313 Fastest way to reach us", CONTACT, ["call or text", "text (us|me|this number|it)", "(send|shoot) (us|me) a text"])],
  }),
  pendingItem({
    key: "sp.contact_email",
    title: "Email address to give callers",
    risk: "high",
    topics: ["email", "e-mail", "send photos", "send plans"],
    callerQuestion: "What email can I send my HOA plans to?",
    claims: [captured("SP05", "sp", "sublimepatio@gmail.com", "sublimepatio@gmail.com", CONTACT, ["sublimepatio@gmail", "sublime ?patio at gmail"])],
  }),
  pendingItem({
    key: "sp.address",
    title: "Address (shared PO Box)",
    risk: "high",
    topics: ["address", "located", "office", "showroom", "where are you", "come by"],
    callerQuestion: "What's your mailing address?",
    claims: [captured("SP08", "sp", "PO Box 90305, Austin 78709 (shared with CLG/TLG)", "PO Box 90305 Austin, Texas 78709", CONTACT, ["\\bp\\.?\\s?o\\.? box\\b", "90305"])],
  }),
  pendingItem({
    key: "sp.site_visits",
    title: "Meetings happen at the property",
    risk: "low",
    topics: ["showroom", "office", "come by", "visit you", "meet", "stop in"],
    callerQuestion: "Do you have a showroom I can visit?",
    claims: [captured("SP09", "sp", "by appointment at the customer's property", "By appointment we come to you", CONTACT, [])],
    suggestedText: "We meet you at your property, by appointment.",
  }),
  pendingItem({
    key: "sp.holiday_lighting",
    title: "Holiday lighting (Sublime vs The Christmas Light Guys)",
    risk: "high",
    topics: ["christmas", "holiday", "seasonal", "string lights", "event lights"],
    callerQuestion: "Can you put up Christmas lights when you do my patio lighting?",
    claims: [
      captured("SP40", "sp", "Sublime: yes, seasonal accent lighting", "many of our clients pair their permanent architectural lighting system with seasonal accent lighting for holidays or special events", LIGHTING, ["holiday lighting", "seasonal (accent )?light(ing|s)", "christmas lights?"]),
      captured("F12", "clg", "CLG: Christmas light installation", "Our professional Christmas light installation and decorating service", "https://thechristmaslightguys.com/", []),
    ],
  }),
  pendingItem({
    key: "sp.landscape_lighting_routing",
    title: "Landscape lighting (Sublime vs The Light Guys)",
    risk: "high",
    topics: ["landscape lighting", "patio lighting", "uplighting", "path lights", "outdoor lights"],
    callerQuestion: "I want lights along my walkway and up into the oak trees. Is that you?",
    claims: [
      captured("SP38", "sp", "Sublime: low-voltage landscape lighting", "custom, low-voltage architectural LED installations", LIGHTING, []),
      captured("F47", "tlg", "The Light Guys: landscape lighting", "BISTRO POOL AND LANDSCAPE LIGHTING", "https://thelightguysaustintx.com/landscape-lighting/", []),
    ],
  }),
  pendingItem({
    key: "sp.maintenance",
    title: "Ongoing maintenance",
    risk: "low",
    topics: ["maintenance", "mow", "upkeep", "lawn care", "ongoing"],
    callerQuestion: "Do you do ongoing yard maintenance after?",
    claims: [captured("SP44", "sp", "design and installation focus; no ongoing maintenance", "Our primary focus is design and installation", LANDSCAPING, [])],
    suggestedText: "Our focus is design and installation. For ongoing yard maintenance, most clients use a local maintenance company.",
  }),
  pendingItem({
    key: "sp.residential_commercial",
    title: "Homes only, or commercial too",
    risk: "high",
    topics: ["commercial", "business", "restaurant", "hoa common area", "builder", "apartment"],
    callerQuestion: "Do you do commercial patios, like for a restaurant?",
    claims: [captured("SP27", "sp", "homeowners (no commercial claim)", "Trusted By Austin Homeowners", HOME, [])],
  }),
  pendingItem({
    key: "sp.product_brands",
    title: "Product brands",
    risk: "high",
    topics: ["brand", "trex", "timbertech", "manufacturer", "what kind of", "louver brand", "turf brand"],
    callerQuestion: "Do you install Trex decking?",
    claims: [captured("SP37", "sp", "Trex/TimberTech named as examples only", "Composite decking (like Trex or TimberTech)", PATIOS, ["\\btrex\\b", "timber ?tech", "(authorized|certified) (dealer|installer)"])],
  }),
  pendingItem({
    key: "sp.reputation",
    title: "Reviews, volume and superlatives",
    risk: "high",
    topics: ["reviews", "rating", "references", "how many", "best", "trusted"],
    callerQuestion: "How many of these have you done? Do you have reviews?",
    claims: [
      captured("SP19", "sp", "published reputation claims", "500+ Happy Clients", HOME, ["\\b500\\b", "five hundred", "hundreds of"]),
      captured("SP20", "sp", "published reputation claims", "5-Star Reviews", HOME, ["\\b(5|five)[- ]star\\b"]),
      captured("SP21", "sp", "published reputation claims", "the region’s most trusted outdoor living specialist", ABOUT, ["most trusted", "\\bpremier\\b", "\\bbest in\\b"]),
      captured("SP23", "sp", "published reputation claims", "I have been very impressed with Sublime Patio from the initial meeting with Josh.", HOME, ["\\bkaren\\b", "\\bandy\\b", "\\bjuan\\b"]),
    ],
  }),
  pendingItem({
    key: "sp.product_performance",
    title: "Product performance numbers",
    risk: "high",
    topics: ["wind", "waterproof", "how long does it last", "lifespan", "energy", "safe", "pets", "kids", "drain"],
    callerQuestion: "Will a louvered roof hold up in a big storm?",
    claims: [
      captured("SP42", "sp", "published performance figures", "wind loads up to 110+ mph", LOUVERED, ["\\b110\\b", "\\bmph\\b", "waterproof"]),
      captured("SP39", "sp", "published performance figures", "consume up to 80% less energy than old halogen bulbs", LIGHTING, ["\\b80 ?%", "\\b(40|50),?000 hours", "zero risk", "18 years"]),
      captured("SP46", "sp", "published performance figures", "last 15 to 20+ years", TURF, ["(15|fifteen) to (20|twenty)", "inches per hour", "non-?toxic", "lead[- ]free|free of lead"]),
    ],
  }),
  pendingItem({
    key: "sp.office_hours",
    title: "Office hours",
    risk: "high",
    topics: ["hours", "open", "closed", "what time", "weekend", "saturday"],
    callerQuestion: "What are your hours?",
    claims: [],
  }),
  pendingItem({
    key: "sp.sister_brands",
    title: "Relationship to the other companies on this line",
    risk: "high",
    topics: ["light guys", "christmas light guys", "the fridge", "same company", "related", "sister"],
    callerQuestion: "Wait, is this the same company as The Light Guys?",
    claims: [proposed("no site states a relationship", "Sublime Patio is part of the same family of companies as The Light Guys.", RELATIONSHIP)],
  }),
];
```

### 5.4 The Fridge (proposed `lib/knowledge/tenants/the-fridge.ts`)

```ts
import type { KnowledgeItem } from "../model";
import { ONE_BUSINESS_DAY, RELATIONSHIP, captured, pendingItem, proposed } from "./capture";

/**
 * The Fridge Vending's knowledge items, from thefridgevending.com as captured
 * on 2026-10-22 (one-page React site; register TF01–TF25 in
 * docs/research/sublime-fridge-knowledge.md). All items start pending.
 */

const TF = "https://thefridgevending.com/";

export const FRIDGE_KNOWLEDGE: KnowledgeItem[] = [
  pendingItem({
    key: "tf.what_we_do",
    title: "What The Fridge is",
    risk: "low",
    topics: ["what is", "what do you do", "vending", "machine", "fridge", "smart"],
    callerQuestion: "What exactly is The Fridge?",
    claims: [
      captured("TF06", "tf", "smart vending machines in local businesses", "The Fridge uses modern smart-vending technology", TF, ["\\bai\\b", "a\\.i\\.", "artificial intelligence"]),
      captured("TF11", "tf", "smart vending machines in local businesses", "Ideal for repair shops, tire shops, service centers, and dealerships with waiting rooms.", TF, []),
    ],
    // Omits "AI" and "free"; both stay forbidden until Amy approves them.
    suggestedText:
      "The Fridge places smart vending machines in local businesses, like auto shop waiting rooms, apartment communities and employee break rooms, stocked around what the people there want.",
  }),
  pendingItem({
    key: "tf.placement_cost",
    title: "Cost to host a machine",
    risk: "high",
    topics: ["cost", "free", "how much", "price", "charge", "fee", "pay"],
    callerQuestion: "Does it cost me anything to have one?",
    claims: [
      captured("TF07", "tf", "free to host, $0", "The machine is placed at no charge", TF, ["free placement", "no (cost|charge)", "\\$0\\b", "zero (dollars|cost)", "costs? (you )?nothing", "free of charge", "(placement|install(ation)?|delivery) is free"]),
    ],
  }),
  pendingItem({
    key: "tf.contract_terms",
    title: "Contract, obligation and removal",
    risk: "high",
    topics: ["contract", "obligation", "commitment", "cancel", "remove", "sign", "term"],
    callerQuestion: "Do I have to sign a contract?",
    claims: [captured("TF09", "tf", "no obligation", "Free placement · No obligation · We reply within one business day.", TF, ["no[- ]obligation", "no contract", "cancel any ?time"])],
  }),
  pendingItem({
    key: "tf.host_workload",
    title: "Who delivers, stocks and services the machine",
    risk: "high",
    topics: ["restock", "who stocks", "maintain", "service", "install", "delivery", "work for us"],
    callerQuestion: "Who keeps it stocked? Do my people have to do anything?",
    claims: [
      captured("TF08", "tf", "delivered, installed, stocked and serviced by The Fridge", "Delivered, installed, stocked & serviced.", TF, ["stocked (and|&) serviced", "we (stock|restock|service|maintain)", "no (extra )?work"]),
      captured("TF08", "tf", "delivered, installed, stocked and serviced by The Fridge", "Bring a modern convenience amenity into your space without buying or maintaining a machine.", TF, ["without (buying|maintaining)"]),
    ],
  }),
  pendingItem({
    key: "tf.location_fit",
    title: "Which locations it is for",
    risk: "low",
    topics: ["auto shop", "tire shop", "dealership", "apartment", "office", "break room", "gym", "my business", "good fit"],
    callerQuestion: "Would this work in my tire shop?",
    claims: [
      captured("TF12", "tf", "auto/tire shops, dealerships, apartments, offices, gyms, high-traffic", "Auto repair shop · Tire shop / service center · Car dealership · Apartment community · Office / employee break room · Gym / fitness center · Other high-traffic location", TF, []),
      captured("TF11", "tf", "auto/tire shops, dealerships, apartments, offices, gyms, high-traffic", "Break rooms · Warehouses & shops · Offices & studios · High-traffic staff areas", TF, []),
    ],
    suggestedText:
      "The Fridge is designed for auto repair and tire shops, dealerships, apartment communities, offices and break rooms, gyms, and other busy locations. The team can tell you whether your space is a good fit.",
  }),
  pendingItem({
    key: "tf.products",
    title: "What goes in the machine",
    risk: "low",
    topics: ["stock", "products", "snacks", "drinks", "lunch", "healthy", "energy drinks", "toys"],
    callerQuestion: "What kind of stuff do you put in it?",
    claims: [
      captured("TF13", "tf", "drinks, snacks, protein, lunch items, candy, kids' toys and puzzles", "Energy drinks, bottled water, sparkling water, sodas, teas, juices, and sports drinks", TF, []),
      captured("TF15", "tf", "drinks, snacks, protein, lunch items, candy, kids' toys and puzzles", "The selection is built around your space", TF, []),
    ],
    suggestedText:
      "It can carry cold drinks and energy drinks, healthy snacks, protein bars, lunch items like sandwiches and salads, chips and candy, and small toys and puzzles for kids. The mix is built around your location.",
  }),
  pendingItem({
    key: "tf.custom_requests",
    title: "Stocking special requests",
    risk: "high",
    topics: ["can you stock", "special request", "my brand", "specific item", "change the mix"],
    callerQuestion: "Can you stock a specific energy drink my guys like?",
    claims: [
      captured("TF14", "tf", "stocks whatever the location wants", "If your people want it, we can stock it.", TF, ["we can stock (it|that|anything)", "anything (you|they) want", "adjust(ed)? any ?time"]),
      captured("TF15", "tf", "stocks whatever the location wants", "100% Customized to you", TF, ["100 ?%|one hundred percent", "fully customi[sz]ed"]),
    ],
  }),
  pendingItem({
    key: "tf.service_area",
    title: "Where The Fridge places machines",
    kind: "service_area",
    risk: "high",
    topics: ["area", "where", "serve", "location", "city", "how far"],
    callerQuestion: "Do you place machines in San Marcos?",
    claims: [captured("TF21", "tf", "'local businesses' (no area stated)", "AI smart vending machines placed in local businesses at no charge", TF, ["\\baustin\\b", "central texas", "round rock"])],
  }),
  pendingItem({
    key: "tf.phone_number",
    title: "Phone number for The Fridge",
    risk: "high",
    topics: ["phone", "number", "call", "reach"],
    callerQuestion: "What's the best number to reach The Fridge?",
    claims: [
      captured("TF02", "tf", "512-923-9313", "512-923-9313", TF, ["923[- .]?9313", "nine two three"]),
      captured("SP03", "sp", "512-339-9313 (shared line)", "(512) 339-9313 - Free Estimates Available", "https://sublimepatio.com/", ["339[- .]?9313", "three three nine"]),
    ],
  }),
  pendingItem({
    key: "tf.contact_person",
    title: "Contact person (and whether to name him)",
    risk: "high",
    topics: ["owner", "president", "joshua", "josh", "bailey", "who do i talk to", "manager"],
    callerQuestion: "Is Joshua there? The website says to call him.",
    claims: [captured("TF03", "tf", "Joshua Bailey, President", "Call Joshua Bailey, President", TF, ["joshua bailey", "\\bbailey\\b", "\\bpresident\\b"])],
  }),
  pendingItem({
    key: "tf.contact_email",
    title: "Email address to give callers",
    risk: "high",
    topics: ["email", "e-mail", "write", "send"],
    callerQuestion: "Can I email you the details instead?",
    claims: [captured("TF04", "tf", "hello@thefridgevending.com (hidden mailto target)", "hello@thefridgevending.com", TF, ["hello@thefridgevending", "hello at the ?fridge ?vending"])],
  }),
  pendingItem({
    key: "tf.response_time",
    title: "How fast the team replies",
    risk: "high",
    topics: ["call back", "hear back", "respond", "how soon", "when"],
    callerQuestion: "How soon will someone get back to me?",
    claims: [captured("TF10", "tf", "within one business day", "We reply within one business day.", TF, ONE_BUSINESS_DAY)],
  }),
  pendingItem({
    key: "tf.machine_hours",
    title: "When the machine can be used",
    risk: "high",
    topics: ["24/7", "always open", "after hours", "night", "weekend", "anytime"],
    callerQuestion: "Can my tenants use it at night?",
    claims: [captured("TF16", "tf", "open 24/7", "24/7 Always open", TF, ["24 ?/ ?7", "twenty[- ]four seven", "always open", "around the clock"])],
  }),
  pendingItem({
    key: "tf.payment",
    title: "How people pay at the machine",
    risk: "high",
    topics: ["pay", "card", "cash", "coins", "apple pay", "checkout", "tap"],
    callerQuestion: "Does it take cash, or just cards?",
    claims: [
      captured("TF17", "tf", "tap checkout, no coins", "Tap. Grab. Gone in sixty seconds.", TF, ["(60|sixty) seconds", "tap (to|and) (pay|go|open)"]),
      captured("TF18", "tf", "tap checkout, no coins", "No clunky old machine, no attendant, no coins.", TF, ["no coins", "no cash", "cards? only"]),
    ],
  }),
  pendingItem({
    key: "tf.machine_issue",
    title: "A machine is down, empty or not cooling",
    kind: "policy",
    risk: "low",
    topics: ["broken", "not working", "empty", "out of", "restock", "not cold", "screen", "door", "error"],
    callerQuestion: "The machine in our break room isn't cold. Who fixes that?",
    claims: [proposed("take the details; the team follows up", "I'm sorry about that. Let me take down where the machine is and what's happening, and I'll pass it to the team.")],
    suggestedText:
      "I'm sorry about that. Let me take down where the machine is and what's happening, and I'll pass it to the team.",
  }),
  pendingItem({
    key: "tf.refunds",
    title: "Charged but nothing came out",
    kind: "policy",
    risk: "high",
    topics: ["refund", "charged", "took my money", "didn't open", "double charged", "money back"],
    callerQuestion: "It charged my card and the door never opened. Can I get my money back?",
    // The wording avoids "refund" on purpose: an approved text unblocks every marker it contains.
    claims: [proposed("agent never promises a refund", "I can't fix a charge myself, but I'll take the details so the team can look into it.", ["refund(ed)?", "money back", "credit (your|the) card", "reimburse"])],
    suggestedText: "I can't fix a charge myself, but I'll take the details so the team can look into it.",
  }),
  pendingItem({
    key: "tf.host_revenue",
    title: "What the host earns (commission, revenue share)",
    kind: "policy",
    risk: "high",
    topics: ["commission", "revenue", "profit", "cut", "split", "what do i get", "percentage"],
    callerQuestion: "Do I get a cut of the sales?",
    claims: [proposed("not on the site; never discussed by the agent", "The team will go over how it works for your location when they call you back.", ["commission", "revenue[- ]share", "\\bprofit\\b", "\\bsplit\\b", "percent(age)?", "\\bcut\\b of"])],
    suggestedText: "The team will go over how it works for your location when they call you back.",
  }),
  pendingItem({
    key: "tf.placement_process",
    title: "How a placement works",
    risk: "low",
    topics: ["process", "how does it work", "next steps", "get started", "sign up"],
    callerQuestion: "What happens if I want one?",
    claims: [captured("TF19", "tf", "learn the location, build the mix, place the machine", "Tell us about your location → We customize the product mix → The machine is placed at no charge → People grab what they want", TF, [])],
    // Omits "no charge"; that stays with tf.placement_cost.
    suggestedText:
      "It starts with a conversation about your location: your customers, your staff and how busy it gets. The team then builds a product mix for your space and arranges the placement.",
  }),
  pendingItem({
    key: "tf.track_record",
    title: "Existing placements and experience",
    risk: "high",
    topics: ["how many", "where else", "references", "how long", "experience", "new company"],
    callerQuestion: "Where else do you have these machines?",
    claims: [captured("TF20", "tf", "a live placement exists (photo caption)", "An employee break room, stocked and ready.", TF, ["live placement", "(already|currently) (in|at) \\d+", "(machines|locations) (around|across|all over)"])],
  }),
  pendingItem({
    key: "tf.web_form",
    title: "Caller says they already sent the online form",
    kind: "policy",
    risk: "low",
    topics: ["form", "website", "sent a request", "filled out", "already applied"],
    callerQuestion: "I filled out the form on your website last week.",
    claims: [captured("TF24", "tf", "form only opens an email draft", "Your email app should have opened with the details filled in.", TF, [])],
    suggestedText: "Thanks for reaching out. So nothing gets missed, let me take your details again.",
  }),
  pendingItem({
    key: "tf.office_hours",
    title: "Office hours (not machine hours)",
    risk: "high",
    topics: ["hours", "open", "office", "what time", "closed"],
    callerQuestion: "What are your office hours?",
    claims: [],
  }),
  pendingItem({
    key: "tf.sister_brands",
    title: "Relationship to the other companies on this line",
    risk: "high",
    topics: ["sublime", "light guys", "christmas light guys", "same company", "related", "josh"],
    callerQuestion: "Is this the same Josh who did my patio?",
    claims: [proposed("no site states a relationship", "The Fridge is part of the same family of companies as Sublime Patio.", RELATIONSHIP)],
  }),
];
```

Notes on the snippets:

- `proposed()` claims mark topics no site answers. Amy writes the words or rejects them.
- `sp.price_ranges`, `sp.product_performance`, `sp.reputation` and `tf.track_record` have no `suggestedText` on purpose. Recommendation: Amy rejects them, so the agent never voices them.
- Every `suggestedText` avoids every risky marker ("free", "AI", "3D", "no charge", "refund"), so approving it does not unblock a risky claim. Only `sp.site_visits` contains a marker of its own claim ("by appointment" is benign and has no marker).
- Checked 2026-10-22: the four blocks were copied to the scratchpad with `Brand` widened, then type-checked with the project's `tsc --strict --noUncheckedIndexedAccess`: no errors. A smoke script confirmed unique keys and that no `suggestedText` matches any forbidden marker. Result: 50 items (Sublime 28, The Fridge 22); 45 `exact_words`, 5 `conflict` (`sp.service_area`, `sp.years_in_business`, `sp.holiday_lighting`, `sp.landscape_lighting_routing`, `tf.phone_number`).

---

## 6. Questions for Amy

### 6.1 The shared line (answer first)

1. **Which number belongs to The Fridge: 512-923-9313 or 512-339-9313?** Does 923-9313 exist and ring the shared line? Should the site be fixed?
2. **How should the agent greet on the shared line?** One greeting per dialed number, a neutral greeting, or a menu ("1 Christmas lights, 2 Sublime Patio, 3 The Fridge", `bestline-options.md` Q7)?
3. **May the agent say the companies are related?** If yes, in which exact words?
4. **Is Joshua Bailey the owner of all four?** May the agent name him? Should "I want to talk to Josh" become a transfer, a message, or a callback from you?
5. **Who takes landscape-lighting calls:** Sublime or The Light Guys? **Holiday-lighting requests from Sublime customers:** route to The Christmas Light Guys?
6. Office hours for each company. The only published hours are TLG's (Mon–Fri 8–5, JSON-LD).

### 6.2 Sublime Patio

7. Which history wording is right: "since 2002", "20+ years", "23 years" or "over 15 years"? (The domain dates from 2012.)
8. "Licensed and insured": licensed by whom, for what? Is insurance current? Which trades are subcontracted (electric, gas, plumbing)?
9. Exact service area. Is the 15-city Contact list right? Dripping Springs, Lago Vista, Volente (on TLG's list, cut from Sublime's)?
10. Are estimates and design consultations still free and on-site?
11. May the agent say any price, range or minimum? (Recommended: no; "every project is priced individually".)
12. Is financing offered? Through whom?
13. Warranty terms per service, and what the "workmanship guarantee" covers.
14. Can the shared line receive texts and photos?
15. Commercial jobs, builders, HOA common areas: yes or no?
16. Current customers with a project underway: who do they reach, and how fast?
17. Is "Sublime Patio & Landscape" (map embed name) the Google listing name? Should the agent answer to it?

### 6.3 The Fridge

18. Where do you place machines (cities, radius)?
19. What makes a location qualify (foot traffic, headcount, units, power, floor space, indoor only)?
20. Is placement really free with no contract? Any minimum term or removal fee?
21. Does the host earn anything (commission, revenue share)? What may the agent say?
22. Machine down or empty: who handles it, how fast, and is it ever urgent enough to call you right away?
23. Payment methods in the machine, and how refunds work.
24. How many live placements exist today? Is the "Live placement" photo a real install?
25. Is hello@thefridgevending.com read? By whom? (The website form only drafts an email, so web requests may never arrive.)

---

## 7. Caller intents and lead fields

Existing `lead_fact.field` values (`supabase/migrations/0002_agent.sql`): `caller_name`, `customer_type`, `property_type`, `property_address`, `zip`, `service_requested`, `job_type`, `desired_timing`, `callback_window`, `lead_source`, `notes`, `callback_phone`. **New** marks a field that is not in that list; it goes in `notes` until a migration adds it. `lead` has no email column.

### 7.1 Sublime Patio

**Top intents (I, ranked by likely volume):**

| # | Intent | What the agent does |
|---|---|---|
| 1 | New project: wants an estimate or consultation | Full intake (below). Callback only. |
| 2 | "How much does a pergola/kitchen/turf cost?" | `sp.quote_process` words only. Never a number, even though the site has ranges. |
| 3 | "Do you come out to [city]?" | Takes the address and ZIP. No yes or no until `sp.service_area` is approved. |
| 4 | Existing customer: schedule, crew, project status | Message for the team: name, address, project, question, urgency. |
| 5 | Problem with a finished job (louver motor, turf seam, lights out, cracked pavers) | Message: install address, what failed, when built, safety issue? No warranty talk. |
| 6 | Financing question | Holds (`sp.financing`). Notes it for the callback. |
| 7 | Wrong brand: holiday lights, landscape lighting for TLG, "is this Josh?" | Routing per Amy's answer to Q5. |
| 8 | Vendors, subcontractors, job seekers, sales | Short message. Not a lead. |

**Lead fields for a new project:**

| Field | Existing / New | Ask how |
|---|---|---|
| Caller name | `caller_name` | "Who am I speaking with?" |
| Callback phone | `callback_phone` | Confirm the caller-ID number. |
| Best callback time | `callback_window` | "When's a good time for the team to call?" |
| Property address | `property_address` | Needed for the site visit and the area check. |
| ZIP | `zip` | Amy's area rule decides; the agent never refuses. |
| Homeowner, builder, property manager, business | `customer_type` | "Is this your home?" |
| Property type | `property_type` | House, new build, HOA community, commercial site. |
| Service(s) | `service_requested` | One or more of the 8 services, or "multiple". |
| New build or add-on | `job_type` | New space, add to existing patio or pool, replace or repair. |
| Timing | `desired_timing` | "When would you like it done? Any date it needs to be ready by?" |
| How they heard | `lead_source` | Referral, Google, drove past, Light Guys customer. |
| Project description | `notes` | Size, what's there now, HOA, photos or plans available. |
| Email | **New** (`notes` for now) | Only if they offer it or want something sent. |
| Budget band | **New** (`notes` for now) | Only if Amy approves asking. The web form asks with 6 bands (SP52). |
| Brand | **New** if the line maps to one `business_id` | Set from the dialed number or the caller's answer, never guessed. |

### 7.2 The Fridge

**Top intents (I, ranked):**

| # | Intent | Who calls | What the agent does |
|---|---|---|---|
| 1 | **Placement inquiry**: "I want one at my shop/property" | Owner, GM, property or office manager | Full placement intake (below). Callback only. |
| 2 | **Machine issue / restock**: empty, not cooling, screen or door error, needs a refill | Host staff | `tf.machine_issue` words. Takes location, machine spot, problem, since when. Flags leaks or electrical risk. |
| 3 | **Charged, nothing dispensed** | Shopper at a machine | `tf.refunds` words. Takes when, where, what, amount. **Never asks for a card number.** |
| 4 | Product request: "stock X" | Shopper or host | Notes it. No promise (`tf.custom_requests`). |
| 5 | Host change: move, remove, change mix | Host | Message with location and request. |
| 6 | "What do I earn?" / contract questions | Prospect host | Holds (`tf.host_revenue`, `tf.contract_terms`). Notes the question. |
| 7 | Product brands or suppliers pitching, job seekers | Vendors | Short message. Not a lead. |
| 8 | Brand confusion (Sublime customer who knows Josh) | Anyone | Routing per Q3–Q4. |

**Lead fields: placement inquiry**

| Field | Existing / New | Ask how |
|---|---|---|
| Caller name | `caller_name` | — |
| Callback phone | `callback_phone` | — |
| Best callback time | `callback_window` | — |
| Role / decision-maker | `customer_type` | "Are you the owner or manager there?" |
| Location type | `property_type` (values from TF12) | Auto repair shop, tire shop / service center, car dealership, apartment community, office / break room, gym, other. |
| Business or property name | **New** (`notes`) | "What's the business called?" |
| Address | `property_address` + `zip` | Needed for Amy's area check (`tf.service_area` is U). |
| Size of the audience | **New** (`notes`) | Waiting customers per day, number of employees, or number of units. |
| Space and power | **New** (`notes`) | "Is there an outlet near where it would go? Indoors?" |
| Hours the location is open | **New** (`notes`) | Matters because "24/7" depends on the host. |
| Current vending | **New** (`notes`) | "Do you have a vending machine there now?" |
| What people want | `notes` | Drinks, lunch, healthy, kids' items. |
| Timing | `desired_timing` | "When would you want it in?" |
| Service | `service_requested` = "placement" | Fixed value. |
| How they heard | `lead_source` | — |
| Email | **New** (`notes`) | Optional. |

**Fields: machine issue or refund (not a sales lead; route as a message)**

- Caller name, callback phone (existing).
- Business name and address where the machine is (`property_address`; business name **New**).
- Where in the building (break room, lobby).
- What happened: not cooling, empty, error message, door did not open, charged twice.
- When: date and time.
- Item and amount (refunds). Payment type only (card, phone wallet). **No card digits.**
- Safety flag: leaking, sparking, blocking an exit.

### 7.3 Routing on the shared line (I)

- Best: one DID per brand forwarding to the shared line. `call.to_e164` then sets the brand before the first word. The Fridge already advertises its own number (923-9313), if it works.
- Without DIDs: the greeting cannot name four brands well. The agent asks once ("Which company are you calling about?") and stores the answer as the lead's brand.
- Until Amy approves Sublime and Fridge facts, those calls get the message-taking flow from `bestline-options.md`: intake fields only, no facts.

---

## 8. Sources (every URL opened, 2026-10-22)

**sublimepatio.com**
- https://sublimepatio.com/ · /about-us/ · /contact-us/ · /our-work/ · /outdoor-kitchens/ · /pergolas-covered-patios/ · /stone-gravel-pathways/ · /patios-masonry-decking/ · /landscape-patio-lighting/ · /louvered-shade-systems/ · /landscaping/ · /artificial-turf-golf-greens/
- https://sublimepatio.com/robots.txt · /sitemap_index.xml · /page-sitemap.xml
- 404: /faq/ · /testimonials/ · /financing/ · /warranty/ · /service-area/ · /pricing/ · /blog/ · /privacy-policy/

**thefridgevending.com**
- https://thefridgevending.com/ (shell, and one render in the built-in browser) · https://thefridgevending.com/assets/index-DVz8jp7-.js
- http://thefridgevending.com/ (301 to https) · https://www.thefridgevending.com/ (200)
- 404: /robots.txt · /sitemap.xml · /sitemap_index.xml · /about · /contact · /faq · /services · /privacy · /terms · /manifest.json · /site.webmanifest

**Cross-checks**
- https://thelightguysaustintx.com/ · /our-company/ · /landscape-lighting/ · /contact/
- https://thechristmaslightguys.com/about-the-christmas-light-guys.php · /contact-christmas-light-austin.php
- https://maps.google.com/maps?q=Sublime%20Patio%20%26%20Landscape%2C%20Austin&output=embed (the embed refuses to render outside an iframe; no listing details read)
- RDAP: https://rdap.verisign.com/com/v1/domain/thefridgevending.com (registered 2026-06-09) · /sublimepatio.com (registered 2012-05-29)
- DNS: MX thefridgevending.com → Google Workspace (aspmx.l.google.com). Both domains resolve to 192.163.202.86.
