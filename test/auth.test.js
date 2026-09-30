const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getBearerToken,
  authenticateRequest,
  getPublicAuthConfig,
} = require('../lib/auth');

test('authentication extracts bearer tokens only', () => {
  assert.equal(
    getBearerToken({ headers: { authorization: 'Bearer session-token' } }),
    'session-token'
  );
  assert.equal(
    getBearerToken({ headers: { authorization: 'Basic credentials' } }),
    null
  );
});

test('authentication verifies Clerk claims and returns the user ID', async () => {
  const originalPublishableKey = process.env.CLERK_PUBLISHABLE_KEY;
  const originalSecretKey = process.env.CLERK_SECRET_KEY;
  process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_example';
  process.env.CLERK_SECRET_KEY = 'sk_test_example';

  try {
    const result = await authenticateRequest(
      { headers: { authorization: 'Bearer valid-token' } },
      {
        verify: async (token) => {
          assert.equal(token, 'valid-token');
          return { sub: 'user_123', sid: 'session_123' };
        },
      }
    );
    assert.deepEqual(result, {
      userId: 'user_123',
      sessionId: 'session_123',
    });
    assert.deepEqual(getPublicAuthConfig(), {
      publishableKey: 'pk_test_example',
    });
  } finally {
    if (originalPublishableKey === undefined) {
      delete process.env.CLERK_PUBLISHABLE_KEY;
    } else {
      process.env.CLERK_PUBLISHABLE_KEY = originalPublishableKey;
    }
    if (originalSecretKey === undefined) {
      delete process.env.CLERK_SECRET_KEY;
    } else {
      process.env.CLERK_SECRET_KEY = originalSecretKey;
    }
  }
});

test('authentication rejects missing and invalid sessions', async () => {
  const originalPublishableKey = process.env.CLERK_PUBLISHABLE_KEY;
  const originalSecretKey = process.env.CLERK_SECRET_KEY;
  process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_example';
  process.env.CLERK_SECRET_KEY = 'sk_test_example';

  try {
    assert.deepEqual(await authenticateRequest({ headers: {} }), {
      error: 'Sign in required',
      status: 401,
    });
    assert.deepEqual(
      await authenticateRequest(
        { headers: { authorization: 'Bearer invalid' } },
        { verify: async () => { throw new Error('invalid'); } }
      ),
      { error: 'Invalid or expired session', status: 401 }
    );
  } finally {
    if (originalPublishableKey === undefined) {
      delete process.env.CLERK_PUBLISHABLE_KEY;
    } else {
      process.env.CLERK_PUBLISHABLE_KEY = originalPublishableKey;
    }
    if (originalSecretKey === undefined) {
      delete process.env.CLERK_SECRET_KEY;
    } else {
      process.env.CLERK_SECRET_KEY = originalSecretKey;
    }
  }
});

test('public config supports Vercel Marketplace Clerk variables', () => {
  const originalPublishableKey = process.env.CLERK_PUBLISHABLE_KEY;
  const originalNextPublishableKey =
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const originalSecretKey = process.env.CLERK_SECRET_KEY;
  delete process.env.CLERK_PUBLISHABLE_KEY;
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_marketplace';
  process.env.CLERK_SECRET_KEY = 'sk_test_example';

  try {
    assert.deepEqual(getPublicAuthConfig(), {
      publishableKey: 'pk_test_marketplace',
    });
  } finally {
    if (originalPublishableKey === undefined) {
      delete process.env.CLERK_PUBLISHABLE_KEY;
    } else {
      process.env.CLERK_PUBLISHABLE_KEY = originalPublishableKey;
    }
    if (originalNextPublishableKey === undefined) {
      delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    } else {
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY =
        originalNextPublishableKey;
    }
    if (originalSecretKey === undefined) {
      delete process.env.CLERK_SECRET_KEY;
    } else {
      process.env.CLERK_SECRET_KEY = originalSecretKey;
    }
  }
});
