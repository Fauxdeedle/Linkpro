#!/usr/bin/env node
/**
 * Grant course access and log each course on the purchase sheet.
 *
 * CSV columns: email,courseId
 * Course ids: pelvis-1, pelvis-3, llip
 *
 * Usage:
 *   node scripts/grant-access.js purchasers.csv
 *
 * Reads UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN, or ENTITLEMENT_FILE
 * for a local JSON store. A Redis grant also needs the Google Sheets variables
 * in .env.example. See .env.example.
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { entitlementStoreMode } = require('../lib/entitlements');
const { importGrantCsv } = require('../lib/grant-csv');
const { recordManualGrant } = require('../lib/purchase-sheet');

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node scripts/grant-access.js purchasers.csv');
    process.exit(1);
  }

  const mode = entitlementStoreMode();
  if (mode === 'memory') {
    console.error(
      'Refusing to grant: no Upstash Redis or ENTITLEMENT_FILE. Access would be discarded.'
    );
    process.exit(1);
  }

  const text = fs.readFileSync(file, 'utf8');
  const result = await importGrantCsv(text);
  console.log(`Store: ${mode}`);
  console.log(`Granted ${result.granted.length}`);
  for (const row of result.granted) {
    console.log(`  ${row.email} → ${row.courseId}`);
  }
  if (result.skipped.length) {
    console.log(`Skipped ${result.skipped.length}`);
    for (const row of result.skipped) {
      console.log(`  ${row.line}`);
    }
  }

  let sheetFailed = false;
  for (const row of result.granted) {
    try {
      const recorded = await recordManualGrant({
        email: row.email,
        courseId: row.courseId,
      });
      if (recorded.recorded) {
        console.log(`  sheet ${recorded.action}: ${row.email} → ${row.courseId}`);
      } else {
        console.error(`  sheet skipped: ${row.email} → ${row.courseId}`);
        sheetFailed = true;
      }
    } catch (err) {
      console.error(`  sheet failed: ${row.email} → ${row.courseId}: ${err.message}`);
      sheetFailed = true;
    }
  }

  if (mode === 'redis' && result.granted.length && sheetFailed) {
    console.error('Access was saved, but the purchase sheet was not updated.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
