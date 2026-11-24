const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { renderEventPage } = require('../lib/event-pages');

const root = path.join(__dirname, '..');
const pngLink = '<link rel="icon" href="/favicon.png" type="image/png" sizes="468x406">';
const svgLink = '<link rel="icon" href="/favicon.svg" type="image/svg+xml">';

function listHtmlFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'components' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listHtmlFiles(full, acc);
    else if (entry.name.endsWith('.html')) acc.push(full);
  }
  return acc;
}

test('favicon assets are the triangle mark', () => {
  const svg = fs.readFileSync(path.join(root, 'favicon.svg'), 'utf8');
  const png = fs.readFileSync(path.join(root, 'favicon.png'));
  assert.match(svg, /<svg[\s>]/);
  assert.match(svg, /viewBox="0 0 338 294"/);
  assert.match(svg, /#D09750/);
  assert.equal(svg, fs.readFileSync(path.join(root, 'assets/brand/link-pro-logo.svg'), 'utf8'));
  assert.equal(png[0], 0x89);
  assert.equal(png[1], 0x50);
  assert.equal(png[2], 0x4e);
  assert.equal(png[3], 0x47);
});

test('every page uses the SVG favicon with a PNG fallback', () => {
  const files = listHtmlFiles(root);
  assert.ok(files.length > 0);

  for (const filePath of files) {
    const rel = path.relative(root, filePath);
    const html = fs.readFileSync(filePath, 'utf8');
    const headEnd = html.indexOf('</head>');
    assert.ok(headEnd > 0, rel);
    const head = html.slice(0, headEnd);
    const pngAt = head.indexOf(pngLink);
    const svgAt = head.indexOf(svgLink);
    assert.ok(pngAt > 0, rel);
    assert.ok(svgAt > pngAt, rel);
  }
});

test('generated event pages include the SVG favicon and PNG fallback', () => {
  const html = renderEventPage({
    slug: 'seminar-upper-limb',
    status: 'upcoming',
    productId: 'seminar-upper-limb',
    catalog: { title: 'Upper Limb' },
    hero: { titleHtml: 'Upper Limb' },
    details: { intro: 'Lab.' },
    cta: { title: 'Register', body: 'Checkout.', buttonText: 'Register' },
  });
  const head = html.slice(0, html.indexOf('</head>'));
  const pngAt = head.indexOf(pngLink);
  const svgAt = head.indexOf(svgLink);
  assert.ok(pngAt > 0);
  assert.ok(svgAt > pngAt);
});
