const {
  isConfigured,
  createPaymentSession,
} = require('./flute');
const { products, getProduct } = require('../server/config/products');

const SUCCESS_TRANSACTION_STATUSES = new Set([
  'Authorized',
  'Captured',
  'Settled',
  'Scheduled',
  'InProgress',
  'Cleared',
]);

function getBaseUrl() {
  const candidates = [
    process.env.BASE_URL,
    process.env.VERCEL_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ];

  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (!value) {
      continue;
    }

    try {
      const url = new URL(
        value.includes('://') ? value : `https://${value}`
      );
      const isFluteApiHost =
        url.hostname === 'api.flute.com' ||
        url.hostname.endsWith('.api.flute.com');
      if (['http:', 'https:'].includes(url.protocol) && !isFluteApiHost) {
        return url.origin;
      }
    } catch {
      // Try the next available deployment URL.
    }
  }

  return null;
}

function buildPaymentSessionRequest(product, userId) {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    throw new Error('BASE_URL must be a valid absolute http(s) URL');
  }

  return {
    amount: product.amount,
    returnUrl: `${baseUrl}/checkout-success.html?session_id={{paymentSessionId}}`,
    paymentMethodTypes: ['card'],
    metadata: {
      productId: product.id,
      ...(userId ? { userId } : {}),
    },
    referenceId: `${product.id}-${Date.now()}`,
  };
}

function getTransactionAmount(session) {
  const amount =
    session.transactionDetails?.transactionReceipt?.amount ??
    session.transactionDetails?.amount;
  const numericAmount = Number(amount);
  return Number.isFinite(numericAmount) ? numericAmount : null;
}

function isSuccessfulTransaction(session, expectedAmount) {
  const transactionStatus =
    session.transactionDetails?.status ||
    session.transactionDetails?.transactionStatus;
  const transactionAmount = getTransactionAmount(session);
  const amountMatches =
    expectedAmount === undefined ||
    transactionAmount === null ||
    transactionAmount === expectedAmount;

  return (
    session.status === 'Completed' &&
    Boolean(transactionStatus) &&
    SUCCESS_TRANSACTION_STATUSES.has(transactionStatus) &&
    amountMatches
  );
}

function isValidCheckoutUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'public.flute.com';
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
  const paid = isSuccessfulTransaction(session, product?.amount);
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

function getCheckoutErrorStatus(error) {
  if (error?.status === 400 || error?.status === 404) {
    return error.status;
  }
  if (error?.status === 429 || error?.status === 503) {
    return 503;
  }
  return 502;
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

async function createCheckoutSession(productId, userId) {
  if (!isConfigured()) {
    return {
      error: 'Flute is not configured. Copy .env.example to .env and add your sandbox credentials.',
      status: 503,
    };
  }
  if (!getBaseUrl()) {
    return {
      error:
        'No public checkout origin is available. Set BASE_URL when running outside Vercel.',
      status: 503,
    };
  }

  const product = getProduct(productId);
  if (!product) {
    return { error: 'Unknown product or missing product amount in config', status: 400 };
  }
  if (product.courseId && !userId) {
    return { error: 'Sign in required before purchasing this course', status: 401 };
  }

  const session = await createPaymentSession(
    buildPaymentSessionRequest(product, userId)
  );
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

  const { fulfillPaymentSession } = require('./course-access');
  return fulfillPaymentSession(sessionId);
}

module.exports = {
  SUCCESS_TRANSACTION_STATUSES,
  getBaseUrl,
  buildPaymentSessionRequest,
  isSuccessfulTransaction,
  isValidCheckoutUrl,
  formatCheckoutSession,
  getCheckoutErrorStatus,
  getFluteConfig,
  createCheckoutSession,
  getCheckoutSession,
};
