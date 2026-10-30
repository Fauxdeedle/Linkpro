---
name: grant-course-access
description: "Grant LINK Pro online course access and log it on the Purchases sheet. Use when the user asks to add someone to the access list, give a buyer a course, or grant pelvis-1, pelvis-3, or llip."
---

# Grant course access

Give one person one or more online courses in the entitlement store, and log each course on the Purchases sheet.

## When to use

- Add an email to the access list
- Grant Pelvis 1.0, Pelvis 3.0, or Lower Limb Injury Prevention
- Comp a course for someone who did not check out

## Course ids

| User says | Course id |
|-----------|-----------|
| Pelvis 1, Pelvis 1.0 | `pelvis-1` |
| Pelvis 3, Pelvis 3.0 | `pelvis-3` |
| LLIP, Lower Limb, Lower Limb Injury Prevention | `llip` |

Stop if a requested course is not one of those three. Seminars and retreats are not online courses. `scripts/grant-access.js` skips them, and they are not written to the sheet.

## What gets written

Access is an Upstash Redis set, `entitlement:{email}`. The purchase sheet row uses the existing columns:

`Timestamp | Email | Product | Product ID | Amount | Session ID`

- One row per email and course.
- Session ID is `manual:{email}:{courseId}` with the email already lowercased. A repeat grant updates that row.
- Product and Product ID come from `server/config/products.js`.
- Amount stays blank. Do not copy the catalog price onto a manual grant.

## Workflow

1. Normalize the email (trim, lowercase). Reject an address that is not a single email.
2. Map each course to an id from the table above.
3. Require a durable store and the purchase sheet before granting. `.env` (gitignored) needs:

   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - `GOOGLE_SHEETS_SPREADSHEET_ID`
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`

   `GOOGLE_SHEETS_TAB` is optional and defaults to `Purchases`. If any required value is missing, pull Vercel **production** env into `.env` without committing it. Do not print Redis tokens, the service-account private key, or `ACCESS_SECRET`.

4. Refuse to grant when those values are still missing. An in-memory grant disappears when the process exits. A Redis grant whose sheet write does not happen is not done.
5. Write a temp CSV outside the repo, one row per course:

   ```csv
   email,courseId
   person@example.com,pelvis-1
   person@example.com,llip
   ```

6. Run:

   ```bash
   node scripts/grant-access.js /tmp/linkpro-grant.csv
   ```

7. Delete the temp CSV. Do not commit the email, the CSV, or `.env`.
8. Confirm `getCourses` for that email includes every granted id, and the script logged `sheet append` or `sheet update` for each course. `Store:` must be `redis`.
9. If access was saved and the sheet was not, say that plainly and stop. Retrying the same CSV is safe: Redis `SADD` and the `manual:` session id both update in place.
10. Do not send a login email unless asked. The buyer opens that course and enters the same email. If the address has that course, the site emails a one-time link and shows a confirmation page.

## References

| File | Purpose |
|------|---------|
| `scripts/grant-access.js` | CSV import, store guard, sheet write |
| `lib/purchase-sheet.js` | `recordManualGrant` |
| `lib/entitlements.js` | Course ids and Redis store |
| `.cursor/rules/purchase-sheet.mdc` | Sheet contract |
| `site-notes.md` | Human-facing purchase sheet notes |
