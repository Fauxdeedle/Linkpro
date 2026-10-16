#!/usr/bin/env node
/**
 * Grant course access to buyers from the previous site.
 *
 * CSV columns: email,courseId
 * Course ids: pelvis-1, pelvis-3, llip
 *
 * Usage:
 *   node scripts/grant-access.js purchasers.csv
 *
 * Reads UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN, or ENTITLEMENT_FILE
 * for a local JSON store. See .env.example.
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { importGrantCsv } = require('../lib/grant-csv');

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node scripts/grant-access.js purchasers.csv');
    process.exit(1);
  }

  const text = fs.readFileSync(file, 'utf8');
  const result = await importGrantCsv(text);
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
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
