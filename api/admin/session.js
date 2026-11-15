const { readJsonBody } = require('../../lib/body');
const { handleAdminSession, sendAdminResult } = require('../../lib/admin-http');

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'POST') req.body = readJsonBody(req);
    sendAdminResult(res, await handleAdminSession(req));
  } catch (err) {
    console.error('Admin session error:', err.message);
    res.status(500).json({ error: 'The admin hub could not sign in.' });
  }
};
