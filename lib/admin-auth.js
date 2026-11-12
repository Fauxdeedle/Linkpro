const crypto = require('node:crypto');

const COOKIE = 'linkpro_admin';
const TTL_SECONDS = 60 * 60 * 12;

function hubPassword(env = process.env) {
  const password = typeof env.ADMIN_HUB_PASSWORD === 'string' ? env.ADMIN_HUB_PASSWORD : '';
  if (!password.trim() || password.trim().startsWith('...')) return '';
  return password;
}

function passwordsMatch(input, expected) {
  const left = crypto.createHash('sha256').update(String(input)).digest();
  const right = crypto.createHash('sha256').update(String(expected)).digest();
  return crypto.timingSafeEqual(left, right);
}

function signSession(password, exp) {
  const payload = Buffer.from(JSON.stringify({ exp })).toString('base64url');
  const signature = crypto.createHmac('sha256', password).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function readCookie(header, name) {
  if (!header || typeof header !== 'string') return '';
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim();
    }
  }
  return '';
}

function cookieIsSecure(env = process.env) {
  return Boolean(env.VERCEL) || String(env.BASE_URL || '').startsWith('https://');
}

function sessionCookie(token, env = process.env, maxAge = TTL_SECONDS) {
  const parts = [
    `${COOKIE}=${token}`,
    'HttpOnly',
    'Path=/',
    `Max-Age=${maxAge}`,
    'SameSite=Lax',
  ];
  if (cookieIsSecure(env)) parts.push('Secure');
  return parts.join('; ');
}

function verifySession(header, env = process.env, nowSeconds = Math.floor(Date.now() / 1000)) {
  const password = hubPassword(env);
  if (!password) return false;
  const token = readCookie(header, COOKIE);
  const separator = token.lastIndexOf('.');
  if (separator <= 0) return false;
  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expected = crypto.createHmac('sha256', password).update(payload).digest('base64url');
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data && typeof data.exp === 'number' && data.exp > nowSeconds;
  } catch {
    return false;
  }
}

function loginResult(password, env = process.env, nowSeconds = Math.floor(Date.now() / 1000)) {
  const expected = hubPassword(env);
  if (!expected) {
    return { status: 503, body: { error: 'The admin hub is not configured.' } };
  }
  if (!passwordsMatch(password, expected)) {
    return { status: 401, body: { error: 'That password is not right.' } };
  }
  const token = signSession(expected, nowSeconds + TTL_SECONDS);
  return {
    status: 200,
    body: { ok: true },
    cookie: sessionCookie(token, env),
  };
}

function logoutResult(env = process.env) {
  return {
    status: 200,
    body: { ok: true },
    cookie: sessionCookie('', env, 0),
  };
}

module.exports = {
  COOKIE,
  hubPassword,
  loginResult,
  logoutResult,
  sessionCookie,
  verifySession,
};
