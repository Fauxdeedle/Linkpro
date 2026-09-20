---
name: create-in-person-event
description: "Create a LINK Pro in-person event landing page (retreat, seminar, intensive) and list it on courses.html. Use when adding retreats, workshops, or hosted events that need a detail page plus a courses catalog entry."
---

# Create a LINK Pro in-person event page

Build static event detail pages with desert-luxe styling (from retreat fliers), shared site nav, and a matching row in the **In-Person Seminars** section on `courses.html`.

## When to use

- New retreat, workshop, or hosted intensive (yoga, fascia seminars hosted off-site, etc.)
- User asks for an “in-person event page”, retreat landing URL, or courses listing for an event
- Replicate the Nicolette David / Soluna retreat pattern

## Reference files

| File | Purpose |
|------|---------|
| [`events/event-template.html`](../../events/event-template.html) | HTML shell + CSS + placeholder tokens |
| [`nicolette-david-retreat.html`](../../nicolette-david-retreat.html) | Working example (filled) |
| [`content/nicolette-david-retreat-source.md`](../../content/nicolette-david-retreat-source.md) | Archived brief shape |
| [`courses.html`](../../courses.html) | In-person seminar cards (`#seminars`, `.seminar`) |
| [`create-course` skill](../create-course/SKILL.md) | Nav registration pattern |
| [`scripts/build-nav.js`](../../scripts/build-nav.js) | `activeByFile` + `npm run build:nav` |

## Inputs

| Input | Example | Notes |
|-------|---------|--------|
| `slug` | `nicolette-david-retreat` | lowercase, hyphenated; file `{slug}.html` at repo root → URL `/{slug}` |
| Event title | Live By The Sun, Love By The Moon | Hero `<h1>`; may use `<em>` for italic phrase |
| Host / instructor | Nicolette David | Bio section + courses card metadata |
| Location | El Pescadero, Baja | Hero + seminar location line |
| Dates | Nov 11–15, 2026 | Hero + seminar date box (month + day range) |
| Schedule | bullet list | “A day at…” column |
| Logistics | flights, check-in/out | Right column |
| Pricing | From $1,350 or fixed | Seminar price block + optional list on page |
| CTA | mailto, tel, or checkout | `#register` section; add `data-flute-product` later if needed |
| Images | 3 gallery + 1 portrait | `images/events/{slug}/` |

Archive the source brief (not linked on site):

```bash
# content/{slug}-source.md
```

## Workflow

### 1. Copy template → event page

```bash
cp events/event-template.html {slug}.html
```

Replace every `{{PLACEHOLDER}}` (see template). Match tone and structure to `nicolette-david-retreat.html` when placeholders are unclear.

**Filename:** `{slug}.html` at repo root (same pattern as `peak-athleticism.html`, `media-kit.html`).

### 2. Assets

```bash
mkdir -p images/events/{slug}
```

- Three landscape photos for `.gallery` (venue, setting, room or activity)
- One portrait for instructor (3:4 crop)
- Optimize large files; do not commit multi-MB reference fliers

Reference images in HTML with root-relative paths: `/images/events/{slug}/filename.jpg`

### 3. Register navigation

In `scripts/build-nav.js` `activeByFile`:

```javascript
'{slug}.html': 'courses',
```

Ensure the page has:

- `<link rel="stylesheet" href="/css/site-nav.css">`
- `<!-- LINKPRO_NAV_START -->` … `<!-- LINKPRO_NAV_END -->`
- `<script src="/js/site-nav.js" defer></script>`

Then:

```bash
npm run build:nav
```

Commit updated HTML files the script touches.

### 4. Add courses.html listing

Inside `<div class="seminars" id="upcoming">`, add a `.seminar.reveal` block **above** unrelated seminars (newest / next event first).

Use this structure:

```html
<div class="seminar reveal">
  <div class="seminar-date"><span class="seminar-month">MON</span><span class="seminar-days">11–15</span></div>
  <div class="seminar-content">
    <h4>Event title (short)</h4>
    <p class="seminar-location">City, Region · host or context</p>
    <p class="seminar-text">One or two sentences.</p>
  </div>
  <div class="seminar-price-block">
    <span class="seminar-price">From $X</span>
    <a href="/{slug}" class="seminar-cta">View event — Register</a>
  </div>
</div>
```

- Use `<a class="seminar-cta">` when registration is on the event page or external.
- Use `<button type="button" class="seminar-cta" data-flute-product="…">` only when Flute checkout is configured (see `js/flute-checkout.js`, `server/config/products.js`).
- Use `<span class="seminar-soon">Coming Soon</span>` when there is no public registration yet.

Do **not** add every event to `index.html` unless the user asks.

### 5. Verify

```bash
npm start
```

Check:

1. `http://localhost:8080/{slug}` — hero, gallery, schedule, CTA, mobile ~400px
2. `http://localhost:8080/courses#seminars` — new row links to `/{slug}`
3. Nav highlights **Courses** on the event page

Use the `walkthrough-artifacts` skill if demo evidence is needed.

### 6. Shareable URLs (required)

```text
Local:      http://localhost:8080/{slug}
Production: https://www.linkprosport.com/{slug}
```

Use `BASE_URL` from `.env` when set.

## Page sections (keep order)

1. **Hero** — eyebrow, title, tagline, dates, venue
2. **Moon divider** — decorative SVG row (optional for non-retreat events; can keep for brand consistency)
3. **Gallery** — three images
4. **Mauve section** — venue intro + two columns (schedule + logistics/pricing)
5. **Sand section** — instructor photo + bio
6. **CTA** — `#register` with primary action
7. **Footer** — standard LINK Pro links

## Styling

- Default palette is in `events/event-template.html` (`--event-sand`, `--event-terracotta`, etc.)
- Typography: Playfair Display + Inter (same as main site)
- For a different host brand, tune `:root` on that page only — do not extract shared CSS unless multiple events share one theme

## What not to do

- Do not add a build step or JSON renderer for v1 (inline HTML like course pages)
- Do not duplicate nav markup — use `build:nav`
- Do not skip the courses.html entry when the event should appear in **In-Person Seminars**
- Do not add footer nav links for one-off events unless the user asks

## Example

**User:** “Add a March fascia intensive in Newport.”

1. `content/newport-fascia-intensive-source.md`
2. `cp events/event-template.html newport-fascia-intensive.html` → fill content
3. `images/events/newport-fascia-intensive/` + photos
4. Register in `build-nav.js`, `npm run build:nav`
5. New `.seminar` on `courses.html` → `/newport-fascia-intensive`
6. Test + output local/production URLs
