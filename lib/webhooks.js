const { verifyWebhookSignature, FluteWebhookError } = require('@getflute/sdk');
const { fulfillPaymentSession } = require('./course-access');

async function processFluteWebhook(
  rawBody,
  headers,
  { fulfill = fulfillPaymentSession } = {}
) {
  const webhookSecret = process.env.FLUTE_WEBHOOK_SECRET;

  if (!webhookSecret || webhookSecret.startsWith('whsec_...')) {
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

  const eventType = event.type || event.eventType;
  const resource = event.data?.object || event.data;

  switch (eventType) {
    case 'payment_session.completed': {
      const sessionId = resource?.id || event.paymentSessionId;
      if (!sessionId) {
        return { error: 'Missing payment session ID', status: 400 };
      }
      await fulfill(sessionId);
      console.log('Payment complete:', {
        sessionId,
        metadata: resource?.metadata,
      });
      break;
    }
    case 'transaction.card.authorized':
    case 'transaction.card.captured':
    case 'transaction.card.declined':
    case 'transaction.card.failed': {
      console.log('Card transaction update:', {
        eventType,
        transactionId: resource?.id,
      });
      break;
    }
    default:
      console.log(`Unhandled Flute event: ${eventType}`);
  }

  return { received: true };
}

module.exports = { processFluteWebhook };
