# LINK Pro site notes

Human-facing notes about how the site works and how to change it safely. Add new sections here as the site grows (booking, courses, payments, content, etc.).

---

## Navigation bar

Every public page uses the **same** top navigation—the same layout and behavior as the homepage.

### What visitors see

- **Logo (left):** Triangle icon + “LINK Pro” → home (`/`).
- **Links (center-right):** About, Services, Classes, Courses, Blog, Reviews.
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

Nav links use **root-relative** paths (`/about`, `/courses`, `/#contact`) so they work from any folder (e.g. blog posts under `/blog/…`). On Vercel, `cleanUrls` serves these without `.html` in the browser.

### Diagrams and detail

- **Page link map (flowchart):** `docs/site-navigation.md`
- **Agent / dev checklist:** `.cursor/rules/site-navigation.mdc`

---

## (Add more sections below)

Examples you might add later: booking form behavior, Flute checkout flow, where course content lives, who to contact for domain/DNS, etc.
