# Protected course access (optional branch)

This branch adds an opt-in account and entitlement layer around Flute Checkout.
It is intentionally isolated so the existing public course can remain unchanged
until the feature is approved.

## Architecture

```text
Clerk account
  → authenticated checkout request
  → Clerk user ID stored in Flute payment-session metadata
  → captured Flute session
  → payment return or signed webhook
  → Neon payment record + course entitlement
  → authenticated course API returns lessons and account progress
```

Flute remains the source of payment truth. Clerk identifies the purchaser.
Neon stores durable access rights and progress. The browser cannot grant itself
access: `/api/course-access/:courseId` verifies the Clerk token and checks the
database before returning lesson content.

## Vercel setup

1. Add Clerk from the Vercel Marketplace and connect it to this project.
2. Add Neon from the Vercel Marketplace and connect it to this project.
3. Ensure these variables exist for Preview and Production:
   - `CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
   - `DATABASE_URL`
   - the existing Flute variables
4. Run `migrations/001_course_access.sql` in the Neon SQL editor.
5. Deploy this branch to Preview before considering a production merge.
6. Configure the Flute webhook to send `payment_session.completed` to
   `https://your-domain/api/webhooks/flute`.

The webhook secret and Clerk secret key are server-only. Never expose them in
HTML or browser JavaScript.

## Access lifecycle

- Pelvis 1.0 checkout requires a signed-in Clerk user.
- The Clerk user ID is attached to the Flute session as metadata.
- Only a completed, successful, correctly priced payment creates entitlement.
- Replayed payment returns and webhook retries are idempotent by payment session.
- Course data and progress return only for the entitled Clerk user.
- Progress is stored per user, so it follows the user across devices.

## Testing without charging

Use a Clerk development instance, a Neon development branch, and Flute sandbox
credentials on a Vercel Preview deployment. Do not connect this branch to Flute
production until the complete sign-in → sandbox payment → entitlement → course
flow has passed.
