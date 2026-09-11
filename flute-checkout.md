# Flute Checkout — LINK Pro

Payment handling for LINK Pro courses and seminars using [Flute Checkout](https://developer.flute.com/docs/online-payments/flute-checkout). This branch adds a small Node/Express backend on top of the existing static HTML site.

**Branch:** `cursor/flute-test-706b`

## What it does

- Enroll / Register buttons on `courses.html` start a Flute hosted checkout session
- Redirect to Flute-hosted checkout
- Success page verifies payment via the Flute API
- Webhook endpoint logs completed payments

## Products

| Product | Price | `data-flute-product` | Post-purchase redirect |
| --- | --- | --- | --- |
| Pelvis 1.0 | $100 | `pelvis-1` | `/pelvis-1-course.html` |
| Lower Limb Injury Prevention | $199 | `llip` | `/courses.html#online` |
| Upper Limb seminar | $1,500 | `seminar-upper-limb` | `/courses.html#seminars` |

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
| `BASE_URL` | Public site URL (required for return redirects) |

### Run locally

```bash
npm install
npm start
```

On startup you should see either `Flute: configured` or `Flute: add credentials in .env to enable checkout`.

### Test checkout

1. Open `http://localhost:8080/courses.html`
2. Click **Enroll Now** — Flute Checkout opens
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
| `POST` | `/api/create-checkout-session` | Body: `{ "productId": "pelvis-1" }` → `{ "url": "https://public.flute.com/checkout/..." }` |
| `GET` | `/api/checkout-session/:sessionId` | Verify payment status after redirect |
| `GET` | `/api/flute-config` | Returns `{ "configured": true }` when credentials are set |
| `POST` | `/api/webhooks/flute` | Flute webhook receiver (HMAC verified) |

## Flow

```
courses.html button click
  → js/flute-checkout.js
  → POST /api/create-checkout-session
  → redirect to Flute Checkout
  → customer pays
  → redirect to checkout-success.html?session_id=...
  → GET /api/checkout-session/:sessionId
  → show course access link

Parallel: Flute → POST /api/webhooks/flute → payment_session.completed
```

## Adding a product

1. Add an entry to `server/config/products.js` with `amount` in whole USD dollars.
2. Add a button with `data-flute-product="your-product-id"`.
3. Include `<script src="js/flute-checkout.js"></script>` on the page.

## Links

- [Flute Checkout docs](https://developer.flute.com/docs/online-payments/flute-checkout)
- [Flute API authentication](https://developer.flute.com/docs/getting-started/creating-an-api-token)
- [Flute webhooks](https://developer.flute.com/docs/getting-started/webhooks)
