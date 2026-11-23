const fs = require('fs');
const path = require('path');
const { activeSalePrice } = require('./event-sale');

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function projectRoot() {
  const candidates = [path.join(__dirname, '..'), process.cwd()];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'content', 'events'))) return candidate;
  }
  return candidates[0];
}

const DEFAULT_ROOT = projectRoot();

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

function listAmount(event) {
  const price = Number(event?.price);
  if (Number.isInteger(price) && price > 0 && price <= 100000) return price;
  const label = String(event?.catalog?.priceLabel || '').trim();
  const match = label.match(/^\$(\d{1,3}(?:,\d{3})*|\d+)$/);
  if (!match) return null;
  const amount = Number(match[1].replace(/,/g, ''));
  if (!Number.isInteger(amount) || amount <= 0 || amount > 100000) return null;
  return amount;
}

function chargedAmount(event, now = new Date()) {
  const list = listAmount(event);
  if (!list) return null;
  return activeSalePrice(list, event?.sale, now) || list;
}

function findGeneratedEvent(id, events) {
  if (!id) return null;
  return (
    events.find((item) => {
      if (item.pageMode !== 'generated') return false;
      return item.productId === id || item.slug === id;
    }) || null
  );
}

function eventProduct(id, events, now = new Date()) {
  const event = findGeneratedEvent(id, events);
  if (!event || !event.productId) return null;
  const amount = chargedAmount(event, now);
  if (!amount) return null;
  return {
    id: event.productId,
    name: event.catalog?.title || event.slug,
    amount,
    successUrl: `/${event.slug}.html`,
  };
}

function productFromEvents(id, events) {
  const event = findGeneratedEvent(id, events);
  if (!event) return { owned: false, product: null };
  return { owned: true, product: eventProduct(id, events) };
}

function getEventProduct(id, root = DEFAULT_ROOT) {
  return eventProduct(id, loadEvents(root));
}

module.exports = {
  DEFAULT_ROOT,
  SLUG_RE,
  projectRoot,
  chargedAmount,
  eventProduct,
  listAmount,
  eventsDirectory,
  findGeneratedEvent,
  getEventProduct,
  loadEvents,
  productFromEvents,
};
