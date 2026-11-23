const { listPurchases } = require('./purchase-sheet');
const { listPurchaseLog } = require('./purchase-log');

const BUNDLE_ID = 'seminar-bundle';
const BUNDLE_EVENTS = new Set([
  'seminar-upper-limb',
  'seminar-lower-limb',
  'seminar-trunk-pelvis',
]);

function mergePurchaseRecords(logRecords, sheetRecords) {
  const bySession = new Map();
  for (const record of sheetRecords || []) {
    if (record && record.sessionId) bySession.set(record.sessionId, record);
  }
  for (const record of logRecords || []) {
    if (record && record.sessionId) bySession.set(record.sessionId, record);
  }
  return [...bySession.values()];
}

function signupNote({ logFailed, sheetFailed, sheetConfigured }) {
  if (logFailed && (sheetFailed || !sheetConfigured)) return 'Signups could not be read.';
  if (logFailed) return 'The hub log could not be read. This list includes the purchase sheet.';
  if (sheetFailed) return 'The purchase sheet could not be read. This list is from the hub log.';
  if (!sheetConfigured) return 'The purchase sheet is not connected. This list is from the hub log.';
  return '';
}

function amountLabel(amount) {
  if (amount === '' || amount == null) return '';
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return '';
  return `$${numeric.toLocaleString('en-US')}`;
}

function paidLabel(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function signupsForEvent(productId, records) {
  if (!productId) return [];
  return (records || [])
    .filter((record) => {
      if (!record || !record.email) return false;
      if (record.productId === productId) return true;
      return record.productId === BUNDLE_ID && BUNDLE_EVENTS.has(productId);
    })
    .slice()
    .sort(
      (a, b) =>
        String(b.paidAt || '').localeCompare(String(a.paidAt || '')) ||
        String(a.email).localeCompare(String(b.email))
    )
    .map((record) => ({
      email: record.email,
      amountLabel: amountLabel(record.amount),
      paidLabel: paidLabel(record.paidAt),
      bundle: record.productId === BUNDLE_ID,
      sessionId: record.sessionId,
    }));
}

function attachSignups(event, records) {
  if (!event) return event;
  return {
    ...event,
    signups: signupsForEvent(event.productId, records),
  };
}

async function readSignupSources(options = {}) {
  let logRecords = [];
  let sheetRecords = [];
  let logFailed = false;
  let sheetFailed = false;
  let sheetConfigured = false;

  try {
    logRecords = await listPurchaseLog(options);
  } catch (err) {
    logFailed = true;
    console.error('Purchase log read failed:', err.message);
  }

  try {
    const sheet = await listPurchases(options);
    sheetConfigured = Boolean(sheet.configured);
    sheetRecords = sheet.records || [];
  } catch (err) {
    sheetFailed = true;
    console.error('Purchase sheet read failed:', err.message);
  }

  return {
    records: mergePurchaseRecords(logRecords, sheetRecords),
    signupsNote: signupNote({ logFailed, sheetFailed, sheetConfigured }),
  };
}

module.exports = {
  attachSignups,
  mergePurchaseRecords,
  readSignupSources,
  signupsForEvent,
  signupNote,
};
