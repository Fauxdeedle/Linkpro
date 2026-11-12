---
name: create-in-person-event
description: "Create a LINK Pro in-person event landing page (retreat, seminar, intensive) and list it on the courses and homepage catalogs. Use when adding retreats, workshops, or hosted events that need a detail page plus a catalog card."
---

# Create a LINK Pro in-person event page

Training event pages are generated from JSON. Do not copy an HTML page for a new event.

The generated layout follows the Nicolette David retreat (hero, rule, optional gallery, details, instructor, register). Colors and wording follow the homepage: charcoal, cream, gold, short clinical sentences. The retreat page itself stays hand-built.

## When to use

- New retreat, workshop, or hosted intensive
- User asks for an in-person event page, retreat landing URL, or courses listing for an event

## Reference files

| File | Purpose |
|------|---------|
| [`content/events/_template.json`](../../content/events/_template.json) | Field starter. Copy this. |
| [`content/events/seminar-upper-limb.json`](../../content/events/seminar-upper-limb.json) | Working generated example |
| [`lib/event-pages.js`](../../lib/event-pages.js) | `renderEventPage` and `renderSeminarCard` |
| [`scripts/build-events.js`](../../scripts/build-events.js) | Writes pages, catalog cards, nav, analytics |
| [`nicolette-david-retreat.html`](../../nicolette-david-retreat.html) | Static retreat page. Not overwritten. |
| [`site-notes.md`](../../site-notes.md) | Editor-facing how-to |

## Add an event

1. Copy `content/events/_template.json` to `content/events/{slug}.json`. The filename must match `slug`.
2. Set `pageMode` to `generated`, `status` to `upcoming` or `coming-soon`, and `listOn` to the catalogs that should show a card (`courses`, `home`).
3. Fill `catalog`, `hero`, `details`, `instructor`, `gallery`, and `cta`. Leave `gallery` as `[]` and `schedule` as `[]` when there are no photos or a day plan. Empty sections are omitted.
4. Set `price` to the whole-dollar checkout amount and `productId` to the slug when registration is open. Leave both out for coming soon. The admin hub at `/admin` does this for a new event.
5. Run `npm run build:events`.

That writes `{slug}.html`, refreshes the cards between `LINKPRO_EVENTS_START` / `LINKPRO_EVENTS_END` on `courses.html` and `index.html`, and registers the page so Courses is the active nav item.

Do not hand-edit `{slug}.html`. The next build replaces it.

## Edit an event

Change `content/events/{slug}.json` and run `npm run build:events` again.

## End or remove an event

- `status: "ended"` drops the card from both catalogs and keeps the page, with the note “This training has ended.”
- Delete `content/events/{slug}.json` and run `npm run build:events` to delete a generated page and its card.
- A `pageMode: "static"` record only feeds the catalog. Deleting it does not delete a hand-built HTML file. The Baja retreat uses this so `nicolette-david-retreat.html` is left alone.

## Static exception

Use `pageMode: "static"` only when the page is maintained by hand. The retreat record is `listOn: ["courses"]` so it does not appear on the homepage.

## Checkout

Register buttons on generated pages use `data-flute-product` and `/checkout.html?product={productId}`. Catalog cards link to `/{slug}`, not to checkout. Checkout reads the event `price` and returns the buyer to `/{slug}.html`.

## Verify

```bash
npm start
```

Check:

1. `http://localhost:8080/{slug}` — hero, any gallery, details, register or coming soon, mobile ~400px
2. `http://localhost:8080/courses#seminars` and the homepage courses section — card order follows `sort`
3. Nav highlights Courses on the event page

```text
Local:      http://localhost:8080/{slug}
Production: https://www.linkprosport.com/{slug}
```

## What not to do

- Do not copy `events/event-template.html` or `nicolette-david-retreat.html` for a new training
- Do not edit the generated HTML or the catalog blocks by hand
- Do not invent a schedule, venue, or biography that is not in the source material
- Do not add a footer or main-nav link for one event unless the user asks
