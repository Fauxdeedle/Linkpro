const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { processFluteWebhook } = require('../lib/webhooks');

const SHEET_KEY = crypto
  .generateKeyPairSync('rsa', { modulusLength: 2048 })
  .privateKey.export({ type: 'pkcs8', format: 'pem' });

function signedWebhook(body, secret, overrides = {}) {
  const id = overrides.id || 'delivery-1';
  const timestamp =
    overrides.timestamp || Math.floor(Date.now() / 1000).toString();
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${id}.${timestamp}.${body}`)
    .digest('base64');

  return {
    'flute-webhook-id': id,
    'flute-webhook-timestamp': timestamp,
    'flute-webhook-signature': `v1,${signature}`,
  };
}

test('valid signed webhooks work without API credentials', async () => {
  const originalSecret = process.env.FLUTE_WEBHOOK_SECRET;
  const originalClientId = process.env.FLUTE_CLIENT_ID;
  const originalClientSecret = process.env.FLUTE_CLIENT_SECRET;
  process.env.FLUTE_WEBHOOK_SECRET = 'test-webhook-secret';
  delete process.env.FLUTE_CLIENT_ID;
  delete process.env.FLUTE_CLIENT_SECRET;

  const body = JSON.stringify({
    id: 'delivery-1',
    type: 'transaction.card.captured',
    data: { object: { id: 'transaction-1', resourceType: 'transaction' } },
  });

  try {
    assert.deepEqual(
      await processFluteWebhook(
        Buffer.from(body),
        signedWebhook(body, process.env.FLUTE_WEBHOOK_SECRET)
      ),
      { received: true }
    );
  } finally {
    if (originalSecret === undefined) {
      delete process.env.FLUTE_WEBHOOK_SECRET;
    } else {
      process.env.FLUTE_WEBHOOK_SECRET = originalSecret;
    }
    if (originalClientId === undefined) {
      delete process.env.FLUTE_CLIENT_ID;
    } else {
      process.env.FLUTE_CLIENT_ID = originalClientId;
    }
    if (originalClientSecret === undefined) {
      delete process.env.FLUTE_CLIENT_SECRET;
    } else {
      process.env.FLUTE_CLIENT_SECRET = originalClientSecret;
    }
  }
});

test('tampered webhooks are rejected', async () => {
  const originalSecret = process.env.FLUTE_WEBHOOK_SECRET;
  process.env.FLUTE_WEBHOOK_SECRET = 'test-webhook-secret';
  const body = JSON.stringify({ type: 'transaction.card.captured' });

  try {
    assert.deepEqual(
      await processFluteWebhook(
        Buffer.from(`${body} `),
        signedWebhook(body, process.env.FLUTE_WEBHOOK_SECRET)
      ),
      { error: 'Webhook signature verification failed', status: 401 }
    );
  } finally {
    if (originalSecret === undefined) {
      delete process.env.FLUTE_WEBHOOK_SECRET;
    } else {
      process.env.FLUTE_WEBHOOK_SECRET = originalSecret;
    }
  }
});

test('a configured purchase sheet error makes the webhook return 500', async () => {
  const originalSecret = process.env.FLUTE_WEBHOOK_SECRET;
  const originalFetch = globalThis.fetch;
  const saved = {
    GOOGLE_SHEETS_SPREADSHEET_ID: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
    GOOGLE_SERVICE_ACCOUNT_EMAIL: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  };
  process.env.FLUTE_WEBHOOK_SECRET = 'test-webhook-secret';
  process.env.GOOGLE_SHEETS_SPREADSHEET_ID = 'sheet123';
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'sheets@example.iam.gserviceaccount.com';
  process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = SHEET_KEY.replace(/\n/g, '\\n');
  globalThis.fetch = async () => ({
    ok: false,
    status: 503,
    statusText: 'unavailable',
    text: async () => JSON.stringify({ error: { message: 'unavailable' } }),
  });

  const body = JSON.stringify({
    type: 'payment_session.completed',
    data: {
      object: {
        id: 'ps_sheet',
        metadata: { productId: 'seminar-upper-limb', customerEmail: 'buyer@example.com' },
      },
    },
  });

  try {
    assert.deepEqual(
      await processFluteWebhook(Buffer.from(body), signedWebhook(body, process.env.FLUTE_WEBHOOK_SECRET)),
      { error: 'Purchase sheet update failed', status: 500 }
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalSecret === undefined) delete process.env.FLUTE_WEBHOOK_SECRET;
    else process.env.FLUTE_WEBHOOK_SECRET = originalSecret;
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

const MAIL_KEYS = [
  'RESEND_API_KEY',
  'ACCESS_EMAIL_FROM',
  'EVENT_NOTIFY_EMAIL',
  'SURVEY_NOTIFY_EMAIL',
];
const SHEET_KEYS = [
  'GOOGLE_SHEETS_SPREADSHEET_ID',
  'GOOGLE_SHEETS_TAB',
  'GOOGLE_SERVICE_ACCOUNT_EMAIL',
  'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY',
];

function saveEnv(keys) {
  return Object.fromEntries(keys.map((key) => [key, process.env[key]]));
}

function restoreEnv(saved) {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function useSheetEnv() {
  process.env.GOOGLE_SHEETS_SPREADSHEET_ID = 'sheet123';
  process.env.GOOGLE_SHEETS_TAB = 'Purchases';
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'sheets@example.iam.gserviceaccount.com';
  process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = SHEET_KEY.replace(/\n/g, '\\n');
}

function useMailEnv() {
  process.env.RESEND_API_KEY = 're_test_key';
  process.env.ACCESS_EMAIL_FROM = 'LINK Pro <access@example.com>';
  process.env.EVENT_NOTIFY_EMAIL = 'events@example.com';
  delete process.env.SURVEY_NOTIFY_EMAIL;
}

function clearMailEnv() {
  for (const key of MAIL_KEYS) delete process.env[key];
}

function createMemorySheet() {
  const rows = [['Timestamp', 'Email', 'Product', 'Product ID', 'Amount', 'Session ID']];
  async function fetchImpl(url, options = {}) {
    const href = String(url);
    if (href.includes('oauth2.googleapis.com/token')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ access_token: 'token' }),
      };
    }
    const decoded = decodeURIComponent(href);
    if (href.includes(':append')) {
      rows.push(JSON.parse(options.body).values[0]);
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ updates: { updatedRows: 1 } }),
      };
    }
    if (options.method === 'PUT') {
      const match = decoded.match(/!A(\d+):F\1/);
      rows[Number(match[1]) - 1] = JSON.parse(options.body).values[0];
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ updatedRows: 1 }),
      };
    }
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ values: rows.map((row) => [...row]) }),
    };
  }
  return { fetchImpl, rows };
}

function completedPayment(productId, email, sessionId) {
  return JSON.stringify({
    type: 'payment_session.completed',
    data: {
      object: {
        id: sessionId,
        metadata: { productId, customerEmail: email },
      },
    },
  });
}

test('a new live-event registration emails once and a retry does not', async () => {
  const saved = saveEnv(['FLUTE_WEBHOOK_SECRET', ...SHEET_KEYS, ...MAIL_KEYS]);
  const originalFetch = globalThis.fetch;
  const emails = [];
  const sheet = createMemorySheet();
  process.env.FLUTE_WEBHOOK_SECRET = 'test-webhook-secret';
  useSheetEnv();
  useMailEnv();
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes('api.resend.com')) {
      emails.push({
        body: JSON.parse(options.body),
        authorization: options.headers.Authorization,
      });
      return { ok: true, status: 200, text: async () => '{}' };
    }
    return sheet.fetchImpl(url, options);
  };
  const body = completedPayment('seminar-upper-limb', 'Buyer@Example.com', 'ps_reg');

  try {
    assert.deepEqual(
      await processFluteWebhook(Buffer.from(body), signedWebhook(body, process.env.FLUTE_WEBHOOK_SECRET)),
      { received: true }
    );
    assert.equal(emails.length, 1);
    assert.equal(emails[0].authorization, 'Bearer re_test_key');
    assert.equal(emails[0].body.to, 'events@example.com');
    assert.equal(emails[0].body.from, 'LINK Pro <access@example.com>');
    assert.equal(emails[0].body.reply_to, 'buyer@example.com');
    assert.equal(
      emails[0].body.subject,
      'Live event registration — Fascia & 2TLS Treatment of the Upper Limb'
    );
    assert.match(emails[0].body.text, /Email: buyer@example.com/);
    assert.match(emails[0].body.text, /Amount: \$1,500/);
    assert.match(emails[0].body.text, /Session ID: ps_reg/);

    assert.deepEqual(
      await processFluteWebhook(Buffer.from(body), signedWebhook(body, process.env.FLUTE_WEBHOOK_SECRET)),
      { received: true }
    );
    assert.equal(emails.length, 1);
    assert.equal(sheet.rows.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(saved);
  }
});

test('an online course payment does not send a registration email', async () => {
  const saved = saveEnv(['FLUTE_WEBHOOK_SECRET', ...SHEET_KEYS, ...MAIL_KEYS]);
  const originalFetch = globalThis.fetch;
  const emails = [];
  const sheet = createMemorySheet();
  process.env.FLUTE_WEBHOOK_SECRET = 'test-webhook-secret';
  useSheetEnv();
  useMailEnv();
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes('api.resend.com')) {
      emails.push(JSON.parse(options.body));
      return { ok: true, status: 200, text: async () => '{}' };
    }
    return sheet.fetchImpl(url, options);
  };
  const body = completedPayment('pelvis-1', 'buyer@example.com', 'ps_course');

  try {
    assert.deepEqual(
      await processFluteWebhook(Buffer.from(body), signedWebhook(body, process.env.FLUTE_WEBHOOK_SECRET)),
      { received: true }
    );
    assert.equal(emails.length, 0);
    assert.equal(sheet.rows[1][3], 'pelvis-1');
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(saved);
  }
});

test('a live-event webhook still records when registration email is not configured', async () => {
  const saved = saveEnv(['FLUTE_WEBHOOK_SECRET', ...SHEET_KEYS, ...MAIL_KEYS]);
  const originalFetch = globalThis.fetch;
  const sheet = createMemorySheet();
  process.env.FLUTE_WEBHOOK_SECRET = 'test-webhook-secret';
  useSheetEnv();
  clearMailEnv();
  globalThis.fetch = async (url, options = {}) => {
    assert.equal(String(url).includes('api.resend.com'), false);
    return sheet.fetchImpl(url, options);
  };
  const body = completedPayment('seminar-upper-limb', 'buyer@example.com', 'ps_nomail');

  try {
    assert.deepEqual(
      await processFluteWebhook(Buffer.from(body), signedWebhook(body, process.env.FLUTE_WEBHOOK_SECRET)),
      { received: true }
    );
    assert.equal(sheet.rows[1][5], 'ps_nomail');
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(saved);
  }
});

test('a live-event webhook emails when the purchase sheet is not configured', async () => {
  const saved = saveEnv(['FLUTE_WEBHOOK_SECRET', ...SHEET_KEYS, ...MAIL_KEYS]);
  const originalFetch = globalThis.fetch;
  const emails = [];
  process.env.FLUTE_WEBHOOK_SECRET = 'test-webhook-secret';
  for (const key of SHEET_KEYS) delete process.env[key];
  useMailEnv();
  delete process.env.EVENT_NOTIFY_EMAIL;
  process.env.SURVEY_NOTIFY_EMAIL = 'concierge@example.com';
  globalThis.fetch = async (url, options = {}) => {
    assert.match(String(url), /api\.resend\.com/);
    emails.push(JSON.parse(options.body));
    return { ok: true, status: 200, text: async () => '{}' };
  };
  const body = completedPayment('retreat-shared-bunk', 'Guest@Example.com', 'ps_retreat');

  try {
    assert.deepEqual(
      await processFluteWebhook(Buffer.from(body), signedWebhook(body, process.env.FLUTE_WEBHOOK_SECRET)),
      { received: true }
    );
    assert.equal(emails.length, 1);
    assert.equal(emails[0].to, 'concierge@example.com');
    assert.equal(emails[0].reply_to, 'guest@example.com');
    assert.match(emails[0].subject, /Nicolette David Retreat — Shared Bunk Room/);
    assert.match(emails[0].text, /Amount: \$1,350/);
    assert.match(emails[0].text, /Session ID: ps_retreat/);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(saved);
  }
});

test('a rejected registration email still accepts the webhook', async () => {
  const saved = saveEnv(['FLUTE_WEBHOOK_SECRET', ...SHEET_KEYS, ...MAIL_KEYS]);
  const originalFetch = globalThis.fetch;
  const sheet = createMemorySheet();
  process.env.FLUTE_WEBHOOK_SECRET = 'test-webhook-secret';
  useSheetEnv();
  useMailEnv();
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes('api.resend.com')) {
      return {
        ok: false,
        status: 422,
        text: async () => JSON.stringify({ message: 'blocked' }),
      };
    }
    return sheet.fetchImpl(url, options);
  };
  const body = completedPayment('seminar-bundle', 'buyer@example.com', 'ps_reject');

  try {
    assert.deepEqual(
      await processFluteWebhook(Buffer.from(body), signedWebhook(body, process.env.FLUTE_WEBHOOK_SECRET)),
      { received: true }
    );
    assert.equal(sheet.rows[1][3], 'seminar-bundle');
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(saved);
  }
});

test('signed malformed JSON is rejected after signature verification', async () => {
  const originalSecret = process.env.FLUTE_WEBHOOK_SECRET;
  process.env.FLUTE_WEBHOOK_SECRET = 'test-webhook-secret';
  const body = '{"type":';

  try {
    assert.deepEqual(
      await processFluteWebhook(
        Buffer.from(body),
        signedWebhook(body, process.env.FLUTE_WEBHOOK_SECRET)
      ),
      { error: 'Invalid webhook payload', status: 400 }
    );
  } finally {
    if (originalSecret === undefined) {
      delete process.env.FLUTE_WEBHOOK_SECRET;
    } else {
      process.env.FLUTE_WEBHOOK_SECRET = originalSecret;
    }
  }
});

