const { readJsonBody } = require('../lib/body');
const { submitEventSurvey } = require('../lib/event-survey');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const result = await submitEventSurvey(readJsonBody(req));
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error('Survey error:', err.message);
    return res.status(500).json({ error: 'Could not send your response. Please try again.' });
  }
};
