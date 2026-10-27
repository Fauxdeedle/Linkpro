const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('node:crypto');

const {
  createFileStore,
  createMemoryStore,
  createRedisStore,
  grantCourse,
  getCourses,
  setEntitlementStore,
} = require('../lib/entitlements');
const {
  LOGIN_MESSAGE,
  emailFromRequest,
  readToken,
  requestCourseAccess,
  serializeSessionCookie,
  signToken,
  verifyCourseLogin,
} = require('../lib/access');
const { getCourseForRequest } = require('../lib/course-content');
const { grantPaidCheckout, publicCheckoutResult, createCheckoutSession } = require('../lib/checkout');
const { importGrantCsv } = require('../lib/grant-csv');
const { HEADERS, recordPurchase } = require('../lib/purchase-sheet');
const { processFluteWebhook } = require('../lib/webhooks');

const SECRET = 'test-access-secret';
const SHEET_KEY = crypto
  .generateKeyPairSync('rsa', { modulusLength: 2048 })
  .privateKey.export({ type: 'pkcs8', format: 'pem' });

function clearSheetEnv() {
  delete process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  delete process.env.GOOGLE_SHEETS_TAB;
  delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
}

function sheetEnv() {
  return {
    GOOGLE_SHEETS_SPREADSHEET_ID: 'sheet123',
    GOOGLE_SHEETS_TAB: 'Purchases',
    GOOGLE_SERVICE_ACCOUNT_EMAIL: 'sheets@example.iam.gserviceaccount.com',
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: SHEET_KEY.replace(/\n/g, '\\n'),
  };
}

function useSheetEnv() {
  Object.assign(process.env, sheetEnv());
}

function createMemorySheet(initialRows = [HEADERS]) {
  const rows = initialRows.map((row) => [...row]);
  async function fetchImpl(url, options = {}) {
    const href = String(url);
    if (href.includes('oauth2.googleapis.com/token')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ access_token: 'token' }),
      };
    }

    const decoded = decodeURIComponent(href);
    if (href.includes(':append')) {
      assert.match(decoded, /valueInputOption=RAW/);
      rows.push(JSON.parse(options.body).values[0]);
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ updates: { updatedRows: 1 } }),
      };
    }
    if (options.method === 'PUT') {
      assert.match(decoded, /valueInputOption=RAW/);
      const match = decoded.match(/!A(\d+):F\1/);
      rows[Number(match[1]) - 1] = JSON.parse(options.body).values[0];
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ updatedRows: 1 }),
      };
    }
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ values: rows.map((row) => [...row]) }),
    };
  }
  return { fetchImpl, rows };
}

function signedWebhook(body, secret) {
  const id = 'delivery-access';
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${id}.${timestamp}.${body}`)
    .digest('base64');
  return {
    'flute-webhook-id': id,
    'flute-webhook-timestamp': timestamp,
    'flute-webhook-signature': `v1,${signature}`,
  };
}

test.beforeEach(() => {
  process.env.ACCESS_SECRET = SECRET;
  process.env.BASE_URL = 'http://localhost:8080';
  clearSheetEnv();
  setEntitlementStore(createMemoryStore());
});

test('a verified course payment grants access and a session cookie', async () => {
  const result = await grantPaidCheckout({
    status: 'Completed',
    metadata: { productId: 'pelvis-1', customerEmail: 'Buyer@Example.com' },
    transactionDetails: { status: 'Captured', transactionReceipt: { amount: 100 } },
  });

  assert.equal(result.status, 'paid');
  assert.equal(result.accessGranted, true);
  assert.match(result.accessCookie, /^linkpro_access=/);
  assert.deepEqual(await getCourses('buyer@example.com'), ['pelvis-1']);
  assert.equal(publicCheckoutResult(result).accessCookie, undefined);

  const seminar = await grantPaidCheckout({
    status: 'Completed',
    metadata: { productId: 'seminar-upper-limb', customerEmail: 'buyer@example.com' },
    transactionDetails: { status: 'Captured', transactionReceipt: { amount: 1500 } },
  });
  assert.equal(seminar.accessGranted, false);
  assert.deepEqual(await getCourses('buyer@example.com'), ['pelvis-1']);
});

test('checkout rejects a missing email before contacting Flute', async () => {
  assert.equal((await createCheckoutSession('pelvis-1', 'not-an-email')).status, 400);
  assert.equal((await createCheckoutSession('pelvis-3', 'buyer@example.com')).status, 503);
});

test('webhook completion grants the online course and ignores other products', async () => {
  const originalSecret = process.env.FLUTE_WEBHOOK_SECRET;
  process.env.FLUTE_WEBHOOK_SECRET = 'test-webhook-secret';

  try {
    const paid = JSON.stringify({
      type: 'payment_session.completed',
      data: {
        object: {
          id: 'ps_1',
          metadata: { productId: 'llip', customerEmail: 'Fan@Example.com' },
        },
      },
    });
    assert.deepEqual(
      await processFluteWebhook(Buffer.from(paid), signedWebhook(paid, process.env.FLUTE_WEBHOOK_SECRET)),
      { received: true }
    );
    assert.deepEqual(await getCourses('fan@example.com'), ['llip']);

    const seminar = JSON.stringify({
      type: 'payment_session.completed',
      data: {
        object: {
          id: 'ps_2',
          metadata: { productId: 'seminar-bundle', customerEmail: 'fan@example.com' },
        },
      },
    });
    await processFluteWebhook(
      Buffer.from(seminar),
      signedWebhook(seminar, process.env.FLUTE_WEBHOOK_SECRET)
    );
    assert.deepEqual(await getCourses('fan@example.com'), ['llip']);
  } finally {
    if (originalSecret === undefined) delete process.env.FLUTE_WEBHOOK_SECRET;
    else process.env.FLUTE_WEBHOOK_SECRET = originalSecret;
  }
});

test('lesson JSON requires a cookie and does not leak videos when locked', async () => {
  const locked = await getCourseForRequest('pelvis-1', { headers: {} });
  assert.equal(locked.status, 401);
  assert.equal(locked.body.amount, 100);
  assert.equal(JSON.stringify(locked.body).includes('youtu'), false);

  await grantCourse('member@example.com', 'pelvis-1');
  const cookie = serializeSessionCookie('member@example.com');
  const opened = await getCourseForRequest('pelvis-1', {
    headers: { cookie },
  });
  assert.equal(opened.status, 200);
  assert.equal(opened.body.lessons[0].title, 'The Pelvis as the Foundation');
  assert.match(opened.body.lessons[0].youtube, /youtu/);

  const otherCourse = await getCourseForRequest('llip', { headers: { cookie } });
  assert.equal(otherCourse.status, 401);
  assert.equal(JSON.stringify(otherCourse.body).includes('youtu'), false);
  assert.equal((await getCourseForRequest('not-a-course', { headers: { cookie } })).status, 404);
});

test('login links are one-time, and expired or unsigned tokens are rejected', async () => {
  const sent = [];
  await grantCourse('return@example.com', 'pelvis-3');
  const known = await requestCourseAccess({
    email: 'return@example.com',
    courseId: 'pelvis-3',
    sendLoginLink: async (message) => {
      sent.push(message);
      return { sent: true };
    },
  });
  const unknown = await requestCourseAccess({
    email: 'stranger@example.com',
    courseId: 'pelvis-3',
    sendLoginLink: async (message) => {
      sent.push(message);
      return { sent: true };
    },
  });

  assert.equal(known.body.message, LOGIN_MESSAGE);
  assert.equal(unknown.body.message, LOGIN_MESSAGE);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'return@example.com');

  const token = new URL(sent[0].url).searchParams.get('token');
  const first = await verifyCourseLogin(token);
  assert.equal(first.ok, true);
  assert.equal(first.next, '/pelvis-3-course.html');
  assert.match(first.cookie, /HttpOnly/);
  assert.equal((await verifyCourseLogin(token)).ok, false);

  const now = Date.now();
  const expired = signToken({
    purpose: 'login',
    email: 'return@example.com',
    exp: Math.floor(now / 1000) - 10,
    jti: 'expired',
    next: '/pelvis-3-course.html',
  });
  assert.equal(readToken(expired, { purpose: 'login', now }), null);
  assert.equal((await verifyCourseLogin(expired, { now })).ok, false);

  const tampered = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`;
  assert.equal((await verifyCourseLogin(tampered)).ok, false);
  assert.equal((await verifyCourseLogin('not-a-token')).ok, false);

  const session = emailFromRequest({
    headers: { cookie: first.cookie },
  });
  assert.equal(session, 'return@example.com');
});

test('CSV import maps old buyers onto course ids', async () => {
  const csv = [
    'email,courseId',
    'Old@Example.com, pelvis-1',
    'old@example.com,llip',
    'old@example.com,seminar-bundle',
    'not-an-email,pelvis-3',
    'second@example.com,pelvis-3',
  ].join('\n');

  const result = await importGrantCsv(csv);
  assert.deepEqual(result.granted, [
    { email: 'old@example.com', courseId: 'pelvis-1' },
    { email: 'old@example.com', courseId: 'llip' },
    { email: 'second@example.com', courseId: 'pelvis-3' },
  ]);
  assert.equal(result.skipped.length, 2);
  assert.deepEqual(await getCourses('old@example.com'), ['llip', 'pelvis-1']);
  assert.deepEqual(await getCourses('second@example.com'), ['pelvis-3']);
});

test('file and redis stores record course grants', async () => {
  const filePath = path.join(os.tmpdir(), `linkpro-entitlements-${Date.now()}.json`);
  const fileStore = createFileStore(filePath);
  await fileStore.grant('file@example.com', 'llip');
  assert.deepEqual(await fileStore.getCourses('file@example.com'), ['llip']);
  fs.unlinkSync(filePath);

  const commands = [];
  const redis = createRedisStore({
    url: 'https://example.upstash.io',
    token: 'token',
    fetchImpl: async (_url, options) => {
      const command = JSON.parse(options.body);
      commands.push(command);
      if (command[0] === 'SADD') {
        return { ok: true, json: async () => ({ result: 1 }) };
      }
      if (command[0] === 'SMEMBERS') {
        return { ok: true, json: async () => ({ result: ['pelvis-1', 'nope'] }) };
      }
      if (command[0] === 'SET') {
        return { ok: true, json: async () => ({ result: 'OK' }) };
      }
      return { ok: true, json: async () => ({ result: '1' }) };
    },
  });

  assert.deepEqual(await redis.grant('redis@example.com', 'pelvis-1'), ['pelvis-1']);
  await redis.rememberLogin('jti-1', 1800);
  assert.equal(await redis.consumeLogin('jti-1'), true);
  assert.deepEqual(commands.map((command) => command[0]), ['SADD', 'SMEMBERS', 'SET', 'GETDEL']);
});

test('a purchase sheet appends a session and updates that same session', async () => {
  const sheet = createMemorySheet();
  const env = sheetEnv();
  const now = () => new Date('2026-10-27T18:00:00.000Z');
  const purchase = {
    email: 'Buyer@Example.com',
    productId: 'pelvis-1',
    sessionId: 'ps_1',
    paidAt: '2026-10-27T18:00:00.000Z',
  };

  assert.deepEqual(await recordPurchase(purchase, { fetchImpl: sheet.fetchImpl, env, now }), {
    recorded: true,
    action: 'append',
  });
  assert.deepEqual(
    await recordPurchase(
      { ...purchase, email: 'buyer@example.com', amount: 1 },
      { fetchImpl: sheet.fetchImpl, env, now }
    ),
    { recorded: true, action: 'update' }
  );
  assert.equal(sheet.rows.length, 2);
  assert.deepEqual(sheet.rows[1], [
    '2026-10-27T18:00:00.000Z',
    'buyer@example.com',
    'Pelvis 1.0',
    'pelvis-1',
    100,
    'ps_1',
  ]);

  assert.deepEqual(
    await recordPurchase(
      { email: 'new@example.com', productId: 'custom-retreat', sessionId: 'ps_custom', amount: 40 },
      { fetchImpl: sheet.fetchImpl, env, now }
    ),
    { recorded: true, action: 'append' }
  );
  assert.deepEqual(sheet.rows[2].slice(1), [
    'new@example.com',
    'custom-retreat',
    'custom-retreat',
    40,
    'ps_custom',
  ]);
});

test('a purchase sheet is skipped when it is not configured', async () => {
  let called = false;
  const result = await recordPurchase(
    { email: 'buyer@example.com', productId: 'pelvis-1', sessionId: 'ps_1' },
    {
      env: {},
      fetchImpl: async () => {
        called = true;
        throw new Error('fetch should not run');
      },
    }
  );
  assert.deepEqual(result, { recorded: false });
  assert.equal(called, false);
});

test('a seminar payment is recorded without granting course access', async () => {
  const originalFetch = globalThis.fetch;
  const sheet = createMemorySheet();
  useSheetEnv();
  globalThis.fetch = sheet.fetchImpl;
  const originalSecret = process.env.FLUTE_WEBHOOK_SECRET;
  process.env.FLUTE_WEBHOOK_SECRET = 'test-webhook-secret';
  const seminar = JSON.stringify({
    type: 'payment_session.completed',
    data: {
      object: {
        id: 'ps_seminar',
        metadata: { productId: 'seminar-bundle', customerEmail: 'Bundle@Example.com' },
      },
    },
  });

  try {
    assert.deepEqual(
      await processFluteWebhook(Buffer.from(seminar), signedWebhook(seminar, process.env.FLUTE_WEBHOOK_SECRET)),
      { received: true }
    );
    assert.deepEqual(await getCourses('bundle@example.com'), []);
    assert.equal(sheet.rows[1][1], 'bundle@example.com');
    assert.equal(sheet.rows[1][2], 'Fascia & 2TLS — Three-Seminar Bundle');
    assert.equal(sheet.rows[1][3], 'seminar-bundle');
    assert.equal(sheet.rows[1][4], 3750);
    assert.equal(sheet.rows[1][5], 'ps_seminar');
  } finally {
    globalThis.fetch = originalFetch;
    clearSheetEnv();
    if (originalSecret === undefined) delete process.env.FLUTE_WEBHOOK_SECRET;
    else process.env.FLUTE_WEBHOOK_SECRET = originalSecret;
  }
});

test('a sheet error during checkout still returns the course access cookie', async () => {
  const originalFetch = globalThis.fetch;
  useSheetEnv();
  globalThis.fetch = async () => ({
    ok: false,
    status: 503,
    statusText: 'unavailable',
    text: async () => JSON.stringify({ error: { message: 'unavailable' } }),
  });

  try {
    const result = await grantPaidCheckout({
      id: 'ps_cookie',
      status: 'Completed',
      metadata: { productId: 'pelvis-1', customerEmail: 'Buyer@Example.com' },
      transactionDetails: { status: 'Captured', transactionReceipt: { amount: 100 } },
    });
    assert.equal(result.status, 'paid');
    assert.equal(result.accessGranted, true);
    assert.match(result.accessCookie, /^linkpro_access=/);
    assert.deepEqual(await getCourses('buyer@example.com'), ['pelvis-1']);
  } finally {
    globalThis.fetch = originalFetch;
    clearSheetEnv();
  }
});

test('course pages do not publish lesson videos', () => {
  for (const file of [
    'pelvis-1-course.html',
    'pelvis-3-course.html',
    'llip-course.html',
    'courses/course-template.html',
  ]) {
    const html = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    assert.equal(html.includes('youtu'), false, file);
    assert.equal(html.includes('/js/course-access.js'), true, file);
  }
});
