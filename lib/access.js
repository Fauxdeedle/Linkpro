const crypto = require('node:crypto');
const {
  coursePath,
  getCourses,
  getEntitlementStore,
  normalizeEmail,
  safeCoursePath,
} = require('./entitlements');
const { getBaseUrl } = require('./base-url');
const { sendLoginEmail } = require('./login-email');

const ACCESS_COOKIE = 'linkpro_access';
const SESSION_TTL_SECONDS = 180 * 24 * 60 * 60;
const LOGIN_TTL_SECONDS = 30 * 60;
const LOGIN_MESSAGE =
  'If this email has a course, we sent a sign-in link.';

function getAccessSecret() {
  const secret = process.env.ACCESS_SECRET;
  if (!secret || secret.length < 16) {
    return null;
  }
  return secret;
}

function signToken(payload, secret = getAccessSecret()) {
  if (!secret) {
    throw new Error('ACCESS_SECRET must be at least 16 characters');
  }

  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('base64url');
  return `${body}.${signature}`;
}

function readToken(token, { purpose, now = Date.now(), secret = getAccessSecret() } = {}) {
  if (!secret || typeof token !== 'string') {
    return null;
  }

  const separator = token.indexOf('.');
  if (separator <= 0) {
    return null;
  }

  const body = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('base64url');
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  const nowSeconds = Math.floor(now / 1000);
  if (
    !payload ||
    typeof payload.exp !== 'number' ||
    payload.exp <= nowSeconds ||
    (purpose && payload.purpose !== purpose) ||
    !normalizeEmail(payload.email)
  ) {
    return null;
  }

  return payload;
}

function cookieIsSecure() {
  if (process.env.VERCEL) {
    return true;
  }
  return (process.env.BASE_URL || '').startsWith('https://');
}

function serializeSessionCookie(email, now = Date.now()) {
  const token = signToken({
    purpose: 'session',
    email: normalizeEmail(email),
    exp: Math.floor(now / 1000) + SESSION_TTL_SECONDS,
  });
  const parts = [
    `${ACCESS_COOKIE}=${token}`,
    'HttpOnly',
    'Path=/',
    `Max-Age=${SESSION_TTL_SECONDS}`,
    'SameSite=Lax',
  ];
  if (cookieIsSecure()) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

function readCookie(header, name) {
  if (!header || typeof header !== 'string') {
    return null;
  }

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) {
      continue;
    }
    const key = part.slice(0, separator).trim();
    if (key === name) {
      return part.slice(separator + 1).trim();
    }
  }
  return null;
}

function emailFromRequest(req, now = Date.now()) {
  const token = readCookie(req.headers?.cookie, ACCESS_COOKIE);
  const payload = readToken(token, { purpose: 'session', now });
  return payload ? normalizeEmail(payload.email) : null;
}

async function requestCourseAccess({
  email,
  courseId,
  now = Date.now(),
  sendLoginLink = sendLoginEmail,
  store = getEntitlementStore(),
}) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return {
      status: 400,
      body: { error: 'Enter a valid email address.' },
    };
  }

  const courses = await getCourses(normalized, store);
  if (courses.length && getAccessSecret()) {
    const jti = crypto.randomBytes(16).toString('base64url');
    const next = safeCoursePath(coursePath(courseId));
    const token = signToken(
      {
        purpose: 'login',
        email: normalized,
        exp: Math.floor(now / 1000) + LOGIN_TTL_SECONDS,
        jti,
        next,
      },
      getAccessSecret()
    );
    await store.rememberLogin(jti, LOGIN_TTL_SECONDS, now);
    const baseUrl = getBaseUrl();
    if (baseUrl) {
      const url = `${baseUrl}/api/access/verify?token=${encodeURIComponent(token)}`;
      try {
        await sendLoginLink({ to: normalized, url });
      } catch (err) {
        console.error('Login email failed:', err.message);
      }
    } else {
      console.error('Login link was not sent because BASE_URL is not configured');
    }
  }

  return { status: 200, body: { message: LOGIN_MESSAGE } };
}

async function verifyCourseLogin(token, { now = Date.now(), store = getEntitlementStore() } = {}) {
  const payload = readToken(token, { purpose: 'login', now });
  if (!payload || !payload.jti) {
    return { ok: false };
  }

  const consumed = await store.consumeLogin(payload.jti, now);
  if (!consumed) {
    return { ok: false };
  }

  const courses = await getCourses(payload.email, store);
  if (!courses.length) {
    return { ok: false };
  }

  return {
    ok: true,
    cookie: serializeSessionCookie(payload.email, now),
    next: safeCoursePath(payload.next),
  };
}

module.exports = {
  ACCESS_COOKIE,
  LOGIN_MESSAGE,
  LOGIN_TTL_SECONDS,
  SESSION_TTL_SECONDS,
  getAccessSecret,
  signToken,
  readToken,
  serializeSessionCookie,
  readCookie,
  emailFromRequest,
  requestCourseAccess,
  verifyCourseLogin,
};
