const { readJsonBody } = require('../../lib/body');
const { requestCourseAccess } = require('../../lib/access');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, courseId } = readJsonBody(req);
    const result = await requestCourseAccess({ email, courseId });
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error('Access request error:', err.message);
    return res.status(500).json({ error: 'Could not send a sign-in link.' });
  }
};
