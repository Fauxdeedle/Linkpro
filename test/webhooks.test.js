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

