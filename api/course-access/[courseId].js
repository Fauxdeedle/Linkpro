const { authenticateRequest } = require('../../lib/auth');
const {
  getProtectedCourse,
  updateCourseProgress,
} = require('../../lib/course-access');
const { readJsonBody } = require('../../lib/body');

module.exports = async function handler(req, res) {
  if (!['GET', 'PUT'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await authenticateRequest(req);
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }

  try {
    const result =
      req.method === 'GET'
        ? await getProtectedCourse(auth.userId, req.query.courseId)
        : await updateCourseProgress(
            auth.userId,
            req.query.courseId,
            readJsonBody(req).completedLessons
          );

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.status(200).json(result);
  } catch (error) {
    console.error('Course access error:', error.message);
    return res.status(503).json({ error: 'Course access is unavailable' });
  }
};
