const {
  createCheckoutSession,
  getCheckoutErrorStatus,
} = require('../lib/checkout');
const { authenticateRequest } = require('../lib/auth');
const { getProduct } = require('../server/config/products');
const { readJsonBody } = require('../lib/body');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { productId } = readJsonBody(req);
    const product = getProduct(productId);
    let userId;
    if (product?.courseId) {
      const auth = await authenticateRequest(req);
      if (auth.error) {
        return res.status(auth.status).json({ error: auth.error });
      }
      userId = auth.userId;
    }

    const result = await createCheckoutSession(productId, userId);

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    return res.status(200).json({
      sessionId: result.sessionId,
      checkoutUrl: result.checkoutUrl,
      productName: result.productName,
    });
  } catch (err) {
    console.error('Checkout session error:', err.message);
    return res
      .status(getCheckoutErrorStatus(err))
      .json({ error: err.message });
  }
};
