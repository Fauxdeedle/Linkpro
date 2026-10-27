const crypto = require('node:crypto');
const { normalizeEmail } = require('./entitlements');
const { products } = require('../server/config/products');

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

function recordedAmount(productId, fallback) {
  const amount = products[productId]?.amount;
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
  const name = products[productId]?.name || productId;
  return [paidAt, email, name, productId, recordedAmount(productId, amount), sessionId];
}

function valuesUrl(settings, range) {
  return `https://sheets.googleapis.com/v4/spreadsheets/${settings.spreadsheetId}/values/${encodeURIComponent(range)}`;
}

async function recordPurchase(purchase = {}, options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const now = options.now || (() => new Date());
  const email = normalizeEmail(purchase.email);
  const productId = typeof purchase.productId === 'string' ? purchase.productId.trim() : '';
  const sessionId = typeof purchase.sessionId === 'string' ? purchase.sessionId.trim() : '';
  if (!email || !productId || !sessionId) {
    return { recorded: false };
  }

  const settings = sheetSettings(env);
  if (!settings) {
    return { recorded: false };
  }

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

  const row = rowValues({
    email,
    productId,
    sessionId,
    amount: purchase.amount,
    paidAt: timestamp(purchase.paidAt, now),
  });
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

module.exports = {
  HEADERS,
  recordPurchase,
};
