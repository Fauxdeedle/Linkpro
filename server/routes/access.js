const express = require('express');
const { readJsonBody } = require('../../lib/body');
const { requestCourseAccess, verifyCourseLogin } = require('../../lib/access');
const { continueCourseAccess, getCheckoutErrorStatus } = require('../../lib/checkout');

const router = express.Router();

router.post('/request', async (req, res) => {
  try {
    const { email, courseId } = readJsonBody(req);
    const result = await requestCourseAccess({ email, courseId });
    res.status(result.status).json(result.body);
  } catch (err) {
    console.error('Access request error:', err.message);
    res.status(500).json({ error: 'Could not send a sign-in link.' });
  }
});

router.post('/continue', async (req, res) => {
  try {
    const { email, courseId } = readJsonBody(req);
    const result = await continueCourseAccess({ email, courseId });
    res.status(result.status).json(result.body);
  } catch (err) {
    console.error('Access continue error:', err.message);
    res.status(getCheckoutErrorStatus(err)).json({ error: err.message });
  }
});

router.get('/verify', async (req, res) => {
  try {
    const result = await verifyCourseLogin(req.query.token);
    if (!result.ok) {
      return res.redirect(302, '/courses?access=invalid');
    }
    res.setHeader('Set-Cookie', result.cookie);
    return res.redirect(302, result.next);
  } catch (err) {
    console.error('Access verify error:', err.message);
    return res.redirect(302, '/courses?access=invalid');
  }
});

module.exports = router;
