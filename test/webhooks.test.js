const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { processFluteWebhook } = require('../lib/webhooks');

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

test('completed payment-session webhooks fulfill course access', async () => {
  const originalSecret = process.env.FLUTE_WEBHOOK_SECRET;
  process.env.FLUTE_WEBHOOK_SECRET = 'test-webhook-secret';
  const body = JSON.stringify({
    id: 'delivery-2',
    type: 'payment_session.completed',
    data: { object: { id: 'payment-session-1' } },
  });
  let fulfilledSessionId;

  try {
    assert.deepEqual(
      await processFluteWebhook(
        Buffer.from(body),
        signedWebhook(body, process.env.FLUTE_WEBHOOK_SECRET, {
          id: 'delivery-2',
        }),
        {
          fulfill: async (sessionId) => {
            fulfilledSessionId = sessionId;
          },
        }
      ),
      { received: true }
    );
    assert.equal(fulfilledSessionId, 'payment-session-1');
  } finally {
    if (originalSecret === undefined) {
      delete process.env.FLUTE_WEBHOOK_SECRET;
    } else {
      process.env.FLUTE_WEBHOOK_SECRET = originalSecret;
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

