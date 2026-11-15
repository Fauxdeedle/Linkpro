const { readJsonBody } = require('../../../lib/body');
const { handleAdminEvent, sendAdminResult } = require('../../../lib/admin-http');

module.exports = async function handler(req, res) {
  const slug = Array.isArray(req.query.slug) ? req.query.slug[0] : req.query.slug;
  try {
    if (req.method === 'PUT') req.body = readJsonBody(req);
    sendAdminResult(res, await handleAdminEvent(req, slug));
  } catch (err) {
    console.error('Admin event error:', err.message);
    res.status(500).json({ error: 'The admin hub could not save that event.' });
  }
};
