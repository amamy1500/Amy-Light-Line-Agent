# 08 — Client Public-Presence Audits (McMurrough & Associates)

Audit date: 2026-10-20. Method: curl HTML and headers, openssl, nslookup, WebFetch. No browser, no logins.
Labels: **F** = FACT (seen on an opened page or in tool output) · **I** = INFERENCE · **U** = UNKNOWN.

**Coverage gaps (read first)**
- **PageSpeed:** every call returned HTTP 429 ("Queries per day" quota exceeded). Mobile scores are **U**. The proxy metrics below come from curl. They are not Lighthouse scores.
- **GBP / Yelp / BBB / Nextdoor:** the shared web-search budget ran out partway through. No GBP rating or review count could be verified, so all are **U**. A follow-up run is needed. No client site links to any review platform (**F**).

---

## 1. Summary table

| Business | Site | CMS / host | SSL | Mobile perf | GBP rating / reviews | Top leak |
|---|---|---|---|---|---|---|
| McMurrough & Associates | mcmurrough.com | WordPress 5.1 + Divi 2.1.4 on PHP 5.3.29, shared host | Valid (Let's Encrypt, to 2026-11-10) | PSI U. 15 mixed-content (http) assets | U | Site frozen in 2014: dead stats, © 2014, EOL PHP, no analytics |
| Christmas Light Guys | thechristmaslightguys.com | Hand-coded PHP 5.5.38, same server as mcmurrough.com | Valid (to 2027-01-05) | PSI U. **No viewport meta. Flash logo and audio** | U | Not mobile-usable in peak season. No click-to-call. Dead UA analytics |
| The Light Guys | thelightguysaustintx.com | WordPress 7.0.7 + Elementor + Slider Revolution + Rank Math | Valid (to 2027-01-01) | PSI U. 35 scripts, 159 KB HTML, TTFB 1.1 s | U | No tel: links. No quote form on home page. Blog last updated 2025-05 |
| Sublime Patio | sublimepatio.com | WordPress 7.1.3 + Elementor 4.2.3 + Rank Math | Valid (to 2027-01-04) | PSI U. 43 stylesheets, TTFB 1.4 s | U | Zero analytics. "Testimonials" goes nowhere. Social icons have no links |
| The Fridge | thefridgevending.com (I) | Vite/React SPA, GoDaddy DNS | Valid (to 2026-12-29) | PSI U. 1 KB HTML shell, 526 KB JS | U | Page is invisible without JS. Form only opens a mailto: draft. **Phone differs from the shared line** |
| NaturoDoc | naturodoc.com | Squarespace | Valid (to 2026-12-14) | PSI U. 53 scripts, 278 KB HTML | U | Two different phone numbers. Broken newsletter block shows publicly. Compliance-risk claims |
| Barefoot Reggie | barefootreggie.com | HostGator shared IP. Site not served | **Broken: serves a \*.hostgator.com cert (name mismatch)** | n/a (site down) | U | Site is down, and his ReverbNation "website" link now opens a gambling spam site |
| Grubbs Construction | grubbsconstruction.com | GoDaddy (Airo builder, I) + Cloudflare | Valid (Google TS, to 2026-12-20) | PSI U. 30 KB HTML, TTFB 0.3 s | U | No analytics. Facebook/Instagram handles conflict between schema and visible links |
| Bestline Solutions | bestline.net | WordPress 7.1.3 + Divi + Yoast, Bluehost | Valid (to 2027-01-08) | PSI U. 303 KB HTML | U | Old indexed URLs (/about, /business-voice-voip) now return 404 |

**Shared infrastructure (F, from DNS/IP):**
- mcmurrough.com and thechristmaslightguys.com share 65.254.227.240 (NS accountsupport.com).
- thelightguysaustintx.com, sublimepatio.com and thefridgevending.com share 192.163.202.86 (Apache).
- I: McMurrough hosts or manages most client sites. This is a natural place to bundle hosting, maintenance and a care plan.

---

## 2. Per-business detail

### 2.1 McMurrough & Associates — https://www.mcmurrough.com/
- **Sells (F):** web design, mobile web design, social media marketing, PR, a "free marketing plan". Austin-area clients (portfolio is mostly builders and outdoor-living firms).
- **Platform (F):** WordPress 5.1 (emoji script ver=5.1), Divi v2.1.4, `X-Powered-By: PHP/5.3.29`. I: PHP 5.3 reached end of life in 2014. This is a security risk.
- **SSL (F):** wildcard Let's Encrypt, valid. HTTP 302s to HTTPS. 15 logo/favicon/image assets still load over http://.
- **Contact (F):** 512-252-7200 is plain text, not a tel: link. Business email is shown. Divi contact form with a math captcha. No chat or booking.
- **Tracking / schema (F):** none found. No GA4, GTM, pixel or JSON-LD.
- **Content (F):** title is "McMurrough & Associates |" with nothing after the bar. No meta description. Home page says "Mobile traffic projected… by 2015". Footer © 2014. Portfolio images uploaded 2013–2014.
- **Social (F):** no social links on the site. Presence is U.
- **Leaks:** stale proof for an agency that sells web design. No analytics. No click-to-call. Mixed content.
- **Quick wins:**
  1. Replace the home page with a one-page case study of the 2026 Christmas Light Guys pilot.
  2. Upgrade PHP/WordPress or rebuild. Add GA4, a tel: link, a meta description and Organization schema.
  3. Turn the existing footer credits on client sites into a portfolio. Those sites already link back to mcmurrough.com.

### 2.2 The Christmas Light Guys — see §3 for the deep dive
- **Platform (F):** static PHP pages (`X-Powered-By: PHP/5.5.38`). Navigation is GIF image buttons. Logo and an audio player are Flash `.swf` files. There is no `<meta viewport>`.
- **Tracking (F):** `UA-3776149-7` only. I: Universal Analytics stopped processing data in July 2023, so nothing is being measured.
- **Schema / social (F):** none.

### 2.3 The Light Guys — https://thelightguysaustintx.com/
- **Sells (F):**
  - Permanent LED lighting as an "Authorized JellyFish Lighting Dealer".
  - Landscape lighting.
  - Wedding and event lighting (rental and sale).
  - Christmas/holiday lighting.
  - Residential and commercial.
- **Area (F):** Austin, Round Rock, Pflugerville, Georgetown, Leander, Westlake Hills, Lakeway, Bee Cave, Cedar Park, Buda, Kyle, Bastrop, Dripping Springs, plus others.
- **Platform (F):**
  - WordPress 7.0.7 with Elementor, Slider Revolution 6.6.11 and Rank Math.
  - DNS NS cubetech.com.
- **Contact (F):**
  - 512-339-9313 appears 4× on the home page. None of them is a tel: link (0 tel: links across 6 pages).
  - Email is a Gmail address.
  - The site shows a PO Box and a street address in 78734.
  - The contact page has a Contact Form 7 form with reCAPTCHA v3. The home page has only a search form.
- **Tracking (F):** GA4 `G-W55023H4C4` via gtag. No pixel or call tracking.
- **Schema (F):** Rank Math HomeAndConstructionBusiness with 4 Service items, opening hours and area served. This is good.
- **Social (F):** Facebook page "The Light Guys | Austin TX" resolves. Twitter/X is linked. Recency is U.
- **Leaks (F):**
  - Footer still says © 2025.
  - Newest blog post is 2025-05-29.
  - The `?page_id=33` link returns 404.
  - The Christmas page reuses the CLG copy word for word.
  - Experience claims conflict: "20 years" on the Christmas page, "over nine years" on About.
- **Quick wins:**
  1. Add tel: links and a sticky mobile call/text button.
  2. Add a quote form to the home page and the JellyFish page, and fire GA4 conversion events.
  3. Publish a JellyFish "starting at / per linear foot" range. The page asks "What's the cost…" but gives no figure.

### 2.4 Sublime Patio — https://sublimepatio.com/
- **Sells (F):**
  - Outdoor kitchens, pergolas and covered patios.
  - Stone and gravel paths; patios, masonry and decking.
  - Landscape lighting, louvered shade systems, landscaping, artificial turf and golf greens.
  - "Since 2002". Austin.
- **Platform (F):**
  - WordPress 7.1.3, Elementor 4.2.3, Rank Math.
  - DNS at Wix, but the site is hosted on 192.163.202.86.
  - Page schema shows it was published 2026-06-09 and modified 2026-08-25. I: the site was rebuilt recently.
- **Contact (F):**
  - (512) 339-9313 with 2 tel: links.
  - Email is a Gmail address.
  - Elementor "Schedule Estimate" form with name, email, phone, address, project, property and budget fields.
- **Tracking (F):** none. No GA4, GTM, pixel or call tracking.
- **Schema (F):** FAQPage, WebSite and Person. There is no LocalBusiness schema.
- **Leaks (F):**
  - The "Testimonials" menu item links to `#`.
  - The Facebook, X and YouTube icons have no href.
  - Trust bar claims "5-Star Reviews" but there are no reviews or a link to any.
- **Quick wins:**
  1. Install GA4 + GTM and track form submits and tel: clicks.
  2. Build a real Testimonials page from Google reviews and fix or remove the social icons.
  3. Add LocalBusiness/HomeAndConstructionBusiness schema with areaServed.

### 2.5 The Fridge — https://thefridgevending.com/ (I: official site)
- **How found (I):** no search hit. The domain resolves to the same server as Light Guys and Sublime Patio. Its title is "The Fridge Vending — … AI Smart Vending".
- **Sells (F):** AI smart vending machines "placed at no charge". Targets auto repair shops, apartment communities and employee spaces. Offers drinks, snacks, meals and kids' items. Pitch: "Free placement · No obligation · We reply within one business day."
- **Area (F):** no city or service area is stated anywhere in the HTML or JS bundle.
- **Platform (F):** Vite/React SPA. The server HTML is a 1 KB shell with an empty `<div id="root">`. NS domaincontrol.com (GoDaddy).
- **Contact (F, from JS bundle):**
  - Phone **512-923-9313** (tel: link).
  - Email hello@thefridgevending.com.
  - The "Request a Free Placement" form builds a `mailto:` link with subject and body. I: nothing is captured on a server. Visitors without a mail app are lost.
- **Tracking / schema (F):** none.
- **Quick wins:**
  1. Confirm the phone number. The shared office line is 512-**339**-9313 and this site shows 512-**923**-9313.
  2. Replace the mailto: flow with a real form (CRM or email API) and add GA4.
  3. Pre-render or SSR the page, and add LocalBusiness schema plus a service-area line such as "Austin metro".

### 2.6 NaturoDoc — https://naturodoc.com/
- **Sells (F):**
  - Naturopathic tele-consults: "$110.00 per 30 minutes", a free 15-minute first visit, and a $50 cancellation fee.
  - Its own EDTA and sulfur products.
  - A Fullscript dispensary and Cerule products (third-party store links).
- **Area (F):** "Based in Northern Arizona". Telephone and online appointments. Schema address is in Kingman, AZ.
- **Platform (F):** Squarespace (`Server: Squarespace`). NS wso.net.
- **Contact (F):**
  - (775) 277-3773 on the home page and in schema.
  - (877) 867-4743 on the appointments page.
  - Neither is a tel: link.
  - Acuity Scheduling booking link and a Squarespace contact form.
- **Tracking (F):** GA4 `G-DZG8GST1QN` (gtag) and reCAPTCHA.
- **Schema (F):** Organization and LocalBusiness with hours. The WebSite description is empty.
- **Social (F):** Facebook (ThomasLeeND) and Instagram (dr.leenaturodoc) are linked. Recency is U.
- **Compliance flag (F, not evaluated):**
  - Pages list disease-related areas of expertise, including cancer care and "disease mitigator" wording.
  - Pages use "clinically proven" superlatives for a third-party supplement.
  - There is a "Patient Testamonials" page.
  - I: this could be a risk under FTC, FDA or state-board rules. It needs counsel review before any ads run.
- **Leaks (F):**
  - The contact page publicly shows "This newsletter signup form needs a storage option. Edit the block…".
  - Typo "Testamonials".
  - Phone numbers are inconsistent.
- **Quick wins:**
  1. Fix or remove the broken newsletter block.
  2. Use one phone number and make it a tel: link.
  3. Put the "Book Appt." Acuity call to action above the fold and fire a GA4 event when it is clicked.

### 2.7 Barefoot Reggie / Reggie Starrett — barefootreggie.com
- **Sells (F, ReverbNation):** trop-rock singer-songwriter. Home base listed as "Martin, US". Claims 242 shows in 2024. 2026 tour said to start January 5. News4Jax (2024) reports TRMA awards.
- **SSL problem (F):**
  - HTTPS presents a `*.hostgator.com` certificate. curl fails with `SEC_E_WRONG_PRINCIPAL`, so browsers will show a security warning.
  - If the warning is bypassed: 302 to `/404.html` with `X-Robots-Tag: noindex, nofollow`.
  - HTTP shows "Error. Page cannot be displayed. Please contact your service provider".
  - The A record is 192.254.250.169. Google DNS returns no NS records.
  - I: the hosting account is not attached or is suspended, and the domain's DNS delegation may be lapsing.
- **Brand-safety leak (F):** ReverbNation lists his website as phinstothewest.com. That domain now serves a Chinese-language sports-betting page. I: the domain expired and was re-registered.
- **Quick wins:**
  1. Fix the domain at the registrar and hosting. Install a certificate that covers barefootreggie.com and www.
  2. Change the website link on ReverbNation and social profiles away from phinstothewest.com today.
  3. Rebuild a simple tour-dates page with a booking form and Event schema.

### 2.8 Grubbs Construction — https://grubbsconstruction.com/
- **Sells (F):** luxury custom homes in Horseshoe Bay, Lake LBJ, the Highland Lakes and the Hill Country. "Over thirty years". Schema priceRange is `$$$$`.
- **Platform (F):** GoDaddy NS. IP 160.153.0.71. Cloudflare. `x-powered-by: Express`. Asset paths include `/airo-assets/`. I: GoDaddy Airo site builder. Email runs on Google Workspace (MX).
- **Contact (F):** (830) 598-4728 tel: link. /contact has a name/email/phone/message form. Email is obfuscated by Cloudflare. "Consultations by appointment".
- **Tracking (F):** none.
- **Schema (F):** GeneralContractor with geo, areaServed and sameAs. This is strong.
- **Leaks (F):** schema sameAs points to facebook.com/grubbsconstruction and instagram.com/grubbsconstruction. The visible links point to a `profile.php?id=` Facebook page and @grubbsconstruction.tx. I: the profiles are split or duplicated.
- **Quick wins:**
  1. Merge to one Facebook and one Instagram account and align schema sameAs with the visible links.
  2. Add GA4 and a form-submit conversion. High-ticket leads justify call tracking.
  3. Add a short project-inquiry qualifier (lot status, timeline, budget band) to the form.

### 2.9 Bestline Solutions — https://bestline.net/
- **What it is (F):** "BestLine Solutions", an Austin technology partner "since 1983". Services:
  - Managed IT and business VoIP.
  - Analog/POTS line replacement.
  - Low-voltage cabling, internet/Wi-Fi and SD-WAN.
  - Cloud physical security and contact center.
  - "24/7 Emergency Support".
  - LinkedIn slug is "bestline-communications".
- **Contact (F):**
  - (512) 328-9095 and toll-free (800) 365-6030, both tel: links.
  - Consultation form with Cloudflare Turnstile.
  - Business address: N Capital of Texas Hwy, Austin 78746.
- **Platform (F):** WordPress 7.1.3, Divi, Yoast, Site Kit. Bluehost (header decodes to "shared.bluehost.com"). MX is Microsoft 365.
- **Tracking / schema (F):** GTM `GTM-NQZBL6MX`. Service, Offer, ContactPoint and OpeningHours schema.
- **Shared-line vendor (U):** no public page links Bestline to the 512-339-9313 line. Verify with Amy.
- **Leaks (F):** /about and /business-voice-voip return 404, and search engines still show both.
- **Quick wins:**
  1. Add 301 redirects from legacy URLs to the current service pages.
  2. Build a POTS-replacement landing page with a deadline angle.
  3. I: offer referral co-marketing with McMurrough clients who already share a Bestline line.

---

## 3. Christmas Light Guys deep dive (live pilot)

### 3.1 Phone numbers by property

| Property | Number shown | Click-to-call? |
|---|---|---|
| thechristmaslightguys.com home page | **None in text.** I: only in the header image | No |
| CLG contact and quote pages | 512-339-9313 | No |
| thelightguysaustintx.com (every page) | 512-339-9313 | No (0 tel: links) |
| sublimepatio.com | (512) 339-9313 | Yes |
| thefridgevending.com | **512-923-9313** | Yes |

- **F:** CLG, Light Guys and Sublime show the same number.
- **F:** The Fridge shows a different number.
- **I:** either it is a typo or it is a separate number on the same Bestline account. Test-call it.
- **I:** one shared line means calls cannot be attributed to a source. Use per-property tracking numbers (CallRail or Bestline DIDs) that forward to the shared line, plus whisper messages so staff know which brand is calling.

### 3.2 Offers, pricing, cutoffs (F)
- **Pricing:** no prices anywhere. The language is "Free Quote", "free estimate", "store them for free" and "free service calls". Free storm re-hangs. If you move within 3 years, lights are refit to the new house.
- **Seasonal offer:** none. No early-bird or referral discount.
- **Booking cutoff:** none stated. Removal "on January 2nd… most displays are down by January 15th".
- **Copy problems:**
  - Footer typo "Christimas".
  - "Untitled Document" text left over in the page templates.
  - "9 years" claim on CLG versus "20 years" on the Light Guys Christmas page.
  - Testimonials have no dates.

### 3.3 Services (F)
- **Who:** residential and commercial.
- **What:** custom design, installation, takedown and free storage. Covers fascia/roofline, pre-lit wreaths, pre-lit garland with wire wrap, door and window trims, tree trunk wraps and canopies, hedges, walkways. C-9 bulbs and LED.
- **Area:** Austin, Round Rock, Pflugerville, Georgetown, Leander, Bastrop; Travis, Williamson and Hays counties.
- **Permanent lights:** the sister site sells JellyFish permanent lighting. CLG does not cross-sell it.

### 3.4 Funnel (F)
- **Quote form:** posts to `php/email-request.php`. 11 fields, including "square footage" and "outdoor plugs". I: too long for mobile, and the page has no viewport meta.
- **Contact form:** has an image captcha.
- **Missing:** no SMS, chat or online booking.
- **Analytics:** UA only, so the 2026 pilot has no working measurement.

### 3.5 Top 5 Austin competitors (2026 season)

| # | Competitor | Site | Reviews visible | Pricing / offer | Booking UX |
|---|---|---|---|---|---|
| 1 | Austin Custom Christmas Lights | atxcustomchristmaslights.com | Google 5.0 badge (Trustindex). Count U | **Published:** $500 minimum. Front roofline ~$500–800. Most spend $800–2,000/yr. **Up to 20% early-booking discount**. Installs from October | Quote form with same-day callback. Call, email or text. © 2024 |
| 2 | Festive Lights | festivelightsco.com | None shown | None | Webflow site. Meta Pixel. "Get A Fast Quote" Jobber work request. Shows 737-271-9526 but the tel: link is (737) 265-3777 (F: mismatch) |
| 3 | Outdoor Lighting Perspectives of Austin | outdoorlights.com/austin | None on page | None. Free design consult. "Start early" urgency | Franchise. Call (512) 898-7851 or contact form. Residential and commercial, takedown and storage, permanent option |
| 4 | Sapien Lighting | sapienlighting.com | Header 5.0. ProvenExpert 5.00 from **1** review. Google count U. Shows BBB and Thumbtack Top Pro 2025 badges | None | **"Book Free Consultation" online booking**. Call or text (737) 777-9099. Open daily 9am–11pm. GoHighLevel/LeadConnector and GTM |
| 5 | Coy's Christmas Lights | U | Angi/HomeAdvisor 5.0 from **5** reviews | U | Angi request flow |

- **Low-cost substitute (F):** TaskRabbit "Christmas light installation, Austin". Featured Taskers have 497–704 reviews, same-day booking, 2-hour minimums. No set prices.
- **Caveat (I):** this ranking comes from the search results available before the budget ran out. It is not a review-count ranking. Re-run GBP checks for Google review counts.

**Gaps vs. competitors (I):**
- ATX Custom publishes price anchors and an early-booking discount. CLG has neither.
- Sapien offers self-serve booking and text. CLG offers neither.
- Every competitor site works on mobile. CLG does not.

### 3.6 Pilot quick wins (do this week)
1. **Mobile + calls:** add a viewport meta. Remove the Flash logo and audio. Add a text phone number and a sticky tel:/sms: bar. Alternative: send CLG traffic with a 301 redirect to a refreshed Light Guys `/christmas-lighting/` page built in Elementor.
2. **Measure:** GA4 + GTM with events for quote submit, tel: click and form start. Add a tracking number per property that forwards to 512-339-9313.
3. **Offer + urgency:** "Book by Nov 15 — save X%" and a "Roofline from $___" anchor. Add a 4-field mobile quote form (name, phone, address, text-OK). Add a review ask and a GBP link to the post-install and January takedown messages.

---

## 4. Sources (every URL opened)

**Client sites**
- https://www.mcmurrough.com/ · /portfolio/ · /clients/ · /contact-us/ · /sample-page-2/ (404)
- https://www.thechristmaslightguys.com/ · https://thechristmaslightguys.com/
- https://thechristmaslightguys.com/about-the-christmas-light-guys.php
- https://thechristmaslightguys.com/austin-christmas-light-services.php
- https://thechristmaslightguys.com/contact-christmas-light-austin.php
- https://thechristmaslightguys.com/request-a-quote.php
- https://thechristmaslightguys.com/photos/photo-gallery.php
- https://thechristmaslightguys.com/flash/logo.swf
- https://thelightguysaustintx.com/ · /christmas-lighting/ · /permanent-lighting-page/ · /our-company/ · /contact/ · /blog/ · /event-lighting/ · /landscape-lighting/ · /weddings/ · /?page_id=33 (404)
- https://sublimepatio.com/ · /about-us/ · /contact-us/ · /our-work/ · /outdoor-kitchens/ · /pergolas-covered-patios/ · /stone-gravel-pathways/ · /patios-masonry-decking/ · /landscape-patio-lighting/ · /louvered-shade-systems/ · /landscaping/ · /artificial-turf-golf-greens/
- https://thefridgevending.com/ · https://thefridgevending.com/assets/index-DVz8jp7-.js
- https://naturodoc.com/ · /telephone-online-appointments · /contact
- https://barefootreggie.com/ · http://barefootreggie.com/ · http://www.barefootreggie.com/
- https://grubbsconstruction.com/ · /contact · /portfolio · /testimonials · /accolades · /available-homesites/horseshoe-bay-lot
- https://bestline.net/ · /about (404) · /business-voice-voip (404)

**Third-party**
- https://www.facebook.com/thelightguysaustin
- https://www.reverbnation.com/reggiestarrett
- https://news4jax.com/river-city-live/2024/04/10/barefoot-reggie-brings-trop-rock-beats-to-river-city-live
- https://troprock.org/?p=1375 (opened. It did not mention him)
- https://phinstothewest.com/ (opened to confirm the takeover. Not linked here)
- https://www.festivelightsco.com/
- https://atxcustomchristmaslights.com/
- https://www.outdoorlights.com/austin/resources/blogs/2024/september/get-ready-for-the-holidays-with-a-christmas-ligh/
- https://www.outdoorlights.com/austin/ (403 Cloudflare challenge)
- https://sapienlighting.com/
- https://www.provenexpert.com/sapien-lighting/
- https://www.homeadvisor.com/tloc/Pflugerville-TX/Holiday-Lighting-Add-or-Remove/
- https://taskrabbit.com/locations/austin/christmas-light-installation
- https://www.googleapis.com/pagespeedonline/v5/runPagespeed (8 calls, all 429)

**Attempted, failed, not cited:**
- homeguide.com Illumination Holiday Lighting (403)
- a-leads.co Light Guys profile (403)
- directory.yext.com → location.com Holiday Lighting & Creations (404)
