const { loginResult, logoutResult, verifySession } = require('./admin-auth');
const {
  ADMIN_SECTIONS,
  createLiveEvent,
  deleteLiveEvent,
  listLiveEvents,
  readLiveEvent,
  updateLiveEvent,
} = require('./event-admin');

function requireSession(req, env) {
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
    const result = loginResult(req.body?.password, env);
    return result;
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
    return { status: 200, body: { events: listLiveEvents(options.root) } };
  }

  if (req.method === 'POST') {
    const result = await createLiveEvent(req.body || {}, settings);
    if (result.error) return { status: result.status, body: { error: result.error } };
    return result;
  }

  return { status: 405, body: { error: 'Method not allowed' } };
}

async function handleAdminEvent(req, slug, env = process.env, options = {}) {
  const denied = requireSession(req, env);
  if (denied) return denied;
  const settings = { ...options, env };

  if (req.method === 'GET') {
    const event = readLiveEvent(slug, options.root);
    if (!event) return { status: 404, body: { error: 'That event was not found.' } };
    return { status: 200, body: { event } };
  }

  if (req.method === 'PUT') {
    const result = await updateLiveEvent(slug, req.body || {}, settings);
    if (result.error) return { status: result.status, body: { error: result.error } };
    return result;
  }

  if (req.method === 'DELETE') {
    const result = await deleteLiveEvent(slug, settings);
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
