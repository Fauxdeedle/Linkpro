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
| Lower Limb Injury Prevention | $199 | `llip` | `/courses.html#online` |
| Upper Limb seminar | $1,500 | `seminar-upper-limb` | `/courses.html#seminars` |
| Lower Limb seminar | $1,500 | `seminar-lower-limb` | `/courses.html#seminars` |
| Trunk & Pelvis seminar | $1,500 | `seminar-trunk-pelvis` | `/courses.html#seminars` |
| Three-seminar bundle | $3,750 | `seminar-bundle` | `/courses.html#seminars` |
| Retreat — shared bunk | $1,350 | `retreat-shared-bunk` | `/nicolette-david-retreat.html` |
| Retreat — one-person king | $2,350 | `retreat-king-single` | `/nicolette-david-retreat.html` |
| Retreat — two-person king | $3,150 | `retreat-king-double` | `/nicolette-david-retreat.html` |

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

## API routes

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/create-checkout-session` | Body: `{ "productId": "pelvis-1" }` → `{ "sessionId": "...", "checkoutUrl": "https://public.flute.com/checkout/...", "productName": "..." }` |
| `GET` | `/api/checkout-session/:sessionId` | Verify payment status after redirect |
| `GET` | `/api/flute-config` | Returns `{ "configured": true }` when credentials are set |
| `POST` | `/api/webhooks/flute` | Flute webhook receiver (HMAC verified) |

## Flow

```
course or retreat checkout link
  → checkout.html?product=...
  → POST /api/create-checkout-session
  → backend creates a session with amount, returnUrl, card method, and product metadata
  → redirect to the returned Flute checkoutUrl
  → customer pays
  → redirect to checkout-success.html?session_id=...
  → GET /api/checkout-session/:sessionId
  → show course access link

Parallel: Flute → POST /api/webhooks/flute → payment_session.completed
```

## Adding a product

1. Add an entry to `server/config/products.js` with `amount` in whole USD dollars.
2. Give it a stable ID, display name, and post-purchase `successUrl`.
3. Optionally add a dedicated amount override to `.env.example`.
4. Add a link to `/checkout.html?product=your-product-id`; the
   `data-flute-product` attribute is supported for non-link controls.

Each item needs this trusted server-side catalog entry so a customer cannot
choose their own price. It does **not** need a separate Flute dashboard setup,
API credential, or Flute product ID. Every purchase creates a new payment
session under the same merchant account.

## Links

- [Flute Checkout docs](https://developer.flute.com/docs/online-payments/flute-checkout)
- [Flute API authentication](https://developer.flute.com/docs/getting-started/creating-an-api-token)
- [Flute webhooks](https://developer.flute.com/docs/getting-started/webhooks)
