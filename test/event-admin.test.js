const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { loginResult, verifySession } = require('../lib/admin-auth');
const { readJsonBody } = require('../lib/body');
const { handleAdminEvents, handleAdminSession } = require('../lib/admin-http');
const {
  createLiveEvent,
  listArchivedEvents,
  listLiveEvents,
  setEventArchived,
  readLiveEvent,
  updateLiveEvent,
} = require('../lib/event-admin');
const { applyEventFields, publicEvent } = require('../lib/event-fields');
const { publishSiteFiles } = require('../lib/github-publish');
const { eventProduct, loadEvents } = require('../lib/event-store');
const { checkoutProduct, getProduct, products } = require('../server/config/products');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'linkpro-admin-'));
  fs.mkdirSync(path.join(root, 'content', 'events'), { recursive: true });
  fs.mkdirSync(path.join(root, 'components'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'components', 'site-nav.html'),
    '<nav><a data-nav-id="courses" href="/courses">Courses</a><a data-nav-id="events" href="/live-events">Live Events</a></nav>'
  );
  fs.writeFileSync(
    path.join(root, 'components', 'site-analytics.html'),
    '<script src="/_vercel/insights/script.js"></script>'
  );
  fs.writeFileSync(
    path.join(root, 'index.html'),
    [
      '<!-- LINKPRO_FEATURED_EVENTS_START -->',
      '<!-- LINKPRO_FEATURED_EVENTS_END -->',
      '<!--',
      'In-Person Seminars',
      'LINKPRO_EVENTS_START',
      'LINKPRO_EVENTS_END',
      '-->',
      '',
    ].join('\n')
  );
  fs.writeFileSync(
    path.join(root, 'live-events.html'),
    '<!-- LINKPRO_EVENTS_START -->\n<!-- LINKPRO_EVENTS_END -->\n'
  );
  fs.writeFileSync(path.join(root, 'courses.html'), 'COURSES PAGE\n');
  fs.writeFileSync(
    path.join(root, 'content', 'events', 'nicolette-david-retreat.json'),
    JSON.stringify({
      slug: 'nicolette-david-retreat',
      pageMode: 'static',
      listOn: ['events'],
      sort: 1,
      catalog: { title: 'Retreat', month: 'NOV', days: '11–15' },
    })
  );
  return root;
}

test('create, update, and archive a live event keep the page and checkout price together', async () => {
  const root = fixture();
  const created = await createLiveEvent(
    {
      name: 'Coastal Intensive',
      date: 'June 7–9',
      price: 1200,
      copy: 'Learn the fascial system.\n\nStudent rate $900 for review.\n\n- Pump the joints\n- Free the tendons',
    },
    { root, env: {} }
  );

  assert.equal(created.status, 201);
  assert.equal(created.body.event.slug, 'coastal-intensive');
  assert.equal(created.body.published, false);
  assert.equal(created.body.event.price, 1200);

  const saved = JSON.parse(
    fs.readFileSync(path.join(root, 'content', 'events', 'coastal-intensive.json'), 'utf8')
  );
  assert.equal(saved.price, 1200);
  assert.equal(saved.productId, 'coastal-intensive');
  assert.deepEqual(saved.listOn, ['events', 'home']);
  assert.equal(saved.catalog.month, 'JUN');
  assert.equal(saved.catalog.days, '7–9');
  assert.equal(saved.instructor.name, 'Dr. Jason Amstutz');
  assert.equal(eventProduct('coastal-intensive', loadEvents(root)).amount, 1200);
  assert.equal(eventProduct('coastal-intensive', loadEvents(root)).name, 'Coastal Intensive');
  assert.equal(
    eventProduct('coastal-intensive', loadEvents(root)).successUrl,
    '/coastal-intensive.html'
  );

  const html = fs.readFileSync(path.join(root, 'coastal-intensive.html'), 'utf8');
  assert.match(html, /Coastal Intensive/);
  assert.match(html, /Learn the fascial system\./);
  assert.match(html, /Student rate \$900/);
  assert.match(html, /data-flute-product="coastal-intensive"/);
  assert.match(html, /\$1,200/);
  assert.match(html, /data-nav-id="events"[^>]*aria-current="page"/);
  assert.doesNotMatch(html, /data-nav-id="courses"[^>]*aria-current/);

  const liveEvents = fs.readFileSync(path.join(root, 'live-events.html'), 'utf8');
  const homepage = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(liveEvents, /Coastal Intensive/);
  assert.match(liveEvents, /\$1,200/);
  assert.match(liveEvents, /seminar-days/);
  assert.match(homepage, /live-event-card/);
  assert.match(homepage, /Coastal Intensive/);
  assert.match(homepage, /LINKPRO_EVENTS_START/);
  assert.match(homepage, /In-Person Seminars/);
  assert.doesNotMatch(homepage, /<!-- LINKPRO_EVENTS_START -->/);
  assert.equal(fs.readFileSync(path.join(root, 'courses.html'), 'utf8'), 'COURSES PAGE\n');

  delete saved.body;
  saved.details.intro = 'Learn the fascial system.';
  saved.details.schedule = ['Day one'];
  saved.gallery = [{ src: '/images/a.webp', alt: 'Lab' }];
  saved.instructor.name = 'Guest Teacher';
  saved.hero.titleHtml = 'Coastal <em>Intensive</em>';
  fs.writeFileSync(
    path.join(root, 'content', 'events', 'coastal-intensive.json'),
    JSON.stringify(saved)
  );
  const viewed = readLiveEvent('coastal-intensive', root);
  const updated = await updateLiveEvent(
    'coastal-intensive',
    {
      name: 'Coastal Intensive Weekend',
      date: viewed.date,
      price: 1400,
      copy: viewed.copy,
    },
    { root, env: {} }
  );
  assert.equal(updated.body.event.slug, 'coastal-intensive');
  assert.equal(updated.body.event.price, 1400);
  const renamed = JSON.parse(
    fs.readFileSync(path.join(root, 'content', 'events', 'coastal-intensive.json'), 'utf8')
  );
  assert.equal(renamed.catalog.title, 'Coastal Intensive Weekend');
  assert.equal(renamed.slug, 'coastal-intensive');
  assert.equal(renamed.productId, 'coastal-intensive');
  assert.equal(renamed.hero.titleHtml, 'Coastal Intensive Weekend');
  assert.deepEqual(renamed.details.schedule, ['Day one']);
  assert.equal(renamed.gallery[0].src, '/images/a.webp');
  assert.equal(renamed.instructor.name, 'Guest Teacher');
  assert.equal(renamed.body, undefined);
  assert.equal(eventProduct('coastal-intensive', loadEvents(root)).amount, 1400);
  const updatedHtml = fs.readFileSync(path.join(root, 'coastal-intensive.html'), 'utf8');
  assert.match(updatedHtml, /Register — \$1,400/);
  assert.match(updatedHtml, /Day one/);
  assert.match(updatedHtml, /\/images\/a\.webp/);

  const archived = await setEventArchived('coastal-intensive', true, { root, env: {} });
  assert.equal(archived.body.event.archived, true);
  assert.equal(fs.existsSync(path.join(root, 'content', 'events', 'coastal-intensive.json')), true);
  assert.equal(fs.existsSync(path.join(root, 'coastal-intensive.html')), true);
  assert.equal(readLiveEvent('coastal-intensive', root).archived, true);
  assert.equal(eventProduct('coastal-intensive', loadEvents(root)).amount, 1400);
  assert.equal(listLiveEvents(root).some((event) => event.slug === 'coastal-intensive'), false);
  assert.equal(listArchivedEvents(root).some((event) => event.slug === 'coastal-intensive'), true);
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'live-events.html'), 'utf8'), /Coastal Intensive/);
  assert.match(fs.readFileSync(path.join(root, 'live-events.html'), 'utf8'), /Retreat/);
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), /Coastal Intensive/);
  assert.equal(fs.readFileSync(path.join(root, 'courses.html'), 'utf8'), 'COURSES PAGE\n');

  const restored = await setEventArchived('coastal-intensive', false, { root, env: {} });
  assert.equal(restored.body.event.archived, false);
  assert.match(fs.readFileSync(path.join(root, 'live-events.html'), 'utf8'), /Coastal Intensive/);
  assert.equal(listLiveEvents(root).some((event) => event.slug === 'coastal-intensive'), true);
  assert.equal(listArchivedEvents(root).some((event) => event.slug === 'coastal-intensive'), false);
  const restoredFile = JSON.parse(
    fs.readFileSync(path.join(root, 'content', 'events', 'coastal-intensive.json'), 'utf8')
  );
  assert.equal(restoredFile.archived, undefined);
});

test('an event with no price has no checkout', async () => {
  const root = fixture();
  const created = await createLiveEvent(
    { name: 'Open Lab', date: 'April 2', price: '', copy: 'Details later.' },
    { root, env: {} }
  );
  assert.equal(created.status, 201);
  assert.equal(created.body.event.price, null);
  assert.equal(created.body.event.checkout, false);
  const saved = JSON.parse(
    fs.readFileSync(path.join(root, 'content', 'events', 'open-lab.json'), 'utf8')
  );
  assert.equal(saved.productId, undefined);
  assert.equal(saved.status, 'coming-soon');
  const html = fs.readFileSync(path.join(root, 'open-lab.html'), 'utf8');
  assert.doesNotMatch(html, /data-flute-product/);
  assert.doesNotMatch(html, /checkout\.html/);
  assert.equal(eventProduct('open-lab', loadEvents(root)), null);
});

test('a hand-built retreat cannot be edited or archived from the hub', async () => {
  const root = fixture();
  const denied = await setEventArchived('nicolette-david-retreat', true, { root, env: {} });
  assert.equal(denied.status, 400);
  const edited = await updateLiveEvent(
    'nicolette-david-retreat',
    { name: 'Changed', date: 'Nov 11', price: 10, copy: 'No' },
    { root, env: {} }
  );
  assert.equal(edited.status, 400);
  assert.equal(
    fs.existsSync(path.join(root, 'content', 'events', 'nicolette-david-retreat.json')),
    true
  );
  assert.equal(readLiveEvent('nicolette-david-retreat', root), null);
});

test('saving the current Trunk & Pelvis fields does not replace its page copy', () => {
  const filePath = path.join(__dirname, '..', 'content', 'events', 'seminar-trunk-pelvis.json');
  const before = fs.readFileSync(filePath, 'utf8');
  const original = JSON.parse(before);
  const event = JSON.parse(JSON.stringify(original));
  const view = publicEvent(event);
  const result = applyEventFields(
    event,
    { name: view.name, date: view.date, price: view.price, copy: view.copy },
    { isNew: false }
  );
  assert.equal(result.error, undefined);
  assert.equal(result.event.body, undefined);
  assert.equal(result.event.hero.titleHtml, original.hero.titleHtml);
  assert.equal(result.event.hero.metaHtml, original.hero.metaHtml);
  assert.deepEqual(result.event.details.sections, original.details.sections);
  assert.deepEqual(result.event.details.intro, original.details.intro);
  assert.equal(result.event.slug, 'seminar-trunk-pelvis');
  assert.equal(result.event.productId, 'seminar-trunk-pelvis');
  assert.equal(result.event.price, 1500);
  assert.equal(fs.readFileSync(filePath, 'utf8'), before);
});

test('generated event checkout comes from the event file and leaves the bundle alone', () => {
  assert.equal(
    getProduct('seminar-trunk-pelvis').name,
    'Fascia Normalization and 2TLS: Trunk and Pelvis'
  );
  assert.equal(getProduct('seminar-trunk-pelvis').amount, 1500);
  assert.equal(getProduct('seminar-trunk-pelvis').successUrl, '/seminar-trunk-pelvis.html');
  assert.equal(
    products['seminar-trunk-pelvis'].name,
    'Fascia Normalization and 2TLS: Trunk and Pelvis'
  );
  assert.equal(products['seminar-bundle'].successUrl, '/live-events');
  assert.equal(getProduct('seminar-bundle').successUrl, '/live-events');
  assert.equal(getProduct('cranial-diaphragm'), null);
  assert.equal(checkoutProduct('seminar-trunk-pelvis', []), null);
  assert.equal(checkoutProduct('pelvis-1', []).amount, 100);
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
  assert.equal(fs.existsSync(path.join(root, 'content', 'events', 'harbor-lab.json')), false);
  const published = calls
    .filter((call) => call.url.endsWith('/git/blobs'))
    .map((call) => call.body.content)
    .join('\n');
  assert.match(published, /Harbor Lab/);
  assert.match(published, /live-event-card/);
  assert.match(published, /seminar-days/);
  assert.doesNotMatch(published, /COURSES PAGE/);
  const commit = calls.find((call) => call.method === 'POST' && call.url.endsWith('/git/commits'));
  assert.equal(commit.body.message, 'Add live event Harbor Lab');
  assert.equal(commit.body.parents[0], 'parent');
  const paths = calls
    .filter((call) => call.url.endsWith('/git/blobs'))
    .map((call) => call.body.content);
  assert.equal(paths.some((content) => content.includes('COURSES PAGE')), false);
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

test('admin routes reject a signed-out request and an unset password', async () => {
  const signedOut = await handleAdminEvents(
    { method: 'GET', headers: {} },
    { ADMIN_HUB_PASSWORD: 'secret' }
  );
  assert.equal(signedOut.status, 401);
  const unconfigured = await handleAdminSession({ method: 'GET', headers: {} }, {});
  assert.equal(unconfigured.status, 503);
  const listing = await handleAdminEvents({ method: 'GET', headers: {} }, {});
  assert.equal(listing.status, 503);
});

test('a buffered login body still yields the password', () => {
  const parsed = readJsonBody({
    body: Buffer.from(JSON.stringify({ password: 'secret' })),
  });
  assert.equal(parsed.password, 'secret');
});

test('the admin password sets a session cookie', () => {
  const settings = { ADMIN_HUB_PASSWORD: 'secret', BASE_URL: 'http://localhost:8080' };
  assert.equal(loginResult('nope', settings).status, 401);
  assert.equal(loginResult('secret', {}).status, 503);
  const result = loginResult('secret', settings);
  assert.equal(result.status, 200);
  assert.equal(verifySession(result.cookie, settings), true);
  const padded = { ADMIN_HUB_PASSWORD: 'secret\n' };
  const trimmed = loginResult('secret', padded);
  assert.equal(trimmed.status, 200);
  assert.equal(verifySession(trimmed.cookie, padded), true);
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
      writes: { 'live-events.html': '<p>catalog</p>' },
      deletes: ['content/events/harbor-lab.json', 'harbor-lab.html'],
    },
  });

  assert.equal(tree.base_tree, 'base');
  assert.deepEqual(
    tree.tree.filter((entry) => entry.sha === null).map((entry) => entry.path),
    ['content/events/harbor-lab.json', 'harbor-lab.html']
  );
});
