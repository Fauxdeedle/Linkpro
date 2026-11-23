const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { loginResult } = require('../lib/admin-auth');
const { handleAdminEvent, handleAdminEvents } = require('../lib/admin-http');
const { mergePurchaseRecords, signupsForEvent } = require('../lib/event-signups');
const {
  createMemoryPurchaseLog,
  listPurchaseLog,
  recordManualGrantLog,
  recordPurchaseLog,
} = require('../lib/purchase-log');
const { HEADERS, listPurchases, recordPurchase } = require('../lib/purchase-sheet');

const SHEET_KEY = crypto
  .generateKeyPairSync('rsa', { modulusLength: 2048 })
  .privateKey.export({ type: 'pkcs8', format: 'pem' });

function sheetEnv() {
  return {
    GOOGLE_SHEETS_SPREADSHEET_ID: 'sheet123',
    GOOGLE_SHEETS_TAB: 'Purchases',
    GOOGLE_SERVICE_ACCOUNT_EMAIL: 'sheets@example.iam.gserviceaccount.com',
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: SHEET_KEY.replace(/\n/g, '\\n'),
  };
}

function createMemorySheet(initialRows = [HEADERS]) {
  const rows = initialRows.map((row) => [...row]);
  async function fetchImpl(url, options = {}) {
    const href = String(url);
    if (href.includes('oauth2.googleapis.com/token')) {
      return { ok: true, status: 200, text: async () => JSON.stringify({ access_token: 'token' }) };
    }
    if (options.method === 'POST' && href.includes(':append')) {
      rows.push(JSON.parse(options.body).values[0]);
      return { ok: true, status: 200, text: async () => JSON.stringify({ updates: { updatedRows: 1 } }) };
    }
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ values: rows.map((row) => [...row]) }),
    };
  }
  return { fetchImpl, rows };
}

function purchase(sessionId, productId, email, paidAt) {
  return {
    email,
    productId,
    sessionId,
    paidAt,
  };
}

test('the hub log stores the same fields as the purchase sheet', async () => {
  const sheet = createMemorySheet();
  const log = createMemoryPurchaseLog();
  const env = sheetEnv();
  const now = () => new Date('2026-11-17T20:30:00.000Z');
  const paid = purchase('ps_same', 'seminar-trunk-pelvis', 'Buyer@Example.com', '2026-11-17T20:30:00.000Z');

  await recordPurchase(paid, { env, fetchImpl: sheet.fetchImpl, now });
  await recordPurchaseLog(paid, { store: log, now });
  const logged = (await log.list())[0];
  assert.deepEqual(
    [logged.paidAt, logged.email, logged.product, logged.productId, logged.amount, logged.sessionId],
    sheet.rows[1]
  );

  const grant = await recordManualGrantLog(
    { email: 'Buyer@Example.com', courseId: 'pelvis-1' },
    { store: log, now }
  );
  assert.equal(grant.action, 'append');
  assert.equal((await recordManualGrantLog({ email: 'buyer@example.com', courseId: 'pelvis-1' }, { store: log, now })).action, 'update');
  const manual = (await log.list()).find((row) => row.productId === 'pelvis-1');
  assert.equal(manual.amount, '');
  assert.equal(manual.sessionId, 'manual:buyer@example.com:pelvis-1');
});

test('a redis purchase log upserts by session id', async () => {
  const stored = new Map();
  const index = new Set();
  const fetchImpl = async (_url, options) => {
    const [command, ...rest] = JSON.parse(options.body);
    let result = null;
    if (command === 'GET') result = stored.get(rest[0]) || null;
    else if (command === 'SET') {
      stored.set(rest[0], rest[1]);
      result = 'OK';
    } else if (command === 'SADD') {
      index.add(rest[1]);
      result = 1;
    } else if (command === 'SMEMBERS') result = [...index];
    else if (command === 'MGET') result = rest.map((key) => stored.get(key) || null);
    else throw new Error(command);
    return { ok: true, json: async () => ({ result }) };
  };
  const env = {
    UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
    UPSTASH_REDIS_REST_TOKEN: 'token',
  };
  const paid = purchase('ps_redis', 'seminar-upper-limb', 'Buyer@Example.com', '2026-11-17T20:30:00.000Z');
  assert.equal((await recordPurchaseLog(paid, { env, fetchImpl })).action, 'append');
  assert.equal((await recordPurchaseLog({ ...paid, email: 'buyer@example.com' }, { env, fetchImpl })).action, 'update');
  const rows = await listPurchaseLog({ env, fetchImpl });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].sessionId, 'ps_redis');
  assert.equal(stored.has('purchase:ps_redis'), true);
  assert.equal(index.has('ps_redis'), true);
});

test('a local purchase log is a json file', async () => {
  const filePath = path.join(os.tmpdir(), `purchases-${Date.now()}-${process.pid}.json`);
  const env = { PURCHASE_LOG_FILE: filePath };
  const paid = purchase('ps_file', 'open-lab', 'buyer@example.com', '2026-11-17T20:30:00.000Z');
  assert.equal((await recordPurchaseLog({ ...paid, amount: 40 }, { env })).action, 'append');
  const rows = await listPurchaseLog({ env });
  assert.equal(rows[0].product, 'open-lab');
  assert.equal(rows[0].amount, 40);
  fs.unlinkSync(filePath);
});

test('event signups merge the hub log and the sheet, including the bundle', () => {
  const sheetOnly = {
    email: 'sheet-only@example.com',
    product: 'Trunk',
    productId: 'seminar-trunk-pelvis',
    amount: 1500,
    paidAt: '2026-11-16T20:00:00.000Z',
    sessionId: 'ps_sheet',
  };
  const older = {
    email: 'old@example.com',
    product: 'Trunk',
    productId: 'seminar-trunk-pelvis',
    amount: 1500,
    paidAt: '2026-11-15T20:00:00.000Z',
    sessionId: 'ps_both',
  };
  const logOnly = {
    email: 'log-only@example.com',
    product: 'Trunk',
    productId: 'seminar-trunk-pelvis',
    amount: 1500,
    paidAt: '2026-11-17T20:30:00.000Z',
    sessionId: 'ps_log',
  };
  const newer = {
    email: 'newer@example.com',
    product: 'Trunk',
    productId: 'seminar-trunk-pelvis',
    amount: 1500,
    paidAt: '2026-11-17T18:00:00.000Z',
    sessionId: 'ps_both',
  };
  const bundle = {
    email: 'bundle@example.com',
    product: 'Bundle',
    productId: 'seminar-bundle',
    amount: 3750,
    paidAt: '2026-11-10T20:00:00.000Z',
    sessionId: 'ps_bundle',
  };
  const course = {
    email: 'course@example.com',
    product: 'Pelvis 1.0',
    productId: 'pelvis-1',
    amount: 100,
    paidAt: '2026-11-17T20:30:00.000Z',
    sessionId: 'ps_course',
  };
  const merged = mergePurchaseRecords([logOnly, newer, bundle], [sheetOnly, older, course]);
  assert.equal(merged.find((record) => record.sessionId === 'ps_both').email, 'newer@example.com');
  const trunk = signupsForEvent('seminar-trunk-pelvis', merged);
  assert.deepEqual(
    trunk.map((signup) => signup.email),
    ['log-only@example.com', 'newer@example.com', 'sheet-only@example.com', 'bundle@example.com']
  );
  assert.equal(trunk[1].amountLabel, '$1,500');
  assert.equal(trunk[1].paidLabel, 'Nov 17, 2026');
  assert.equal(trunk[3].bundle, true);
  assert.equal(trunk[3].amountLabel, '$3,750');
  assert.equal(signupsForEvent('seminar-upper-limb', merged).length, 1);
  assert.equal(signupsForEvent('seminar-lower-limb', merged)[0].email, 'bundle@example.com');
  assert.deepEqual(signupsForEvent('coastal-intensive', merged), []);
  assert.deepEqual(signupsForEvent('', merged), []);
});

function eventFile(slug, title, price) {
  return {
    slug,
    status: price ? 'upcoming' : 'coming-soon',
    pageMode: 'generated',
    listOn: ['events'],
    sort: 10,
    ...(price ? { productId: slug, price } : {}),
    catalog: {
      title,
      month: 'DEC',
      days: '4–6',
      ...(price ? { priceLabel: `$${price}` } : {}),
    },
    dateLabel: 'December 4–6',
  };
}

test('the admin hub lists signups when one purchase source is down', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'linkpro-signups-'));
  fs.mkdirSync(path.join(root, 'content', 'events'), { recursive: true });
  for (const event of [
    eventFile('seminar-trunk-pelvis', 'Trunk and Pelvis', 1500),
    eventFile('seminar-upper-limb', 'Upper Limb', 1500),
    eventFile('cranial-diaphragm', 'Cranial Diaphragm', 0),
  ]) {
    fs.writeFileSync(
      path.join(root, 'content', 'events', `${event.slug}.json`),
      JSON.stringify(event)
    );
  }

  const log = createMemoryPurchaseLog();
  const now = () => new Date('2026-11-17T20:30:00.000Z');
  await recordPurchaseLog(
    purchase('ps_direct', 'seminar-trunk-pelvis', 'direct@example.com', '2026-11-17T20:30:00.000Z'),
    { store: log, now }
  );
  await recordPurchaseLog(
    purchase('ps_bundle', 'seminar-bundle', 'bundle@example.com', '2026-11-10T18:00:00.000Z'),
    { store: log, now }
  );

  const sheet = createMemorySheet([
    HEADERS,
    ['2026-11-01T18:00:00.000Z', 'sheet@example.com', 'Upper Limb', 'seminar-upper-limb', 1500, 'ps_sheet'],
  ]);
  const env = {
    ADMIN_HUB_PASSWORD: 'secret',
    BASE_URL: 'http://localhost:8080',
    ...sheetEnv(),
  };
  const cookie = loginResult('secret', env).cookie;

  const sheetDown = await handleAdminEvents(
    { method: 'GET', headers: { cookie } },
    env,
    {
      root,
      store: log,
      fetchImpl: async () => ({
        ok: false,
        status: 503,
        text: async () => JSON.stringify({ error: { message: 'unavailable' } }),
      }),
    }
  );
  assert.equal(sheetDown.status, 200);
  assert.equal(sheetDown.body.signupsNote, 'The purchase sheet could not be read. This list is from the hub log.');
  const trunk = sheetDown.body.events.find((event) => event.slug === 'seminar-trunk-pelvis');
  assert.deepEqual(
    trunk.signups.map((signup) => `${signup.email}${signup.bundle ? ' bundle' : ''}`),
    ['direct@example.com', 'bundle@example.com bundle']
  );
  const closed = sheetDown.body.events.find((event) => event.slug === 'cranial-diaphragm');
  assert.equal(closed.checkout, false);
  assert.deepEqual(closed.signups, []);

  const logDown = await handleAdminEvents(
    { method: 'GET', headers: { cookie } },
    env,
    {
      root,
      store: {
        async list() {
          throw new Error('log down');
        },
      },
      fetchImpl: sheet.fetchImpl,
    }
  );
  assert.equal(logDown.status, 200);
  assert.equal(logDown.body.signupsNote, 'The hub log could not be read. This list includes the purchase sheet.');
  const upper = logDown.body.events.find((event) => event.slug === 'seminar-upper-limb');
  assert.equal(upper.signups[0].email, 'sheet@example.com');
  assert.equal(upper.signups[0].amountLabel, '$1,500');

  const detail = await handleAdminEvent(
    { method: 'GET', headers: { cookie } },
    'seminar-upper-limb',
    env,
    { root, store: log, fetchImpl: sheet.fetchImpl }
  );
  assert.deepEqual(
    detail.body.event.signups.map((signup) => signup.email),
    ['bundle@example.com', 'sheet@example.com']
  );
  assert.equal(detail.body.signupsNote, '');
});
