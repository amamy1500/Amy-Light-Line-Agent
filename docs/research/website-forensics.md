# Website Forensics: The Christmas Light Guys + The Light Guys Austin

- **Date:** 2026-10-22
- **Sites:** `https://thechristmaslightguys.com/` (CLG) and `https://thelightguysaustintx.com/` (TLG)
- **Owner contact (given):** Amy Reilly. Her name does not appear on either site.
- **Companion file:** `site-facts.json` (same folder). It holds the machine-readable fact list.

## Labels used

| Label | Meaning |
|---|---|
| **FACT** | Observed directly in an HTTP response, DNS, RDAP or TLS output today. |
| **INFERENCE** | Reasoned from observed evidence. Not directly verified. |
| **OPEN QUESTION** | Cannot be settled from outside. Needs Amy, the host, or a browser test. |

## Method and limits

- FACT: Every request was a GET. Nothing was POSTed. No form was submitted.
- FACT: Crawled every page linked from CLG (6 pages) and every URL in the TLG sitemap (13 pages).
- FACT: Fetched linked JS/CSS, the captcha images the pages reference, robots.txt and the sitemaps.
- FACT: Ran DNS, RDAP (registry) and TLS certificate lookups.
- FACT: Made the same GETs a visitor's browser makes for the CAPTCHA widgets. That means reCAPTCHA `api.js` and `anchor`, and hCaptcha `api.js` and `checksiteconfig`.
- FACT: Read the public source of the "ReCaptcha v2 for Contact Form 7" plugin on plugins.svn.wordpress.org.
- FACT: One unlinked default file was fetched by mistake (`/readme.html` on TLG, 200). It is not used as evidence.
- FACT: I did **not** GET `php/email.php`, `php/email-request.php` or `cfgen-form-3/inc/*.php` handlers. A GET to a mail handler can send a blank email.
- Limit: No JavaScript was run. Widget rendering and console errors are inferred from code. One browser page load (no submit) would confirm them.

---

## 0. Executive summary

1. **FACT:** CLG has **two** lead forms, not one. Each has a different CAPTCHA:
   - The Contact page uses a home-made image CAPTCHA (`captcha.php`). It posts to `php/email.php`.
   - The Request-a-Quote page uses an hCaptcha widget. It posts to `php/email-request.php`.
2. **FACT:** Both CAPTCHA resources load today. `captcha.php` returns a readable JPEG ("n7pyx7"). hCaptcha `api.js` returns 200.
3. **INFERENCE (most likely failure mode):** Spam bots POST straight to the two PHP handlers. They skip the page. Neither form has a honeypot, CSRF token or time check. The hCaptcha only blocks bots if `email-request.php` calls hCaptcha `siteverify`. Nothing on the page suggests it does.
4. **FACT:** The Contact page looks broken:
   - It loads hCaptcha but shows no hCaptcha widget.
   - It references `cfgen-form-2` JS/CSS, which return 404.
   - Its Submit button calls `validate()`, which does not exist.
5. **FACT:** A retired form engine (`cfgen-form-3`, dated 2016) is still deployed. Its captcha endpoint answers (`inc/captcha.php` returns 200 image/png). Its JS also names `inc/form-validation.php` and `inc/upload.php`. INFERENCE: these are live orphan endpoints. That is both a spam route and a security risk.
6. **FACT:** On TLG, the Contact Form 7 reCAPTCHA **v2 checkbox** key is valid for the domain. A leftover **v3** loader on every page asks Google for the same key in v3 mode. Google answers **HTTP 400**. INFERENCE: The TLG form probably still works and is protected by v2. The v3 code is dead weight that causes console errors.
7. **FACT:** The business facts disagree across the sites. Key conflicts:
   - Years in business: 9 vs 20.
   - Coverage: bonded vs licensed.
   - Three different addresses.
   - Two emails.
   - Four different service-area lists.
   - Permanent lighting: JellyFish on one page, "Inception" on another.
   - CLG links its sister company to an **unregistered** domain.

---

## 1. Corrections to the 2026-10-20 findings

| 2026-10-20 claim | Today (2026-10-22) | Label |
|---|---|---|
| CLG = static PHP, `X-Powered-By: PHP/5.5.38` | Confirmed on every CLG page. | FACT |
| GIF nav buttons | Confirmed. Six GIF image buttons with alt text. | FACT |
| "Flash .swf logo" | **Corrected.** The `logo.swf` `<object>` is inside an HTML comment, so it never renders. A JPG logo replaced it. The Flash **audio** player (`flash/audio.swf` via `AC_FL_RunContent`) is still live code. | FACT |
| No meta viewport on CLG | Confirmed on all 6 pages. | FACT |
| No tel: links on CLG | Confirmed. 0 `tel:` links. One `mailto:` (Contact page). | FACT |
| "Dead Universal Analytics" | **Refined.** It is *Classic* GA (`ga.js`, `_gat._getTracker("UA-3776149-7")`). That predates Universal Analytics. UA properties stopped processing in July 2023. | FACT |
| CLG IP 65.254.227.240 shared with mcmurrough.com | **Refined.** It is shared with `www.mcmurrough.com`. The apex `mcmurrough.com` now resolves to 65.254.238.128. PTR is `yourhostingaccount.com`. NS is `ns1/ns2.accountsupport.com`. | FACT |
| TLG = WordPress 7.0.7 | Confirmed (`<meta name="generator" content="WordPress 7.0.7">`). | FACT |
| TLG uses **Elementor** | **Wrong.** No Elementor plugin assets load. "elementor" appears only as CSS selectors in the theme. The theme is **BeTheme 27.3.8** (Muffin Builder). | FACT |
| Slider Revolution 6.6.11 | Confirmed (generator meta and `data-version="6.6.11"`). | FACT |
| Rank Math | Confirmed (HTML comments and sitemap footer). | FACT |
| 512-339-9313 appears 4x, 0 tel: | Confirmed on the homepage: 2 in visible text plus 2 in JSON-LD. 0 `tel:` links on any TLG page. | FACT |
| Contact page = CF7 + **reCAPTCHA v3** | **Wrong.** The form uses a **reCAPTCHA v2 checkbox** via the "ReCaptcha v2 for Contact Form 7" plugin. A separate scroll-triggered v3 loader also exists, and Google rejects it with HTTP 400. | FACT |
| Email thelightguysaustin@gmail.com | Confirmed. Plain text on every page. No `mailto:` link. | FACT |
| TLG IP 192.163.202.86 shared with sublimepatio.com, thefridgevending.com | Confirmed. PTR is `server.cubetech.com`. NS is `ns1/ns2.cubetech.com`. | FACT |

---

## 2. CAPTCHA and spam diagnosis: CLG

### 2.1 Form inventory (CLG)

| # | Page | Form id | Action | Method | Visible fields (name) | Hidden fields | CAPTCHA | Client validation |
|---|---|---|---|---|---|---|---|---|
| 1 | `/contact-christmas-light-austin.php` | `form1` | `php/email.php` (relative) | POST | `name`, `email`, `phone`, `find` (How did you find us), `comments`, `captcha_code` | **none** | Image CAPTCHA `<img src="captcha.php?rand=83615866" id='captchaimg'>` with a refresh link | `onsubmit="return validate1(this)"` checks only that name, email and captcha_code are non-empty. Submit button `onclick="return validate();"` calls a **function that does not exist**. |
| 2 | `/request-a-quote.php` | `form1` | `php/email-request.php` (relative) | POST | `name`, `address`, `citystatezip`, `email`, `phone`, `phonetwo`, `contacttime`, `squarehome`, `description`, `find` (Do you have outdoor plugs?), `other` | **none** (the hCaptcha widget injects `h-captcha-response` at runtime) | hCaptcha `<div class="h-captcha" data-sitekey="b808c7db-54a5-49ad-a1a6-f8b9913428e0">` | **None.** No `required` attributes and no JS check. Blank submissions can be sent from the browser. |

- FACT: No other `<form>` exists on CLG. Home, About, Services and Gallery have none.
- FACT: Both forms reuse `id="form1"`. The quote form gives two inputs `id="phone"`. These are minor markup faults.
- FACT: The quote form shows "Request an Estimate", the PO Box and 512-339-9313 above the fields.

### 2.2 CAPTCHA resource status today (CLG)

| Resource (referenced by page) | Status | Detail | Label |
|---|---|---|---|
| `https://thechristmaslightguys.com/captcha.php?rand=…` | **200** `image/jpeg` | ~4 KB GD JPEG (`CREATOR: gd-jpeg v1.0`). It sets `PHPSESSID`. The sample read clearly as `n7pyx7`, 6 characters with light distortion. | FACT |
| `https://www.hCaptcha.com/1/api.js` (quote and contact pages) | **301** to `https://js.hcaptcha.com/1/api.js`, then **200** | Script loads, with one extra redirect. | FACT |
| hCaptcha `checksiteconfig` for sitekey `b808c7db-…` | 200 `"pass": true` | A made-up key also returns `pass: true`, so this GET **cannot** prove the key is valid. | FACT / OPEN QUESTION |
| `cfgen-form-2/js/form.js`, `cfgen-form-2/css/form.css` (contact page) | **404** | Broken references. | FACT |
| `cfgen-form-3/js/form.js` and swfupload JS (quote page) | 200 | Loaded but inert. `form.js` binds only `input.cfgen-submit`, and that button no longer exists. | FACT |
| `cfgen-form-3/inc/captcha.php` (named in `cfgen-form-3/js/form.js`) | **200** `image/png` | 108x25 PNG ("4x27dr"). The retired cfgen backend is still deployed. | FACT |
| `cfgen-form-3/js/swfupload/swfupload.swf` (named in `upload.js`) | 200 | SWFUpload 2.2.0 (2009-03-25). | FACT |
| `cfgen-form-3/js/upload.js` | 200, Last-Modified 2016-10-17 | Hard-codes `upload_url: "cfgen-form-3/inc/upload.php…"` and a stale `PHPSESSID` value. | FACT |

### 2.3 Is the CAPTCHA enforced on the server?

- OPEN QUESTION: Server PHP is not visible from outside. Enforcement can only be inferred.
- **Contact form (image CAPTCHA).**
  - INFERENCE: It is *probably* checked against the session. The image sets `PHPSESSID`, and the form posts `captcha_code`.
  - INFERENCE: Even if it is checked, it is weak. The text is clean and readable by OCR.
  - INFERENCE: Many scripts of this vintage also forget to clear the session code after use. One solved code can then be replayed. Unverified.
- **Quote form (hCaptcha).**
  - INFERENCE: It is *probably not* enforced.
  - The widget sits in a hand-built 2016-era form.
  - There is no `data-callback` and no JS that blocks submit without a token.
  - The page has no other sign of a server integration.
  - An hCaptcha widget does nothing unless `email-request.php` POSTs the token and secret to `https://api.hcaptcha.com/siteverify` and refuses on failure.
- **Retired cfgen backend.**
  - INFERENCE: `cfgen-form-3/inc/form-validation.php` and `inc/upload.php` are probably still reachable.
  - Bots that know this widely sold form-builder's paths can submit through it. That bypasses both visible forms.

### 2.4 Honeypot, CSRF and rate limiting

| Control | Contact form | Quote form | Label |
|---|---|---|---|
| Honeypot field | None | None | FACT |
| CSRF or nonce token | None | None | FACT |
| Time-on-page or timestamp field | None | None | FACT |
| `required` attributes | None (JS-only check) | None | FACT |
| Rate limiting / WAF | Unknown. A proxy adds `request_id` and `X-Request-ID` headers, but they give no protection signal. | Same | OPEN QUESTION |

### 2.5 Most likely failure modes (ranked)

| Rank | Failure mode | Evidence | Confidence | Label |
|---|---|---|---|---|
| 1 | **Direct POST to `php/email-request.php` with no hCaptcha check on the server.** Bots post the known field names and never load the widget. | No server-integration markers. No honeypot or token. Endpoint unchanged for years. | Medium-high | INFERENCE |
| 2 | **Direct POST to `php/email.php` with OCR-solved or replayed image codes.** | The CAPTCHA is legible plain text. No honeypot. | Medium | INFERENCE |
| 3 | **Retired `cfgen-form-3` backend used as a back door.** | `inc/captcha.php` is live. JS names `inc/form-validation.php` and `inc/upload.php`. | Medium (spam). Higher concern for security (`upload.php`). | INFERENCE |
| 4 | **"Broken/missing" is what Amy sees on the Contact page.** | No hCaptcha widget despite the hCaptcha script. 404 cfgen-form-2 assets. JS `ReferenceError` from `validate()`. | High that these faults exist. They do not by themselves cause spam. | FACT (faults) / INFERENCE (link to the report) |
| 5 | **hCaptcha key not registered for this domain.** The widget would then show an error box on the quote page. | Cannot be tested by GET. | Unknown | OPEN QUESTION |

### 2.6 Decisive tests (owner or host side; no outside probing)

1. **OPEN QUESTION:** Amy forwards 3 recent spam emails with full headers. The body format shows which script sent each one:
   - `email.php`: includes "How did you find us" and comments.
   - `email-request.php`: includes square footage and outdoor plugs.
   - cfgen: has its own template.
2. **OPEN QUESTION:** The host pulls access logs for `POST /php/email.php`, `POST /php/email-request.php` and `POST /cfgen-form-3/inc/*`.
   - A POST with no GET of the page (or `captcha.php`) just before it, from the same IP, is a direct-post bot.
3. **OPEN QUESTION:** Open `/request-a-quote.php` once in a normal browser. Check whether the hCaptcha box renders without an error.
4. **OPEN QUESTION:** Read `php/email-request.php` (download it as a backup first). Search for `siteverify`. If it is absent, ranks 1 and 2 are confirmed.

---

## 3. Forms: TLG

### 3.1 Inventory

| Page(s) | CF7 form id | Action | Method | Fields | Hidden fields | CAPTCHA | Label |
|---|---|---|---|---|---|---|---|
| `/contact/` | 6 | `/contact/#wpcf7-f6-p35-o1`. JS sends it to the CF7 REST endpoint. | POST | `your-name`*, `your-email`*, `tel-401`*, `your-subject`, `your-message` | `_wpcf7`, `_wpcf7_version`=6.1.6, `_wpcf7_locale`, `_wpcf7_unit_tag`, `_wpcf7_container_post`, `_wpcf7_posted_data_hash`, `_wpcf7_recaptcha_response` | reCAPTCHA v2 checkbox, sitekey `6Le_i0AoAAAAANStzAWiBUT-dxvcW938Mj2i6HcE`, loaded from `recaptcha.net` (`render=explicit`) | FACT |
| `/christmas-lighting/`, `/landscape-lighting/`, `/event-lighting/`, `/permanent-lighting-page/`, `/architectural-lighting/` | 260 | `/…/#wpcf7-f260-p{id}-o1` | POST | `your-email`*, `tel-401`*, `your-message`. Button: "Free Estimate Form". | Same set | Same v2 checkbox | FACT |
| Every page | none | `https://thelightguysaustintx.com/` | GET | Site search `s` | none | none | FACT |

- FACT: The homepage, `/weddings/`, `/our-company/` and the blog have no lead form.
- FACT: The `/weddings/` CTA "Let's Get Brilliant!" links to `http://weddings.thelightguysaustintx.com/contact.php`. That host **does not resolve**.
- FACT: No honeypot field. No Akismet markers seen.
- FACT: The Formidable Forms CSS loads on every page, but no Formidable form exists. It is an unused plugin.

### 3.2 reCAPTCHA status (TLG)

| Test (GET) | Result | Meaning | Label |
|---|---|---|---|
| `recaptcha.net/recaptcha/api.js?render=explicit&onload=recaptchaCallback` | 200 | The v2 loader works. | FACT |
| `recaptcha.net/recaptcha/api2/anchor?k=6Le_i0…&co=<thelightguysaustintx.com>&size=normal` | 200, `recaptcha.anchor.Main.init` | The key is valid for this domain as a v2 checkbox. | FACT |
| Same anchor, `size=invisible` | `ErrorMain` "Invalid input" | The key is not an invisible-type key. | FACT |
| Same anchor, made-up key | `ErrorMain` "Invalid site key" | Control: errors are detected correctly. | FACT |
| `www.google.com/recaptcha/api.js?render=6Le_i0…&ver=3.0` (inline scroll loader) | **400 Bad Request** | Made-up keys return 200, so Google recognises this key and refuses it for v3. | FACT (status) / INFERENCE (reason) |

- FACT: An inline script on **all 13** TLG pages fires on first scroll. It injects the v3 loader above. After 4 seconds it calls `grecaptcha.execute(sitekey, …)` and does so again on every form `change` event.
- INFERENCE: The v3 script fails to load (400), so the v2 `grecaptcha` object is not overwritten. The `execute` calls then hit the v2 API with a sitekey and throw console errors. They do not stop the v2 checkbox.
- FACT: The public source of the v2 plugin removes CF7's own v3 spam filter. Its `iqfix_wpcf7_manage_hooks()` calls `remove_filter('wpcf7_spam','wpcf7_recaptcha_verify_response', 9)` and adds its own v2 check.
- INFERENCE: The server checks the v2 token, and the empty `_wpcf7_recaptcha_response` field is harmless. Confidence is medium. It depends on the plugin version installed. The asset is `ver=1.2`, while the current stable release is 1.5.0.
- OPEN QUESTION: Do real TLG submissions reach Amy's inbox? Send one real test after peak hours, and check the CF7 or Flamingo spam log if one exists.

---

## 4. Repair recommendation (peak season)

### 4.1 Principles

- Change the fewest files. Keep a one-step rollback. Test with a real submission right after each change.
- Never lose real leads. If an external check (hCaptcha `siteverify`) cannot be reached, **log and fail open** at first. Switch to fail-closed only after logs show it works.
- INFERENCE: PHP 5.5.38 has been end-of-life since 21 July 2016. Its TLS stack may not reach `api.hcaptcha.com`. Test outbound TLS before relying on `siteverify`.

### 4.2 Option A: minimal in-place patch (recommended first)

| Step | Action | Rollback |
|---|---|---|
| 0 | **Back up** these files from the host file manager or FTP into two places:<br>• `php/email.php`, `php/email-request.php`, `captcha.php`<br>• `contact-christmas-light-austin.php`, `request-a-quote.php`<br>• the whole `cfgen-form-3/` folder (zip)<br>Record the file dates. | n/a |
| 1 | Find the spam route (section 2.6, tests 1-2). Patch only the endpoint(s) that receive spam. | n/a |
| 2 | On each live form, add a **honeypot** input. Example: `<input name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px">`. Add a hidden **timestamp**. | Restore the `.php` page from backup. |
| 3 | At the top of each handler, before `mail()`:<br>• reject if `website` is not empty<br>• reject if the form was filled in under ~4 s<br>• for the quote form, verify `h-captcha-response` with `siteverify` (log and fail open for 48 h, then fail closed)<br>Return the normal "thank you" page to rejected bots so they get no signal. | Copy back `email*.php.bak`. |
| 4 | Contact form: make sure `captcha_code` is compared with the session value and then **cleared**. Better still, swap the image CAPTCHA for the same hCaptcha widget and check it on the server the same way. | Restore from backup. |
| 5 | **Disable the retired cfgen backend.** Put an `.htaccess` deny on `cfgen-form-3/inc/`, or rename the folder. FACT: no current form posts there. | Remove the `.htaccess` or rename the folder back. |
| 6 | Cosmetic fixes for after the season:<br>• remove the dead `cfgen-form-2` and `cfgen-form-3` script/CSS tags<br>• remove the unused hCaptcha tag from the Contact page (or add the widget)<br>• fix `validate()` to `validate1(this)` | Restore the page. |
| 7 | Test: one real quote and one real contact submission, from a phone and from a desktop. Confirm both arrive in the inbox Amy reads. | n/a |

- Risk: A PHP syntax error takes the form down. Edit in a quiet hour and test at once.

### 4.3 Option B: new endpoint + standalone landing page (alternative)

- **What:** One new mobile-first quote page, for example `/christmas-quote/`.
  - It has a viewport tag, a `tel:` link, labelled fields and the same intake questions.
  - It posts to a **new** handler that has honeypot, time check and server-side CAPTCHA built in.
  - Hosting choices:
    - (i) A CF7 form on the TLG WordPress site. Its v2 checkbox already works.
    - (ii) A hosted form service that verifies CAPTCHA or Turnstile on its own server.
- **Cut-over:** Point the CLG "Request a quote" and "Contact" nav links to the new page. Leave the old handlers in place but neutered (honeypot plus time check, or a silent drop).
- **Pros:**
  - No edits to 2008-era PHP.
  - Modern spam controls.
  - Works on phones.
  - A GA4 conversion event can be added.
- **Cons:**
  - Lead routing changes, so notifications must be tested.
  - If hosted on TLG, a CLG visitor lands on a different brand's domain.
- **Rollback:** Point the nav links back. The old pages are untouched.

### 4.4 TLG fixes (lower urgency)

- Remove the inline scroll-triggered v3 loader. It is dead code that returns 400.
- Add a honeypot (CF7 honeypot add-on or Akismet).
- Update the "ReCaptcha v2 for CF7" plugin. The asset is 1.2; the current release is 1.5.0.
- Fix the dead weddings CTA and the 404 menu link `/?page_id=33` ("WEDDINGS").
- Fix the secondary-menu "CHRISTMAS" link, which points to `/landscape-lighting/`.
- Replace the literal "[Free Estimate Form]" text with a link.
- Add `tel:` links.

---

## 5. Site audit: CLG (`thechristmaslightguys.com`)

### 5.1 Stack and hosting

| Item | Observation | Label |
|---|---|---|
| Server | `X-Powered-By: PHP/5.5.38`. Static PHP pages built from Dreamweaver-style includes. Each include carries its own `<!DOCTYPE>`, `<html>` and `<head>`, so pages contain nested documents. | FACT |
| Hosting | IP 65.254.227.240. PTR `65-254-227-240.yourhostingaccount.com`. NS `ns1/ns2.accountsupport.com`. INFERENCE: Web.com / Network Solutions shared hosting. | FACT / INFERENCE |
| Registrar | GoDaddy. Registered 2008-09-05. Expires 2027-09-05. | FACT |
| Mail | MX `mx.thechristmaslightguys.com` (65.254.254.51-54). SPF `… include:websitewelcome.com ?all` (neutral `?all`). No DMARC record. | FACT |
| Designer | "Site design by McMurrough and Associates". "Music by local pianist Dan McMurrough". | FACT |
| File ages | `sitemap.xml` 2008-10-07. `css/styles.css` 2008-11-13. `flash/audio.swf` 2008-10-29. `pdfs/COI.pdf` 2008-10-08. `cfgen-form-3/*` 2016-10-17. | FACT |

### 5.2 Contact points and CTAs

| Item | Where | Label |
|---|---|---|
| 512-339-9313 | Contact page body; Quote page header. **Not** on Home, About, Services or Gallery. | FACT |
| guys@thechristmaslightguys.com | Contact page only, as a `mailto:` link. | FACT |
| PO Box 90305, Austin, Texas 78709 | Contact page; Quote page. | FACT |
| `tel:` links | 0 | FACT |
| CTAs | GIF nav button "Request a quote". Home text "Call or email for a free estimate today." (no number or email on that page). Home meta "Call for a Free Quote." | FACT |

### 5.3 Content inventory

| Topic | Observation | Label |
|---|---|---|
| Services | Front and fascia (roofline) lighting. Pre-lit wreaths. Pre-lit garlands with wire wrap. Door trims. Window trims. Tree trunk wraps and canopy lighting. Hedge lighting. Walkway lighting. Custom design. Install, takedown, storage. | FACT |
| Service area | Footer: "Serving Austin, Round Rock, Pflugerville, Georgetown, Leander, Travis County, Williamson County, Hays County". Titles add **Bastrop**. Home: "We service the entire Austin, Texas area." About meta: "Austin and Travis County Region". | FACT |
| Trust claims | "9 years". "fully bonded and insured". "Licensed and Bonded" (footer, with typo "Christimas"). "$1,000,000 Liability Certificate of Insurance" (PDF Last-Modified 2008). | FACT |
| Seasonal / dates | "this Holiday Season". "On January 2nd we will start removing… most displays are down by January 15th." No year shown. | FACT |
| Policies | Free storage. Free service calls. Rehang storm-downed lights "at no charge". Refit lights if you move "within 3 years". | FACT |
| Gallery | `/photos/photo-gallery.php`: 8 photos. The "thumbnails" are full-size files (about 156-179 KB each). Alt text is "Thumbnail 1…8". | FACT |
| Reviews | 2 testimonials (Suzette F., Laura W.). Both are repeated on TLG. No third-party ratings. | FACT |
| Sister link | "Our sister company, The Light Guys" links to `http://www.thelightguysaustin.com/`. **NXDOMAIN; RDAP 404 (not registered).** Anyone could register it. | FACT |

### 5.4 SEO, indexability, analytics

| Item | Observation | Label |
|---|---|---|
| Titles and meta | Unique per page, 2008 keyword style. Contact and Quote share one title. | FACT |
| Canonical | None. Both `https://` apex and `https://www.` return 200, so the site is duplicated. | FACT |
| Redirects | `http://` gives **302** (temporary) to `HTTPS://www.thechristmaslightguys.com/`. It should be a 301. | FACT |
| robots | `robots.txt` returns 200 with 0 bytes, so everything is allowed. No meta robots. | FACT |
| Sitemap | 4 `http://` URLs from 2008. Gallery and Quote pages are missing. | FACT |
| Structured data | No JSON-LD and no microdata. | FACT |
| Analytics | Classic `ga.js`, `UA-3776149-7`. Collects nothing since July 2023. No GA4, GTM, Meta pixel or call tracking. | FACT |
| Indexation in Google | Not tested. | OPEN QUESTION |

### 5.5 Security and TLS

| Item | Observation | Label |
|---|---|---|
| TLS | Let's Encrypt (YE1) wildcard `*.thechristmaslightguys.com`, valid 2026-10-07 to 2027-01-05. TLS 1.3. | FACT |
| HSTS / CSP / XFO / XCTO / Referrer-Policy | All absent. | FACT |
| Mixed content | No `http://` sub-resources. Only `http://` outbound anchor links. | FACT |
| Exposed directories | `/php/` and `/cfgen-form-3/` return 403, so listing is off. | FACT |

### 5.6 Outdated components (version strings only)

| Component | Version seen | Note | Label |
|---|---|---|---|
| PHP | 5.5.38 | Branch end-of-life since 2016-07-21. Later PHP security fixes were never released for 5.5. | FACT |
| jQuery | 1.11.1 (Google CDN; Quote and Contact pages) | Known issues: CVE-2015-9251, CVE-2019-11358, CVE-2020-11022, CVE-2020-11023. | FACT |
| SWFUpload | 2.2.0 (2009-03-25) | CVE-2012-3414 (XSS in `swfupload.swf`). Flash is dead in browsers, so the server-side `inc/upload.php` is the real exposure. | FACT / INFERENCE |
| Adobe Flash content | `audio.swf`, `logo.swf` | Flash end-of-life 2020-12-31. The audio player shows nothing. | FACT |
| cfgen form builder | form-3 (2016) | Orphaned. Backend reachable. | FACT |

### 5.7 Mobile and accessibility

| Item | Observation | Label |
|---|---|---|
| Viewport | Absent. Fixed 968 px table layout. Phones show a zoomed-out desktop page. | FACT |
| Tap-to-call | None. | FACT |
| `lang` attribute | Missing. | FACT |
| Headings | No `<h1>` on any page. Headings are styled `<span>`s. | FACT |
| Text in images | Nav buttons and banners are GIFs ("Convenient • Energy Efficient • Better Looking than your Neighbors", "We Do Light(s) Right"). Alt text is present. | FACT |
| Alt text | Present on most images. Missing on the CAPTCHA image. Logo alt has a typo: "They Christmas Light Guys". | FACT |
| CAPTCHA a11y | Image only. No audio option. | FACT |
| Form labels | Quote form uses placeholders only, with no `<label>`. Contact form uses table text, not `<label for>`. | FACT |
| Contrast | Not measured. Green backgrounds (#93C47C / #CEE6AA) need checking. | OPEN QUESTION |

---

## 6. Site audit: TLG (`thelightguysaustintx.com`)

### 6.1 Stack and hosting

| Item | Observation | Label |
|---|---|---|
| CMS | WordPress 7.0.7. | FACT |
| Theme | BeTheme 27.3.8 (Muffin Builder). | FACT |
| Plugins seen | Contact Form 7 6.1.6. "ReCaptcha v2 for CF7" (asset `ver=1.2`). Slider Revolution 6.6.11. Rank Math. Formidable Forms (CSS only, no form). **No Elementor.** | FACT |
| Server | `Server: Apache`. IP 192.163.202.86. PTR `server.cubetech.com`. NS cubetech. MX is the domain itself. SPF `ip4:192.163.202.86 +a +mx ~all`. No DMARC. | FACT |
| Registrar | Domain.com (Network Solutions). Registered 2016-01-22. **Expires 2027-01-22.** | FACT |
| WP exposure | `xmlrpc.php` is advertised (EditURI). The REST API is advertised. Author slugs are public in the blog filter (`guysoflight`, `thelightguys`). | FACT |

### 6.2 Contact points and CTAs

| Item | Where | Label |
|---|---|---|
| 512-339-9313 | Header and footer of every page. Contact body. Weddings body ("512.339.9313"). JSON-LD x2. | FACT |
| thelightguysaustin@gmail.com | Header of every page and the LocalBusiness JSON-LD. No `mailto:`. | FACT |
| PO Box 90305, Austin, TX 78709 | Header; Contact page. | FACT |
| 2009 Pyramid Drive, Austin, TX 78734 | Footer of every page; LocalBusiness JSON-LD. INFERENCE: may be a residence. | FACT / INFERENCE |
| 9518 Hwy 290 W, Suite D, Austin, Texas 78736 | Rank Math Organization and Place JSON-LD only. Not visible on any page. | FACT |
| `tel:` / `mailto:` | 0 / 0. | FACT |
| CTAs | Header "Request a Quote" goes to `/contact/`. "Free Estimate Form" buttons. The literal text "[Free Estimate Form]" on the permanent page is unlinked. "Request your free quote today" in the blog is unlinked. Weddings buttons "Illuminate Me" and "Shine On" have `href=""`. | FACT |
| Social | facebook.com/thelightguysaustin, twitter.com/thelightguysatx. Not checked. | FACT / OPEN QUESTION |

### 6.3 Content inventory

| Topic | Observation | Label |
|---|---|---|
| Services | Permanent LED (JellyFish). Landscape, architectural and pathway lights. Bistro pool lighting. Event and wedding lighting (bistro, PAR, LED). Rentals and sales. Christmas (the CLG list copied word for word). | FACT |
| Service area | 18 cities (home and footer). 8-9 cities (permanent page). 9 cities (LocalBusiness `areaServed`). | FACT |
| Trust claims | "20 years" (home). "over nine years" (About body). "over 20 years" (About meta, Weddings). "fully licensed and insured". | FACT |
| Product claims | Architectural page: "PAYS FOR ITSELF IN 2 YEARS!", "87% POWER USAGE SAVINGS!", "50,000 HOURS LIFE EXPECTANCY!", "lasts 10 years or more". Blog: "You pay once—and enjoy it forever." | FACT |
| Brand conflict | Permanent page: "Authorized JellyFish Lighting Dealer". Architectural page title and schema: "Permanent **Inception** LED Commercial & Home Lighting System" (2016, orphaned but in the sitemap and indexable). | FACT |
| Gallery | Permanent page has 6 photos (`p_gall_1-6.jpg`, uploaded 2025-05) and a slider. Filenames such as `2021-May-Utah-South-Jordan-DSC04547.jpg` and `2022-March-Modern-Farmhouse-Angela.jpg`. INFERENCE: manufacturer or dealer stock, not Austin jobs. | FACT / INFERENCE |
| Reviews | The 2 CLG testimonials plus Brenda Laurent, Brandi, and Sidney Roberts (G'Raj Mahal, Rainey St). Weddings has 3 unnamed quotes. Staff name "Josh/Joshua" appears. | FACT |
| Hours | Mon-Fri 08:00-17:00, in JSON-LD only. | FACT |
| Copyright | "© 2025" (stale). | FACT |

### 6.4 SEO, indexability, analytics

| Item | Observation | Label |
|---|---|---|
| Meta robots | `follow, index` on all pages. | FACT |
| Canonical | Present and self-referencing. | FACT |
| Redirects | http and www give **301** to `https://thelightguysaustintx.com/`. | FACT |
| robots.txt | WordPress default. Points to `sitemap_index.xml` (Rank Math). | FACT |
| Sitemap | 9 pages, 4 posts, 1 category. Page lastmod 2026-06-05. | FACT |
| Title bug | `/why-permanent-led-lighting-is-the-smartest-upgrade-for-your-home/` has `<title>` and og:title "Wedding Lighting Tips and Tricks for the Best Lights". | FACT |
| Orphans / 404 | `/architectural-lighting/` is not linked from nav. `/?page_id=33` returns 404 (secondary menu "WEDDINGS"). `weddings.thelightguysaustintx.com` is NXDOMAIN. | FACT |
| JSON-LD | Rank Math graph (Organization at the Hwy 290 address). A hand-added `HomeAndConstructionBusiness` (Pyramid Dr address, hours, `priceRange "$$"`, 9 `areaServed`, 4 `Service` nodes). The two business entities **conflict**. | FACT |
| Analytics | GA4 `G-W55023H4C4` on all 13 pages. No GTM, Meta pixel or call tracking. | FACT |

### 6.5 Security and TLS

| Item | Observation | Label |
|---|---|---|
| TLS | Let's Encrypt (YR1), valid 2026-10-03 to 2027-01-01. Covers the apex and wildcard. TLS 1.3. | FACT |
| Security headers | HSTS, CSP, X-Frame-Options, X-Content-Type-Options and Referrer-Policy are all absent. Only `Server: Apache`. | FACT |
| Mixed content | None. Only `http://` social anchor links. | FACT |
| Outdated components | Slider Revolution 6.6.11 is behind the 6.7.x line. Vulnerabilities have been published for 6.6.x. Check exact IDs on Wordfence or WPScan. BeTheme 27.3.8: check the same way. "ReCaptcha v2 for CF7" assets show 1.2 vs stable 1.5.0. Formidable is installed but unused. | FACT (versions) / OPEN QUESTION (CVE IDs) |

### 6.6 Mobile and accessibility

| Item | Observation | Label |
|---|---|---|
| Viewport | `width=device-width, initial-scale=1, maximum-scale=1`. Blocks pinch-zoom (WCAG 1.4.4 concern). | FACT |
| `<h1>` | Missing on Home, Christmas, Event, Landscape, Permanent and Weddings. | FACT |
| Alt text | Missing on 3-9 images per page. Many are decorative icons; some are content photos. | FACT |
| Tap-to-call | None. | FACT |
| Contrast | Not measured. | OPEN QUESTION |

---

## 7. Business fact reconciliation

Classification keys:

- **BOTH** = CONFIRMED ON BOTH SITES
- **CLG** = ONLY CHRISTMAS SITE
- **TLG** = ONLY LIGHT GUYS SITE
- **CONTRA** = CONTRADICTORY
- **AMY** = NEEDS AMY CONFIRMATION
- **SAFE** = SAFE FOR AI TO STATE
- **NOT** = NOT SAFE FOR AI TO STATE

All quotes are FACT (observed today). The classifications are recommendations.

| id | Fact | Quote (short) | URL | Classification |
|---|---|---|---|---|
| F01 | Brand "The Christmas Light Guys" | "The Christmas Light Guys" | CLG /contact-christmas-light-austin.php; TLG /christmas-lighting/ ("Let The Christmas Light Guys Do It") | BOTH, SAFE |
| F02 | Brand "The Light Guys" | "Our sister company, The Light Guys" / "© 2025 The Light Guys" | CLG /about…; TLG / | BOTH, SAFE |
| F03 | The brands are sister companies | "Our sister company, The Light Guys provides a full range of year-round professional lighting services" | CLG /about-the-christmas-light-guys.php | CLG, AMY, NOT |
| F04 | Phone 512-339-9313 | "512-339-9313" | CLG /contact…; TLG / (header) | BOTH, SAFE |
| F05 | Mailing address | "PO Box 90305 … Austin, Texas 78709" | CLG /contact…; TLG /contact/ | BOTH, SAFE |
| F06 | Street address A | "2009 Pyramid Drive, Austin, TX 78734" | TLG / (footer, JSON-LD) | TLG, CONTRA, AMY, NOT |
| F07 | Street address B | "9518 Hwy 290 W, Suite D" (JSON-LD only) | TLG / (Rank Math schema) | TLG, CONTRA, AMY, NOT |
| F08 | CLG email | "guys@thechristmaslightguys.com" | CLG /contact… | CLG, CONTRA, AMY, NOT |
| F09 | TLG email | "thelightguysaustin@gmail.com" | TLG / (header) | TLG, CONTRA, AMY, NOT |
| F10 | Based in Austin, TX | "The Christmas Light Guys are based in Austin, TX." / "Outdoor Lighting Austin TX" | CLG /request-a-quote.php (meta); TLG / | BOTH, SAFE |
| F11 | Residential and commercial | "Residential and Commercial Outdoor Christmas light…" / "for both residential and commercial properties" | CLG footer; TLG / | BOTH, SAFE |
| F12 | Christmas/holiday light installation | "professional Christmas light installation and decorating service" | CLG /; TLG /christmas-lighting/ | BOTH, SAFE |
| F13 | Christmas items list (8) | "Front and Facia (roofline) Lighting … Walkway Lighting" | CLG /; TLG /christmas-lighting/ | BOTH, SAFE |
| F14 | Custom design | "We do a custom design for you" | CLG /; TLG /christmas-lighting/ | BOTH, SAFE |
| F15 | Takedown at season end (no date) | "take them down at the end of the season" | CLG /; TLG /christmas-lighting/ | BOTH, SAFE |
| F16 | Off-season storage offered | "store them for free" / "off-season storage" (JSON-LD) | CLG /; TLG /christmas-lighting/ | BOTH, AMY, SAFE (candidate) |
| F17 | Storage is **free** | "store them for free" | CLG /; TLG /christmas-lighting/ | BOTH, AMY, NOT |
| F18 | Estimates are free | "Call or email for a free estimate today." / "free consultation" / "We offer free estimates" | CLG /; TLG /contact/, /permanent-lighting-page/ | BOTH, AMY, NOT |
| F19 | Estimate process includes a preliminary plan | "we will provide a preliminary lighting plan for your review" | CLG /austin-christmas-light-services.php | CLG, AMY, NOT |
| F20 | Takedown dates | "On January 2nd we will start removing … most displays are down by January 15th" | CLG /austin-christmas-light-services.php | CLG, AMY, NOT |
| F21 | Free service calls / storm rehang | "We offer free service calls" / "rehang the lights for you at no charge" | CLG /austin-christmas-light-services.php | CLG, AMY, NOT |
| F22 | Refit if you move within 3 years | "If you move within 3 years to a house similar in size we can fit them" | CLG /austin-christmas-light-services.php | CLG, AMY, NOT |
| F23 | Equipment specs | "C-9 bulbs … low-energy LEDs for tree and window decoration" | CLG /austin-christmas-light-services.php | CLG, AMY, NOT |
| F24 | $1M liability insurance | "View our $1,000,000 Liability Certificate of Insurance" (PDF dated 2008) | CLG /about… | CLG, AMY, NOT |
| F25 | Bonded | "Licensed and Bonded" / "fully bonded and insured" | CLG footer, /about… | CLG, CONTRA, AMY, NOT |
| F26 | Licensed and insured | "We are a fully licensed and insured locally owned company" | TLG /our-company/ | TLG, CONTRA, AMY, NOT |
| F27 | Years: 9 | "We have offered this service for 9 years in the Austin area" | CLG /about… | CLG, CONTRA, AMY, NOT |
| F28 | Years: 20 (Christmas) | "We have offered this service for 20 years in the Austin area" | TLG / | TLG, CONTRA, AMY, NOT |
| F29 | Years: over nine (landscape) | "With over nine years of experience in residential and commercial landscape design maintenance" | TLG /our-company/ | TLG, CONTRA, AMY, NOT |
| F30 | Years: over 20 (events) | "over 20 years of experience lighting events like yours" | TLG /weddings/ | TLG, CONTRA, AMY, NOT |
| F31 | CLG area list | "Serving Austin, Round Rock, Pflugerville, Georgetown, Leander, Travis County, Williamson County, Hays County" | CLG footer | CLG, CONTRA, AMY, NOT |
| F32 | TLG area list (18) | "Serving Austin, Round Rock, … Volente, and Dripping Springs" | TLG / footer | TLG, CONTRA, AMY, NOT |
| F33 | Core cities on both | Austin, Round Rock, Pflugerville, Georgetown, Leander | CLG footer; TLG footer | BOTH, AMY, NOT (boundary rule) |
| F34 | Bastrop | CLG `<title>` only; TLG list | CLG /request-a-quote.php; TLG / | CONTRA, AMY, NOT |
| F35 | "Entire Austin area" | "We service the entire Austin, Texas area." | CLG /; TLG /christmas-lighting/ | BOTH, AMY, NOT |
| F36 | Permanent LED lighting offered | "Permanent LED Lighting for Austin Homes & Businesses" | TLG /permanent-lighting-page/ | TLG, AMY, NOT (until confirmed) |
| F37 | JellyFish authorized dealer | "Authorized JellyFish Lighting Dealer" | TLG /permanent-lighting-page/ | TLG, CONTRA (Inception), AMY, NOT |
| F38 | App control, colours | "Smart App Control – Choose from millions of colors" | TLG /permanent-lighting-page/ | TLG, AMY, NOT |
| F39 | Permanent pricing basis | "Pricing is based on linear footage, design complexity, and install needs" | TLG /permanent-lighting-page/ | TLG, AMY, NOT |
| F40 | Performance claims | "PAYS FOR ITSELF IN 2 YEARS!" / "87% POWER USAGE SAVINGS!" | TLG /architectural-lighting/ | TLG, AMY, NOT |
| F41 | "Pay once" claim | "You pay once—and enjoy it forever." | TLG /why-permanent-led-… | TLG, AMY, NOT |
| F42 | Landscape lighting | "LANDSCAPE LIGHTS" / "The Light Guys provide top of line event, bistro, and landscape lighting" | TLG /landscape-lighting/; CLG /about… | BOTH, AMY, SAFE (candidate) |
| F43 | Event and wedding lighting | "we also offer Par lighting, LED lighting and Bistro lighting" | TLG /event-lighting/; CLG /about… | BOTH, AMY, SAFE (candidate) |
| F44 | Lights for rent and sale | "We also offer lights for rent and sale." | TLG /event-lighting/ | TLG, AMY, NOT |
| F45 | Event packages include delivery, install, removal | "our packages also include delivery, installation and removal of lights" | TLG /event-lighting/ | TLG, AMY, NOT |
| F46 | Year-round tree wrapping | "residential and commercial tree wrapping year round" | CLG /about… | CLG, AMY, NOT |
| F47 | Pathway, architectural, bistro pool lights | "PATHWAY LIGHTS" / "BISTRO POOL AND LANDSCAPE LIGHTING" | TLG /landscape-lighting/ | TLG, AMY, SAFE (candidate) |
| F48 | Hours Mon-Fri 8-5 | `"opens": "08:00", "closes": "17:00"` (JSON-LD) | TLG / | TLG, AMY, NOT |
| F49 | Price range "$$" | `"priceRange": "$$"` (JSON-LD) | TLG / | TLG, AMY, NOT |
| F50 | Staff name Josh/Joshua | "Joshua suggested that I use colored lights" | CLG /about…; TLG /our-company/ | BOTH, NOT |
| F51 | Testimonials | "- Suzette F." / "- Laura W." | CLG /about…; TLG /our-company/ | BOTH, NOT |
| F52 | "More affordable" (testimonial) | "more affordable than anyone else out there" | CLG /about…; TLG /our-company/ | BOTH, NOT |
| F53 | Quote intake questions | "Square footage of home" / "Do you have outdoor plugs?" / "Best time to contact" | CLG /request-a-quote.php | CLG, AMY, SAFE (to *ask*) |
| F54 | Energy-efficient positioning | "Convenient • Energy Efficient • Better Looking than your Neighbors" / "energy-efficient solutions" | CLG /; TLG / | BOTH, AMY, SAFE (generic) |
| F55 | Slogan | "We Do Lights Right" / "WE DO LIGHTS RIGHT!" | CLG /; TLG /christmas-lighting/ | BOTH, SAFE |
| F56 | Permanent lights for other holidays | "Light up Christmas, Halloween, or the 4th of July" | TLG /permanent-lighting-page/ | TLG, AMY, SAFE (candidate) |
| F57 | Sister-site URL on CLG | `http://www.thelightguysaustin.com/` (unregistered) | CLG /about… | CLG, CONTRA, NOT |
| F58 | TLG website | `https://thelightguysaustintx.com/` | TLG | TLG, SAFE |
| F59 | Social profiles | facebook.com/thelightguysaustin; twitter.com/thelightguysatx | TLG footer | TLG, AMY, NOT |
| F60 | Gallery shows own work | Filenames "2021-May-Utah-South-Jordan…" | TLG /permanent-lighting-page/, blog | TLG, AMY, NOT |
| F61 | Commercial storefront permanent lighting | "Draw attention to your storefront or business" | TLG /permanent-lighting-page/ | TLG, AMY, SAFE (candidate) |
| F62 | Online quote request exists | CLG "Request an Estimate" form; TLG "Request a Quote" | CLG /request-a-quote.php; TLG /contact/ | BOTH, SAFE |

---

## 8. Contradictions between the sites (explicit)

| # | Topic | CLG says | TLG says | Label |
|---|---|---|---|---|
| C1 | Years in business | "9 years" (About) | "20 years" (Home); "over nine years" (About body, landscape); "over 20 years" (About meta, Weddings) | FACT |
| C2 | Licensing and coverage | "Licensed and Bonded"; "fully bonded and insured"; $1M COI dated 2008 | "fully licensed and insured"; no bond claim | FACT |
| C3 | Address | PO Box 90305 only | PO Box 90305; **2009 Pyramid Drive 78734** (footer, LocalBusiness); **9518 Hwy 290 W Ste D 78736** (Organization schema) | FACT |
| C4 | Email | guys@thechristmaslightguys.com | thelightguysaustin@gmail.com | FACT |
| C5 | Service area | 5 cities + Travis/Williamson/Hays counties; Bastrop only in titles; "entire Austin area" | 18 cities (footer); 8-9 (permanent page); 9 (schema) | FACT |
| C6 | Christmas policy detail | Jan 2 / Jan 15 takedown; free service calls; storm rehang; 3-year refit | The Christmas page copy omits all of these. JSON-LD says "maintenance, safe removal, and off-season storage". | FACT |
| C7 | Sister-company link | Links `thelightguysaustin.com` (unregistered) | Never links CLG at all | FACT |
| C8 | Permanent-lighting brand | (not mentioned) | "Authorized JellyFish Lighting Dealer" vs "Permanent Inception LED … System" | FACT (TLG internal) |
| C9 | Free offer wording | "free estimate" / "Free Quote" | "free consultation" / "free estimate" / "free quote" | FACT (consistent in spirit, not contradictory) |

---

## 9. Draft "approved facts candidate" list (for Amy)

Nothing below is approved. The AI phone agent may state an item only after Amy ticks it. Items marked [confirm] need her to confirm or reword.

1. We are The Christmas Light Guys, the holiday-lighting brand of The Light Guys in Austin, Texas. [confirm relationship wording, F03]
2. Our phone number is 512-339-9313.
3. Our mailing address is PO Box 90305, Austin, TX 78709.
4. We work with homes and businesses (residential and commercial).
5. We install outdoor Christmas and holiday lighting and decorations.
6. Typical items: roofline (fascia) lighting, pre-lit wreaths, pre-lit garlands, door and window trims, tree trunk wraps and canopy lighting, hedge lighting, walkway lighting.
7. Each display gets a custom design.
8. We install, take down at the end of the season, and store your decorations. [confirm storage policy and whether it is free, F16/F17]
9. Estimates are free. [confirm, F18]
10. Estimate process: we schedule a visit or call and give you a lighting plan. [confirm wording, F19]
11. We serve the Austin area, including Austin, Round Rock, Pflugerville, Georgetown and Leander. [confirm the full list and boundaries, F31-F35]
12. Our sister company The Light Guys also does permanent LED lighting, landscape lighting, and wedding and event lighting. [confirm, F36/F42/F43]
13. Permanent lighting is app-controlled and can be set for any holiday. [confirm brand: JellyFish? F37/F38]
14. Online quote requests: thelightguysaustintx.com. [confirm which URL and which inbox]
15. Questions the agent may **ask** a caller: address and ZIP, best callback time, approximate square footage, whether there are outdoor outlets, what look they want. [confirm, F53]

**Must stay off-limits until Amy rewrites them:**

- years in business
- insured, bonded or licensed status
- takedown dates
- free service calls and storm rehang
- the move/refit policy
- any price, price basis or "$$"
- business hours
- any street address
- staff names
- testimonials or "more affordable" claims
- performance or savings figures
- "authorized dealer" status

---

## 10. Open questions for Amy

1. Which inbox gets each form today? Which address should the AI give callers: guys@thechristmaslightguys.com or thelightguysaustin@gmail.com?
2. Can you forward 3 recent spam emails with full headers? That identifies the spam route (section 2.6).
3. Who can reach the CLG hosting account (file manager or FTP) and the TLG WordPress admin?
4. Which is correct: 9 years or 20 years? Since what year?
5. Current insurance and bond status? Is "licensed" accurate, and if so, what licence?
6. Which address is real: 2009 Pyramid Drive, 9518 Hwy 290 W Ste D, or neither? Should any street address be public?
7. What is the exact service area for Christmas, and for permanent lighting?
8. Is storage still free? Are service calls still free? Are the Jan 2 / Jan 15 takedown dates still right for 2026-27?
9. Is the "3-year move refit" offer still valid?
10. Are you an authorized JellyFish dealer? Should the "Inception" architectural page be removed?
11. Do customers own or lease the lights?
12. Business hours?
13. Should `thelightguysaustin.com` (currently unregistered) be bought to protect the brand? CLG links to it.
14. Are the Facebook and Twitter profiles active?
15. Are the permanent-lighting gallery photos your installs or manufacturer images?
