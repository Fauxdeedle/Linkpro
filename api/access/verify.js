const { verifyCourseLogin } = require('../../lib/access');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Location', '/courses?access=invalid');
    return res.status(302).end();
  }

  try {
    const result = await verifyCourseLogin(req.query.token);
    if (!result.ok) {
      res.setHeader('Location', '/courses?access=invalid');
      return res.status(302).end();
    }
    res.setHeader('Set-Cookie', result.cookie);
    res.setHeader('Location', result.next);
    return res.status(302).end();
  } catch (err) {
    console.error('Access verify error:', err.message);
    res.setHeader('Location', '/courses?access=invalid');
    return res.status(302).end();
  }
};
