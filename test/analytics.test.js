const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

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

test('every HTML page loads Vercel Web Analytics', () => {
  const files = listHtmlFiles(root);
  assert.ok(files.length > 0);

  for (const filePath of files) {
    const rel = path.relative(root, filePath);
    const html = fs.readFileSync(filePath, 'utf8');
    assert.match(html, /LINKPRO_ANALYTICS_START/, rel);
    assert.match(html, /LINKPRO_ANALYTICS_END/, rel);
    assert.match(html, /src="\/_vercel\/insights\/script\.js"/, rel);
    assert.match(html, /searchParams\.delete\('session_id'\)/, rel);
    assert.equal(html.indexOf('LINKPRO_ANALYTICS_END') < html.lastIndexOf('</body>'), true, rel);
  }
});
