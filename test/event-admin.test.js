const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { loginResult, verifySession } = require('../lib/admin-auth');
const { handleAdminEvents } = require('../lib/admin-http');
const {
  createLiveEvent,
  deleteLiveEvent,
  readLiveEvent,
  updateLiveEvent,
} = require('../lib/event-admin');
const { publishSiteFiles } = require('../lib/github-publish');
const { eventProduct, loadEvents } = require('../lib/event-store');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'linkpro-admin-'));
  fs.mkdirSync(path.join(root, 'content', 'events'), { recursive: true });
  fs.mkdirSync(path.join(root, 'components'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'components', 'site-nav.html'),
    '<nav><a data-nav-id="courses" href="/courses">Courses</a></nav>'
  );
  fs.writeFileSync(
    path.join(root, 'components', 'site-analytics.html'),
    '<script src="/_vercel/insights/script.js"></script>'
  );
  const catalog = '<!-- LINKPRO_EVENTS_START -->\n<!-- LINKPRO_EVENTS_END -->\n';
  fs.writeFileSync(path.join(root, 'index.html'), catalog);
  fs.writeFileSync(path.join(root, 'courses.html'), catalog);
  fs.writeFileSync(
    path.join(root, 'content', 'events', 'nicolette-david-retreat.json'),
    JSON.stringify({
      slug: 'nicolette-david-retreat',
      pageMode: 'static',
      listOn: ['courses'],
      sort: 1,
      catalog: { title: 'Retreat', month: 'NOV', days: '11–15' },
    })
  );
  return root;
}

function env() {
  return {};
}

test('create, update, and delete a live event keep the page and checkout price together', async () => {
  const root = fixture();
  const created = await createLiveEvent(
    {
      name: 'Coastal Intensive',
      date: 'June 7–9',
      price: 1200,
      copy: 'Learn the fascial system.\n\n- Pump the joints\n- Free the tendons',
    },
    { root, env: env() }
  );

  assert.equal(created.status, 201);
  assert.equal(created.body.event.slug, 'coastal-intensive');
  assert.equal(created.body.published, false);

  const saved = JSON.parse(
    fs.readFileSync(path.join(root, 'content', 'events', 'coastal-intensive.json'), 'utf8')
  );
  assert.equal(saved.price, 1200);
  assert.equal(saved.productId, 'coastal-intensive');
  assert.equal(saved.catalog.month, 'JUN');
  assert.equal(saved.catalog.days, '7–9');
  assert.equal(saved.instructor.name, 'Dr. Jason Amstutz');

  const html = fs.readFileSync(path.join(root, 'coastal-intensive.html'), 'utf8');
  assert.match(html, /Coastal Intensive/);
  assert.match(html, /Learn the fascial system\./);
  assert.match(html, /data-flute-product="coastal-intensive"/);
  assert.match(html, /\$1,200/);
  assert.match(html, /aria-current="page"/);
  assert.match(fs.readFileSync(path.join(root, 'courses.html'), 'utf8'), /Coastal Intensive/);
  assert.match(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), /\$1,200/);
  assert.equal(eventProduct('coastal-intensive', loadEvents(root)).amount, 1200);

  const updated = await updateLiveEvent(
    'coastal-intensive',
    {
      name: 'Coastal Intensive Weekend',
      date: 'June 7–9',
      price: 1400,
      copy: 'Learn the fascial system.\n\n- Pump the joints\n- Free the tendons',
    },
    { root, env: env() }
  );
  assert.equal(updated.body.event.slug, 'coastal-intensive');
  assert.equal(updated.body.event.price, 1400);
  const renamed = JSON.parse(
    fs.readFileSync(path.join(root, 'content', 'events', 'coastal-intensive.json'), 'utf8')
  );
  assert.equal(renamed.catalog.title, 'Coastal Intensive Weekend');
  assert.equal(renamed.slug, 'coastal-intensive');
  assert.equal(eventProduct('coastal-intensive', loadEvents(root)).amount, 1400);
  assert.match(
    fs.readFileSync(path.join(root, 'coastal-intensive.html'), 'utf8'),
    /Register — \$1,400/
  );

  const removed = await deleteLiveEvent('coastal-intensive', { root, env: env() });
  assert.equal(removed.body.deleted, 'coastal-intensive');
  assert.equal(fs.existsSync(path.join(root, 'content', 'events', 'coastal-intensive.json')), false);
  assert.equal(fs.existsSync(path.join(root, 'coastal-intensive.html')), false);
  assert.equal(readLiveEvent('coastal-intensive', root), null);
  assert.equal(eventProduct('coastal-intensive', loadEvents(root)), null);
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'courses.html'), 'utf8'), /Coastal Intensive/);
  assert.match(fs.readFileSync(path.join(root, 'courses.html'), 'utf8'), /Retreat/);
});

test('a hand-built retreat cannot be edited or deleted from the hub', async () => {
  const root = fixture();
  const denied = await deleteLiveEvent('nicolette-david-retreat', { root, env: env() });
  assert.equal(denied.status, 400);
  assert.equal(
    fs.existsSync(path.join(root, 'content', 'events', 'nicolette-david-retreat.json')),
    true
  );
});

test('the deployed hub publishes the changed files and does not write them locally', async () => {
  const root = fixture();
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ url, method: options.method || 'GET', body });
    const payload = url.endsWith('/git/blobs')
      ? { sha: `blob-${calls.length}` }
      : url.endsWith('/git/trees')
        ? { sha: 'tree1' }
        : url.endsWith('/git/commits')
          ? { sha: 'commit1', tree: { sha: 'tree0' } }
          : { object: { sha: 'parent' }, tree: { sha: 'tree0' } };
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify(payload),
    };
  };

  const created = await createLiveEvent(
    { name: 'Harbor Lab', date: 'March 2', price: 900, copy: 'A one-day lab.' },
    {
      root,
      env: {
        VERCEL: '1',
        ADMIN_GITHUB_TOKEN: 'token',
        ADMIN_GITHUB_REPO: 'linkpro/linkpro',
        ADMIN_GITHUB_BRANCH: 'main',
      },
      fetchImpl,
    }
  );

  assert.equal(created.status, 201);
  assert.equal(created.body.published, true);
  assert.equal(
    fs.existsSync(path.join(root, 'content', 'events', 'harbor-lab.json')),
    false
  );
  const blob = calls.find((call) => call.url.endsWith('/git/blobs'));
  assert.match(blob.body.content, /Harbor Lab/);
  const commit = calls.find(
    (call) => call.method === 'POST' && call.url.endsWith('/git/commits')
  );
  assert.equal(commit.body.message, 'Add live event Harbor Lab');
  assert.equal(commit.body.parents[0], 'parent');
});

test('publishing fails closed when the live site has no GitHub token', async () => {
  const root = fixture();
  const result = await createLiveEvent(
    { name: 'Harbor Lab', date: 'March 2', price: 900, copy: 'A one-day lab.' },
    { root, env: { VERCEL: '1' } }
  );
  assert.equal(result.status, 503);
  assert.equal(fs.existsSync(path.join(root, 'content', 'events', 'harbor-lab.json')), false);
});

test('admin routes reject a signed-out request', async () => {
  const result = await handleAdminEvents({ method: 'GET', headers: {} }, { ADMIN_HUB_PASSWORD: 'secret' });
  assert.equal(result.status, 401);
});

test('the admin password sets a session cookie', () => {
  const settings = { ADMIN_HUB_PASSWORD: 'secret', BASE_URL: 'http://localhost:8080' };
  assert.equal(loginResult('nope', settings).status, 401);
  assert.equal(loginResult('secret', {}).status, 503);
  const result = loginResult('secret', settings);
  assert.equal(result.status, 200);
  assert.equal(verifySession(result.cookie, settings), true);
});

test('publishSiteFiles deletes a removed event in the same commit', async () => {
  let tree = null;
  const fetchImpl = async (url, options = {}) => {
    const body = options.body ? JSON.parse(options.body) : null;
    if (url.endsWith('/git/trees') && options.method === 'POST') tree = body;
    const payload = url.endsWith('/git/blobs')
      ? { sha: 'blob1' }
      : url.endsWith('/git/trees')
        ? { sha: 'tree1' }
        : url.endsWith('/git/commits') && options.method === 'POST'
          ? { sha: 'commit1' }
          : { object: { sha: 'parent' }, tree: { sha: 'base' } };
    return { ok: true, text: async () => JSON.stringify(payload) };
  };

  await publishSiteFiles({
    env: { ADMIN_GITHUB_TOKEN: 'token', ADMIN_GITHUB_REPO: 'linkpro/linkpro' },
    fetchImpl,
    message: 'Remove live event Harbor Lab',
    files: {
      writes: { 'courses.html': '<p>catalog</p>' },
      deletes: ['content/events/harbor-lab.json', 'harbor-lab.html'],
    },
  });

  assert.equal(tree.base_tree, 'base');
  assert.deepEqual(
    tree.tree.filter((entry) => entry.sha === null).map((entry) => entry.path),
    ['content/events/harbor-lab.json', 'harbor-lab.html']
  );
});
