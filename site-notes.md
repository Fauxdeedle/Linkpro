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
| How sections are built from JSON (new block types, field names) | `js/peak-athleticism-page.js` |
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

- On load, `js/peak-athleticism-page.js` fetches `/content/peak-athleticism.json` and injects HTML into `#peak-content`. Hero fields `#peak-hero-eyebrow`, `#peak-hero-headline`, `#peak-hero-sub` are updated from the same JSON.
- If the fetch fails, visitors see a short error message in the content area.
- Scroll-in animations use the same `.reveal` / `.visible` pattern as other pages (observer attached after render).

### Adding a new page like this

Pattern: static HTML shell + data file + small render script. Register the HTML file in `scripts/build-nav.js`, add nav markers + `/css/site-nav.css` + `/js/site-nav.js`, run `npm run build:nav`, and document the content file here.

---

## (Add more sections below)

Examples you might add later: booking form behavior, Flute checkout flow, where course content lives, who to contact for domain/DNS, etc.
