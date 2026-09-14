const {
  getBaseUrl,
  getCheckoutBaseUrl,
  isConfigured,
  createPaymentSession,
  getPaymentSession,
} = require('./flute');
const { getProduct } = require('../server/config/products');

const SUCCESS_TRANSACTION_STATUSES = new Set([
  'Authorized',
  'Captured',
  'PartiallyAuthorized',
  'Scheduled',
  'InProgress',
]);

function getFluteConfig() {
  if (!isConfigured()) {
    return { error: 'Flute is not configured', status: 503 };
  }
  return { configured: true };
}

async function createCheckoutSession(productId, host) {
  if (!isConfigured()) {
    return {
      error: 'Flute is not configured. Copy .env.example to .env and add your sandbox credentials.',
      status: 503,
    };
  }

  const product = getProduct(productId);
  if (!product) {
    return { error: 'Unknown product or missing product amount in config', status: 400 };
  }

  const baseUrl = getBaseUrl(host);
  const session = await createPaymentSession({
    amount: product.amount,
    returnUrl: `${baseUrl}/checkout-success.html?session_id={{paymentSessionId}}`,
    paymentMethodTypes: ['card'],
    metadata: { productId: product.id },
    referenceId: `${product.id}-${Date.now()}`,
    pageName: product.name,
  });

  const checkoutUrl =
    session.checkoutUrl || `${getCheckoutBaseUrl()}/checkout/${session.id}`;

  return { url: checkoutUrl };
}

async function getCheckoutSession(sessionId) {
  if (!isConfigured()) {
    return { error: 'Flute is not configured', status: 503 };
  }

  const session = await getPaymentSession(sessionId);
  const product = getProduct(session.metadata?.productId);

  const transactionStatus = session.transactionDetails?.transactionStatus;
  const paid =
    session.status === 'Completed' &&
    transactionStatus &&
    SUCCESS_TRANSACTION_STATUSES.has(transactionStatus);

  return {
    status: paid ? 'paid' : session.status?.toLowerCase() || 'unknown',
    productId: session.metadata?.productId,
    productName: product?.name,
    successUrl: product?.successUrl || '/courses.html',
  };
}

module.exports = { getFluteConfig, createCheckoutSession, getCheckoutSession };
