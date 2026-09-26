const test = require('node:test');
const assert = require('node:assert/strict');

const { getApiHeaders, getFluteErrorMessage } = require('../lib/flute');

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
