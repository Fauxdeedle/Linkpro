const {
  getCheckoutSession,
  getCheckoutErrorStatus,
  publicCheckoutResult,
} = require('../../lib/checkout');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sessionId } = req.query;
  if (!sessionId) {
    return res.status(400).json({ error: 'Missing session ID' });
  }

  try {
    const result = await getCheckoutSession(sessionId);
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }
    if (result.accessCookie) {
      res.setHeader('Set-Cookie', result.accessCookie);
    }
    return res.status(200).json(publicCheckoutResult(result));
  } catch (err) {
    console.error('Session lookup error:', err.message);
    return res
      .status(getCheckoutErrorStatus(err))
      .json({ error: err.message });
  }
};
