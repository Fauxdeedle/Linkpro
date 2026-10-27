const {
  isConfigured,
  createPaymentSession,
  getPaymentSession,
} = require('./flute');
const { products, getProduct } = require('../server/config/products');
const {
  grantCourse,
  isOnlineCourse,
  normalizeEmail,
} = require('./entitlements');
const { getBaseUrl } = require('./base-url');
const { serializeSessionCookie } = require('./access');
const { recordPurchase } = require('./purchase-sheet');

const SUCCESS_TRANSACTION_STATUSES = new Set([
  'Authorized',
  'Captured',
  'Settled',
  'Scheduled',
  'InProgress',
  'Cleared',
]);

function buildPaymentSessionRequest(product, customerEmail) {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    throw new Error('BASE_URL must be a valid absolute http(s) URL');
  }

  const email = normalizeEmail(customerEmail);
  if (!email) {
    throw new Error('A valid customer email is required');
  }

  return {
    amount: product.amount,
    returnUrl: `${baseUrl}/checkout-success.html?session_id={{paymentSessionId}}`,
    paymentMethodTypes: ['card'],
    metadata: { productId: product.id, customerEmail: email },
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

async function rememberPurchase(session, email, productId) {
  const sessionId = typeof session.id === 'string' ? session.id.trim() : '';
  if (!email || !productId || !sessionId) {
    return;
  }

  try {
    await recordPurchase({
      email,
      productId,
      sessionId,
      amount: getTransactionAmount(session),
    });
  } catch (err) {
    console.error('Purchase sheet update failed:', err.message);
  }
}

async function grantPaidCheckout(session) {
  const formatted = formatCheckoutSession(session);
  if (formatted.status !== 'paid') {
    return { ...formatted, accessGranted: false, accessCookie: null };
  }

  const email = normalizeEmail(session.metadata?.customerEmail);
  await rememberPurchase(session, email, formatted.productId);

  if (!email || !isOnlineCourse(formatted.productId)) {
    return { ...formatted, accessGranted: false, accessCookie: null };
  }

  await grantCourse(email, formatted.productId);
  let accessCookie = null;
  try {
    accessCookie = serializeSessionCookie(email);
  } catch (err) {
    console.error('Paid course could not set an access cookie:', err.message);
  }

  return {
    ...formatted,
    accessGranted: Boolean(accessCookie),
    accessCookie,
  };
}

async function createCheckoutSession(productId, customerEmail) {
  const email = normalizeEmail(customerEmail);
  if (!email) {
    return {
      error: 'Enter the email that should have access to this purchase.',
      status: 400,
    };
  }

  const product = getProduct(productId);
  if (!product) {
    return { error: 'Unknown product or missing product amount in config', status: 400 };
  }

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

  const session = await createPaymentSession(
    buildPaymentSessionRequest(product, email)
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

  const session = await getPaymentSession(sessionId);
  return grantPaidCheckout(session);
}

function publicCheckoutResult(result) {
  if (!result || result.error) {
    return result;
  }

  const { accessCookie, ...body } = result;
  return body;
}

module.exports = {
  SUCCESS_TRANSACTION_STATUSES,
  getBaseUrl,
  buildPaymentSessionRequest,
  isSuccessfulTransaction,
  isValidCheckoutUrl,
  formatCheckoutSession,
  grantPaidCheckout,
  getCheckoutErrorStatus,
  getFluteConfig,
  createCheckoutSession,
  getCheckoutSession,
  publicCheckoutResult,
};
