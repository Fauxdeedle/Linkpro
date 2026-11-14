# LINK Pro site notes

Human-facing notes about how the site works and how to change it safely. Add new sections here as the site grows (booking, courses, payments, content, etc.).

---

## Navigation bar

Every public page uses the **same** top navigation—the same layout and behavior as the homepage.

### What visitors see

- **Logo (left):** Triangle icon + “LINK Pro” → home (`/`).
- **Links (center-right):** About, Services, Classes, Peak, Courses, Blog, Reviews.
- **Book Now (right):** Gold button → contact / booking section on the home page (`/#contact`).
- **Phone / small screens:** Hamburger opens a full-screen menu with the same links plus “Book a Consultation.”

**Not in the main nav (by design):** SomaTherapy, Rams, course sub-sections (Online vs Seminars), and individual blog posts. Those are reached from page content or the footer (e.g. Rams).

### Scroll behavior (most pages)

- At the **top of the page**, the bar is **transparent** so it sits over dark heroes (home, about, courses, etc.).
- After scrolling down about **80px**, the bar gets a **dark, blurred background** so links stay readable.
- On **checkout success / cancel** pages (light cream background), the bar stays **solid dark** from the start so white link text is always visible. Those pages use `body class="nav-surface-light"`.

### How to change the nav

The site is static HTML. Nav markup is maintained in one template and **copied into each page** with a small script (so every page loads with nav already in the HTML—good for SEO and no “flash” of missing header).

| What you want to change | Edit this file |
|-------------------------|----------------|
| Link labels, order, or URLs | `components/site-nav.html` |
| Colors, spacing, mobile menu look | `css/site-nav.css` |
| Scroll threshold, hamburger, smooth scroll to `#contact` | `js/site-nav.js` |
| Which page shows the “current” link highlight | `scripts/build-nav.js` (`activeByFile` map) |

**After any nav change:**

1. Run: `npm run build:nav`
2. Commit the component/CSS/JS **and** the HTML files that the script updated.

**Adding a new page to the site:** Include the nav placeholders and assets on that page (see `.cursor/rules/site-navigation.mdc` or copy an existing page’s `<head>` / body markers), register the file in `scripts/build-nav.js`, then run `npm run build:nav`.

### URLs

Nav links use **root-relative** paths (`/about`, `/courses`, `/#contact`) so they work from any folder (e.g. blog posts under `/blog/…`). URLs omit `.html` in the browser (Vercel `cleanUrls`; local dev via `npm start` uses the same rules in `server/index.js`).

### Diagrams and detail

- **Page link map (flowchart):** `docs/site-navigation.md`
- **Agent / dev checklist:** `.cursor/rules/site-navigation.mdc`

---

## Flute hosted checkout

Paid courses, seminars, bundles, and retreat rooms use
[Flute Checkout](https://developer.flute.com/docs/online-payments/flute-checkout).
Payment fields live on Flute's hosted page; LINK Pro only creates and verifies
payment sessions from server-side routes.

### Checkout flow

Online courses (`pelvis-1`, `pelvis-3`, `llip`) start on the course page.

1. **View course** opens that course page.
2. If the browser cookie already belongs to an email with that course, the lessons load.
3. Otherwise the page asks for an email and posts it to `/api/access/continue`.
4. When that email has the course, the site sends a one-time link and shows `/access-link-sent`. The link signs the browser in. Typing the email does not.
5. When that email does not have the course, the backend creates a Flute session and the browser goes to its `checkoutUrl`. A direct call to `/api/create-checkout-session` for an owned online course is refused.

Seminars and retreats still open `/checkout.html?product={productId}` and post the product ID and email to `/api/create-checkout-session`. An old online-course checkout link uses the same email check: a cookie that already has the course returns to the course page, an entitled email goes to `/access-link-sent`, and any other email continues to Flute.

The backend looks up the trusted price in `server/config/products.js`. Flute substitutes the session ID into the configured return URL and sends the visitor to `checkout-success.html`. The return page calls `/api/checkout-session/{sessionId}`. The backend confirms both payment-session status `Completed` and a documented successful transaction status before showing enrollment confirmation.

Never put an amount in the browser request or trust the return URL by itself.

### Product setup

Flute does **not** need a separate dashboard product, API client, or webhook for
each offering. All offerings share one merchant configuration. Each item does
need a catalog entry in `server/config/products.js` with an ID, name, amount,
and success URL, plus a matching checkout link on the site.

Current IDs are `pelvis-1`, `llip`, `seminar-upper-limb`,
`seminar-lower-limb`, `seminar-trunk-pelvis`, `seminar-bundle`,
`retreat-shared-bunk`, `retreat-king-single`, and
`retreat-king-double`. Optional environment-based price overrides are listed
in `.env.example`.

### Configuration and maintenance

- Required server variables: `FLUTE_CLIENT_ID`, `FLUTE_CLIENT_SECRET`, and
  `FLUTE_ENVIRONMENT`.
- Vercel's deployment URL is used automatically to build Flute's absolute
  `returnUrl`. Set `BASE_URL` only to override it with a canonical custom
  domain or when running outside Vercel.
- Session creation and verification live in `lib/checkout.js`; Flute HTTP calls
  live in `lib/flute.js`.
- Express routes under `server/routes/` and Vercel functions under `api/` must
  return the same response shapes.
- Run `npm test` after changing products, session payloads, or payment-status
  handling.
- See `flute-checkout.md` for setup, endpoint, and webhook details.
- Completed payments are also written to the purchase sheet. See **Purchase sheet** below.

---

## Peak Athleticism (sub-brand page)

Young-athlete **ReConditioning** sub-brand landing page. Dark theme and bronze accents match the Peak Athleticism logo.

### What visitors see

- **URL:** `/peak-athleticism` (`peak-athleticism.html`)
- **Hero:** Sub-brand eyebrow, headline, short subhead, logo image on the right (stacked on mobile)
- **Body (loaded from JSON):** Intro, three “How we ReCondition” pillars, method + class info callout, expandable “What parents & coaches should know” topics, optional shoulder/throwing section, quotes, and a **Book a consultation** CTA → `/#contact`
- **Nav:** Global site nav; link label **Peak** → `/peak-athleticism` (`data-nav-id="peak"`; active on this page via `scripts/build-nav.js`)
- **Discovery:** Also linked from the Classes page card at the bottom of `/classes`

### How to update copy (no HTML edits)

All public text lives in one file:

| What you want to change | Edit this file |
|-------------------------|----------------|
| Headlines, paragraphs, pillars, topics, quotes, CTA, SEO title/description | `content/peak-athleticism.json` |
| Page layout, colors, typography, hero structure | `peak-athleticism.html` (inline `<style>`) |
| How sections are built from JSON (new block types, field names) | `js/sales-page.js` (`pageType`: `program`) |
| Logo image | `images/peak-athleticism-logo.png` |

**After JSON-only changes:** Save and deploy—no `npm run build:nav` unless you also changed nav.

**Reference:** Original info sheet archive: `content/peak-info-source.md` (not shown on the site).

### JSON structure (quick map)

- `meta` — browser title and meta description
- `hero` — eyebrow, headline, subheadline, logo alt text (headline/subhead also appear in the static hero in HTML until JS runs; keep JSON in sync with hero IDs or rely on JS to overwrite on load)
- `intro` — lead line + paragraph array
- `pillars` — array of `{ title, body }` (three cards)
- `method` — title + paragraphs; paired on the page with `classes` (title, scheduleNote, details list)
- `topics` — accordion sections: `{ title, points[] }`
- `throwing` — optional youth throwing/shoulder block (omit or empty to hide)
- `quotes` — blockquote strings
- `cta` — title, body, buttonText, buttonHref

The `_comment` key at the top of the JSON is for editors only; the renderer ignores unknown keys.

### Technical notes

- On load, `js/sales-page.js` fetches `/content/peak-athleticism.json` and injects HTML into `#peak-content`. Hero fields `#peak-hero-eyebrow`, `#peak-hero-headline`, `#peak-hero-sub` are updated from the same JSON.
- If the fetch fails, visitors see a short error message in the content area.
- Scroll-in animations use the same `.reveal` / `.visible` pattern as other pages (observer attached after render).

### Adding a new page like this

Pattern: static HTML shell + data file + small render script. Register the HTML file in `scripts/build-nav.js`, add nav markers + `/css/site-nav.css` + `/js/site-nav.js`, run `npm run build:nav`, and document the content file here.

---

## Client sales / pitch pages

Shareable one-off pages for prospective clients (custom course proposals, onsite training packages, etc.). You typically **email the direct URL**—most pitch pages are **not** in the main nav or footer. Cursor can scaffold these with the **create-sales-page** skill (`.cursor/skills/create-sales-page/SKILL.md`); the steps below are the same workflow by hand.

### Example (footer-linked test page)

- **URL:** `/sharks-proposal` (`sharks-proposal.html`)
- **Content:** `content/sharks-proposal.json` (`pageType`: `proposal`)
- **Source archive:** `content/sharks-proposal-source.md` (from client doc; not public)
- **Assets:** `images/sales/sharks/`
- **Discovery:** Footer link **Client pitch (sample)** on main site pages (internal preview only—not the pattern for real client pitches)
- **SEO:** `noindex, nofollow` on client pitches by default (set in JSON `meta.robots` and/or the HTML shell)

### Building a new sales page (checklist)

**1. Choose a slug and page type**

| `pageType` | Use for | Reference |
|------------|---------|-----------|
| `proposal` | Client-specific pitch (letter, outline, pricing table) | `sharks-proposal.html`, `content/sharks-proposal.json` |
| `program` | Sub-brand or program landing (pillars, topics, quotes) | `peak-athleticism.html`, `content/peak-athleticism.json` |

- **Slug:** lowercase, hyphenated (e.g. `acme-fc-proposal`).
- **Public URL:** `https://your-domain.com/{slug}` (file `{slug}.html` at repo root; Vercel `cleanUrls` drops `.html`).

**2. Archive the source brief (optional but recommended)**

Save the Word doc / email / notes as `content/{slug}-source.md`. This file is for editors only—not linked on the site.

**3. Create the JSON**

```bash
cp content/sales-page-template.json content/{slug}.json
```

- Set `"pageType": "proposal"` or `"program"`.
- For **program** pages, start from `content/peak-athleticism.json` instead of the template.
- Fill `meta`, `hero`, body sections, `pricing` (proposals), and `cta`.
- Client pitches: include `"robots": "noindex, nofollow"` under `meta` unless you want search indexing.

**4. Add images**

Put logos and diagrams in `images/sales/{slug}/` and reference paths in JSON (e.g. `hero.logos`, `figure.src`).

**5. Create the HTML shell**

**Proposal:**

```bash
cp sales/sales-page-template.html {slug}.html
```

Replace template placeholders (`{{SLUG}}`, `{{PAGE_TITLE}}`, etc.). Tune `:root` CSS variables in the `<style>` block for client colors (see Sharks teal vs Peak bronze). Required on `<body>`:

- `data-sales-content="/content/{slug}.json"`
- `data-sales-mount="sales-content"`
- `data-sales-css-prefix="sales"`

Include nav placeholders, `/css/site-nav.css`, `/js/site-nav.js`, and `<script src="/js/sales-page.js" defer></script>`.

**Program:** copy `peak-athleticism.html`, point `data-sales-content` at your JSON, use `data-sales-mount="peak-content"` and `data-sales-css-prefix="peak"`.

**6. Register the page and build nav**

In `scripts/build-nav.js`, add to `activeByFile`:

```javascript
'{slug}.html': null,
```

Use `null` unless the page should highlight a nav item (most pitches stay `null`). Then:

```bash
npm run build:nav
```

Commit `{slug}.html` and any other HTML files the script updated.

**7. Footer and main nav (defaults)**

| Discovery | Default for client pitches |
|-----------|----------------------------|
| Main nav (`components/site-nav.html`) | **Do not add** |
| Site footer | **Do not add** (send URL only) |
| Exception | Demo/test pages (like Sharks sample) may add a footer link on the same pages that link Media Kit |

**8. Deploy and share**

- **JSON-only edits:** save and deploy—no `build:nav` needed.
- **New HTML page:** deploy after step 6.

Share with the client:

```text
https://your-domain.com/{slug}
```

Local preview: `npm start` → `http://localhost:8080/{slug}`.

### How the pieces fit together

| Piece | Role |
|-------|------|
| `{slug}.html` | Shell: hero placeholders, theme CSS, nav, mount div (`#sales-content` or `#peak-content`) |
| `content/{slug}.json` | All public copy; must include `pageType` |
| `js/sales-page.js` | Fetches JSON from `body[data-sales-content]` and renders sections |
| `scripts/build-nav.js` | Registers the HTML file for nav injection |

Proposal JSON highlights: `letter`, `sections`, `prepWork`, `days`, `includedMaterials`, `pricing`, `cta`. Program JSON highlights: `intro`, `pillars`, `method`, `classes`, `topics`, optional `throwing`, `quotes`, `cta` (see Peak section above).

### Updating an existing pitch

| Change | Action |
|--------|--------|
| Wording, prices, dates | Edit `content/{slug}.json` only → deploy |
| Colors, layout, hero structure | Edit `{slug}.html` → deploy |
| New section type for all pitches | Extend `js/sales-page.js` + document field names here |

### Templates and skill

- HTML starter: `sales/sales-page-template.html`
- JSON starter: `content/sales-page-template.json`
- Agent workflow: `.cursor/skills/create-sales-page/SKILL.md` (includes required copy-paste URL output)

---

## Online course lesson videos (YouTube)

Course pages (e.g. `pelvis-1-course.html`) list lessons in a JavaScript `lessons` array at the bottom of the page. Each lesson can include an optional **`youtube`** field.

### Link a video to a lesson

1. Upload the lesson video to the [LINK Pro Sport YouTube channel](https://www.youtube.com/@linkprosport) and set visibility to **Unlisted** (not Private—private videos cannot embed).
2. In YouTube Studio, open the video and copy the **Share** link or browser URL.
3. Open the course HTML file (e.g. `pelvis-1-course.html`) and find the `lessons` array in the `<script>` block.
4. Paste the URL or 11-character video ID into the matching lesson’s `youtube` property. Lesson order in the array matches the curriculum list on the page (first object = Lesson 1).

```javascript
{
  title: 'The Pelvis as the Foundation',
  duration: '18 min',
  description: '...',
  youtube: 'https://youtu.be/XXXXXXXXXXX'
}
```

Accepted formats: raw video ID, `youtube.com/watch?v=…`, `youtu.be/…`, `/embed/…`, or `/shorts/…`.

5. Save and deploy. Opening that lesson shows a 16:9 embed instead of the placeholder.

### Behavior

- **No `youtube` or empty string:** visitors see the “Course video placeholder” block.
- **Closing the lesson modal** clears the embed so playback stops.
- New courses copied from `courses/course-template.html` include the same embed logic automatically.

### Files

| What | File |
|------|------|
| Live Pelvis 1.0 lessons + video IDs | `pelvis-1-course.html` |
| Pelvis 3.0 lessons (3: Part One, Part Two, Part Three) | `pelvis-3-course.html` |
| Lower Limb Injury Prevention lessons | `llip-course.html` |
| Template for new courses | `courses/course-template.html` |
| Agent checklist for new courses | `.cursor/skills/create-course/SKILL.md` |

---

## Grant course access

Use this when someone should have an online course without going through checkout. The command saves their email in the course-access store (Upstash Redis) and writes one row per course on the Purchases sheet.

Deploying the site does not grant anyone. Run the command on your computer, from the repo, after `main` includes `scripts/grant-access.js`.

### Which courses

| Course | Put this in the CSV |
|--------|---------------------|
| Pelvis 1.0 | `pelvis-1` |
| Pelvis 3.0 | `pelvis-3` |
| Lower Limb Injury Prevention | `llip` |

Seminars and retreats are skipped. They are not online courses.

### The CSV

Keep the file outside the repo. One row per email and course. A header row is optional.

```csv
email,courseId
someone@example.com,pelvis-1
someone@example.com,llip
```

To add more people later, edit that file and run the command again. You can replace the old rows or add new ones under them. An email and course that already have access stay as they are in Redis. The sheet updates that person’s existing row instead of adding a second one.

### Run it

```bash
node scripts/grant-access.js /tmp/linkpro-grant.csv
```

A finished grant prints `Store: redis`, `Granted` with a count, and `sheet append` or `sheet update` for each course.

The person opens that course and enters the same email. If the address has that course, the site emails a one-time link and shows `/access-link-sent`. Opening the link signs them in. An email with a different course still goes to payment for the one they do not have. This command does not send that email itself.

### Local `.env`

The command reads `.env` next to `package.json`. It does not read `.env.local` or `.env.example`. Pulling `main` leaves `.env` alone, because that file is gitignored.

| Variable | Role |
|----------|------|
| `UPSTASH_REDIS_REST_URL` | Redis REST URL. Course access is stored here |
| `UPSTASH_REDIS_REST_TOKEN` | Redis REST token |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | Purchases spreadsheet |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Account that can edit the sheet |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | That account’s private key |

The site reads `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` first. When that pair is empty, it uses Vercel’s `PAY_CHECK_KV_REST_API_URL` and `PAY_CHECK_KV_REST_API_TOKEN`, then `KV_REST_API_URL` and `KV_REST_API_TOKEN`. Use the read-write token, not the read-only token. Leave `ENTITLEMENT_FILE` unset so the grant is stored in production Redis. A login email is sent only when that store already has the course for the address. An address without the course goes to checkout and Resend is not called.

If the Redis variables are missing, the command stops with `Refusing to grant` and writes nothing. If Redis succeeds and the sheet write does not, it prints `Access was saved, but the purchase sheet was not updated.` Run the same CSV again to fill in the sheet.

### Where the pieces live

| What | File |
|------|------|
| The command | `scripts/grant-access.js` |
| Course ids and Redis | `lib/entitlements.js` |
| Sheet row for a manual grant | `lib/purchase-sheet.js` (`recordManualGrant`) |
| Agent checklist | `.cursor/skills/grant-course-access/SKILL.md` |

Sheet columns and the `manual:{email}:{courseId}` session id are under **Purchase sheet** below.

---

## Purchase sheet

Completed course, seminar, and retreat payments are logged in a Google Sheet. One row is one Flute payment session. The same person buying two things gets two rows. A webhook retry updates the existing row instead of adding a second one. A manual course grant from `scripts/grant-access.js` is also one row, keyed by `manual:{email}:{courseId}`.

This sheet is the purchase log. Online course access still lives in the entitlement store. Payments from before this sheet was turned on are not backfilled.

### When a row appears

1. Flute sends `payment_session.completed` to `/api/webhooks/flute`. The site grants online course access when the product is an online course, then writes the sheet.
2. If the buyer lands on the success page, that check writes the same row. Seminars and retreats are included even though they do not unlock a course.
3. `node scripts/grant-access.js` saves online course access, then writes one row per course. The Session ID is `manual:{email}:{courseId}`. Amount is left blank. Running the same grant again updates that row. Seminars and retreats in the CSV are skipped and are not written. The full steps are under **Grant course access** above.

A sheet failure on the success page does not block the buyer. A sheet failure on the webhook makes Flute retry. Both payment writes use the Flute session id, so they stay one row. A Redis grant whose sheet write does not happen exits with an error after access has been saved. Running the same CSV again updates the manual row.

### The columns

The `Purchases` tab, row 1, must stay exactly:

`Timestamp | Email | Product | Product ID | Amount | Session ID`

| Column | What it is |
|--------|------------|
| Timestamp | When the site recorded the row, ISO 8601 UTC |
| Email | Buyer email, lowercased |
| Product | Name from `server/config/products.js` |
| Product ID | Catalog id, such as `pelvis-1` or `seminar-bundle` |
| Amount | Whole dollars from that catalog entry for a payment. Blank for a manual grant |
| Session ID | Flute payment session id, or `manual:{email}:{courseId}` for a grant from `scripts/grant-access.js`. This is the key for updates |

### How to update the sheet

Safe to do in Google Sheets:

- Read, filter, and sort for yourself. The site finds a row by Session ID, not by row order.
- Add notes in columns to the right of Session ID (column G and onward). Updates only rewrite columns A–F.
- Fix a typo in a Product or Email cell. A later write for that same Session ID will overwrite columns A–F. A payment rewrite uses the catalog amount. A manual-grant rewrite leaves Amount blank.

Do not:

- Rename, reorder, or insert columns in A–F. The site refuses to write until row 1 matches the six headers above. Webhooks then fail until it matches again.
- Rename the tab unless you also set `GOOGLE_SHEETS_TAB` in Vercel to the new name and redeploy.
- Put a real-looking value in Session ID on a hand-typed row unless it is that payment’s Flute session id, or a manual grant id `manual:{email}:{courseId}`. A later write with the same id replaces that row. Leave those manual ids as the script wrote them.
- Delete row 1.

Adding a new course, seminar, or retreat does not require a sheet edit. Add the product in `server/config/products.js` and point a checkout link at it. The next purchase uses that product’s name and price.

Changing the price in the catalog changes the amount on future rows only. Existing rows stay as they were written.

To change the columns themselves, update both places in one change, then redeploy:

1. `HEADERS` in `lib/purchase-sheet.js`
2. Row 1 of the live `Purchases` tab, same names, same order

Until those match, new purchases are not logged.

### Configuration

Set these in Vercel (Production, and Preview if you want it there) and in local `.env`. Saving variables does not update the running site. Redeploy after you add or change them.

| Variable | Role |
|----------|------|
| `GOOGLE_SHEETS_SPREADSHEET_ID` | The id between `/d/` and `/edit` in the sheet URL |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `client_email` from the service-account JSON |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | PEM private key. A value with `\n` between lines is fine |
| `GOOGLE_SHEETS_TAB` | Optional. Defaults to `Purchases` |

Share the spreadsheet with the service-account email as **Editor**. If any of the first three variables is missing, payments still complete and the sheet is left unchanged.

Code: `lib/purchase-sheet.js`, called from `lib/webhooks.js`, `grantPaidCheckout` in `lib/checkout.js`, and `scripts/grant-access.js`. Setup steps also live in `flute-checkout.md`. Agent checklist: `.cursor/rules/purchase-sheet.mdc`.

---

## Lower Limb course survey

Unlisted feedback page for people who attended **Fascia Normalization and 2TLS Treatment of the Lower Limb** with Dr. Jason Amstutz. Send the direct link after the course. It is not in the nav, footer, homepage, or courses list.

- **URL:** `/lower-limb-survey` (`lower-limb-survey.html`)
- **Local:** `http://localhost:8080/lower-limb-survey`
- **Production:** `https://www.linkprosport.com/lower-limb-survey`
- **SEO:** `noindex, nofollow`. Anyone with the link can open it. There is no password.

The questions match the previous course form: name, email, an optional news signup, course-format checkboxes, five agreement scales, and the written prompts (lectures, teaching method, three-day versus four-day format, practice application, one-sentence value, and an “aha moment”).

Submitting posts to `/api/event-survey`. The server emails the full response through Resend. The From address is `ACCESS_EMAIL_FROM`. The To address is `SURVEY_NOTIFY_EMAIL`. Reply-To is the attendee’s email. The news checkbox is included in that email only. It does not add anyone to a mailing list.

If `RESEND_API_KEY`, `ACCESS_EMAIL_FROM`, or `SURVEY_NOTIFY_EMAIL` is missing, the page asks the visitor to try again. Responses are not stored anywhere else.

Set `SURVEY_NOTIFY_EMAIL` in Vercel (and in local `.env` when testing). The example value is `concierge@linkmedicalcenter.com`.

---

## Training events

In-person seminars and the Baja retreat each have a page a visitor can open from the live events list at `/live-events`. LINK Pro seminars also appear on the homepage. The pages share one layout: hero, gold rule, gallery when photos exist, a cream details block, the instructor, and a register band. Colors match the homepage (charcoal, cream, gold). Online courses stay on `/courses`.

Generated pages:

- `/seminar-upper-limb` — June 7–9, Newport Beach, $1,500
- `/cranial-diaphragm` — August 1–5, Dallas, registration not open
- `/seminar-lower-limb` — September 25–27, Costa Mesa, $1,500
- `/seminar-trunk-pelvis` — December 4, 5, and 6, Costa Mesa, $1,500

The Baja retreat stays at `/nicolette-david-retreat`. That page is written by hand. Its card on `/live-events` still comes from the event data.

Catalog cards link to the event page. Register lives on that page and uses the existing Flute product id. After payment, Upper Limb, Lower Limb, and Trunk & Pelvis return to their own page. The three-seminar bundle still checks out from the bundle row and returns to `/live-events`.

### Make a new event

1. Copy `content/events/_template.json` to `content/events/{slug}.json`. Use a lowercase hyphenated slug. The filename has to match the slug. `/fascia-intensive` comes from `content/events/fascia-intensive.json`.
2. Set `pageMode` to `generated`.
3. Set `status` to `upcoming` when people can register, or `coming-soon` when the page should exist without checkout.
4. Set `listOn` to `["events", "home"]` or `["events"]`. Set `sort` to control order. Lower numbers appear first. `courses` is still accepted as an alias for `events`.
5. Fill the catalog card, hero, details, instructor, gallery, and the register blurb. Leave `gallery` as `[]` when there are no photos. Leave `schedule` as `[]` when there is no day plan. Empty sections are left off the page.
6. Set `productId` to an id already listed in `server/config/products.js` when checkout should open. Leave it out for a coming-soon event. Point that product’s `successUrl` at `/{slug}.html`.
7. Run `npm run build:events`.

The command writes `{slug}.html`, refreshes the cards on `live-events.html` and `index.html`, and marks Live Events as the current nav item.

### Edit an existing page

Edit `content/events/{slug}.json`, then run `npm run build:events` again. Do not hand-edit the generated `{slug}.html`. The next build replaces those edits.

`hero.titleHtml` and `hero.metaHtml` are inserted as HTML, so an italic word uses `<em>` and a line break uses `<br>`. Every other field is plain text.

### End or remove an event

- Set `status` to `ended` and rebuild. The card leaves the live events page and the homepage. The URL stays up and says “This training has ended.” Checkout is removed.
- Delete `content/events/{slug}.json` and rebuild to remove a generated page and its card.

The retreat record uses `pageMode: "static"` and `listOn: ["events"]`. Rebuilding updates its live events card and does not overwrite `nicolette-david-retreat.html`. Deleting that JSON removes the card only.

### Fields

- `status` — `upcoming`, `coming-soon`, or `ended`
- `pageMode` — `generated` writes the HTML page. `static` only feeds the catalog.
- `listOn` — `events`, `home`, or both. `courses` still lists the event on `/live-events`.
- `sort` — catalog order
- `catalog` — month, days, title, location, summary, price label, and button text
- `productId` — Flute checkout id. Omit it when registration is not open.
- `hero`, `details`, `instructor`, `gallery`, `cta` — the page body
- `details.intro` — opening paragraphs. An array is several paragraphs.
- `details.registerLink` — optional text that links to the register band, such as `Register here.`
- `details.sections` — optional blocks for a longer page. Each section can include `heading`, `paragraphs`, `bullets`, `closing`, nested `blocks` (same fields), and `facts` (`label` and `text`). Set `details.label` and `details.heading` to `""` when those default titles should not appear. Leave `sections` out when a schedule list and logistics column are enough.

### Files

- `content/events/` — one JSON file per event, plus `_template.json`
- `lib/event-pages.js` — turns one event into HTML
- `scripts/build-events.js` — `npm run build:events`
- `css/event-page.css` — shared page styles
- `live-events.html` and `index.html` — cards sit between `<!-- LINKPRO_EVENTS_START -->` and `<!-- LINKPRO_EVENTS_END -->`

A later system that adds and ends trainings should write or update these JSON files and run the same command.

---

## (Add more sections below)

Examples you might add later: booking form behavior, Flute checkout flow, who to contact for domain/DNS, etc.
