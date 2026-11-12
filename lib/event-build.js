const fs = require('fs');
const path = require('path');
const { renderCatalog, renderEventPage } = require('./event-pages');

const NAV_START = '<!-- LINKPRO_NAV_START -->';
const NAV_END = '<!-- LINKPRO_NAV_END -->';
const ANALYTICS_START = '<!-- LINKPRO_ANALYTICS_START -->';
const ANALYTICS_END = '<!-- LINKPRO_ANALYTICS_END -->';
const EVENTS_START = '<!-- LINKPRO_EVENTS_START -->';
const EVENTS_END = '<!-- LINKPRO_EVENTS_END -->';

function readOptional(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8').trim() : '';
}

function injectMarked(html, start, end, block) {
  const startAt = html.indexOf(start);
  const endAt = html.indexOf(end);
  if (startAt === -1 || endAt === -1 || endAt < startAt) return html;
  return `${html.slice(0, startAt + start.length)}\n${block}\n${html.slice(endAt)}`;
}

function navBlock(root) {
  const template = readOptional(path.join(root, 'components', 'site-nav.html'));
  if (!template) return '';
  return template.replace(
    /(<a[^>]*data-nav-id="courses"[^>]*)>/,
    '$1 aria-current="page">'
  );
}

function analyticsBlock(root) {
  return readOptional(path.join(root, 'components', 'site-analytics.html'));
}

function finishPage(event, root) {
  let html = renderEventPage(event);
  const nav = navBlock(root);
  if (nav) html = injectMarked(html, NAV_START, NAV_END, nav);
  const analytics = analyticsBlock(root);
  if (analytics) html = injectMarked(html, ANALYTICS_START, ANALYTICS_END, analytics);
  return html;
}

function spliceCatalog(html, events, surface, variant) {
  const cards = renderCatalog(events, surface, variant);
  const startAt = html.indexOf(EVENTS_START);
  const endAt = html.indexOf(EVENTS_END);
  if (startAt === -1 || endAt === -1 || endAt < startAt) {
    throw new Error('Missing event markers in a catalog page');
  }
  return `${html.slice(0, startAt + EVENTS_START.length)}\n${cards}\n${html.slice(endAt)}`;
}

function changedSiteFiles({ root, events, slug, removedSlug }) {
  const writes = {};
  const deletes = [];

  if (slug) {
    const event = events.find((item) => item.slug === slug);
    if (!event) throw new Error(`Missing event ${slug}`);
    writes[`content/events/${slug}.json`] = `${JSON.stringify(event, null, 2)}\n`;
    if (event.pageMode === 'generated') {
      writes[`${slug}.html`] = finishPage(event, root);
    }
  }

  if (removedSlug) {
    deletes.push(`content/events/${removedSlug}.json`, `${removedSlug}.html`);
  }

  const indexPath = path.join(root, 'index.html');
  const coursesPath = path.join(root, 'courses.html');
  writes['index.html'] = spliceCatalog(
    fs.readFileSync(indexPath, 'utf8'),
    events,
    'home',
    'home'
  );
  writes['courses.html'] = spliceCatalog(
    fs.readFileSync(coursesPath, 'utf8'),
    events,
    'courses',
    'courses'
  );

  return { writes, deletes };
}

function writeSiteFiles(root, { writes, deletes }) {
  for (const [rel, content] of Object.entries(writes)) {
    const filePath = path.join(root, rel);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  }
  for (const rel of deletes) {
    const filePath = path.join(root, rel);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}

module.exports = {
  changedSiteFiles,
  finishPage,
  writeSiteFiles,
};
