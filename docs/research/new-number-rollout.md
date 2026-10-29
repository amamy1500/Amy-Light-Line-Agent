# New CLG number: Google profile, listings, websites, old line

As of **2026-10-23**. Read-only research. Nothing was edited, signed up for, or contacted.

Labels:

- **FACT**: stated in a source opened today (URL given). Source class in brackets:
  - **[Google]** Google Business Profile Help or Google Search Central (primary).
  - **[Std]** spec or reference: IETF RFC, MDN, schema.org (primary).
  - **[Pract]** well-known local-SEO practitioner: Whitespark, BrightLocal, Sterling Sky.
  - **[Other]** vendor docs, news, agency blogs, forums. Weakest.
  - **[Repo]** this repo's own docs or code.
- **INFERENCE**: my conclusion from the facts.
- **OPEN QUESTION**: not documented, or needs Amy or the owner.

Gaps: moz.com refused automated fetches today. No Moz article is used. Yext's re-verification page returned 403. Nextdoor's help center is script-rendered and did not load. The phone number 512-339-9313 is not indexed by the web search tool, so current directory listings are unknown.

Scope: "the new number" means one new local 512 Twilio number. It rings Amy first; the AI answers if she doesn't (docs/go-live.md, docs/bestline-options.md option B). 9313 stays as it is.

---

## 0. Answers in one screen

| # | Question | Recommendation |
|---|---|---|
| 1 | GBP phone change | Ranking risk is low. Review or suspension risk is low but not zero. Change **only** the phone. New number as **primary**, 9313 as **additional**. Do it now, not mid-December. |
| 2 | NAP consistency | Exact match matters less for rank than it once did. It still matters for people and for which number Google shows. Update first: both websites, GBP, Facebook, Yelp, Bing, Apple. Next: BBB, Nextdoor, Angi where listed. Data aggregators wait until January. |
| 3 | Website | One number on both sites. Put it in the header and footer of every page. Use a `tel:` link in +1 format. Change the JSON-LD `telephone` in the same edit. Remove 9313 from both sites. |
| 4 | Past customers | 9313 keeps ringing Amy, so nobody is lost. Add one sentence to 9313's missed-call greeting. Email past customers once. Print the new number everywhere. Later (phase 2): 9313 no-answer goes to the AI. |
| 5 | Order | Test the line → websites → GBP (same day) → big platforms → watch Google's 4-day suggested-edit window → long tail in January. |

**Key point (INFERENCE):** 9313 stays live and still reaches Amy. So every half-finished state is safe. A directory that lags costs AI coverage on missed calls, not lost calls. That is why a peak-season rollout is reasonable at all.

---

## 1. Changing the phone number on the Google Business Profile

### 1.1 What Google says

| Claim | Label | Source |
|---|---|---|
| Use a local number rather than a central call-center helpline whenever possible. | FACT [Google] | https://support.google.com/business/answer/3038177 |
| The number must be under the business's direct control. | FACT [Google] | same |
| Don't give numbers that redirect or refer users to numbers other than the business's own. | FACT [Google] | same |
| Additional phone numbers can be used on Business Profile websites and other local surfaces. Premium-rate numbers are not allowed. | FACT [Google] | same |
| One profile per business. Do not create more than one profile per location. | FACT [Google] | same |
| The guidelines page does not mention call-tracking numbers at all (checked 2026-10-23). | FACT [Google] | same |
| Besides the primary number you can add up to 2 more. Mobile or landline, not fax. The phone can be hidden. | FACT [Google] | https://support.google.com/business/answer/3039617 ; https://support.google.com/business/answer/16750496 |
| Changing the **name** after verification might require verifying again. Moving to a new **address** requires verifying again. The page names no such rule for the phone. | FACT [Google] | https://support.google.com/business/answer/3039617 |
| Google reviews changes before they go live. Review usually takes up to 10 minutes, sometimes up to 30 days. An edit can be "not approved" if Google can't confirm it, and may be appealable. | FACT [Google] | https://support.google.com/business/answer/3038311 |
| A request to re-verify is likely because some business details were recently updated. Methods include phone/SMS, email, live video call, video recording, postcard. | FACT [Google] | https://support.google.com/business/answer/7107242 |
| If sources report profile info as wrong or outdated, Google may update the profile. | FACT [Google] | https://support.google.com/business/answer/3480441 |
| For a user-suggested edit needing review, the owner has **4 days** after notification to accept or reject. Otherwise Google may publish it if other public info supports it, **such as the business website**. | FACT [Google] | https://support.google.com/business/answer/3480441 (change reported 2026-09-23: https://www.seroundtable.com/google-business-profiles-4-days-42139.html [Other]) |
| Google may call or text the **number on the profile** to confirm details. These calls are automated. Resulting updates show as pending, with review up to 5 business days. Owners can opt out in Business Profile settings → Advanced settings. | FACT [Google] | https://support.google.com/business/answer/7690269 |
| Call history and chat were removed from Business Profile on 2024-07-31. | FACT [Google] | https://support.google.com/business/answer/14919056 |

### 1.2 What practitioners say about "tracking number primary, old number additional"

| Claim | Label | Source |
|---|---|---|
| If you use a call-tracking number, make it primary and the real business number secondary. This won't hurt citation consistency, because listings across the web stay connected through the additional number. Phone field marked "does not influence rankings". (Whitespark, Claire Carlile, 2026-02-02.) | FACT [Pract] | https://whitespark.ca/google-business-profile-guide/business-information/ |
| Same page: changes to core info (name, category, address, phone, website) need caution. They can sometimes get the profile flagged, unverified or suspended. | FACT [Pract] | same |
| Move the original number to the additional field and put the tracking number as primary. Google can then match the original number across your website and citations. (Sterling Sky, Yan Gilbert, 2021-11-30.) | FACT [Pract] | https://www.sterlingsky.ca/how-to-track-gmb-onsite-calls/ |
| Google's guidelines say nothing specific about tracking numbers. Best practice: tracking number primary, local business number secondary. One reader reported a hard suspension after doing this. Joy Hawkins replied she had never seen Google enforce anything about tracking numbers. (Sterling Sky, 2020-02-18.) | FACT [Pract] | https://www.sterlingsky.ca/call-tracking-and-local-seo-5-myths-busted/ |
| On GBP you can set the tracking number as primary and the standard number as additional. A tracking number can be the main citation number if used consistently. | FACT [Pract] | https://www.brightlocal.com/learn/local-citation-faqs/ |
| Phone edits are pending during review. Google "cannot confirm all phone numbers". Edits may be rejected or replaced by automated Google updates. (Joy Hawkins, comment on a post updated 2026-09-22.) | FACT [Pract] | https://www.sterlingsky.ca/remove-phone-number-google-my-business/ |
| Yext lists phone among fields whose edit can trigger re-verification. Page returned 403; claim seen only in a search summary. | Unverified [Other] | https://help.yext.com/hc/en-us/articles/52796266329243-Google-Verification-and-Re-Verification |

### 1.3 Assessment

- **INFERENCE: ranking risk is low.**
  - Whitespark's 2026 guide says the phone field doesn't influence rankings.
  - The new number is a local 512 number. "Local area code on GBP" ranks only #112 of the pack factors anyway (Whitespark 2026, §2.1).
  - The factor that does matter is the website matching the profile (§2). Keep them in sync.
- **INFERENCE: re-verification or suspension risk is low, not zero.**
  - Google's own docs name name and address changes as re-verify triggers, not phone.
  - Practitioners still warn about any core-field edit. One anecdotal suspension exists (Sterling Sky 2020 comments).
  - The cost of a suspension in November–December is very high. Hence the precautions in §5.
- **INFERENCE: this is not really a "tracking number".**
  - It is the new real number for CLG. The practitioner pattern still fits: new number primary, old number additional.
  - It satisfies Google's rules if the Twilio account belongs to the business. docs/go-live.md already requires that ([Repo]). If an agency or Pavan holds the account, "direct control" is doubtful.
  - The press-1 screen and AI still reach the same business. It is not a referral to another business's number.

### 1.4 Peak-season timing risks

| Risk | Likelihood | Impact | Mitigation | Label |
|---|---|---|---|---|
| Edit sits "pending" for days or weeks. | Medium | Low. Old 9313 shows and still rings Amy. | Edit early (this week). Don't stack other edits. | INFERENCE from 3038311 |
| Edit rejected because Google can't confirm the number. | Low–medium | Low. Old number stays. | Website must already show the new number. Appeal or resubmit with proof. | INFERENCE from 3038311, 3480441 |
| Re-verification prompt. | Low | Medium. Profile may be limited until done. | Have video verification ready. Have Amy ready to answer a verification call. Check SMS capture (§1.5). | INFERENCE from 7107242 |
| Suspension. | Low | Very high in Nov–Dec. | Phone-only edit. Keep 9313 as additional. Don't touch name, category, address, service area, hours. | INFERENCE |
| Google reverts primary to 9313 via a "Google update" or a suggested edit. | Medium if 9313 stays on the sites | Medium. Calls go back to the shared line. | Remove 9313 from both sites the same day. Check GBP notifications daily (4-day window). | FACT (3480441) + INFERENCE |
| Google's automated call reaches the AI. | Medium | Low–medium. A wrong answer could become a pending profile update. | AI states approved facts only ([Repo] design). Amy watches Google emails. Or opt out of automated calls (a settings change, Amy's choice). | FACT (7690269) + INFERENCE |

### 1.5 Specific to a Twilio number answered by AI

- **FACT [Repo]:** The repo has no inbound SMS route. `app/api/` holds voice, agent, leads and jobs routes, nothing for SMS.
  - **INFERENCE:** a verification code sent by text from Google, Yelp or Bing may go unseen. Twilio's console probably logs it (OPEN QUESTION; not checked).
  - Prefer email or video verification. Otherwise have someone watch the Twilio log.
- **INFERENCE:** a verification **call** rings Amy first (press 1). If she misses it, the AI answers. The code would then sit in the transcript, if the call was recorded.
- **FACT [Other]:** an agency blog quotes Nextdoor: a phone tree, automated system, Google Voice number or extension may block Nextdoor's verification call. The original Nextdoor page did not load. https://www.mwiah.com/our-insights/hello-nextdoor-neighbors
- **INFERENCE: check the new number's history first.** Twilio numbers are recycled. Search the number in quotes on Google before publishing. Pick another if it shows on someone else's listing.
- **FACT [Other]:** Uberall says Google uses overlapping name, address, category, **phone** and website to detect duplicate profiles. https://uberall.helpjuice.com/google/378273
  - **INFERENCE:** 9313 is shared by three companies. If their profiles all list it as primary, a dedicated CLG number reduces that overlap. That is a small plus.

---

## 2. NAP consistency

### 2.1 How much a phone mismatch matters today

Whitespark Local Search Ranking Factors 2026 (Darren Shaw, published 2025-11-06). Lower rank number = more important. https://whitespark.ca/local-search-ranking-factors/ — FACT [Pract]

| Factor | Local pack | Local organic | AI search |
|---|---|---|---|
| Website NAP matches GBP NAP | 15 | 55 | 68 |
| Citation consistency on Google, Bing, Apple Maps | 28 | 71 | 31 |
| Citation consistency on key sites (Yelp, Yellowpages, D&B) | 63 | 79 | 49 |
| Consistency on data aggregators | 85 | 90 | 56 |
| Consistency on other citation sources | 123 | 102 | 76 |
| Local area code on GBP | 112 | 128 | 121 |

- **FACT [Pract]:** Darren Shaw notes citations lost about half a point of weight in 2026. He also says 3 of the top 5 AI-search factors are citation factors. (Same page.)
- **FACT [Pract]:** Sterling Sky (Joy Hawkins, 2023-11-15): two moved businesses gained rank within days. Citations weren't updated for weeks or months. https://www.sterlingsky.ca/moving-impact-ranking-local-seo/
- **FACT [Pract]:** Sterling Sky (2020): Google understands a business's core facts better now, so a few NAP inconsistencies hurt less than before. https://www.sterlingsky.ca/call-tracking-and-local-seo-5-myths-busted/
- **FACT [Pract]:** BrightLocal consumer survey (2023-10-11, 1,138 US consumers): 45% would lose trust after a wrong phone number, down from 66% in 2021. 8% call a wrong business number at least weekly. https://www.brightlocal.com/research/local-business-discovery-trust-report/
- **FACT [Pract]:** BrightLocal expert survey (2018, 22 experts): nearly all said phone numbers need an exact match. Old. https://www.brightlocal.com/research/expert-local-citation-survey/
- **FACT [Pract]:** Listing platforms pull data from aggregators and from each other. Example given: Yelp feeding Apple Maps. https://www.brightlocal.com/learn/why-your-listing-info-changes-and-what-to-do-about-it/
- **FACT [Google]:** a suggested edit can be auto-published if the business website supports it (§1.1). So the **website** is now the tie-breaker Google names.

**INFERENCE (summary):**

- For ranking, the website-to-GBP match matters most. Then Google, Bing and Apple. Long-tail directories barely matter.
- For people, any listing a customer actually uses should show a working number. 9313 still works, so stale listings are not harmful this season.
- One controllable risk remains: Google may flip back to 9313 if the website still shows it.

### 2.2 Practical minimum set

| Tier | Where | Why | Old 9313 as secondary? |
|---|---|---|---|
| 1 — same day | Both websites (visible text + JSON-LD) | Whitespark factor #15. Google's tie-breaker for suggested edits. | No. Remove it. |
| 1 — same day | Google Business Profile(s) for CLG / TLG | Most calls start here. | **Yes**, as additional phone, this season. |
| 2 — this week | Facebook page, Yelp, Bing Places, Apple Business Connect | Factor #28 (Google/Bing/Apple). Yelp feeds Apple Maps. Customers use them. | Only if the platform has a separate secondary field. Otherwise new number only. |
| 3 — within 2 weeks, only where a listing exists | BBB, Nextdoor, Angi | Customers check them for trust. Low rank weight (factor #63 or lower). | No. |
| 4 — January | Data aggregators (Data Axle, Localeze, Foursquare) and long-tail directories | Slow. Low weight. Pushing a number to aggregators spreads it to marketers' lists (INFERENCE). | No. |

Notes on tier 2–4 (all **unverified this pass** unless marked):

- **FACT [Other]:** Bing Places can import from a Google profile. Verification is still needed. https://ppc.land/bing-places-for-business-migrates-to-bing-com-domain-with-import-tools/
- **FACT [Pract], conflicting:** Whitespark's ecosystem page says Localeze *used to* allow only one free core-detail change per year (https://whitespark.ca/local-search-ecosystem/). Whitespark's 2025-08-27 post says updating an existing Localeze listing is free, no limit stated. It also says Acxiom listings can't change name or phone; delete and re-add instead (https://whitespark.ca/blog/helpful-support-numbers-to-call-on-the-top-u-s-citation-sites/). **INFERENCE:** aggregator edits are slow and sometimes awkward. Another reason to wait for January.
- **FACT [Pract]:** BrightLocal: a changed phone does not update already-built citations by itself. Each listing must be edited. https://help.brightlocal.com/hc/en-us/articles/27761138247058
- **OPEN QUESTION:** which of Yelp, BBB, Nextdoor, Angi and Facebook have CLG or TLG listings today. The 2026-10-20 audit could not verify any (docs/prior-work/08-client-audits.md, [Repo]). Web search today found none.
- **FACT [Pract]:** Sterling Sky (2020, quoting Darren Shaw): little benefit in a separate tracking number per directory. Use the local number on directories. https://www.sterlingsky.ca/call-tracking-and-local-seo-5-myths-busted/

### 2.3 Keep 9313 as a secondary everywhere?

- **On GBP: yes, this season.**
  - Whitespark and Sterling Sky say this keeps old citations tied to the profile (§1.2).
  - It reduces the chance Google sees 9313 elsewhere and "corrects" the profile (INFERENCE).
  - **INFERENCE:** revisit in January. If 9313 is gone from CLG's main listings by then, remove it. Its spam load and three-company sharing make it a poor public number.
- **On the websites: no.**
  - Two numbers in the header confuses callers. It also keeps feeding 9313 to scrapers and to Google (INFERENCE).
- **On directories: no,** except where a true secondary field exists. Most give one phone field (unverified this pass).

---

## 3. The new number on the websites

### 3.1 What the standards say

| Claim | Label | Source |
|---|---|---|
| `tel:` links autodial on phones. On computers, a calling app may open, or the number may be saved. | FACT [Std] | https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/a (modified 2026-10-12) |
| On public HTML pages the number in a `tel:` URI should always be global form, starting with "+". Separators like hyphens are allowed and ignored. Example: `tel:+1-201-555-0123`. | FACT [Std] | https://www.rfc-editor.org/rfc/rfc3966.html §5.1, §6, §8 |
| `LocalBusiness` `telephone`: the primary customer contact number. Include country and area code. Required: `name`, `address`. Recommended includes `telephone`, `url`. | FACT [Google] | https://developers.google.com/search/docs/appearance/structured-data/local-business (updated 2026-09-08) |
| `telephone` is Text on Organization and Place, so `LocalBusiness` inherits it. | FACT [Std] | https://schema.org/telephone |
| One case: an AI Overview showed a competitor's number. Changing only the number's **format** on the client site fixed it. Single anecdote. (Joy Hawkins, 2025-09-26.) | FACT [Pract] | https://www.sterlingsky.ca/how-changing-format-fixed-a-google-ai-overview/ |
| Google formats profile numbers itself. No need to type parentheses or dashes. | FACT [Google] | https://support.google.com/business/answer/16750496 |

### 3.2 Current state of the two sites (from earlier audits)

| Site | Where 9313 is today | `tel:` links | JSON-LD | Label |
|---|---|---|---|---|
| thechristmaslightguys.com (static PHP, shared includes) | Contact page body, Quote page header only. Not on Home. | 0 | None | FACT [Repo] docs/research/website-forensics.md §5.2, line 284 |
| thelightguysaustintx.com (WordPress, BeTheme, Rank Math) | Header and footer of every page, Contact, Weddings ("512.339.9313"), JSON-LD ×2 | 0 | Rank Math Organization + hand-added `HomeAndConstructionBusiness`. They conflict on address. | FACT [Repo] same, §6.2 and line 374 |
| This repo's campaign page `/christmas-lights-austin` | Shows the line's own number as a `tel:` link built from E.164. Set to noindex. | Yes | — | FACT [Repo] app/christmas-lights-austin/page.tsx lines 16, 37–49 |

- **FACT [Repo]:** CLG has no viewport meta, so phones show a zoomed-out desktop page (website-forensics.md line 311). Tap targets will be small.

### 3.3 Recommended changes (a spec for whoever edits the sites; not done)

1. Header and footer of **every** page, on both sites: the new number as a link.
2. Contact and quote pages: the same link near the form.
3. One display format everywhere, the same as Google shows: `(512) 555-0100`. Retire `512.339.9313` style.
4. JSON-LD: change every `telephone` value in the same edit. On TLG that means the Rank Math setting **and** the hand-added block (location of the hand-added block: OPEN QUESTION).
5. Don't fix the address conflicts now. One change at a time in peak season. Fix them in January (INFERENCE).
6. Remove 9313 from both sites.

Placeholder number below (555-0100 is fictional). Replace it with the purchased number.

```html
<!-- Header/footer link: E.164 in href (RFC 3966), human format in text -->
<a href="tel:+15125550100" class="call-link">(512) 555-0100</a>
```

```json
{
  "@context": "https://schema.org",
  "@type": "HomeAndConstructionBusiness",
  "name": "The Christmas Light Guys",
  "telephone": "+1-512-555-0100",
  "url": "https://thechristmaslightguys.com/"
}
```

The JSON-LD above is only the phone-relevant fields. Keep the existing `address` (required by Google), and keep other properties as they are.

### 3.4 Should both sites show the same number?

- **Yes, if CLG and TLG are one business.** INFERENCE, based on:
  - Google: one profile per business, one number connecting to it (§1.1).
  - Website-to-GBP match is the highest-weight NAP factor (§2.1).
  - Earlier design already treats CLG + TLG as one business with two brands (docs/adr/0006-one-office-three-companies.md, [Repo]).
- **Consequence to accept:** TLG's header covers landscape, permanent and event lighting too. Those callers move to the new line as well. The AI's CLG business already covers both brands. OPEN QUESTION: does Amy want that?
- **If two profiles exist** (one CLG, one TLG): each site should match its own profile. Don't merge or delete profiles during the season (INFERENCE). Sharing one number across two profiles adds duplicate-detection overlap (Uberall, §1.5).
- **Attribution later (INFERENCE):** a second Twilio number on the non-GBP site would show which site drives calls. It breaks exact NAP match on that site. Not worth the risk this season.

---

## 4. Past customers who saved 512-339-9313

### 4.1 Facts that frame this

- **FACT [Repo]:** 9313 is shared by three companies and forwards every call to Amy's cell. Never port it (docs/bestline-options.md).
- **FACT [Repo]:** design rule v1 says 9313 stays exactly as it is. Phase 2 option D forwards 9313 to the AI only on no answer (docs/bestline-options.md).
- **FACT [Pract]:** Sterling Sky (2020): customers having saved an old number is usually a smaller problem than owners fear. They tend to search the business online for the current number. https://www.sterlingsky.ca/call-tracking-and-local-seo-5-myths-busted/
- **OPEN QUESTION [Repo]:** is the missed-call voicemail on 9313 Bestline's or Amy's cell carrier's? (docs/bestline-options.md Q2.)

### 4.2 Options

| Option | Effect | Cost / risk | Verdict | Label |
|---|---|---|---|---|
| Keep 9313 unchanged | Saved contacts still reach Amy. | None. | **Required.** | INFERENCE |
| Add one sentence to 9313's missed-call greeting: "For Christmas lights, call 512-555-0100, answered any time." | Moves repeat CLG callers over gradually. | Sublime and Fridge callers hear it too. Keep it short and last. | **Do now.** | INFERENCE |
| Amy mentions the new number when she answers a CLG call on 9313 | Personal, effective. | Adds seconds per call. | Optional. | INFERENCE |
| One email to past CLG customers: "Save our new number," with a contact card (.vcf) | Reaches people before they need to call. | Low. Email only to customers with an existing relationship. | **Do this week.** | INFERENCE |
| Text past customers | Higher reach. | Consent rules apply. See docs/research/legal-compliance.md. | Only for customers who agreed to texts. | OPEN QUESTION |
| New number on invoices, estimates, yard signs, truck magnets, email signature | Steady reinforcement. | Print cost. | Do as items are reordered. | INFERENCE |
| Callbacks show the new number as caller ID | Puts the number in customers' recent calls. | Needs outbound from Twilio. Unknown today. | OPEN QUESTION | — |
| Register the new number with the Free Caller Registry (if used for outbound calls) | Lowers "Spam Likely" labels. Not guaranteed. | Free. | Optional. | FACT [Other] https://www.phoneburner.com/blog/how-freecallerregistry-helps-reduce-spam-flag-risk |
| Phase 2: 9313 no-answer → AI shared line | AI covers missed 9313 calls for all three companies. | Needs Bestline changes and approvals. | After the Bestline call. | FACT [Repo] docs/bestline-options.md |

### 4.3 Don't

- Forward **all** 9313 calls to the new number. Sublime and Fridge callers would land in the CLG line (INFERENCE).
- Put a "press 1 for Christmas" menu on 9313 now. Earlier research rejected menus for adding friction (docs/research/one-number-three-businesses.md §1.1, [Repo]).
- Disconnect or port 9313 (docs/bestline-options.md, [Repo]).
- Treat the new number as temporary. Once printed and listed, it has to live for years (INFERENCE).

---

## 5. Rollout for this season

Days are relative to the go decision. Amy or the owner does every account step. Nothing here was done.

**Day 0 — before anything public**

1. Twilio number bought in the **business's** account. Local 512 (docs/go-live.md, [Repo]).
2. Search the number in quotes on Google. Reject it if it shows on another business's listing.
3. Run the go-live prove-it calls (docs/go-live.md §3): Amy presses 1; Amy ignores → AI; voicemail capture.
4. Decide how a verification code would be seen: SMS log, or Amy answers. Prefer email or video verification (§1.5).
5. Inventory every place 9313 appears for CLG and TLG. Screenshot the current GBP(s) as a baseline.
6. Answer the open questions in §6, mainly: how many profiles, which website each links to.

**Day 1 — same day, websites first, then GBP**

7. Both websites: header, footer, contact, quote pages and JSON-LD (§3.3). Remove 9313.
8. GBP: new number as primary, 9313 as additional. **Change nothing else.**
9. Note the edit status. Pending can last up to 30 days (Google 3038311).

**Days 2–7**

10. Facebook, Yelp, Bing Places, Apple Business Connect.
11. Update the 9313 missed-call greeting (§4.2).
12. Email past CLG customers.
13. Check GBP notifications **daily, weekends included**. Reject any suggested edit back to 9313 within 4 days (Google 3480441).

**Days 8–14**

14. BBB, Nextdoor, Angi, where a listing exists. Nextdoor may need Amy to answer its verification call, or a document upload.
15. Search the business name on Google and Apple Maps. Confirm the shown number.

**January (after the season)**

16. Data aggregators and long-tail directories.
17. Fix TLG's conflicting addresses in schema.
18. Decide: drop 9313 from GBP; a second number for attribution; phase 2 on 9313.

**Avoid**

- Editing name, categories, address, service area or hours on GBP in the same window.
- Creating a new GBP for the new number.
- Changing GBP while the websites still show 9313. Google may revert it.
- Different numbers on different directories.
- Paid bulk citation pushes during the season.
- Going public before the call flow is tested on real calls.

---

## 6. Open questions (for Amy or the owner)

1. How many Google profiles exist: CLG, TLG, Sublime, Fridge? Who owns each? Which website does each link to? Are they verified service-area profiles?
2. Which directories list CLG or TLG today (Yelp, BBB, Nextdoor, Angi, Facebook, Apple, Bing)? Who has the logins?
3. Should TLG's non-Christmas callers (landscape, permanent, events) move to the new line?
4. Is 9313's missed-call voicemail Bestline's or Amy's cell carrier's? Can she edit its greeting?
5. Is the Twilio account in the business's name? Who can read its inbound-SMS log?
6. Will callbacks go out from Amy's cell or the new number?
7. Which past customers agreed to texts? (docs/research/legal-compliance.md)
8. Does Amy want Google's automated calls turned off on the profile?

---

## 7. Sources

**Primary — Google**

- Guidelines for representing your business: https://support.google.com/business/answer/3038177
- Edit your Business Profile: https://support.google.com/business/answer/3039617
- Add your phone number: https://support.google.com/business/answer/16750496
- What happens to your edits: https://support.google.com/business/answer/3038311
- Understand Google updates (4-day suggested edits): https://support.google.com/business/answer/3480441
- Verify your business: https://support.google.com/business/answer/7107242
- Automated calls and texts from Google: https://support.google.com/business/answer/7690269
- Chat and call history removed: https://support.google.com/business/answer/14919056
- LocalBusiness structured data: https://developers.google.com/search/docs/appearance/structured-data/local-business

**Primary — standards**

- RFC 3966 (tel URI): https://www.rfc-editor.org/rfc/rfc3966.html
- MDN `<a>` (tel links): https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/a
- schema.org telephone: https://schema.org/telephone

**Practitioners**

- Whitespark, Local Search Ranking Factors 2026: https://whitespark.ca/local-search-ranking-factors/
- Whitespark, GBP business information (2026): https://whitespark.ca/google-business-profile-guide/business-information/
- Whitespark, citation site support numbers (2025-08-27): https://whitespark.ca/blog/helpful-support-numbers-to-call-on-the-top-u-s-citation-sites/
- Whitespark, US local search ecosystem: https://whitespark.ca/local-search-ecosystem/
- Sterling Sky, call tracking myths (2020): https://www.sterlingsky.ca/call-tracking-and-local-seo-5-myths-busted/
- Sterling Sky, onsite call tracking (2021): https://www.sterlingsky.ca/how-to-track-gmb-onsite-calls/
- Sterling Sky, moving and rankings (2023): https://www.sterlingsky.ca/moving-impact-ranking-local-seo/
- Sterling Sky, phone format and AI Overview (2025): https://www.sterlingsky.ca/how-changing-format-fixed-a-google-ai-overview/
- Sterling Sky, hiding/editing the phone: https://www.sterlingsky.ca/remove-phone-number-google-my-business/
- BrightLocal, citation FAQs: https://www.brightlocal.com/learn/local-citation-faqs/
- BrightLocal, why listing info changes: https://www.brightlocal.com/learn/why-your-listing-info-changes-and-what-to-do-about-it/
- BrightLocal, discovery and trust report 2023: https://www.brightlocal.com/research/local-business-discovery-trust-report/
- BrightLocal, expert citation survey 2018: https://www.brightlocal.com/research/expert-local-citation-survey/
- BrightLocal help, listings don't auto-update: https://help.brightlocal.com/hc/en-us/articles/27761138247058
- Moz: not reachable today.

**Other (weakest)**

- Search Engine Roundtable, 4-day window: https://www.seroundtable.com/google-business-profiles-4-days-42139.html
- Uberall, duplicate detection: https://uberall.helpjuice.com/google/378273
- Agency blog quoting Nextdoor verification: https://www.mwiah.com/our-insights/hello-nextdoor-neighbors
- Bing Places import: https://ppc.land/bing-places-for-business-migrates-to-bing-com-domain-with-import-tools/
- Free Caller Registry overview: https://www.phoneburner.com/blog/how-freecallerregistry-helps-reduce-spam-flag-risk
- Yext re-verification (403, unread): https://help.yext.com/hc/en-us/articles/52796266329243-Google-Verification-and-Re-Verification

**Repo**

- docs/go-live.md, docs/bestline-options.md, docs/adr/0006-one-office-three-companies.md
- docs/research/website-forensics.md, docs/research/one-number-three-businesses.md, docs/research/legal-compliance.md
- docs/prior-work/08-client-audits.md
- app/christmas-lights-austin/page.tsx
