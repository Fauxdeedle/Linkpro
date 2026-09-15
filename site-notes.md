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

## (Add more sections below)

Examples you might add later: booking form behavior, Flute checkout flow, where course content lives, who to contact for domain/DNS, etc.
