const { Flute, Environment } = require('@getflute/sdk');

const SENSITIVE_FIELD_PATTERN =
  /authorization|token|secret|password|client.?id|api.?key|card|cvv|cvc|account|routing/i;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 2;

class FluteApiError extends Error {
  constructor(message, { status, data, cause } = {}) {
    super(message, { cause });
    this.name = 'FluteApiError';
    this.status = status;
    this.data = data;
  }
}

function redactSensitiveString(value) {
  return value
    .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(
      /((?:authorization|token|secret|password|client.?id|api.?key|cvv|cvc)\s*[:=]\s*)\S+/gi,
      '$1[REDACTED]'
    );
}

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
    return redactSensitiveString(value);
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

function getFluteErrorMessage(data, response) {
  const message =
    data?.error?.message ||
    data?.message ||
    data?.title ||
    response.statusText ||
    'Flute API request failed';
  const details = data?.error?.details || data?.details || data?.errors;
  const detailMessages = Array.isArray(details)
    ? details
        .map((detail) =>
          typeof detail === 'string'
            ? detail
            : [detail?.field, detail?.message].filter(Boolean).join(': ')
        )
        .filter(Boolean)
    : [];

  return [...new Set([message, ...detailMessages])].join(' — ');
}

function getApiHeaders(token, includeContentType = false) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    ...(includeContentType ? { 'Content-Type': 'application/json' } : {}),
  };
}

function getRetryAfterMs(response) {
  const value = response.headers?.get?.('retry-after');
  if (!value) {
    return null;
  }

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

function getRetryDelayMs(attempt, response, random = Math.random) {
  const retryAfterMs = response ? getRetryAfterMs(response) : null;
  if (retryAfterMs !== null) {
    return retryAfterMs;
  }

  const baseDelay = 250 * 2 ** attempt;
  return baseDelay + Math.floor(random() * baseDelay);
}

function shouldRetryStatus(status) {
  return status === 429 || status === 500 || status === 503;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  return requestFlute('/payment-sessions', {
    operation: 'createPaymentSession',
    method: 'POST',
    body,
  });
}

async function getPaymentSession(paymentSessionId) {
  return requestFlute(
    `/payment-sessions/${encodeURIComponent(paymentSessionId)}`,
    { operation: 'getPaymentSession' }
  );
}

async function requestFlute(
  path,
  {
    operation,
    method = 'GET',
    body,
    flute = getFlute(),
    fetchImpl = fetch,
    sleepImpl = sleep,
    random = Math.random,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
  } = {}
) {
  if (!flute) {
    throw new Error('Flute is not configured');
  }

  let token = await flute.sessions.getAccessToken();
  let refreshedToken = false;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    let response;
    try {
      response = await fetchImpl(`${flute.baseUrls.payIntApi}${path}`, {
        method,
        headers: getApiHeaders(token, body !== undefined),
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (cause) {
      if (attempt < maxRetries) {
        await sleepImpl(getRetryDelayMs(attempt, null, random));
        continue;
      }
      throw new FluteApiError('Flute API request failed after retries', {
        cause,
      });
    }

    const data = await readResponseBody(response);
    if (response.ok) {
      return data;
    }

    if (response.status === 401 && !refreshedToken) {
      token = await flute.sessions.refreshAccessToken();
      refreshedToken = true;
      continue;
    }

    if (attempt < maxRetries && shouldRetryStatus(response.status)) {
      await sleepImpl(getRetryDelayMs(attempt, response, random));
      continue;
    }

    logFluteError(operation, response, data);
    throw new FluteApiError(getFluteErrorMessage(data, response), {
      status: response.status,
      data,
    });
  }

  throw new FluteApiError('Flute API request failed');
}

module.exports = {
  FluteApiError,
  getFlute,
  isConfigured,
  getFluteErrorMessage,
  getApiHeaders,
  getRetryAfterMs,
  getRetryDelayMs,
  shouldRetryStatus,
  requestFlute,
  createPaymentSession,
  getPaymentSession,
};
