const crypto = require('node:crypto');
const { isOnlineCourse, normalizeEmail } = require('./entitlements');
const { getProduct, products } = require('../server/config/products');

const HEADERS = ['Timestamp', 'Email', 'Product', 'Product ID', 'Amount', 'Session ID'];
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

function sheetSettings(env = process.env) {
  const spreadsheetId =
    typeof env.GOOGLE_SHEETS_SPREADSHEET_ID === 'string'
      ? env.GOOGLE_SHEETS_SPREADSHEET_ID.trim()
      : '';
  const email =
    typeof env.GOOGLE_SERVICE_ACCOUNT_EMAIL === 'string'
      ? env.GOOGLE_SERVICE_ACCOUNT_EMAIL.trim()
      : '';
  const privateKeyRaw = env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!spreadsheetId || !email || !privateKeyRaw) {
    return null;
  }
  if (!/^[a-zA-Z0-9-_]+$/.test(spreadsheetId)) {
    throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID is not a valid spreadsheet id');
  }

  const tab = String(env.GOOGLE_SHEETS_TAB || 'Purchases').trim() || 'Purchases';
  return {
    spreadsheetId,
    tab,
    email,
    privateKey: String(privateKeyRaw).replace(/\\n/g, '\n'),
  };
}

function quoteTab(tab) {
  return `'${String(tab).replace(/'/g, "''")}'`;
}

function base64url(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return buffer
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function serviceAccountJwt(settings, nowSeconds) {
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(
    JSON.stringify({
      iss: settings.email,
      scope: SHEETS_SCOPE,
      aud: TOKEN_URL,
      iat: nowSeconds,
      exp: nowSeconds + 3600,
    })
  );
  const unsigned = `${header}.${payload}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), settings.privateKey);
  return `${unsigned}.${base64url(signature)}`;
}

async function parseBody(response) {
  const text = await response.text();
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function googleFetch(fetchImpl, url, options) {
  const response = await fetchImpl(url, options);
  const data = await parseBody(response);
  if (!response.ok) {
    const message =
      data.error?.message ||
      data.error_description ||
      data.raw ||
      response.statusText ||
      'request failed';
    throw new Error(`Purchase sheet request failed (${response.status}): ${message}`);
  }
  return data;
}

async function accessToken(settings, fetchImpl, now) {
  const assertion = serviceAccountJwt(settings, Math.floor(now().getTime() / 1000));
  const data = await googleFetch(fetchImpl, TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!data.access_token) {
    throw new Error('Purchase sheet request failed: Google did not return an access token');
  }
  return data.access_token;
}

function headersMatch(row) {
  return (
    Array.isArray(row) &&
    HEADERS.every((header, index) => String(row[index] ?? '').trim() === header)
  );
}

function catalogEntry(productId) {
  return getProduct(productId) || products[productId] || null;
}

function recordedAmount(productId, fallback) {
  const amount = catalogEntry(productId)?.amount;
  if (Number.isFinite(amount)) {
    return amount;
  }
  const numeric = Number(fallback);
  return Number.isFinite(numeric) ? numeric : '';
}

function timestamp(paidAt, now) {
  const value = paidAt ? new Date(paidAt) : now();
  if (Number.isNaN(value.getTime())) {
    return now().toISOString();
  }
  return value.toISOString();
}

function rowValues({ email, productId, sessionId, amount, paidAt }) {
  const name = catalogEntry(productId)?.name || productId;
  return [paidAt, email, name, productId, recordedAmount(productId, amount), sessionId];
}

function recordFromValues(row) {
  return {
    paidAt: row[0],
    email: row[1],
    product: row[2],
    productId: row[3],
    amount: row[4],
    sessionId: row[5],
  };
}

function paymentRecord(purchase = {}, now = () => new Date()) {
  const email = normalizeEmail(purchase.email);
  const productId = typeof purchase.productId === 'string' ? purchase.productId.trim() : '';
  const sessionId = typeof purchase.sessionId === 'string' ? purchase.sessionId.trim() : '';
  if (!email || !productId || !sessionId) return null;
  return recordFromValues(
    rowValues({
      email,
      productId,
      sessionId,
      amount: purchase.amount,
      paidAt: timestamp(purchase.paidAt, now),
    })
  );
}

function manualGrantRecord(grant = {}, now = () => new Date()) {
  const email = normalizeEmail(grant.email);
  const courseId = typeof grant.courseId === 'string' ? grant.courseId.trim() : '';
  if (!email || !isOnlineCourse(courseId)) return null;
  const name = products[courseId]?.name || courseId;
  const sessionId = `manual:${email}:${courseId}`;
  return recordFromValues([timestamp(undefined, now), email, name, courseId, '', sessionId]);
}

function sheetAmount(value) {
  if (value === '' || value == null) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? value : '';
  const numeric = Number(String(value).replace(/[$,]/g, '').trim());
  return Number.isFinite(numeric) ? numeric : '';
}

function recordFromSheetRow(row) {
  if (!Array.isArray(row)) return null;
  const email = normalizeEmail(String(row[1] ?? ''));
  const productId = String(row[3] ?? '').trim();
  const sessionId = String(row[5] ?? '').trim();
  if (!email || !productId || !sessionId) return null;
  return {
    paidAt: String(row[0] ?? '').trim(),
    email,
    product: String(row[2] ?? '').trim(),
    productId,
    amount: sheetAmount(row[4]),
    sessionId,
  };
}

function valuesUrl(settings, range) {
  return `https://sheets.googleapis.com/v4/spreadsheets/${settings.spreadsheetId}/values/${encodeURIComponent(range)}`;
}

async function upsertRow(settings, fetchImpl, now, sessionId, row) {
  const token = await accessToken(settings, fetchImpl, now);
  const readRange = `${quoteTab(settings.tab)}!A:F`;
  const existing = await googleFetch(fetchImpl, valuesUrl(settings, readRange), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const rows = Array.isArray(existing.values) ? existing.values : [];
  if (!headersMatch(rows[0])) {
    throw new Error(
      'Purchase sheet headers do not match Timestamp, Email, Product, Product ID, Amount, Session ID'
    );
  }

  const found = rows.findIndex(
    (entry, index) => index > 0 && String(entry[5] ?? '') === sessionId
  );
  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  if (found === -1) {
    await googleFetch(
      fetchImpl,
      `${valuesUrl(settings, readRange)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ values: [row] }),
      }
    );
    return { recorded: true, action: 'append' };
  }

  const updateRange = `${quoteTab(settings.tab)}!A${found + 1}:F${found + 1}`;
  await googleFetch(fetchImpl, `${valuesUrl(settings, updateRange)}?valueInputOption=RAW`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ values: [row] }),
  });
  return { recorded: true, action: 'update' };
}

async function recordPurchase(purchase = {}, options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const now = options.now || (() => new Date());
  const record = paymentRecord(purchase, now);
  if (!record) return { recorded: false };

  const settings = sheetSettings(env);
  if (!settings) return { recorded: false };

  const row = [
    record.paidAt,
    record.email,
    record.product,
    record.productId,
    record.amount,
    record.sessionId,
  ];
  return upsertRow(settings, fetchImpl, now, record.sessionId, row);
}

async function recordManualGrant(grant = {}, options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const now = options.now || (() => new Date());
  const record = manualGrantRecord(grant, now);
  if (!record) return { recorded: false };

  const settings = sheetSettings(env);
  if (!settings) return { recorded: false };

  const row = [
    record.paidAt,
    record.email,
    record.product,
    record.productId,
    record.amount,
    record.sessionId,
  ];
  return upsertRow(settings, fetchImpl, now, record.sessionId, row);
}

async function listPurchases(options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const settings = sheetSettings(env);
  if (!settings) return { configured: false, records: [] };

  const token = await accessToken(settings, fetchImpl, options.now || (() => new Date()));
  const readRange = `${quoteTab(settings.tab)}!A:F`;
  const existing = await googleFetch(fetchImpl, valuesUrl(settings, readRange), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const rows = Array.isArray(existing.values) ? existing.values : [];
  if (!rows.length) return { configured: true, records: [] };
  if (!headersMatch(rows[0])) {
    throw new Error(
      'Purchase sheet headers do not match Timestamp, Email, Product, Product ID, Amount, Session ID'
    );
  }

  const records = [];
  for (const row of rows.slice(1)) {
    const record = recordFromSheetRow(row);
    if (record) records.push(record);
  }
  return { configured: true, records };
}

module.exports = {
  HEADERS,
  listPurchases,
  manualGrantRecord,
  paymentRecord,
  recordPurchase,
  recordManualGrant,
};
