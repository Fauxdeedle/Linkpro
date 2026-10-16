#!/usr/bin/env node
/**
 * Inlines components/site-analytics.html into every HTML page.
 * Run after editing the snippet: npm run build:analytics
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const templatePath = path.join(root, 'components', 'site-analytics.html');
const startMarker = '<!-- LINKPRO_ANALYTICS_START -->';
const endMarker = '<!-- LINKPRO_ANALYTICS_END -->';

function listHtmlFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listHtmlFiles(full, acc);
    } else if (entry.name.endsWith('.html')) {
      acc.push(full);
    }
  }
  return acc;
}

function inject(content, block) {
  const start = content.indexOf(startMarker);
  const end = content.indexOf(endMarker);
  if (start !== -1 && end !== -1 && end > start) {
    return (
      content.slice(0, start) +
      block +
      content.slice(end + endMarker.length)
    );
  }

  const close = content.lastIndexOf('</body>');
  if (close === -1) return null;
  const prefix = content.slice(0, close).replace(/\s*$/, '\n');
  return `${prefix}${block}\n${content.slice(close)}`;
}

const snippet = fs.readFileSync(templatePath, 'utf8').trim();
if (!snippet.includes('/_vercel/insights/script.js')) {
  console.error('Invalid site-analytics template');
  process.exit(1);
}

const block = `${startMarker}\n${snippet}\n${endMarker}`;
const files = listHtmlFiles(root);

if (files.length === 0) {
  console.error('No HTML files found');
  process.exit(1);
}

for (const filePath of files) {
  const rel = path.relative(root, filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  const next = inject(content, block);
  if (next === null) {
    console.warn('skip (no </body>):', rel);
    continue;
  }
  if (next === content) {
    console.log('unchanged:', rel);
    continue;
  }
  fs.writeFileSync(filePath, next, 'utf8');
  console.log('updated:', rel);
}

console.log('build:analytics complete');
