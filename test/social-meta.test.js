const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { renderEventPage } = require('../lib/event-pages');
const { OG_IMAGE_URL, pageUrl, formatSocialBlock } = require('../lib/social-meta');

const root = path.join(__dirname, '..');

function listHtmlFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'components' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listHtmlFiles(full, acc);
    else if (entry.name.endsWith('.html')) acc.push(full);
  }
  return acc;
}

function jpegSize(file) {
  let i = 2;
  while (i + 8 < file.length) {
    if (file[i] !== 0xff) return null;
    const marker = file[i + 1];
    if (marker === 0xc0 || marker === 0xc2) {
      return { height: file.readUInt16BE(i + 5), width: file.readUInt16BE(i + 7) };
    }
    i += 2 + file.readUInt16BE(i + 2);
  }
  return null;
}

test('link preview image is a 1200x630 JPEG', () => {
  const file = fs.readFileSync(path.join(root, 'og-image.jpg'));
  assert.equal(file[0], 0xff);
  assert.equal(file[1], 0xd8);
  assert.equal(file[2], 0xff);
  assert.ok(file.length < 400_000);
  assert.deepEqual(jpegSize(file), { width: 1200, height: 630 });
});

test('every page uses the shared link preview image', () => {
  const files = listHtmlFiles(root);
  assert.ok(files.length > 0);

  for (const filePath of files) {
    const rel = path.relative(root, filePath).split(path.sep).join('/');
    const html = fs.readFileSync(filePath, 'utf8');
    const headEnd = html.indexOf('</head>');
    assert.ok(headEnd > 0, rel);
    const head = html.slice(0, headEnd);
    assert.match(head, /<title>[^<]+<\/title>/);
    assert.ok(head.includes(`<meta property="og:url" content="${pageUrl(rel)}">`), rel);
    assert.ok(head.includes(`<meta property="og:image" content="${OG_IMAGE_URL}">`), rel);
    assert.ok(head.includes('<meta name="twitter:card" content="summary_large_image">'), rel);
    assert.ok(head.includes(`<meta name="twitter:image" content="${OG_IMAGE_URL}">`), rel);
    assert.ok(head.indexOf('og:image') > head.indexOf('<title>'), rel);
  }
});

test('generated event pages include the shared link preview image', () => {
  const html = renderEventPage({
    slug: 'seminar-upper-limb',
    status: 'upcoming',
    productId: 'seminar-upper-limb',
    catalog: { title: 'Upper Limb', summary: 'Lab intensive.' },
    hero: { titleHtml: 'Upper Limb' },
    details: { intro: 'Lab.' },
    cta: { title: 'Register', body: 'Checkout.', buttonText: 'Register' },
  });
  const expected = formatSocialBlock('', {
    title: 'Upper Limb — LINK Pro',
    description: 'Lab intensive.',
    url: pageUrl('seminar-upper-limb.html'),
  });
  assert.ok(html.includes(expected));
  assert.ok(html.indexOf(expected) < html.indexOf('</head>'));
});
