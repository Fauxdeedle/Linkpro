const {
  isConfigured,
  createPaymentSession,
  getPaymentSession,
} = require('./flute');
const { products, getProduct } = require('../server/config/products');

const SUCCESS_TRANSACTION_STATUSES = new Set([
  'Authorized',
  'Captured',
  'PartiallyAuthorized',
  'Scheduled',
  'InProgress',
]);

function getBaseUrl() {
  const value = process.env.BASE_URL?.trim();
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

function buildPaymentSessionRequest(product) {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    throw new Error('BASE_URL must be a valid absolute http(s) URL');
  }

  return {
    amount: product.amount,
    returnUrl: `${baseUrl}/checkout-success.html?session_id={{paymentSessionId}}`,
    paymentMethodTypes: ['card'],
    metadata: { productId: product.id },
    referenceId: `${product.id}-${Date.now()}`,
  };
}

function isSuccessfulTransaction(session) {
  const transactionStatus =
    session.transactionDetails?.status ||
    session.transactionDetails?.transactionStatus;

  return (
    session.status === 'Completed' &&
    Boolean(transactionStatus) &&
    SUCCESS_TRANSACTION_STATUSES.has(transactionStatus)
  );
}

function isValidCheckoutUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function formatCheckoutSession(session) {
  const productId =
    session.metadata?.productId ||
    Object.keys(products)
      .sort((a, b) => b.length - a.length)
      .find((id) => session.referenceId?.startsWith(`${id}-`));
  const product = getProduct(productId);
  const transactionStatus =
    session.transactionDetails?.status ||
    session.transactionDetails?.transactionStatus;
  const paid = isSuccessfulTransaction(session);
  const status =
    paid
      ? 'paid'
      : session.status === 'Completed'
        ? 'failed'
        : session.status?.toLowerCase() || 'unknown';

  return {
    status,
    sessionStatus: session.status,
    transactionStatus,
    productId,
    productName: product?.name,
    successUrl: product?.successUrl || '/courses.html',
    retryUrl: productId
      ? `/checkout.html?product=${encodeURIComponent(productId)}`
      : '/courses.html',
  };
}

function getFluteConfig() {
  if (!isConfigured()) {
    return { error: 'Flute is not configured', status: 503 };
  }
  if (!getBaseUrl()) {
    return { error: 'BASE_URL is not configured', status: 503 };
  }
  return { configured: true };
}

async function createCheckoutSession(productId) {
  if (!isConfigured()) {
    return {
      error: 'Flute is not configured. Copy .env.example to .env and add your sandbox credentials.',
      status: 503,
    };
  }
  if (!getBaseUrl()) {
    return {
      error: 'BASE_URL must be configured as the public checkout origin.',
      status: 503,
    };
  }

  const product = getProduct(productId);
  if (!product) {
    return { error: 'Unknown product or missing product amount in config', status: 400 };
  }

  const session = await createPaymentSession(buildPaymentSessionRequest(product));
  if (!session?.id || !isValidCheckoutUrl(session.checkoutUrl)) {
    throw new Error('Flute returned an incomplete checkout session');
  }

  return {
    sessionId: session.id,
    checkoutUrl: session.checkoutUrl,
    productName: product.name,
  };
}

async function getCheckoutSession(sessionId) {
  if (!isConfigured()) {
    return { error: 'Flute is not configured', status: 503 };
  }

  const session = await getPaymentSession(sessionId);
  return formatCheckoutSession(session);
}

module.exports = {
  SUCCESS_TRANSACTION_STATUSES,
  getBaseUrl,
  buildPaymentSessionRequest,
  isSuccessfulTransaction,
  isValidCheckoutUrl,
  formatCheckoutSession,
  getFluteConfig,
  createCheckoutSession,
  getCheckoutSession,
};
