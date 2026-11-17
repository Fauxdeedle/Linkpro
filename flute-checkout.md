# Flute Checkout — LINK Pro

Payment handling for LINK Pro courses and seminars using [Flute Checkout](https://developer.flute.com/docs/online-payments/flute-checkout). This branch adds a small Node/Express backend on top of the existing static HTML site.

## What it does

- Enroll / Register buttons create a payment session on the backend
- The browser redirects to the session-specific Flute-hosted checkout URL
- Success page verifies payment via the Flute API
- Webhook endpoint logs completed payments

Card details stay on Flute's hosted page and never touch this application.
Checkout currently requests card payments explicitly. Flute uses one merchant
API configuration for every item; there are no per-item products to create in
the Flute dashboard.

## Products

| Product | Price | `data-flute-product` | Post-purchase redirect |
| --- | --- | --- | --- |
| Pelvis 1.0 | $100 | `pelvis-1` | `/pelvis-1-course.html` |
| Lower Limb Injury Prevention | $199 | `llip` | `/llip-course.html` |
| Upper Limb seminar | $1,500 | `seminar-upper-limb` | `/seminar-upper-limb.html` |
| Lower Limb seminar | $1,500 | `seminar-lower-limb` | `/seminar-lower-limb.html` |
| Fascia Normalization and 2TLS: Trunk and Pelvis | $1,500 | `seminar-trunk-pelvis` | `/seminar-trunk-pelvis.html` |
| Three-seminar bundle | $3,750 | `seminar-bundle` | `/live-events` |
| Retreat — shared bunk | $1,350 | `retreat-shared-bunk` | `/nicolette-david-retreat.html` |
| Retreat — one-person king | $2,350 | `retreat-king-single` | `/nicolette-david-retreat.html` |
| Retreat — two-person king | $3,150 | `retreat-king-double` | `/nicolette-david-retreat.html` |

Seminar catalog cards link to the training page. The full list is `/live-events`. The homepage shows the first three of those events. The Register button on a generated page carries `data-flute-product`. The Lower Limb Injury Prevention card on `courses.html` is not using `data-flute-product` right now. It opens `/llip-course.html` directly so the lessons can be reviewed. Pelvis 3.0 (`/pelvis-3-course.html`) is also open and is not in this catalog yet.

Generated live events take their Flute name, whole-dollar amount, and success URL `/{slug}.html` from `content/events/{slug}.json`. The price shown in the page header is the charged price. A student rate typed into the page copy is not a second product. Courses, the three-seminar bundle, and the retreat rooms stay in `server/config/products.js`. The bundle still returns to `/live-events`. Clearing an event price removes checkout for that event, including Upper Limb, Lower Limb, and Trunk & Pelvis. Their names remain in `products.js`.

Create, edit, and archive those events at `/admin`. See **Admin hub** in `site-notes.md`. A local save writes the JSON and rebuilds the page, the `/live-events` cards, and the homepage feature row. On Vercel, Save commits that change to `admin/live-events` and opens a pull request into `main`. Merge the pull request when the preview looks right. A missing token fails the save. `ADMIN_HUB_PASSWORD` gates the page. Leave it unset until a password is chosen. Archiving an event does not remove Purchases-sheet rows or payments already taken in Flute.

## Project layout

```
lib/
  flute.js                 # Flute client + payment session API
  checkout.js              # Create / verify checkout sessions
  webhooks.js              # Flute webhook handler
server/
  config/products.js       # Product catalog with USD amounts
  routes/checkout.js       # Checkout API routes
  routes/webhooks.js       # Flute webhook handler
js/flute-checkout.js       # Client: enroll button → Checkout redirect
api/                       # Vercel serverless equivalents
```

## Setup

### Prerequisites

- Node.js 20.19+
- A [Flute merchant account](https://flute.com/) with sandbox API keys

### Environment variables

Copy `.env.example` to `.env`:

| Variable | Description |
| --- | --- |
| `FLUTE_CLIENT_ID` | Merchant API client ID |
| `FLUTE_CLIENT_SECRET` | Merchant API client secret |
| `FLUTE_ENVIRONMENT` | `sandbox` or `production` |
| `FLUTE_WEBHOOK_SECRET` | HMAC secret from webhook endpoint setup |
| `BASE_URL` | Optional public site URL override; Vercel's deployment URL is used automatically when unset |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | Purchase sheet id from the sheet URL |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Service account that can edit the sheet |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | PEM private key. Escaped `\n` sequences are accepted |
| `GOOGLE_SHEETS_TAB` | Optional tab name. Defaults to `Purchases` |
| `ADMIN_HUB_PASSWORD` | Password for `/admin`. Unset means the page loads and every admin action fails |
| `ADMIN_GITHUB_TOKEN` | GitHub token used when `/admin` commits event files on Vercel |
| `ADMIN_GITHUB_REPO` | `owner/name` repository those commits update |
| `ADMIN_GITHUB_BRANCH` | Review branch for admin saves. Defaults to `admin/live-events`. A value equal to the base branch is ignored |
| `ADMIN_GITHUB_BASE` | Branch the review pull request merges into. Defaults to `main` |

### Run locally

```bash
npm install
npm start
```

On startup you should see either `Flute: configured` or `Flute: add credentials in .env to enable checkout`.

### Test checkout

1. Open `http://localhost:8080/courses.html`
2. Click **Enroll Now** — the local loading page creates a session and redirects to Flute Checkout
3. Complete payment using sandbox test card **4111 1111 1111 1111**
4. You are redirected to `checkout-success.html`, which verifies the session

### Webhooks

Register a webhook in the Flute dashboard pointing to:

```
https://your-domain.com/api/webhooks/flute
```

Subscribe to `payment_session.completed`.

### Purchase sheet

A completed payment appends one row to the Google Sheet named by `GOOGLE_SHEETS_SPREADSHEET_ID`. Courses, seminars, and retreats are all recorded. A repeated webhook for the same Flute session updates that row instead of adding another one. Online course access is unchanged, and older payments are not backfilled.

Share the spreadsheet with `GOOGLE_SERVICE_ACCOUNT_EMAIL` as Editor. The tab (`Purchases`, unless `GOOGLE_SHEETS_TAB` is set) must use this header row:

`Timestamp | Email | Product | Product ID | Amount | Session ID`

The success page writes the same row when the buyer returns. A sheet error there does not block course access. A sheet error on the webhook returns 500 so Flute retries.

`scripts/grant-access.js` writes the same columns for a comped online course. The Session ID is `manual:{email}:{courseId}`, and Amount is blank. A repeat of that grant updates the row.

A new live-event row also emails `EVENT_NOTIFY_EMAIL`, or `SURVEY_NOTIFY_EMAIL` when that is unset. The From address is `ACCESS_EMAIL_FROM`. Reply-To is the buyer. The message names the event, the buyer email, the whole-dollar amount, and the Flute session id. An update for the same session does not send again. Online courses are not emailed. If the sheet is not configured, only the webhook sends that email. A mail failure is logged and does not change the payment or the sheet. Missing `RESEND_API_KEY`, `ACCESS_EMAIL_FROM`, or a notify address logs the registration and skips the email.

## API routes

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/access/continue` | Body: `{ "email": "...", "courseId": "pelvis-1" }` → `{ "action": "login" }` or `{ "action": "pay", "checkoutUrl": "..." }` |
| `POST` | `/api/create-checkout-session` | Body: `{ "productId": "pelvis-1", "customerEmail": "..." }` → `{ "sessionId": "...", "checkoutUrl": "https://public.flute.com/checkout/...", "productName": "..." }`. Refuses an online course the email already has. |
| `GET` | `/api/checkout-session/:sessionId` | Verify payment status after redirect |
| `GET` | `/api/flute-config` | Returns `{ "configured": true }` when credentials are set |
| `POST` | `/api/webhooks/flute` | Flute webhook receiver (HMAC verified) |
| `GET` | `/api/admin/session` | Admin hub session. `503` when `ADMIN_HUB_PASSWORD` is unset |
| `POST` | `/api/admin/session` | Body: `{ "password": "..." }` sets the admin cookie |
| `GET` | `/api/admin/events` | Generated live events for the hub |
| `POST` | `/api/admin/events` | Create a live event from name, date, price, and copy |
| `GET` | `/api/admin/events/:slug` | One generated event |
| `PUT` | `/api/admin/events/:slug` | Save name, date, price, and copy. The slug stays fixed |
| `DELETE` | `/api/admin/events/:slug` | Remove the generated page, both catalog cards, and checkout |

## Flow

```
online course
  → course page
  → cookie already has this course: show the lessons
  → otherwise POST /api/access/continue with the email
  → email has this course: one-time link, then /access-link-sent
  → email does not: Flute checkoutUrl

seminar or retreat
  → checkout.html?product=...
  → POST /api/create-checkout-session
  → backend creates a session with amount, returnUrl, card method, and product metadata
  → redirect to the returned Flute checkoutUrl
  → customer pays
  → redirect to checkout-success.html?session_id=...
  → GET /api/checkout-session/:sessionId
  → show enrollment confirmation

Parallel: Flute → POST /api/webhooks/flute → payment_session.completed
```

## Adding a product

Online courses, the seminar bundle, and retreat rooms:

1. Add an entry to `server/config/products.js` with `amount` in whole USD dollars.
2. Give it a stable ID, display name, and post-purchase `successUrl`.
3. Optionally add a dedicated amount override to `.env.example`.
4. Add a link to `/checkout.html?product=your-product-id` for a retreat room. An online course card links to `/{slug}-course`. The `data-flute-product` attribute is supported for non-link controls.

A new live event does not get a `products.js` entry. Save it in `/admin`, or add `content/events/{slug}.json` and run `npm run build:events`. The event file supplies the charged price.

Each item needs this trusted server-side catalog entry so a customer cannot
choose their own price. It does **not** need a separate Flute dashboard setup,
API credential, or Flute product ID. Every purchase creates a new payment
session under the same merchant account.

## Links

- [Flute Checkout docs](https://developer.flute.com/docs/online-payments/flute-checkout)
- [Flute API authentication](https://developer.flute.com/docs/getting-started/creating-an-api-token)
- [Flute webhooks](https://developer.flute.com/docs/getting-started/webhooks)
