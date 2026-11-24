const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { renderEventPage } = require('../lib/event-pages');

const root = path.join(__dirname, '..');
const pngLink = '<link rel="icon" href="/favicon.png?v=2" type="image/png" sizes="468x468">';
const svgLink = '<link rel="icon" href="/favicon.svg?v=2" type="image/svg+xml">';

function listHtmlFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'components' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listHtmlFiles(full, acc);
    else if (entry.name.endsWith('.html')) acc.push(full);
  }
  return acc;
}

function pngSize(buffer) {
  assert.equal(buffer.subarray(12, 16).toString(), 'IHDR');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

test('favicon assets are the triangle mark on a square canvas', () => {
  const svg = fs.readFileSync(path.join(root, 'favicon.svg'), 'utf8');
  const brand = fs.readFileSync(path.join(root, 'assets/brand/link-pro-logo.svg'), 'utf8');
  const png = fs.readFileSync(path.join(root, 'favicon.png'));
  assert.match(svg, /viewBox="0 0 338 338"/);
  assert.match(svg, /#D09750/);
  const mark = [...brand.matchAll(/d="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(mark.length, 3);
  for (const pathData of mark) assert.ok(svg.includes(pathData));
  assert.deepEqual(pngSize(png), { width: 468, height: 468 });
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
