const { changedSiteFiles, writeSiteFiles } = require('./event-build');
const { applyEventFields, createEventRecord, publicEvent } = require('./event-fields');
const { DEFAULT_ROOT, loadEvents } = require('./event-store');
const { checkoutPublishSource, publishConfig, publishSiteFiles } = require('./github-publish');

const ADMIN_SECTIONS = [
  { id: 'events', label: 'Live Events' },
  { id: 'archive', label: 'Archive Events' },
];

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

async function usingSource(options, fn) {
  const env = options.env || process.env;
  if (!env.VERCEL || !publishConfig(env)) {
    return fn(options.root || DEFAULT_ROOT);
  }
  const workspace = await checkoutPublishSource({ env, fetchImpl: options.fetchImpl });
  try {
    return await fn(workspace.root);
  } finally {
    workspace.cleanup();
  }
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
      const published = await publishSiteFiles({
        files,
        message,
        env,
        fetchImpl,
      });
      return {
        published: true,
        written: false,
        branch: published.branch,
        pullRequestUrl: published.pullRequestUrl,
      };
    } catch (err) {
      console.error('Admin publish failed:', err.message);
      return { error: publishError(err), status: 502 };
    }
  }

  return { published: false, written: true };
}

function publishedBody(saved, extra) {
  return {
    ...extra,
    published: saved.published,
    pullRequestUrl: saved.pullRequestUrl || '',
  };
}

async function createLiveEvent(input, options = {}) {
  try {
    return await usingSource(options, async (root) => {
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
        body: publishedBody(saved, { event: publicEvent(created.event) }),
      };
    });
  } catch (err) {
    console.error('Admin publish failed:', err.message);
    return { error: publishError(err), status: 502 };
  }
}

async function updateLiveEvent(slug, input, options = {}) {
  try {
    return await usingSource(options, async (root) => {
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
        body: publishedBody(saved, { event: publicEvent(updated.event) }),
      };
    });
  } catch (err) {
    console.error('Admin publish failed:', err.message);
    return { error: publishError(err), status: 502 };
  }
}

async function setEventArchived(slug, archived, options = {}) {
  try {
    return await usingSource(options, async (root) => {
      const events = loadEvents(root);
      const current = events.find((event) => event.slug === slug);
      if (!current) return { error: 'That event was not found.', status: 404 };
      if (current.pageMode !== 'generated') {
        return { error: 'This event is maintained by hand.', status: 400 };
      }

      if (archived) current.archived = true;
      else delete current.archived;

      const saved = await persistChange({
        ...options,
        root,
        events,
        slug,
        message: `${archived ? 'Archive' : 'Restore'} live event ${current.catalog?.title || slug}`,
      });
      if (saved.error) return saved;
      return {
        status: 200,
        body: publishedBody(saved, { event: publicEvent(current) }),
      };
    });
  } catch (err) {
    console.error('Admin publish failed:', err.message);
    return { error: publishError(err), status: 502 };
  }
}

function publishError(err) {
  const detail = String(err?.message || '').trim();
  if (!detail || detail === 'The change could not be published.') {
    return 'The change could not be published.';
  }
  return `The change could not be published. ${detail}`;
}

async function adminLists(options = {}) {
  return usingSource(options, (root) => ({
    events: listLiveEvents(root),
    archived: listArchivedEvents(root),
  }));
}

async function loadAdminEvent(slug, options = {}) {
  return usingSource(options, (root) => readLiveEvent(slug, root));
}

function listLiveEvents(root = DEFAULT_ROOT) {
  return generatedEvents(loadEvents(root))
    .filter((event) => !event.archived)
    .map(publicEvent);
}

function listArchivedEvents(root = DEFAULT_ROOT) {
  return generatedEvents(loadEvents(root))
    .filter((event) => event.archived)
    .map(publicEvent);
}

function readLiveEvent(slug, root = DEFAULT_ROOT) {
  const event = findGenerated(loadEvents(root), slug);
  if (!event) return null;
  return publicEvent(event);
}

module.exports = {
  ADMIN_SECTIONS,
  adminLists,
  createLiveEvent,
  listArchivedEvents,
  listLiveEvents,
  loadAdminEvent,
  readLiveEvent,
  setEventArchived,
  updateLiveEvent,
};
