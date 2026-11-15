const express = require('express');
const {
  handleAdminEvent,
  handleAdminEvents,
  handleAdminSession,
  sendAdminResult,
} = require('../../lib/admin-http');

const router = express.Router();

router.all('/session', async (req, res) => {
  try {
    sendAdminResult(res, await handleAdminSession(req));
  } catch (err) {
    console.error('Admin session error:', err.message);
    res.status(500).json({ error: 'The admin hub could not sign in.' });
  }
});

router.all('/events', async (req, res) => {
  try {
    sendAdminResult(res, await handleAdminEvents(req));
  } catch (err) {
    console.error('Admin events error:', err.message);
    res.status(500).json({ error: 'The admin hub could not save that event.' });
  }
});

router.all('/events/:slug', async (req, res) => {
  try {
    sendAdminResult(res, await handleAdminEvent(req, req.params.slug));
  } catch (err) {
    console.error('Admin event error:', err.message);
    res.status(500).json({ error: 'The admin hub could not save that event.' });
  }
});

module.exports = router;
