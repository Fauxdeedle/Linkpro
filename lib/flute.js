const { Flute, Environment } = require('@getflute/sdk');

const SENSITIVE_FIELD_PATTERN =
  /authorization|token|secret|password|card|cvv|cvc|account|routing/i;

function redactSensitiveData(value) {
  if (Array.isArray(value)) {
    return value.map(redactSensitiveData);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        SENSITIVE_FIELD_PATTERN.test(key)
          ? '[REDACTED]'
          : redactSensitiveData(entry),
      ])
    );
  }

  if (typeof value === 'string') {
    return value.replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]');
  }

  return value;
}

async function readResponseBody(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function logFluteError(operation, response, body) {
  const safeBody = redactSensitiveData(body);
  const serializedBody =
    typeof safeBody === 'string'
      ? safeBody.slice(0, 4000)
      : JSON.stringify(safeBody).slice(0, 4000);

  console.error('Flute API request failed', {
    operation,
    status: response.status,
    statusText: response.statusText,
    body: serializedBody,
  });
}

function isConfigured() {
  const clientId = process.env.FLUTE_CLIENT_ID;
  const clientSecret = process.env.FLUTE_CLIENT_SECRET;
  return Boolean(
    clientId &&
      clientSecret &&
      !clientId.startsWith('...') &&
      !clientSecret.startsWith('...')
  );
}

function getEnvironment() {
  return process.env.FLUTE_ENVIRONMENT === 'production'
    ? Environment.Production
    : Environment.Sandbox;
}

let fluteClient = null;

function getFlute() {
  if (!isConfigured()) {
    return null;
  }

  if (!fluteClient) {
    fluteClient = new Flute({
      clientId: process.env.FLUTE_CLIENT_ID,
      clientSecret: process.env.FLUTE_CLIENT_SECRET,
      environment: getEnvironment(),
    });
  }

  return fluteClient;
}

async function createPaymentSession(body) {
  const flute = getFlute();
  if (!flute) {
    throw new Error('Flute is not configured');
  }

  await flute.sessions.authenticate();
  const token = await flute.sessions.getAccessToken();
  const response = await fetch(`${flute.baseUrls.payIntApi}/payment-sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-api-version': '1',
    },
    body: JSON.stringify(body),
  });

  const data = await readResponseBody(response);
  if (!response.ok) {
    logFluteError('createPaymentSession', response, data);
    const message = data?.error?.message || data?.message || response.statusText;
    throw new Error(message);
  }

  return data;
}

async function getPaymentSession(paymentSessionId) {
  const flute = getFlute();
  if (!flute) {
    throw new Error('Flute is not configured');
  }

  await flute.sessions.authenticate();
  const token = await flute.sessions.getAccessToken();
  const response = await fetch(
    `${flute.baseUrls.payIntApi}/payment-sessions/${encodeURIComponent(paymentSessionId)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'x-api-version': '1',
      },
    }
  );

  const data = await readResponseBody(response);
  if (!response.ok) {
    logFluteError('getPaymentSession', response, data);
    const message = data?.error?.message || data?.message || response.statusText;
    throw new Error(message);
  }

  return data;
}

module.exports = {
  getFlute,
  isConfigured,
  createPaymentSession,
  getPaymentSession,
};
