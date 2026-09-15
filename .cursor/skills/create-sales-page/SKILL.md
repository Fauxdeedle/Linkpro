---
name: create-sales-page
description: "Create a LINK Pro client pitch or program landing page (JSON + shared renderer). Use when the user wants a sales page, client proposal URL, or pitch one-pager from a doc or brief."
---

# Create a LINK Pro sales page

Build shareable static pitch pages: **proposal** (custom training / course packages for a client) or **program** (sub-brand landing like Peak Athleticism).

## When to use

- New client proposal to send by URL (Word doc, email brief, pricing outline)
- Another program-style landing page with pillars, topics, and CTA
- User invokes “sales page”, “client pitch”, “proposal page”

## Reference files

| File | Purpose |
|------|---------|
| [`sharks-proposal.html`](../../sharks-proposal.html) | Working **proposal** example |
| [`content/sharks-proposal.json`](../../content/sharks-proposal.json) | Proposal JSON shape |
| [`peak-athleticism.html`](../../peak-athleticism.html) | Working **program** example |
| [`content/peak-athleticism.json`](../../content/peak-athleticism.json) | Program JSON shape |
| [`sales/sales-page-template.html`](../../sales/sales-page-template.html) | Proposal shell template |
| [`content/sales-page-template.json`](../../content/sales-page-template.json) | JSON starter |
| [`js/sales-page.js`](../../js/sales-page.js) | Shared renderer |
| [`create-course` skill](../create-course/SKILL.md) | Nav/build patterns (same repo conventions) |

## Inputs

Collect from the user or source doc:

| Input | Example | Notes |
|-------|---------|--------|
| `slug` | `acme-training-proposal` | lowercase, hyphenated; file `{slug}.html`, URL `/{slug}` |
| `pageType` | `proposal` or `program` | Required in JSON |
| Client / program name | San Jose Sharks | Hero + meta |
| Source doc | `.docx`, Google Doc paste | Archive as `content/{slug}-source.md` |
| `linkInFooter` | `false` (default) | Only `true` if user wants a site footer link (test/demo pages) |
| `linkInNav` | `false` (default) | Rare; do not add unless user asks |
| Theme | CSS vars in HTML shell | Tune accent colors per client (see Sharks teal, Peak bronze) |
| Images | logos, diagrams | `images/sales/{slug}/` |

**Slug rules:** no spaces; filename `{slug}.html` at repo root (same as `media-kit.html`, `sharks-proposal.html`).

## Workflow

### 1. Archive source material

Save the original brief (not linked on site):

```bash
# content/{slug}-source.md — paste or convert from docx
```

### 2. Create JSON

```bash
cp content/sales-page-template.json content/{slug}.json
```

- Set `"pageType": "proposal"` or `"program"`.
- For **program** pages, copy structure from `content/peak-athleticism.json` instead of the template.
- Fill `meta`, `hero`, body sections, `pricing` (proposals), `cta`.
- Client pitches: set `"meta": { "robots": "noindex, nofollow" }` unless the user wants indexing.

### 3. Create HTML shell

**Proposal:**

```bash
cp sales/sales-page-template.html {slug}.html
```

Replace all `{{PLACEHOLDER}}` tokens (`SLUG`, `PAGE_TITLE`, `META_DESCRIPTION`, `CLIENT_NAME`, `HERO_TITLE_HTML`, `DATES`, `LED_BY`). Adjust `:root` CSS colors for client branding. Keep:

- `data-sales-content="/content/{slug}.json"`
- `data-sales-mount="sales-content"`
- `data-sales-css-prefix="sales"`
- Nav markers + `/css/site-nav.css` + `/js/site-nav.js`
- `<script src="/js/sales-page.js" defer></script>`

**Program:** copy `peak-athleticism.html`, set `data-sales-content`, `data-sales-mount="peak-content"`, `data-sales-css-prefix="peak"`, update static hero/logo paths.

### 4. Assets

- Put images in `images/sales/{slug}/`.
- Reference paths in JSON (`hero.logos`, `figure`, etc.).

### 5. Register navigation

In [`scripts/build-nav.js`](../../scripts/build-nav.js) `activeByFile`:

```javascript
'{slug}.html': null,
```

(or `'peak'` / `'courses'` only if user asked for nav highlight)

```bash
npm run build:nav
```

Commit the HTML files the script updates.

### 6. Footer (optional)

Default: **no** footer link (share URL only).

If `linkInFooter: true`, add after Media Kit on each standard footer (same pages as Media Kit):

```html
<a href="/{slug}">Client pitch (sample)</a>
```

Use a descriptive label if the user prefers (e.g. client name). Do **not** add to `components/site-nav.html` unless requested.

### 7. Verify

```bash
npm start
```

Open `http://localhost:8080/{slug}` and check:

1. Hero and JSON-driven sections render
2. Pricing / letter / CTA match the source doc
3. `noindex` present for client pitches when configured
4. Mobile layout ~400px width
5. Nav scroll behavior unchanged

### 8. Shareable link output (required)

Always end the task with a copy-paste block for the user:

```text
Local:    http://localhost:8080/{slug}
Production: https://YOUR_DOMAIN/{slug}
```

Use `BASE_URL` from `.env` when set; otherwise tell the user to substitute their Vercel or custom domain.

## JSON quick reference

### `pageType: "proposal"`

- `hero`: `client`, `title`, `dates`, `ledBy`, `logos[]`
- `letter`: `salutation`, `paragraphs[]`, `signoff` (use `\n` for line breaks)
- `sections[]`: `title`, `body`, `paragraphs[]`, `bullets[]`, `subsections[]`
- `prepWork`, `processNote`, `days[]`, `includedMaterials[]`, `pricing[]`, optional `figure`
- `cta`: `title`, `body`, `buttonText`, `buttonHref`

### `pageType: "program"`

See `content/peak-athleticism.json`: `intro`, `pillars`, `method`, `classes`, `topics`, optional `throwing`, `quotes`, `cta`.

## What not to do

- Do not add every pitch page to the footer (default unlisted)
- Do not add backend auth or PDF generation in v1
- Do not duplicate renderer logic — extend `js/sales-page.js` if new block types are needed
- Do not skip `npm run build:nav` after creating a new HTML page with nav markers

## Example

**User:** “Create a proposal page for Acme FC from this doc.”

1. Archive → `content/acme-fc-proposal-source.md`
2. `content/acme-fc-proposal.json` with `pageType: proposal`
3. `acme-fc-proposal.html` from template + brand colors
4. Register in `build-nav.js`, run `npm run build:nav`
5. Output local + production URLs (no footer link)
