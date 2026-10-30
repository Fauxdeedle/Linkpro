const { readJsonBody } = require('../../lib/body');
const { continueCourseAccess, getCheckoutErrorStatus } = require('../../lib/checkout');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, courseId } = readJsonBody(req);
    const result = await continueCourseAccess({ email, courseId });
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error('Access continue error:', err.message);
    return res.status(getCheckoutErrorStatus(err)).json({ error: err.message });
  }
};
