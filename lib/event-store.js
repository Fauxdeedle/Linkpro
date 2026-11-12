const fs = require('fs');
const path = require('path');

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DEFAULT_ROOT = path.join(__dirname, '..');

function eventsDirectory(root = DEFAULT_ROOT) {
  return path.join(root, 'content', 'events');
}

function loadEvents(root = DEFAULT_ROOT) {
  const dir = eventsDirectory(root);
  if (!fs.existsSync(dir)) {
    throw new Error('Missing content/events');
  }

  const events = [];
  const seen = new Set();

  for (const name of fs.readdirSync(dir).sort()) {
    if (!name.endsWith('.json') || name.startsWith('_')) continue;
    const event = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
    if (!SLUG_RE.test(event.slug || '')) {
      throw new Error(`${name} has an invalid slug`);
    }
    if (name !== `${event.slug}.json`) {
      throw new Error(`${name} must be named ${event.slug}.json`);
    }
    if (seen.has(event.slug)) throw new Error(`Duplicate slug ${event.slug}`);
    seen.add(event.slug);
    if (!event.catalog || !event.catalog.title) {
      throw new Error(`${name} needs catalog.title`);
    }
    events.push(event);
  }

  return events;
}

function eventProduct(id, events) {
  if (!id) return null;
  const event = events.find((item) => {
    if (item.pageMode !== 'generated') return false;
    return (item.productId || item.slug) === id;
  });
  if (!event) return null;

  const amount = Number(event.price);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  return {
    id: event.productId || event.slug,
    name: event.catalog.title || event.slug,
    amount,
    successUrl: `/${event.slug}.html`,
  };
}

function getEventProduct(id, root = DEFAULT_ROOT) {
  return eventProduct(id, loadEvents(root));
}

module.exports = {
  DEFAULT_ROOT,
  SLUG_RE,
  eventsDirectory,
  loadEvents,
  eventProduct,
  getEventProduct,
};
