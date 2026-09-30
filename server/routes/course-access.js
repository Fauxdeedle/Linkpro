const express = require('express');
const { authenticateRequest } = require('../../lib/auth');
const {
  getProtectedCourse,
  updateCourseProgress,
} = require('../../lib/course-access');

const router = express.Router();

router.use(async (req, res, next) => {
  const auth = await authenticateRequest(req);
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }
  req.auth = auth;
  return next();
});

router.get('/:courseId', async (req, res) => {
  try {
    const result = await getProtectedCourse(
      req.auth.userId,
      req.params.courseId
    );
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.json(result);
  } catch (error) {
    console.error('Course access error:', error.message);
    return res.status(503).json({ error: 'Course access is unavailable' });
  }
});

router.put('/:courseId', async (req, res) => {
  try {
    const result = await updateCourseProgress(
      req.auth.userId,
      req.params.courseId,
      req.body.completedLessons
    );
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.json(result);
  } catch (error) {
    console.error('Course progress error:', error.message);
    return res.status(503).json({ error: 'Course progress is unavailable' });
  }
});

module.exports = router;
