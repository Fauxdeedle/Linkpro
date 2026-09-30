const express = require('express');
const {
  getFluteConfig,
  createCheckoutSession,
  getCheckoutSession,
  getCheckoutErrorStatus,
} = require('../../lib/checkout');
const { authenticateRequest } = require('../../lib/auth');
const { getProduct } = require('../config/products');

const router = express.Router();

router.get('/flute-config', (_req, res) => {
  const result = getFluteConfig();
  if (result.error) {
    return res.status(result.status).json({ error: result.error });
  }
  res.json({ configured: result.configured });
});

router.post('/create-checkout-session', async (req, res) => {
  try {
    const product = getProduct(req.body.productId);
    let userId;
    if (product?.courseId) {
      const auth = await authenticateRequest(req);
      if (auth.error) {
        return res.status(auth.status).json({ error: auth.error });
      }
      userId = auth.userId;
    }

    const result = await createCheckoutSession(req.body.productId, userId);
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }
    res.json({
      sessionId: result.sessionId,
      checkoutUrl: result.checkoutUrl,
      productName: result.productName,
    });
  } catch (err) {
    console.error('Checkout session error:', err.message);
    res.status(getCheckoutErrorStatus(err)).json({ error: err.message });
  }
});

router.get('/checkout-session/:sessionId', async (req, res) => {
  try {
    const result = await getCheckoutSession(req.params.sessionId);
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }
    res.json(result);
  } catch (err) {
    console.error('Session lookup error:', err.message);
    res.status(getCheckoutErrorStatus(err)).json({ error: err.message });
  }
});

module.exports = router;
