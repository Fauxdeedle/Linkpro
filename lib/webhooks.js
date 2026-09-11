const { getFlute } = require('./flute');
const { verifyWebhookSignature, FluteWebhookError } = require('@getflute/sdk');

async function processFluteWebhook(rawBody, headers) {
  const webhookSecret = process.env.FLUTE_WEBHOOK_SECRET;

  if (!getFlute() || !webhookSecret || webhookSecret.startsWith('whsec_...')) {
    return { error: 'Flute webhook is not configured', status: 503 };
  }

  try {
    const verified = verifyWebhookSignature({
      signatureHeader: headers['flute-webhook-signature'],
      idHeader: headers['flute-webhook-id'],
      timestampHeader: headers['flute-webhook-timestamp'],
      rawRequestBody: rawBody,
      signatureSecret: webhookSecret,
    });

    if (!verified) {
      return { error: 'Webhook signature verification failed', status: 401 };
    }
  } catch (err) {
    const message = err instanceof FluteWebhookError ? err.message : err.message;
    console.error('Webhook signature verification failed:', message);
    return { error: `Webhook Error: ${message}`, status: 400 };
  }

  let event;
  try {
    event = JSON.parse(typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8'));
  } catch (err) {
    return { error: 'Invalid webhook payload', status: 400 };
  }

  switch (event.eventType || event.type) {
    case 'payment_session.completed': {
      console.log('Payment complete:', {
        sessionId: event.data?.id || event.paymentSessionId,
        metadata: event.data?.metadata,
      });
      break;
    }
    default:
      console.log(`Unhandled Flute event: ${event.eventType || event.type}`);
  }

  return { received: true };
}

module.exports = { processFluteWebhook };
