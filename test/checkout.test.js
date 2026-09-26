const test = require('node:test');
const assert = require('node:assert/strict');

const { products, getProduct } = require('../server/config/products');
const {
  buildPaymentSessionRequest,
  formatCheckoutSession,
  isSuccessfulTransaction,
  isValidCheckoutUrl,
} = require('../lib/checkout');

const expectedProducts = {
  'pelvis-1': 100,
  llip: 199,
  'seminar-upper-limb': 1500,
  'seminar-lower-limb': 1500,
  'seminar-trunk-pelvis': 1500,
  'seminar-bundle': 3750,
  'retreat-shared-bunk': 1350,
  'retreat-king-single': 2350,
  'retreat-king-double': 3150,
};

test('catalog contains every displayed checkout item at its advertised price', () => {
  assert.equal(Object.keys(products).length, 9);

  for (const [id, amount] of Object.entries(expectedProducts)) {
    assert.equal(getProduct(id)?.amount, amount, id);
  }
});

test('hosted session payload uses a trusted product and documented fields', () => {
  const originalBaseUrl = process.env.BASE_URL;
  process.env.BASE_URL = 'https://linkprosport.com/some/path';

  try {
    const payload = buildPaymentSessionRequest(getProduct('seminar-bundle'));

    assert.equal(payload.amount, 3750);
    assert.equal(
      payload.returnUrl,
      'https://linkprosport.com/checkout-success.html?session_id={{paymentSessionId}}'
    );
    assert.deepEqual(payload.paymentMethodTypes, ['card']);
    assert.deepEqual(payload.metadata, { productId: 'seminar-bundle' });
    assert.match(payload.referenceId, /^seminar-bundle-\d+$/);
  } finally {
    if (originalBaseUrl === undefined) {
      delete process.env.BASE_URL;
    } else {
      process.env.BASE_URL = originalBaseUrl;
    }
  }
});

test('checkout URL validation requires HTTPS', () => {
  assert.equal(
    isValidCheckoutUrl('https://public.flute.com/checkout/session-id'),
    true
  );
  assert.equal(
    isValidCheckoutUrl('http://public.flute.com/checkout/session-id'),
    false
  );
  assert.equal(isValidCheckoutUrl('not a url'), false);
});

test('verification accepts only documented successful transaction states', () => {
  for (const status of [
    'Authorized',
    'Captured',
    'PartiallyAuthorized',
    'Scheduled',
    'InProgress',
  ]) {
    assert.equal(
      isSuccessfulTransaction({
        status: 'Completed',
        transactionDetails: { status },
      }),
      true,
      status
    );
  }

  assert.equal(
    isSuccessfulTransaction({
      status: 'Completed',
      transactionDetails: { status: 'Declined' },
    }),
    false
  );
  assert.equal(
    isSuccessfulTransaction({
      status: 'Created',
      transactionDetails: { status: 'Captured' },
    }),
    false
  );
});

test('verification resolves product metadata and terminal failures', () => {
  const paid = formatCheckoutSession({
    status: 'Completed',
    metadata: { productId: 'retreat-king-single' },
    transactionDetails: { status: 'Captured' },
  });
  assert.equal(paid.status, 'paid');
  assert.equal(paid.productId, 'retreat-king-single');
  assert.equal(paid.successUrl, '/nicolette-david-retreat.html');

  const failed = formatCheckoutSession({
    status: 'Completed',
    referenceId: 'seminar-lower-limb-123',
    transactionDetails: { status: 'Declined' },
  });
  assert.equal(failed.status, 'failed');
  assert.equal(failed.productId, 'seminar-lower-limb');
  assert.equal(
    failed.retryUrl,
    '/checkout.html?product=seminar-lower-limb'
  );

  assert.equal(
    formatCheckoutSession({ status: 'Cancelled' }).status,
    'cancelled'
  );
  assert.equal(formatCheckoutSession({ status: 'Expired' }).status, 'expired');
});
