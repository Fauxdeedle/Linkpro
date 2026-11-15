const { hubPassword } = require('./admin-auth');
const { loginResult, logoutResult, verifySession } = require('./admin-auth');
const {
  ADMIN_SECTIONS,
  adminLists,
  createLiveEvent,
  loadAdminEvent,
  setEventArchived,
  updateLiveEvent,
} = require('./event-admin');
const { SLUG_RE } = require('./event-store');

function requireSession(req, env) {
  if (!hubPassword(env)) {
    return { status: 503, body: { error: 'The admin hub is not configured.' } };
  }
  if (verifySession(req.headers?.cookie, env)) return null;
  return { status: 401, body: { error: 'Sign in to use the admin hub.' } };
}

async function handleAdminSession(req, env = process.env) {
  if (req.method === 'GET') {
    const denied = requireSession(req, env);
    if (denied) return denied;
    return { status: 200, body: { ok: true, sections: ADMIN_SECTIONS } };
  }

  if (req.method === 'POST') {
    return loginResult(req.body?.password, env);
  }

  if (req.method === 'DELETE') {
    return logoutResult(env);
  }

  return { status: 405, body: { error: 'Method not allowed' } };
}

async function handleAdminEvents(req, env = process.env, options = {}) {
  const denied = requireSession(req, env);
  if (denied) return denied;
  const settings = { ...options, env };

  if (req.method === 'GET') {
    try {
      return { status: 200, body: await adminLists(settings) };
    } catch (err) {
      console.error('Admin event list failed:', err.message);
      return { status: 500, body: { error: 'The event list could not be read.' } };
    }
  }

  if (req.method === 'POST') {
    const result = await createLiveEvent(req.body || {}, settings);
    if (result.error) return { status: result.status, body: { error: result.error } };
    return result;
  }

  return { status: 405, body: { error: 'Method not allowed' } };
}

async function handleAdminEvent(req, slug, env = process.env, options = {}) {
  if (!SLUG_RE.test(slug || '')) {
    return { status: 404, body: { error: 'That event was not found.' } };
  }
  const denied = requireSession(req, env);
  if (denied) return denied;
  const settings = { ...options, env };

  if (req.method === 'GET') {
    const event = await loadAdminEvent(slug, settings);
    if (!event) return { status: 404, body: { error: 'That event was not found.' } };
    return { status: 200, body: { event } };
  }

  if (req.method === 'PUT') {
    const result = await updateLiveEvent(slug, req.body || {}, settings);
    if (result.error) return { status: result.status, body: { error: result.error } };
    return result;
  }

  if (req.method === 'PATCH' || req.method === 'DELETE') {
    const archived = req.method === 'DELETE' ? true : req.body?.archived;
    if (archived !== true && archived !== false) {
      return { status: 400, body: { error: 'Choose whether to archive this event.' } };
    }
    const result = await setEventArchived(slug, archived, settings);
    if (result.error) return { status: result.status, body: { error: result.error } };
    return result;
  }

  return { status: 405, body: { error: 'Method not allowed' } };
}

function sendAdminResult(res, result) {
  if (result.cookie) res.setHeader('Set-Cookie', result.cookie);
  res.status(result.status).json(result.body);
}

module.exports = {
  handleAdminEvent,
  handleAdminEvents,
  handleAdminSession,
  sendAdminResult,
};
