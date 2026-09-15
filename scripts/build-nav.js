#!/usr/bin/env node
/**
 * Inlines components/site-nav.html into all pages between LINKPRO_NAV markers.
 * Run after editing the nav component: npm run build:nav
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const templatePath = path.join(root, 'components', 'site-nav.html');
const startMarker = '<!-- LINKPRO_NAV_START -->';
const endMarker = '<!-- LINKPRO_NAV_END -->';

const activeByFile = {
  'index.html': null,
  'about.html': 'about',
  'services.html': 'services',
  'somatherapy.html': 'services',
  'classes.html': 'classes',
  'courses.html': 'courses',
  'blog.html': 'blog',
  'reviews.html': 'reviews',
  'rams.html': null,
  'peak-athleticism.html': 'peak',
  'sharks-proposal.html': null,
  'media-kit.html': null,
  'pelvis-1-course.html': 'courses',
  'checkout-success.html': null,
  'checkout-cancel.html': null,
  'blog/your-pain-has-an-address.html': 'blog',
  'blog/what-pro-teams-know-about-the-pelvis.html': 'blog',
  'courses/course-template.html': 'courses',
};

function renderNav(activeId) {
  let html = fs.readFileSync(templatePath, 'utf8');
  if (activeId) {
    html = html.replace(
      new RegExp(`(<a[^>]*data-nav-id="${activeId}"[^>]*)>`, 'g'),
      '$1 aria-current="page">'
    );
  }
  return html.trim();
}

function injectNav(fileRel, activeId) {
  const filePath = path.join(root, fileRel);
  if (!fs.existsSync(filePath)) {
    console.warn('skip (missing):', fileRel);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const start = content.indexOf(startMarker);
  const end = content.indexOf(endMarker);

  if (start === -1 || end === -1 || end <= start) {
    console.warn('skip (no markers):', fileRel);
    return;
  }

  const navHtml = renderNav(activeId);
  const before = content.slice(0, start + startMarker.length);
  const after = content.slice(end);
  const block = `\n${navHtml}\n`;
  const next = before + block + after;

  if (next === content) {
    console.log('unchanged:', fileRel);
    return;
  }

  fs.writeFileSync(filePath, next, 'utf8');
  console.log('updated:', fileRel, activeId ? `(active: ${activeId})` : '');
}

const template = fs.readFileSync(templatePath, 'utf8');
if (!template.includes('data-nav-id')) {
  console.error('Invalid site-nav template');
  process.exit(1);
}

Object.entries(activeByFile).forEach(([file, activeId]) => {
  injectNav(file, activeId);
});

console.log('build:nav complete');
