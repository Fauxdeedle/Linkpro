const { verifyToken } = require('@clerk/backend');

function isAuthConfigured() {
  return Boolean(
    getPublishableKey() &&
      (process.env.CLERK_SECRET_KEY || process.env.CLERK_JWT_KEY)
  );
}

function getPublishableKey() {
  return (
    process.env.CLERK_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  );
}

function getBearerToken(req) {
  const authorization = req.headers?.authorization;
  if (typeof authorization !== 'string') {
    return null;
  }
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

function getAuthorizedParties() {
  const values = [
    process.env.BASE_URL,
    process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
    process.env.VERCEL_PROJECT_PRODUCTION_URL &&
      `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`,
    process.env.NODE_ENV !== 'production' && 'http://localhost:8080',
  ];

  return values
    .filter(Boolean)
    .map((value) => {
      try {
        return new URL(value).origin;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

async function authenticateRequest(req, { verify = verifyToken } = {}) {
  if (!isAuthConfigured()) {
    return { error: 'Authentication is not configured', status: 503 };
  }

  const token = getBearerToken(req);
  if (!token) {
    return { error: 'Sign in required', status: 401 };
  }

  try {
    const claims = await verify(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
      jwtKey: process.env.CLERK_JWT_KEY,
      authorizedParties: getAuthorizedParties(),
    });
    if (!claims?.sub) {
      return { error: 'Invalid session', status: 401 };
    }
    return { userId: claims.sub, sessionId: claims.sid };
  } catch {
    return { error: 'Invalid or expired session', status: 401 };
  }
}

function getPublicAuthConfig() {
  if (!isAuthConfigured()) {
    return { error: 'Authentication is not configured', status: 503 };
  }
  return { publishableKey: getPublishableKey() };
}

module.exports = {
  isAuthConfigured,
  getPublishableKey,
  getBearerToken,
  getAuthorizedParties,
  authenticateRequest,
  getPublicAuthConfig,
};
