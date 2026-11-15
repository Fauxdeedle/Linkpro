const { getProduct } = require('../server/config/products');
const { isOnlineCourse, normalizeEmail } = require('./entitlements');

function configuredValue(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('...')) return '';
  return trimmed;
}

function notifyAddress(env = process.env) {
  return configuredValue(env.EVENT_NOTIFY_EMAIL) || configuredValue(env.SURVEY_NOTIFY_EMAIL);
}

function isLiveEventProduct(productId) {
  if (!productId || isOnlineCourse(productId)) return false;
  return Boolean(getProduct(productId));
}

function dollarLabel(amount) {
  if (!Number.isInteger(amount)) return '';
  return `$${amount.toLocaleString('en-US')}`;
}

function registrationMessage({ productName, email, amount, sessionId }) {
  return {
    text: [`${productName}`, '', `Email: ${email}`, `Amount: ${dollarLabel(amount)}`, `Session ID: ${sessionId}`, ''].join(
      '\n'
    ),
  };
}

async function resendErrorMessage(response) {
  if (!response || typeof response.text !== 'function') return '';
  let body = '';
  try {
    body = await response.text();
  } catch {
    return '';
  }
  if (!body) return '';
  try {
    const parsed = JSON.parse(body);
    const message = parsed?.message || parsed?.error?.message || parsed?.error;
    return typeof message === 'string' ? message : body;
  } catch {
    return body;
  }
}

function shouldNotify(productId, sheetResult, { fromWebhook = false } = {}) {
  if (!isLiveEventProduct(productId)) return false;
  if (sheetResult?.action === 'append') return true;
  return Boolean(fromWebhook && sheetResult && sheetResult.recorded === false);
}

async function sendRegistrationEmail(purchase, { fetchImpl = fetch, env = process.env } = {}) {
  const email = normalizeEmail(purchase.email);
  const productId = typeof purchase.productId === 'string' ? purchase.productId.trim() : '';
  const sessionId = typeof purchase.sessionId === 'string' ? purchase.sessionId.trim() : '';
  const product = getProduct(productId);
  const productName = product?.name || productId;
  const amount = Number.isInteger(product?.amount) ? product.amount : null;
  const summary = `${productName} ${email || ''} ${sessionId}`.trim();
  const apiKey = configuredValue(env.RESEND_API_KEY);
  const from = configuredValue(env.ACCESS_EMAIL_FROM);
  const to = notifyAddress(env);

  if (!apiKey || !from || !to) {
    console.info(`Live event registration (email delivery is not configured): ${summary}`);
    return { sent: false, reason: 'not-configured' };
  }

  const response = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      reply_to: email,
      subject: `Live event registration — ${productName}`,
      ...registrationMessage({ productName, email, amount, sessionId }),
    }),
  });

  if (!response.ok) {
    const message = (await resendErrorMessage(response)).slice(0, 500);
    console.error('Resend rejected the live event registration', {
      status: response.status,
      message,
    });
    return { sent: false, reason: 'rejected', status: response.status, message };
  }

  return { sent: true };
}

async function notifyLiveEventRegistration(purchase, sheetResult, options = {}) {
  const productId = typeof purchase?.productId === 'string' ? purchase.productId.trim() : '';
  if (!shouldNotify(productId, sheetResult, options)) {
    return { sent: false, reason: 'skipped' };
  }

  try {
    return await sendRegistrationEmail(purchase, options);
  } catch (err) {
    console.error('Live event registration email failed:', err.message);
    return { sent: false, reason: 'failed' };
  }
}

module.exports = {
  isLiveEventProduct,
  notifyLiveEventRegistration,
};
