import { NextResponse } from 'next/server';

// Airwallex credentials
const AIRWALLEX_CLIENT_ID = process.env.AIRWALLEX_CLIENT_ID || '3gyTOclyRNKCyF_VR2w1vw';
const AIRWALLEX_API_KEY = process.env.AIRWALLEX_API_KEY || '5d1e3464a2566158f727157d84a0f403de7eb0fe701bafd72dfc562d0661fb72c3b449e761123423ffde8ebc8218a28b';
const AIRWALLEX_BASE_URL = process.env.AIRWALLEX_BASE_URL || 'https://api.airwallex.com';

// Cache for access token
let accessToken = null;
let tokenExpiry = 0;

// Get access token from Airwallex
async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpiry - 5 * 60 * 1000) {
    return accessToken;
  }

  console.log('[Airwallex Refund] Getting new access token...');

  const response = await fetch(`${AIRWALLEX_BASE_URL}/api/v1/authentication/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-client-id': AIRWALLEX_CLIENT_ID,
      'x-api-key': AIRWALLEX_API_KEY
    }
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[Airwallex Refund] Auth failed:', error);
    throw new Error(`Authentication failed: ${error}`);
  }

  const data = await response.json();
  accessToken = data.token;
  tokenExpiry = Date.now() + 30 * 60 * 1000;

  console.log('[Airwallex Refund] Got access token');
  return accessToken;
}

// Create a refund for a payment intent
async function createRefund(paymentIntentId, amount, reason) {
  const token = await getAccessToken();

  const payload = {
    payment_intent_id: paymentIntentId,
    request_id: `refund_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    reason: reason || 'REQUESTED_BY_CUSTOMER',
    metadata: {
      refund_reason: reason || 'Make failed - auto refund'
    }
  };

  // If amount is specified, do a partial refund
  if (amount && amount > 0) {
    payload.amount = amount;
  }
  // If no amount specified, full refund is performed

  console.log('[Airwallex Refund] Creating refund:', payload);

  const response = await fetch(`${AIRWALLEX_BASE_URL}/api/v1/pa/refunds/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[Airwallex Refund] Create refund failed:', error);
    throw new Error(`Create refund failed: ${error}`);
  }

  return await response.json();
}

// Get refund status
async function getRefundStatus(refundId) {
  const token = await getAccessToken();

  const response = await fetch(`${AIRWALLEX_BASE_URL}/api/v1/pa/refunds/${refundId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get refund status: ${error}`);
  }

  return await response.json();
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      paymentIntentId,  // The payment intent ID to refund
      amount,           // Optional: partial refund amount (in dollars)
      reason            // Optional: refund reason
    } = body;

    console.log('[Airwallex Refund] Request:', { paymentIntentId, amount, reason });

    if (!paymentIntentId) {
      return NextResponse.json({ error: 'Missing paymentIntentId' }, { status: 400 });
    }

    // Create the refund
    const refund = await createRefund(paymentIntentId, amount, reason);

    console.log('[Airwallex Refund] Refund created:', refund.id, 'Status:', refund.status);

    return NextResponse.json({
      success: true,
      data: {
        id: refund.id,
        status: refund.status,
        amount: refund.amount,
        currency: refund.currency,
        paymentIntentId: refund.payment_intent_id,
        createdAt: refund.created_at
      }
    });

  } catch (error) {
    console.error('[Airwallex Refund] Error:', error);
    return NextResponse.json({
      error: error.message || 'Failed to create refund'
    }, { status: 500 });
  }
}

// GET endpoint to check refund status
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const refundId = searchParams.get('id');

    if (!refundId) {
      return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
    }

    console.log('[Airwallex Refund] Checking refund status:', refundId);

    const refund = await getRefundStatus(refundId);

    return NextResponse.json({
      success: true,
      data: {
        id: refund.id,
        status: refund.status,
        amount: refund.amount,
        currency: refund.currency,
        paymentIntentId: refund.payment_intent_id
      }
    });

  } catch (error) {
    console.error('[Airwallex Refund] Error:', error);
    return NextResponse.json({
      error: error.message || 'Failed to get refund status'
    }, { status: 500 });
  }
}
