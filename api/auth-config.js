const { getPublicAuthConfig } = require('../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const result = getPublicAuthConfig();
  if (result.error) {
    return res.status(result.status).json({ error: result.error });
  }
  return res.status(200).json(result);
};
