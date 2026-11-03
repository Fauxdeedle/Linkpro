const test = require('node:test');
const assert = require('node:assert/strict');
const { sendLoginEmail } = require('../lib/login-email');

const ENV_KEYS = ['RESEND_API_KEY', 'ACCESS_EMAIL_FROM'];

function restoreEnv(previous) {
  for (const key of ENV_KEYS) {
    if (previous[key] === undefined) delete process.env[key];
    else process.env[key] = previous[key];
  }
}

test('course link email posts text and html to Resend', async () => {
  const previous = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  process.env.RESEND_API_KEY = '  re_test_key  ';
  process.env.ACCESS_EMAIL_FROM = '  LINK Pro <access@example.com>  ';
  const url = 'https://linkprosport.com/api/access/verify?token=body.signature';

  try {
    let sent;
    const result = await sendLoginEmail({
      to: 'buyer@example.com',
      url,
      fetchImpl: async (endpoint, options) => {
        sent = {
          endpoint,
          authorization: options.headers.Authorization,
          body: JSON.parse(options.body),
        };
        return { ok: true, status: 200 };
      },
    });

    assert.equal(result.sent, true);
    assert.equal(sent.endpoint, 'https://api.resend.com/emails');
    assert.equal(sent.authorization, 'Bearer re_test_key');
    assert.equal(sent.body.from, 'LINK Pro <access@example.com>');
    assert.equal(sent.body.to, 'buyer@example.com');
    assert.equal(sent.body.subject, 'Your LINK Pro course link');
    assert.match(sent.body.text, new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(sent.body.html, /href="https:\/\/linkprosport\.com\/api\/access\/verify\?token=body\.signature"/);
  } finally {
    restoreEnv(previous);
  }
});

test('a Resend rejection keeps the response message', async () => {
  const previous = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  process.env.RESEND_API_KEY = 're_test_key';
  process.env.ACCESS_EMAIL_FROM = 'LINK Pro <access@example.com>';

  try {
    const result = await sendLoginEmail({
      to: 'buyer@example.com',
      url: 'https://linkprosport.com/api/access/verify?token=abc',
      fetchImpl: async () => ({
        ok: false,
        status: 403,
        text: async () => JSON.stringify({ message: 'The domain is not verified.' }),
      }),
    });

    assert.equal(result.sent, false);
    assert.equal(result.status, 403);
    assert.equal(result.message, 'The domain is not verified.');
  } finally {
    restoreEnv(previous);
  }
});

test('missing Resend configuration does not call the API', async () => {
  const previous = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  delete process.env.RESEND_API_KEY;
  delete process.env.ACCESS_EMAIL_FROM;

  try {
    const result = await sendLoginEmail({
      to: 'buyer@example.com',
      url: 'https://linkprosport.com/api/access/verify?token=abc',
      fetchImpl: async () => {
        throw new Error('should not send');
      },
    });
    assert.deepEqual(result, { sent: false, reason: 'not-configured' });
  } finally {
    restoreEnv(previous);
  }
});
