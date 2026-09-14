const { Flute, Environment } = require('@getflute/sdk');

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

function getCheckoutBaseUrl() {
  return process.env.FLUTE_ENVIRONMENT === 'production'
    ? 'https://public.flute.com'
    : 'https://public.flute.com';
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

function getBaseUrl(host) {
  if (process.env.BASE_URL) {
    return process.env.BASE_URL.replace(/\/$/, '');
  }
  if (host) {
    return `https://${host}`;
  }
  return `http://localhost:${process.env.PORT || 8080}`;
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

  const data = await response.json();
  if (!response.ok) {
    const message = data?.error?.message || response.statusText;
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

  const data = await response.json();
  if (!response.ok) {
    const message = data?.error?.message || response.statusText;
    throw new Error(message);
  }

  return data;
}

module.exports = {
  getFlute,
  getBaseUrl,
  getCheckoutBaseUrl,
  isConfigured,
  createPaymentSession,
  getPaymentSession,
};
