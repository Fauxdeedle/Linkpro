const express = require('express');
const { readJsonBody } = require('../../lib/body');
const { submitEventSurvey } = require('../../lib/event-survey');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const result = await submitEventSurvey(readJsonBody(req));
    res.status(result.status).json(result.body);
  } catch (err) {
    console.error('Survey error:', err.message);
    res.status(500).json({ error: 'Could not send your response. Please try again.' });
  }
});

router.use((req, res) => {
  res.status(405).json({ error: 'Method not allowed' });
});

module.exports = router;
