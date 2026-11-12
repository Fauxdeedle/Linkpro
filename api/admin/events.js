const { readJsonBody } = require('../../lib/body');
const { handleAdminEvents, sendAdminResult } = require('../../lib/admin-http');

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'POST') req.body = readJsonBody(req);
    sendAdminResult(res, await handleAdminEvents(req));
  } catch (err) {
    console.error('Admin events error:', err.message);
    res.status(500).json({ error: 'The admin hub could not save that event.' });
  }
};
