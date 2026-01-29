import { NextResponse } from 'next/server';
import crypto from 'crypto';

// Store for completed payments (in production, use a database)
// Key: payment_intent_id, Value: { status, amount, timestamp }
const completedPayments = new Map();

// Webhook secret - set this in Airwallex dashboard
const WEBHOOK_SECRET = process.env.AIRWALLEX_WEBHOOK_SECRET || '';

// Verify webhook signature
function verifySignature(payload, signature, timestamp) {
  if (!WEBHOOK_SECRET) {
    console.warn('[Airwallex Webhook] No webhook secret configured - skipping verification');
    return true;
  }

  const signedPayload = `${timestamp}.${payload}`;
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(signedPayload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export async function POST(request) {
  try {
    const payload = await request.text();
    const signature = request.headers.get('x-signature') || '';
    const timestamp = request.headers.get('x-timestamp') || '';

    console.log('[Airwallex Webhook] Received webhook');

    // Verify signature (optional but recommended)
    if (WEBHOOK_SECRET && !verifySignature(payload, signature, timestamp)) {
      console.error('[Airwallex Webhook] Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(payload);
    console.log('[Airwallex Webhook] Event:', event.name, 'ID:', event.data?.id);

    // Handle different event types
    switch (event.name) {
      case 'payment_intent.succeeded':
        console.log('[Airwallex Webhook] Payment succeeded:', event.data.id);
        completedPayments.set(event.data.id, {
          status: 'succeeded',
          amount: event.data.amount,
          currency: event.data.currency,
          timestamp: Date.now()
        });
        break;

      case 'payment_intent.payment_failed':
        console.log('[Airwallex Webhook] Payment failed:', event.data.id);
        completedPayments.set(event.data.id, {
          status: 'failed',
          amount: event.data.amount,
          currency: event.data.currency,
          timestamp: Date.now()
        });
        break;

      case 'payment_intent.cancelled':
        console.log('[Airwallex Webhook] Payment cancelled:', event.data.id);
        completedPayments.set(event.data.id, {
          status: 'cancelled',
          timestamp: Date.now()
        });
        break;

      default:
        console.log('[Airwallex Webhook] Unhandled event type:', event.name);
    }

    // Clean up old entries (older than 1 hour)
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    for (const [key, value] of completedPayments.entries()) {
      if (value.timestamp < oneHourAgo) {
        completedPayments.delete(key);
      }
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('[Airwallex Webhook] Error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

// Note: completedPayments is stored in-memory for this serverless function instance
// In production, use a database or Redis for persistent storage across instances
