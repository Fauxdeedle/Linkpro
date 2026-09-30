const test = require('node:test');
const assert = require('node:assert/strict');

const {
  FluteApiError,
  getApiHeaders,
  getFluteErrorMessage,
  requestFlute,
} = require('../lib/flute');

function response(status, body, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: {
      get(name) {
        return headers[name.toLowerCase()] ?? null;
      },
    },
    async text() {
      return body === undefined ? '' : JSON.stringify(body);
    },
  };
}

function fakeFlute() {
  const calls = { get: 0, refresh: 0 };
  return {
    calls,
    baseUrls: { payIntApi: 'https://sandbox.api.flute.com/pay-int-api' },
    sessions: {
      async getAccessToken() {
        calls.get += 1;
        return 'cached-token';
      },
      async refreshAccessToken() {
        calls.refresh += 1;
        return 'refreshed-token';
      },
    },
  };
}

test('Flute requests use the current API without a legacy version pin', () => {
  const headers = getApiHeaders('test-token', true);

  assert.deepEqual(headers, {
    Authorization: 'Bearer test-token',
    Accept: 'application/json',
    'Content-Type': 'application/json',
  });
  assert.equal('x-api-version' in headers, false);
});

test('Flute validation errors include rejected field details', () => {
  const message = getFluteErrorMessage(
    {
      error: {
        type: 'validation_error',
        message: 'Invalid payment session',
        details: [
          {
            field: 'paymentMethodTypes',
            message: "Allowed values: 'card', 'ach'",
          },
        ],
      },
    },
    { statusText: 'Bad Request' }
  );

  assert.equal(
    message,
    "Invalid payment session — paymentMethodTypes: Allowed values: 'card', 'ach'"
  );
});

test('Flute requests reuse cached tokens and send the documented session body', async () => {
  const flute = fakeFlute();
  let request;

  const result = await requestFlute('/payment-sessions', {
    operation: 'createPaymentSession',
    method: 'POST',
    body: { amount: 100, paymentMethodTypes: ['card'] },
    flute,
    fetchImpl: async (url, options) => {
      request = { url, options };
      return response(200, {
        id: 'session-1',
        checkoutUrl: 'https://public.flute.com/checkout/session-1',
      });
    },
  });

  assert.equal(flute.calls.get, 1);
  assert.equal(flute.calls.refresh, 0);
  assert.equal(
    request.url,
    'https://sandbox.api.flute.com/pay-int-api/payment-sessions'
  );
  assert.equal(request.options.headers.Authorization, 'Bearer cached-token');
  assert.deepEqual(JSON.parse(request.options.body), {
    amount: 100,
    paymentMethodTypes: ['card'],
  });
  assert.equal(result.id, 'session-1');
});

test('401 refreshes the token once and retries the request', async () => {
  const flute = fakeFlute();
  const authorizations = [];

  const result = await requestFlute('/payment-sessions/session-1', {
    operation: 'getPaymentSession',
    flute,
    fetchImpl: async (_url, options) => {
      authorizations.push(options.headers.Authorization);
      return authorizations.length === 1
        ? response(401, { error: { message: 'Expired token' } })
        : response(200, { id: 'session-1', status: 'Completed' });
    },
  });

  assert.equal(flute.calls.refresh, 1);
  assert.deepEqual(authorizations, [
    'Bearer cached-token',
    'Bearer refreshed-token',
  ]);
  assert.equal(result.status, 'Completed');
});

test('429 and 503 responses retry with the server delay then backoff', async () => {
  const flute = fakeFlute();
  const delays = [];
  const responses = [
    response(429, { error: { message: 'Slow down' } }, { 'retry-after': '2' }),
    response(503, { error: { message: 'Unavailable' } }),
    response(200, { id: 'session-1' }),
  ];

  const result = await requestFlute('/payment-sessions', {
    operation: 'createPaymentSession',
    flute,
    fetchImpl: async () => responses.shift(),
    sleepImpl: async (delay) => delays.push(delay),
    random: () => 0,
  });

  assert.equal(result.id, 'session-1');
  assert.deepEqual(delays, [2000, 500]);
});

test('validation errors are not retried and preserve the upstream status', async () => {
  const flute = fakeFlute();
  let requests = 0;

  await assert.rejects(
    requestFlute('/payment-sessions', {
      operation: 'createPaymentSession',
      flute,
      fetchImpl: async () => {
        requests += 1;
        return response(400, {
          error: {
            message: 'Invalid payment session',
            details: [{ field: 'amount', message: 'Must be positive' }],
          },
        });
      },
    }),
    (error) => {
      assert.ok(error instanceof FluteApiError);
      assert.equal(error.status, 400);
      assert.equal(
        error.message,
        'Invalid payment session — amount: Must be positive'
      );
      return true;
    }
  );
  assert.equal(requests, 1);
});

test('network failures are bounded by timeout-aware retries', async () => {
  const flute = fakeFlute();
  let requests = 0;
  let suppliedSignal;

  await assert.rejects(
    requestFlute('/payment-sessions', {
      operation: 'createPaymentSession',
      flute,
      timeoutMs: 25,
      fetchImpl: async (_url, options) => {
        requests += 1;
        suppliedSignal = options.signal;
        throw new Error('socket closed');
      },
      sleepImpl: async () => {},
      random: () => 0,
    }),
    (error) => {
      assert.ok(error instanceof FluteApiError);
      assert.match(error.message, /after retries/);
      return true;
    }
  );

  assert.equal(requests, 3);
  assert.ok(suppliedSignal instanceof AbortSignal);
});
