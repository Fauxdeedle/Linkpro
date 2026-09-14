# TODO

Personal task tracker for LINK Pro. Check items off as you go (`- [ ]` → `- [x]`).

See also: [`flute-checkout.md`](flute-checkout.md) for full setup docs and troubleshooting.

---

## Flute setup (required to test checkout)

Everything below must be done before **Enroll Now** on `courses.html` will work.

### Account & local environment

- [ ] Create a [Flute merchant account](https://flute.com/) (sandbox is fine for now)
- [ ] Install Node.js 20.19+ on your machine
- [ ] Run `npm install` in the project root
- [ ] Copy `.env.example` to `.env` (`cp .env.example .env`)

### Flute Dashboard — API keys

- [ ] Open your Flute merchant dashboard and create a **Public Auth Client** (sandbox)
- [ ] Set `FLUTE_CLIENT_ID` in `.env`
- [ ] Set `FLUTE_CLIENT_SECRET` in `.env`
- [ ] Set `FLUTE_ENVIRONMENT=sandbox` in `.env`

See [Flute API keys](https://developer.flute.com/docs/getting-started/api-keys) and [Creating an API token](https://developer.flute.com/docs/getting-started/creating-an-api-token) for details.

### Products & amounts

Product amounts are defined in `server/config/products.js`. Defaults match the prices on `courses.html`:

- [ ] **Pelvis 1.0** ($100) — `pelvis-1`
- [ ] **Lower Limb Injury Prevention** ($199) — `llip`
- [ ] **Fascia & 2TLS — Upper Limb seminar** ($1,500) — `seminar-upper-limb`

Optional: override amounts via env vars (`FLUTE_AMOUNT_PELVIS_1`, `FLUTE_AMOUNT_LLIP`, `FLUTE_AMOUNT_SEMINAR`).

### Server config

- [ ] Set `PORT=8080` (or your preferred port) in `.env`
- [ ] Set `BASE_URL=http://localhost:8080` in `.env` (must match where you run the server)
- [ ] Run `npm start` and confirm the console shows **Flute: configured**
- [ ] Open http://localhost:8080/courses.html

### Verify checkout works

- [ ] Click **Enroll Now** on a course — Flute Checkout page opens
- [ ] Pay with sandbox test card **4111 1111 1111 1111** (any future expiry, any CVC)
- [ ] Land on `checkout-success.html` with payment verified and a course link

### Webhooks (recommended before relying on post-payment logic)

Local testing:

- [ ] Use the [Flute Webhooks CLI](https://developer.flute.com/docs/sdk/webhooks-cli) to forward events to `localhost:8080/api/webhooks/flute`
- [ ] Copy the webhook signing secret into `FLUTE_WEBHOOK_SECRET` in `.env`
- [ ] Restart the server and complete a test checkout
- [ ] Confirm server logs `Payment complete:` for `payment_session.completed`

Production (when deployed on Vercel):

- [ ] Complete the **Vercel deployment** checklist below
- [ ] Add webhook endpoint `https://your-domain.com/api/webhooks/flute` in the Flute dashboard
- [ ] Subscribe to `payment_session.completed`
- [ ] Copy the HMAC signing secret into Vercel as `FLUTE_WEBHOOK_SECRET` and redeploy

---

## Vercel deployment

Ensure `api/` routes and `vercel.json` are on your deploy branch before deploying.

### Connect the project

- [ ] Go to [vercel.com/new](https://vercel.com/new) and import `dramstutz-LP/Linkpro`
- [ ] Framework preset: **Other** (no build command needed)
- [ ] Leave **Build Command** and **Output Directory** empty
- [ ] Set production branch to `cursor/flute-test-706b` (or `main` after merge)
- [ ] Deploy once to get a preview URL (e.g. `https://linkpro-xxx.vercel.app`)

### Environment variables

In Vercel → Project → **Settings → Environment Variables**, add:

- [ ] `BASE_URL` → your production URL (e.g. `https://linkpro.com` or your `.vercel.app` URL for testing)
- [ ] `FLUTE_CLIENT_ID` → sandbox client ID for preview, production client ID for live
- [ ] `FLUTE_CLIENT_SECRET` → matching client secret
- [ ] `FLUTE_ENVIRONMENT` → `sandbox` for preview, `production` for live
- [ ] `FLUTE_WEBHOOK_SECRET` → add after creating the webhook endpoint (see below)
- [ ] `FLUTE_AMOUNT_PELVIS_1`, `FLUTE_AMOUNT_LLIP`, `FLUTE_AMOUNT_SEMINAR` → optional overrides

Apply to **Production** (and **Preview** if you want checkout on preview deploys).

### Flute webhook (production)

- [ ] Flute dashboard → create webhook endpoint
- [ ] URL: `https://your-domain.com/api/webhooks/flute`
- [ ] Event: `payment_session.completed`
- [ ] Copy the HMAC signing secret into Vercel as `FLUTE_WEBHOOK_SECRET`
- [ ] Redeploy so the new env var is picked up
- [ ] Complete a test checkout and confirm Vercel function logs show `Payment complete:`

### Custom domain (optional)

- [ ] Vercel → Project → **Domains** → add your domain
- [ ] Update DNS with the records Vercel provides
- [ ] Update `BASE_URL` in Vercel to match the custom domain
- [ ] Update the Flute webhook URL to use the custom domain
- [ ] Redeploy

### Verify production checkout

- [ ] Open `https://your-domain.com/courses.html`
- [ ] Click **Enroll Now** — Flute Checkout opens
- [ ] Complete payment (sandbox card in test mode, real card only with production credentials)
- [ ] Land on `checkout-success.html` with payment verified

### Go live

- [ ] Switch Flute env vars in Vercel from sandbox to production credentials
- [ ] Set `FLUTE_ENVIRONMENT=production`
- [ ] Create a separate Flute webhook endpoint for production (or update existing)
- [ ] Confirm Flute merchant activation is complete before accepting real payments


## Flute follow-ups (after basic checkout works)

- [ ] Implement fulfillment in `server/routes/webhooks.js` (grant course access by email, token, or database)
- [ ] Gate `pelvis-1-course.html` so only purchasers can access lessons
- [ ] Add remaining products (Pelvis 3.0, other seminars, 3-seminar bundle) to `server/config/products.js`
- [ ] Wire enroll buttons on `index.html` (still links to linkprosport.com today)
- [ ] Collect customer email on checkout for reliable fulfillment
- [ ] Switch to production Flute credentials and complete merchant activation before accepting real payments
- [ ] Set up receipts / purchase confirmation emails

---

## My tasks

Add your own items below.

- [ ] 
- [ ] 
- [ ] 

---

## Notes

<!-- Free-form notes, links, blockers, etc. -->
