const { changedSiteFiles, writeSiteFiles } = require('./event-build');
const {
  applyEventFields,
  createEventRecord,
  publicEvent,
} = require('./event-fields');
const { DEFAULT_ROOT, loadEvents } = require('./event-store');
const { publishConfig, publishSiteFiles } = require('./github-publish');

const ADMIN_SECTIONS = [{ id: 'events', label: 'Live Events' }];

function generatedEvents(events) {
  return events
    .filter((event) => event.pageMode === 'generated')
    .slice()
    .sort(
      (a, b) =>
        (Number(a.sort) || 0) - (Number(b.sort) || 0) ||
        String(a.slug).localeCompare(String(b.slug))
    );
}

function findGenerated(events, slug) {
  return events.find((event) => event.slug === slug && event.pageMode === 'generated');
}

async function persistChange({
  root = DEFAULT_ROOT,
  events,
  slug,
  removedSlug,
  message,
  env = process.env,
  fetchImpl,
}) {
  const files = changedSiteFiles({ root, events, slug, removedSlug });
  const publishing = Boolean(env.VERCEL);
  if (publishing && !publishConfig(env)) {
    return { error: 'Admin publishing is not configured.', status: 503 };
  }

  if (!publishing) {
    writeSiteFiles(root, files);
  }

  if (publishing) {
    try {
      await publishSiteFiles({
        files,
        message,
        env,
        fetchImpl,
      });
    } catch (err) {
      console.error('Admin publish failed:', err.message);
      return { error: 'The change could not be published.', status: 502 };
    }
  }

  return { published: publishing, written: !publishing };
}

async function createLiveEvent(input, options = {}) {
  const root = options.root || DEFAULT_ROOT;
  const events = loadEvents(root);
  const created = createEventRecord(events, input, root);
  if (created.error) return { error: created.error, status: 400 };

  const next = events.concat(created.event);
  const saved = await persistChange({
    ...options,
    root,
    events: next,
    slug: created.event.slug,
    message: `Add live event ${created.event.catalog.title}`,
  });
  if (saved.error) return saved;
  return {
    status: 201,
    body: {
      event: publicEvent(created.event),
      published: saved.published,
    },
  };
}

async function updateLiveEvent(slug, input, options = {}) {
  const root = options.root || DEFAULT_ROOT;
  const events = loadEvents(root);
  const current = events.find((event) => event.slug === slug);
  if (!current) return { error: 'That event was not found.', status: 404 };
  if (current.pageMode !== 'generated') {
    return { error: 'This event is maintained by hand.', status: 400 };
  }

  const updated = applyEventFields(current, input, { isNew: false });
  if (updated.error) return { error: updated.error, status: 400 };

  const saved = await persistChange({
    ...options,
    root,
    events,
    slug,
    message: `Update live event ${updated.event.catalog.title}`,
  });
  if (saved.error) return saved;
  return {
    status: 200,
    body: {
      event: publicEvent(updated.event),
      published: saved.published,
    },
  };
}

async function deleteLiveEvent(slug, options = {}) {
  const root = options.root || DEFAULT_ROOT;
  const events = loadEvents(root);
  const current = events.find((event) => event.slug === slug);
  if (!current) return { error: 'That event was not found.', status: 404 };
  if (current.pageMode !== 'generated') {
    return { error: 'This event is maintained by hand.', status: 400 };
  }

  const next = events.filter((event) => event.slug !== slug);
  const saved = await persistChange({
    ...options,
    root,
    events: next,
    removedSlug: slug,
    message: `Remove live event ${current.catalog?.title || slug}`,
  });
  if (saved.error) return saved;
  return { status: 200, body: { deleted: slug, published: saved.published } };
}

function listLiveEvents(root = DEFAULT_ROOT) {
  return generatedEvents(loadEvents(root)).map(publicEvent);
}

function readLiveEvent(slug, root = DEFAULT_ROOT) {
  const event = findGenerated(loadEvents(root), slug);
  if (!event) return null;
  return publicEvent(event);
}

module.exports = {
  ADMIN_SECTIONS,
  createLiveEvent,
  deleteLiveEvent,
  listLiveEvents,
  readLiveEvent,
  updateLiveEvent,
};
