const { getFluteConfig } = require('../lib/checkout');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const result = getFluteConfig();
  if (result.error) {
    return res.status(result.status).json({ error: result.error });
  }

  return res.status(200).json({ configured: result.configured });
};
