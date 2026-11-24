#!/usr/bin/env node
/**
 * Writes Open Graph and Twitter card tags into every HTML page.
 * Run after adding a page: npm run build:social
 */

const fs = require('fs');
const path = require('path');
const { START_MARKER, END_MARKER, decode, pageUrl, formatSocialBlock } = require('../lib/social-meta');

const root = path.join(__dirname, '..');
const blockRe = new RegExp(
  `^[ ]*${START_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${END_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n?`,
  'm'
);

function listHtmlFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'components' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listHtmlFiles(full, acc);
    else if (entry.name.endsWith('.html')) acc.push(full);
  }
  return acc;
}

function field(html, pattern) {
  const match = html.match(pattern);
  return match ? decode(match[1].trim()) : '';
}

function inject(content, rel) {
  const title = field(content, /<title>([^<]*)<\/title>/);
  const description = field(content, /<meta name="description" content="([^"]*)">/);
  if (!title) return null;

  const anchor =
    content.match(/^( *)<meta name="description" content="[^"]*">/m) ||
    content.match(/^( *)<title>[^<]*<\/title>/m);
  if (!anchor) return null;

  const block = `${formatSocialBlock(anchor[1], {
    title,
    description,
    url: pageUrl(rel),
  })}\n`;

  if (blockRe.test(content)) {
    return content.replace(blockRe, block);
  }
  return content.replace(anchor[0], `${anchor[0]}\n${block.trimEnd()}`);
}

const files = listHtmlFiles(root);
if (files.length === 0) {
  console.error('No HTML files found');
  process.exit(1);
}

for (const filePath of files) {
  const rel = path.relative(root, filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  const next = inject(content, rel.split(path.sep).join('/'));
  if (next === null) {
    console.warn('skip:', rel);
    continue;
  }
  if (next === content) {
    console.log('unchanged:', rel);
    continue;
  }
  fs.writeFileSync(filePath, next, 'utf8');
  console.log('updated:', rel);
}

console.log('build:social complete');
