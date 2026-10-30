#!/usr/bin/env node
/**
 * End-to-end exercise of the course paywall.
 *
 * Starts an isolated LINK Pro server (no Flute, Redis, or Resend account)
 * and walks the buyer paths:
 *
 *   1. Anonymous visitors cannot see lesson videos
 *   2. Checkout requires an email and does not trust the browser for price
 *   3. A verified payment grants that email the course and a return cookie
 *   4. A signed Flute webhook grants the same way, including if the tab closes
 *   5. Seminars and wrong charge amounts do not unlock online courses
 *   6. A one-time login link restores access on a new browser
 *   7. A CSV import gives old-site buyers the same login
 *   8. One course purchase does not unlock the others
 *
 * Usage: node scripts/test-paywall.js
 */
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PAYWALL_TEST_PORT || 8765);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const SECRET = 'paywall-test-access-secret';
const WEBHOOK_SECRET = 'paywall-test-webhook-secret';
const ENTITLEMENT_FILE = path.join(
  os.tmpdir(),
  `linkpro-paywall-test-${process.pid}.json`
);

process.env.ACCESS_SECRET = SECRET;
process.env.BASE_URL = BASE_URL;
process.env.ENTITLEMENT_FILE = ENTITLEMENT_FILE;
process.env.FLUTE_WEBHOOK_SECRET = WEBHOOK_SECRET;
process.env.FLUTE_CLIENT_ID = '';
process.env.FLUTE_CLIENT_SECRET = '';
process.env.FLUTE_AMOUNT_PELVIS_1 = '100';
process.env.FLUTE_AMOUNT_PELVIS_3 = '150';
process.env.FLUTE_AMOUNT_LLIP = '199';
process.env.UPSTASH_REDIS_REST_URL = '';
process.env.UPSTASH_REDIS_REST_TOKEN = '';
process.env.RESEND_API_KEY = '';
process.env.ACCESS_EMAIL_FROM = '';
delete process.env.VERCEL;
delete process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
delete process.env.GOOGLE_SHEETS_TAB;
delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

const { grantPaidCheckout, publicCheckoutResult } = require('../lib/checkout');
const { serializeSessionCookie } = require('../lib/access');
const { setEntitlementStore } = require('../lib/entitlements');

const failures = [];
let server;
let logs = '';

function check(name, condition, detail) {
  if (condition) {
    console.log(`  pass  ${name}`);
    return;
  }
  const message = detail === undefined ? '' : ` — ${detail}`;
  console.log(`  FAIL  ${name}${message}`);
  failures.push(`${name}${message}`);
}

function section(title) {
  console.log(`\n${title}`);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function request(method, urlPath, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: urlPath,
        method,
        headers,
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = text ? JSON.parse(text) : null;
          } catch {
            json = null;
          }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            text,
            json,
          });
        });
      }
    );
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

function cookieHeader(setCookie) {
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  return list.map((value) => value.split(';')[0]).join('; ');
}

function signedWebhook(body, id) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(`${id}.${timestamp}.${body}`)
    .digest('base64');
  return {
    'flute-webhook-id': id,
    'flute-webhook-timestamp': timestamp,
    'flute-webhook-signature': `v1,${signature}`,
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(body),
  };
}

function loginLinks() {
  return logs
    .split('\n')
    .map((line) => {
      const marker = 'Login link (email delivery is not configured): ';
      const index = line.indexOf(marker);
      return index === -1 ? '' : line.slice(index + marker.length).trim();
    })
    .filter(Boolean);
}

async function waitForLoginLink(previousCount) {
  const started = Date.now();
  while (loginLinks().length === previousCount) {
    if (Date.now() - started > 3000) {
      throw new Error('Timed out waiting for a login link in the server log');
    }
    await delay(20);
  }
  return loginLinks().at(-1);
}

async function waitForServer() {
  const started = Date.now();
  while (Date.now() - started < 5000) {
    if (server.exitCode !== null) {
      throw new Error(`Server exited early:\n${logs}`);
    }
    try {
      const health = await request('GET', '/courses.html');
      if (health.status === 200) return;
    } catch {
      // The server is still binding the port.
    }
    await delay(30);
  }
  throw new Error(`Server did not start:\n${logs}`);
}

function startServer() {
  const childEnv = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    PORT: String(PORT),
    BASE_URL,
    ACCESS_SECRET: SECRET,
    ENTITLEMENT_FILE,
    FLUTE_WEBHOOK_SECRET: WEBHOOK_SECRET,
    FLUTE_CLIENT_ID: '',
    FLUTE_CLIENT_SECRET: '',
    FLUTE_ENVIRONMENT: 'sandbox',
    FLUTE_AMOUNT_PELVIS_1: '100',
    FLUTE_AMOUNT_PELVIS_3: '150',
    FLUTE_AMOUNT_LLIP: '199',
    UPSTASH_REDIS_REST_URL: '',
    UPSTASH_REDIS_REST_TOKEN: '',
    RESEND_API_KEY: '',
    ACCESS_EMAIL_FROM: '',
  };

  server = spawn(process.execPath, ['server/index.js'], {
    cwd: ROOT,
    env: childEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (chunk) => {
    logs += chunk.toString();
  });
  server.stderr.on('data', (chunk) => {
    logs += chunk.toString();
  });
}

function paidSession(productId, email, amount) {
  return {
    status: 'Completed',
    metadata: { productId, customerEmail: email },
    transactionDetails: {
      status: 'Captured',
      transactionReceipt: { amount },
    },
  };
}

async function main() {
  fs.rmSync(ENTITLEMENT_FILE, { force: true });
  setEntitlementStore(null);
  startServer();
  await waitForServer();
  check(
    'server keeps entitlements in the isolated file store',
    logs.includes('Entitlements: file'),
    logs.trim().split('\n').slice(-5).join(' | ')
  );

  section('1. Anonymous visitors cannot see lesson videos');
  const lockedCourses = [
    ['pelvis-1', 100, 'Pelvis 1.0'],
    ['pelvis-3', 150, 'Pelvis 3.0'],
    ['llip', 199, 'Lower Limb Injury Prevention'],
  ];
  for (const [slug, amount, name] of lockedCourses) {
    const locked = await request('GET', `/api/courses/${slug}`);
    check(`${slug} is locked`, locked.status === 401, String(locked.status));
    check(`${slug} offers its price`, locked.json?.amount === amount, JSON.stringify(locked.json));
    check(`${slug} names the course`, locked.json?.productName === name, locked.json?.productName);
    check(
      `${slug} checkout link stays on this site`,
      locked.json?.checkoutUrl === `/checkout.html?product=${slug}`,
      locked.json?.checkoutUrl
    );
    check(
      `${slug} lock response has no video url`,
      !JSON.stringify(locked.json).includes('youtu'),
      JSON.stringify(locked.json)
    );
  }

  const unknown = await request('GET', '/api/courses/not-a-course');
  check('unknown course is not found', unknown.status === 404, String(unknown.status));

  const leaked = await request('GET', '/content/courses/pelvis-1.json');
  check('lesson files are not publicly served', leaked.status === 404, String(leaked.status));
  check(
    'direct lesson file has no video url',
    !leaked.text.includes('youtu'),
    leaked.text.slice(0, 120)
  );

  for (const page of ['pelvis-1-course.html', 'pelvis-3-course.html', 'llip-course.html']) {
    const html = await request('GET', `/${page}`);
    check(`${page} loads`, html.status === 200, String(html.status));
    check(`${page} does not embed videos`, !html.text.includes('youtu'), 'found youtu');
    check(`${page} asks the access api`, html.text.includes('/js/course-access.js'));
    check(`${page} hides the curriculum until access`, html.text.includes('id="lessons" hidden'));
    check(
      `${page} has one continue form`,
      html.text.includes('>Continue</button>') && !html.text.includes('paywallEnroll')
    );
    check(
      `${page} keeps the email section closed`,
      html.text.includes('id="continueCourse"') &&
        html.text.includes('id="coursePaywallReveal"') &&
        !html.text.includes('course-reveal is-open')
    );
  }

  const sentPage = await request('GET', '/access-link-sent.html');
  check('access link page loads', sentPage.status === 200, String(sentPage.status));
  check(
    'access link page confirms the email was sent',
    sentPage.text.includes('An access link was sent to your email.')
  );

  const catalog = await request('GET', '/courses.html');
  check('catalog has no preview bypass', !catalog.text.includes('Preview test course'));
  check(
    'catalog opens Pelvis 1.0 on its course page',
    catalog.text.includes('href="/pelvis-1-course"') && !catalog.text.includes('/checkout.html?product=pelvis-1')
  );
  check(
    'catalog opens Pelvis 3.0 on its course page',
    catalog.text.includes('href="/pelvis-3-course"') && !catalog.text.includes('/checkout.html?product=pelvis-3')
  );
  check(
    'catalog opens Lower Limb on its course page',
    catalog.text.includes('href="/llip-course"') && !catalog.text.includes('/checkout.html?product=llip')
  );
  check('catalog shows the Pelvis 3.0 placeholder price', catalog.text.includes('$150'));

  const home = await request('GET', '/');
  check(
    'homepage opens Pelvis 3.0 on its course page',
    home.text.includes('href="/pelvis-3-course"') && !home.text.includes('/checkout.html?product=pelvis-3')
  );

  section('2. Checkout requires an email and ignores a browser-supplied price');
  const checkoutPage = await request('GET', '/checkout.html?product=pelvis-1');
  check('checkout page loads', checkoutPage.status === 200, String(checkoutPage.status));
  check('checkout page asks for an email', checkoutPage.text.includes('id="email"'));
  check(
    'checkout page posts only the product id and email',
    checkoutPage.text.includes('customerEmail') && !checkoutPage.text.includes('amount:')
  );
  check(
    'online checkout can send an access link instead of charging',
    checkoutPage.text.includes('/api/access/continue') && checkoutPage.text.includes('/access-link-sent')
  );

  const missingEmail = await request('POST', '/api/create-checkout-session', {
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ productId: 'pelvis-1', amount: 1 }),
  });
  check('missing email is rejected', missingEmail.status === 400, JSON.stringify(missingEmail.json));

  const badEmail = await request('POST', '/api/create-checkout-session', {
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ productId: 'pelvis-1', customerEmail: 'not-an-email', amount: 1 }),
  });
  check('invalid email is rejected', badEmail.status === 400, JSON.stringify(badEmail.json));

  const unknownProduct = await request('POST', '/api/create-checkout-session', {
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ productId: 'free-course', customerEmail: 'buyer@example.com', amount: 1 }),
  });
  check('unknown product is rejected', unknownProduct.status === 400, JSON.stringify(unknownProduct.json));

  const noFlute = await request('POST', '/api/create-checkout-session', {
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ productId: 'pelvis-1', customerEmail: 'buyer@example.com', amount: 1 }),
  });
  check(
    'a real session is not created without Flute',
    noFlute.status === 503,
    JSON.stringify(noFlute.json)
  );
  check(
    'a rejected checkout does not unlock the course',
    (await request('GET', '/api/courses/pelvis-1')).status === 401
  );

  section('3. A verified payment grants the course and a return cookie');
  const wrongAmount = await grantPaidCheckout(paidSession('pelvis-1', 'short@example.com', 50));
  check('underpaid session is not paid', wrongAmount.status !== 'paid', wrongAmount.status);
  check('underpaid session grants nothing', wrongAmount.accessGranted === false);

  const paid = await grantPaidCheckout(paidSession('pelvis-1', 'Buyer@Example.com', 100));
  const publicPaid = publicCheckoutResult(paid);
  check('paid session is paid', paid.status === 'paid', paid.status);
  check('paid session grants access', paid.accessGranted === true);
  check('cookie is not returned in the json body', publicPaid.accessCookie === undefined);
  check('cookie is httpOnly', paid.accessCookie.includes('HttpOnly'));
  check('cookie lasts about 180 days', paid.accessCookie.includes('Max-Age=15552000'));
  check('local http cookie is not marked Secure', !paid.accessCookie.includes('Secure'));

  const paidCookie = cookieHeader(paid.accessCookie);
  const opened = await request('GET', '/api/courses/pelvis-1', {
    headers: { cookie: paidCookie },
  });
  check('paid browser can load Pelvis 1.0', opened.status === 200, String(opened.status));
  check(
    'paid browser receives the lesson video',
    opened.json?.lessons?.[0]?.title === 'The Pelvis as the Foundation' &&
      opened.json.lessons[0].youtube.includes('youtu'),
    JSON.stringify(opened.json?.lessons?.[0])
  );
  const stillLocked = await request('GET', '/api/courses/llip', {
    headers: { cookie: paidCookie },
  });
  check('Pelvis 1.0 does not unlock Lower Limb', stillLocked.status === 401, String(stillLocked.status));
  check(
    'the other course response still has no video',
    !JSON.stringify(stillLocked.json).includes('youtu')
  );

  const repeat = await request('GET', '/api/courses/pelvis-1', {
    headers: { cookie: paidCookie },
  });
  check('the same cookie works on a later request', repeat.status === 200, String(repeat.status));

  const cleared = await request('GET', '/api/courses/pelvis-1');
  check('clearing the cookie locks the course again', cleared.status === 401, String(cleared.status));

  const garbage = await request('GET', '/api/courses/pelvis-1', {
    headers: { cookie: 'linkpro_access=not-a-real-cookie' },
  });
  check('a forged cookie is rejected', garbage.status === 401, String(garbage.status));

  const seminar = await grantPaidCheckout(
    paidSession('seminar-upper-limb', 'seminar@example.com', 1500)
  );
  check('a seminar payment does not grant a course cookie', seminar.accessGranted === false);
  const seminarCookie = serializeSessionCookie('seminar@example.com');
  const seminarView = await request('GET', '/api/courses/pelvis-1', {
    headers: { cookie: cookieHeader(seminarCookie) },
  });
  check('a seminar buyer cannot watch Pelvis 1.0', seminarView.status === 401, String(seminarView.status));

  section('4. The payment webhook grants access when the shopper closes the tab');
  const webhookBody = JSON.stringify({
    id: 'delivery-llip',
    type: 'payment_session.completed',
    data: {
      object: {
        id: 'ps_llip',
        metadata: { productId: 'llip', customerEmail: 'Webhook@Example.com' },
      },
    },
  });
  const unsigned = await request('POST', '/api/webhooks/flute', {
    headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(webhookBody) },
    body: webhookBody,
  });
  check('a webhook with no signature is rejected', unsigned.status === 400, String(unsigned.status));

  const forgedBody = `${webhookBody} `;
  const forgedHeaders = signedWebhook(webhookBody, 'delivery-forged');
  forgedHeaders['content-length'] = Buffer.byteLength(forgedBody);
  const forged = await request('POST', '/api/webhooks/flute', {
    headers: forgedHeaders,
    body: forgedBody,
  });
  check('a webhook with a forged signature is rejected', forged.status === 401, String(forged.status));

  const signed = await request('POST', '/api/webhooks/flute', {
    headers: signedWebhook(webhookBody, 'delivery-llip'),
    body: webhookBody,
  });
  check('a signed webhook is accepted', signed.status === 200, signed.text);

  const again = await request('POST', '/api/webhooks/flute', {
    headers: signedWebhook(webhookBody, 'delivery-llip-again'),
    body: webhookBody,
  });
  check('a repeated webhook is accepted', again.status === 200, again.text);

  const beforeLogin = loginLinks().length;
  const linkRequest = await request('POST', '/api/access/request', {
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'webhook@example.com', courseId: 'llip' }),
  });
  check('login request returns the generic message', linkRequest.json?.message?.includes('If this email has a course'));
  const continueOwned = await request('POST', '/api/access/continue', {
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'webhook@example.com', courseId: 'llip' }),
  });
  check(
    'continue sends a link when this course is owned',
    continueOwned.status === 200 &&
      continueOwned.json?.action === 'login' &&
      !continueOwned.json?.checkoutUrl,
    JSON.stringify(continueOwned.json)
  );
  const continueOther = await request('POST', '/api/access/continue', {
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'webhook@example.com', courseId: 'pelvis-1' }),
  });
  check(
    'continue does not unlock a different course',
    continueOther.status === 503 && !continueOther.json?.checkoutUrl,
    JSON.stringify(continueOther.json)
  );
  const webhookLink = await waitForLoginLink(beforeLogin);
  const webhookVerify = await request(
    'GET',
    new URL(webhookLink).pathname + new URL(webhookLink).search
  );
  check('login link redirects to Lower Limb', webhookVerify.status === 302, String(webhookVerify.status));
  check(
    'login link lands on the course',
    webhookVerify.headers.location === '/llip-course.html',
    webhookVerify.headers.location
  );
  const webhookCookie = cookieHeader(webhookVerify.headers['set-cookie']);
  check('login link sets a cookie', webhookCookie.startsWith('linkpro_access='), webhookCookie);
  const webhookCourse = await request('GET', '/api/courses/llip', {
    headers: { cookie: webhookCookie },
  });
  check('webhook buyer can watch Lower Limb', webhookCourse.status === 200, String(webhookCourse.status));
  check(
    'webhook buyer gets both lessons',
    webhookCourse.json?.lessons?.length === 2,
    String(webhookCourse.json?.lessons?.length)
  );

  const seminarWebhook = JSON.stringify({
    type: 'payment_session.completed',
    data: {
      object: {
        id: 'ps_seminar',
        metadata: { productId: 'seminar-bundle', customerEmail: 'bundle@example.com' },
      },
    },
  });
  const seminarResult = await request('POST', '/api/webhooks/flute', {
    headers: signedWebhook(seminarWebhook, 'delivery-seminar'),
    body: seminarWebhook,
  });
  check('a seminar webhook is accepted', seminarResult.status === 200, seminarResult.text);
  const seminarLinksBefore = loginLinks().length;
  await request('POST', '/api/access/request', {
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'bundle@example.com', courseId: 'pelvis-1' }),
  });
  await delay(150);
  check(
    'a seminar buyer is not emailed a course link',
    loginLinks().length === seminarLinksBefore,
    `links ${loginLinks().length}`
  );

  section('5. A one-time login link restores access, and bad links do not');
  const strangerBefore = loginLinks().length;
  const stranger = await request('POST', '/api/access/request', {
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'stranger@example.com', courseId: 'pelvis-1' }),
  });
  const buyerAgain = await request('POST', '/api/access/request', {
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'buyer@example.com', courseId: 'pelvis-1' }),
  });
  check('unknown email gets the same message', stranger.json?.message === buyerAgain.json?.message, stranger.json?.message);
  await delay(150);
  check(
    'unknown email does not get a link',
    loginLinks().length === strangerBefore + 1,
    `expected one new link, saw ${loginLinks().length - strangerBefore}`
  );

  const badAddress = await request('POST', '/api/access/request', {
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'not-an-email', courseId: 'pelvis-1' }),
  });
  check('login form rejects an invalid email', badAddress.status === 400, JSON.stringify(badAddress.json));

  const ownedBefore = loginLinks().length;
  const ownedContinue = await request('POST', '/api/access/continue', {
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'buyer@example.com', courseId: 'pelvis-1' }),
  });
  check(
    'an email with this course gets a login action',
    ownedContinue.status === 200 && ownedContinue.json?.action === 'login',
    JSON.stringify(ownedContinue.json)
  );
  check('an email with this course does not get a payment url', !ownedContinue.json?.checkoutUrl);
  await waitForLoginLink(ownedBefore);

  const otherBefore = loginLinks().length;
  const otherContinue = await request('POST', '/api/access/continue', {
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'buyer@example.com', courseId: 'llip' }),
  });
  await delay(150);
  check(
    'an email without this course is not given a payment url',
    otherContinue.status === 503 && !otherContinue.json?.checkoutUrl,
    JSON.stringify(otherContinue.json)
  );
  check('an email without this course does not get a link', loginLinks().length === otherBefore);

  const blockedCheckout = await request('POST', '/api/create-checkout-session', {
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ productId: 'pelvis-1', customerEmail: 'buyer@example.com' }),
  });
  check(
    'checkout refuses an email that already has the course',
    blockedCheckout.status === 409,
    JSON.stringify(blockedCheckout.json)
  );

  const buyerLink = loginLinks().at(-1);
  const firstUse = await request('GET', new URL(buyerLink).pathname + new URL(buyerLink).search);
  check('first login link redirects to Pelvis 1.0', firstUse.headers.location === '/pelvis-1-course.html', firstUse.headers.location);
  const buyerCookie = cookieHeader(firstUse.headers['set-cookie']);
  const afterLink = await request('GET', '/api/courses/pelvis-1', {
    headers: { cookie: buyerCookie },
  });
  check('login cookie opens Pelvis 1.0', afterLink.status === 200, String(afterLink.status));

  const secondUse = await request('GET', new URL(buyerLink).pathname + new URL(buyerLink).search);
  check('the login link dies after one use', secondUse.status === 302, String(secondUse.status));
  check(
    'a used link returns to the catalog',
    secondUse.headers.location === '/courses?access=invalid',
    secondUse.headers.location
  );
  const staleCookie = cookieHeader(secondUse.headers['set-cookie']);
  check('a used link does not set a new cookie', staleCookie === '', staleCookie);
  const stillSignedIn = await request('GET', '/api/courses/pelvis-1', {
    headers: { cookie: buyerCookie },
  });
  check('the browser cookie still works after the link is spent', stillSignedIn.status === 200);

  const tampered = `${buyerLink.slice(0, -1)}${buyerLink.endsWith('a') ? 'b' : 'a'}`;
  const tamperedVisit = await request('GET', new URL(tampered).pathname + new URL(tampered).search);
  check(
    'a tampered login link is rejected',
    tamperedVisit.headers.location === '/courses?access=invalid',
    tamperedVisit.headers.location
  );

  const evilBefore = loginLinks().length;
  const evilContinue = await request('POST', '/api/access/continue', {
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'buyer@example.com', courseId: 'https://evil.example' }),
  });
  await delay(150);
  check('a course id cannot leave this site', evilContinue.status === 400, JSON.stringify(evilContinue.json));
  check(
    'a bogus course id does not send a link',
    loginLinks().length === evilBefore,
    `links ${loginLinks().length}`
  );

  const invalidNotice = await request('GET', '/courses?access=invalid');
  check(
    'the catalog explains an invalid login link',
    invalidNotice.text.includes('That login link is invalid or already used'),
    'notice missing'
  );

  section('6. Old-site buyers gain the same access from a CSV import');
  const csvPath = path.join(os.tmpdir(), `linkpro-old-buyers-${process.pid}.csv`);
  fs.writeFileSync(
    csvPath,
    [
      'email,courseId',
      'Old@Site.com, pelvis-1',
      'old@site.com,llip',
      'old@site.com,seminar-bundle',
      'not-an-email,pelvis-3',
      'second@site.com,pelvis-3',
    ].join('\n')
  );
  const imported = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/grant-access.js', csvPath], {
      cwd: ROOT,
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        ACCESS_SECRET: SECRET,
        ENTITLEMENT_FILE,
        UPSTASH_REDIS_REST_URL: '',
        UPSTASH_REDIS_REST_TOKEN: '',
      },
    });
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk;
    });
    child.stderr.on('data', (chunk) => {
      output += chunk;
    });
    child.on('error', reject);
    child.on('exit', (code) => resolve({ code, output }));
  });
  check('import script exits cleanly', imported.code === 0, imported.output);
  check('import grants three rows', imported.output.includes('Granted 3'), imported.output);
  check('import skips two rows', imported.output.includes('Skipped 2'), imported.output);

  const oldBefore = loginLinks().length;
  await request('POST', '/api/access/request', {
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'OLD@site.com', courseId: 'llip' }),
  });
  const oldLink = await waitForLoginLink(oldBefore);
  const oldVerify = await request('GET', new URL(oldLink).pathname + new URL(oldLink).search);
  check('old buyer lands on Lower Limb', oldVerify.headers.location === '/llip-course.html', oldVerify.headers.location);
  const oldCookie = cookieHeader(oldVerify.headers['set-cookie']);
  const oldPelvis = await request('GET', '/api/courses/pelvis-1', { headers: { cookie: oldCookie } });
  const oldLlip = await request('GET', '/api/courses/llip', { headers: { cookie: oldCookie } });
  const oldPelvis3 = await request('GET', '/api/courses/pelvis-3', { headers: { cookie: oldCookie } });
  check('old buyer can watch Pelvis 1.0', oldPelvis.status === 200, String(oldPelvis.status));
  check('old buyer can watch Lower Limb', oldLlip.status === 200, String(oldLlip.status));
  check('old buyer cannot watch Pelvis 3.0', oldPelvis3.status === 401, String(oldPelvis3.status));

  const secondBefore = loginLinks().length;
  await request('POST', '/api/access/request', {
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'second@site.com', courseId: 'pelvis-3' }),
  });
  const secondLink = await waitForLoginLink(secondBefore);
  const secondVerify = await request('GET', new URL(secondLink).pathname + new URL(secondLink).search);
  const secondCookie = cookieHeader(secondVerify.headers['set-cookie']);
  const secondCourse = await request('GET', '/api/courses/pelvis-3', {
    headers: { cookie: secondCookie },
  });
  check(
    'imported Pelvis 3.0 buyer gets three lessons',
    secondCourse.status === 200 && secondCourse.json?.lessons?.length === 3,
    JSON.stringify({ status: secondCourse.status, count: secondCourse.json?.lessons?.length })
  );
  const secondOther = await request('GET', '/api/courses/pelvis-1', {
    headers: { cookie: secondCookie },
  });
  check('imported Pelvis 3.0 buyer cannot watch Pelvis 1.0', secondOther.status === 401);

  fs.rmSync(csvPath, { force: true });
}

main()
  .catch((err) => {
    console.error(err);
    failures.push(err.message);
  })
  .finally(() => {
    if (server && server.exitCode === null) server.kill();
    fs.rmSync(ENTITLEMENT_FILE, { force: true });
    console.log(`\n${failures.length === 0 ? 'All paywall checks passed.' : `${failures.length} check(s) failed.`}`);
    process.exit(failures.length === 0 ? 0 : 1);
  });
