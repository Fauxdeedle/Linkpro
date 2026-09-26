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

function getFluteConfig() {
  if (!isConfigured()) {
    return { error: 'Flute is not configured', status: 503 };
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

  const product = getProduct(productId);
  if (!product) {
    return { error: 'Unknown product or missing product amount in config', status: 400 };
  }

  const session = await createPaymentSession({
    amount: product.amount,
    referenceId: `${product.id}-${Date.now()}`,
  });

  return { sessionId: session.id, productName: product.name };
}

async function getCheckoutSession(sessionId) {
  if (!isConfigured()) {
    return { error: 'Flute is not configured', status: 503 };
  }

  const session = await getPaymentSession(sessionId);
  const productId =
    session.metadata?.productId ||
    Object.keys(products)
      .sort((a, b) => b.length - a.length)
      .find((id) => session.referenceId?.startsWith(`${id}-`));
  const product = getProduct(productId);

  const transactionStatus = session.transactionDetails?.transactionStatus;
  const paid =
    session.status === 'Completed' &&
    transactionStatus &&
    SUCCESS_TRANSACTION_STATUSES.has(transactionStatus);

  return {
    status: paid ? 'paid' : session.status?.toLowerCase() || 'unknown',
    productId,
    productName: product?.name,
    successUrl: product?.successUrl || '/courses.html',
  };
}

module.exports = { getFluteConfig, createCheckoutSession, getCheckoutSession };
