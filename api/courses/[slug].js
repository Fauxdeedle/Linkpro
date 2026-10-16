const { getCourseForRequest } = require('../../lib/course-content');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const slug = Array.isArray(req.query.slug) ? req.query.slug[0] : req.query.slug;

  try {
    const result = await getCourseForRequest(slug, req);
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error('Course content error:', err.message);
    return res.status(500).json({ error: 'Could not load this course.' });
  }
};
