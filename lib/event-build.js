const fs = require('fs');
const path = require('path');
const { renderCatalog, renderEventPage } = require('./event-pages');

const NAV_START = '<!-- LINKPRO_NAV_START -->';
const NAV_END = '<!-- LINKPRO_NAV_END -->';
const ANALYTICS_START = '<!-- LINKPRO_ANALYTICS_START -->';
const ANALYTICS_END = '<!-- LINKPRO_ANALYTICS_END -->';
const EVENTS_START = '<!-- LINKPRO_EVENTS_START -->';
const EVENTS_END = '<!-- LINKPRO_EVENTS_END -->';

const CATALOGS = [
  { file: 'live-events.html', surface: 'events', variant: 'courses' },
  {
    file: 'index.html',
    surface: 'events',
    variant: 'feature',
    limit: 3,
    start: '<!-- LINKPRO_FEATURED_EVENTS_START -->',
    end: '<!-- LINKPRO_FEATURED_EVENTS_END -->',
  },
];

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
    /(<a[^>]*data-nav-id="events"[^>]*)>/g,
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

function catalogContents(html, events, catalog) {
  const start = catalog.start || EVENTS_START;
  const end = catalog.end || EVENTS_END;
  const cards = renderCatalog(events, catalog.surface, catalog.variant, { limit: catalog.limit });
  const startAt = html.indexOf(start);
  const endAt = html.indexOf(end);
  if (startAt === -1 || endAt === -1 || endAt < startAt) {
    throw new Error(`Missing event markers in ${catalog.file}`);
  }
  return `${html.slice(0, startAt + start.length)}\n${cards}\n${html.slice(endAt)}`;
}

function applyCatalogs(root, events) {
  for (const catalog of CATALOGS) {
    const filePath = path.join(root, catalog.file);
    const next = catalogContents(fs.readFileSync(filePath, 'utf8'), events, catalog);
    fs.writeFileSync(filePath, next);
    console.log('catalog', catalog.file, catalog.variant);
  }
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

  for (const catalog of CATALOGS) {
    const filePath = path.join(root, catalog.file);
    writes[catalog.file] = catalogContents(fs.readFileSync(filePath, 'utf8'), events, catalog);
  }

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
  CATALOGS,
  applyCatalogs,
  catalogContents,
  changedSiteFiles,
  finishPage,
  writeSiteFiles,
};
