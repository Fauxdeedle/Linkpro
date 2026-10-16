const express = require('express');
const { getCourseForRequest } = require('../../lib/course-content');

const router = express.Router();

router.get('/:slug', async (req, res) => {
  try {
    const result = await getCourseForRequest(req.params.slug, req);
    res.status(result.status).json(result.body);
  } catch (err) {
    console.error('Course content error:', err.message);
    res.status(500).json({ error: 'Could not load this course.' });
  }
});

module.exports = router;
