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

  const response = await fetch(`${AIRWALLEX_BASE_URL}/api/v1/authentication/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-client-id': AIRWALLEX_CLIENT_ID,
      'x-api-key': AIRWALLEX_API_KEY
    }
  });

  if (!response.ok) {
    throw new Error('Authentication failed');
  }

  const data = await response.json();
  accessToken = data.token;
  tokenExpiry = Date.now() + 30 * 60 * 1000;
  return accessToken;
}

// Check payment link status
async function checkPaymentLinkStatus(linkId) {
  const token = await getAccessToken();

  const response = await fetch(`${AIRWALLEX_BASE_URL}/api/v1/pa/payment_links/${linkId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get payment link: ${error}`);
  }

  return await response.json();
}

// Check payment intent status
async function checkPaymentIntentStatus(intentId) {
  const token = await getAccessToken();

  const response = await fetch(`${AIRWALLEX_BASE_URL}/api/v1/pa/payment_intents/${intentId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get payment intent: ${error}`);
  }

  return await response.json();
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const type = searchParams.get('type') || 'link'; // 'link' or 'intent'

    if (!id) {
      return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
    }

    console.log('[Airwallex Check Status] Checking:', type, id);

    let result;
    if (type === 'link') {
      result = await checkPaymentLinkStatus(id);
    } else {
      result = await checkPaymentIntentStatus(id);
    }

    // Determine if payment is complete
    // Payment link statuses: ACTIVE, INACTIVE, PAID, EXPIRED
    // Payment intent statuses: REQUIRES_PAYMENT_METHOD, REQUIRES_CUSTOMER_ACTION, REQUIRES_CAPTURE, SUCCEEDED, CANCELLED
    const isComplete = result.status === 'PAID' || result.status === 'SUCCEEDED';
    const isFailed = result.status === 'CANCELLED' || result.status === 'EXPIRED';

    console.log('[Airwallex Check Status] Status:', result.status, 'Complete:', isComplete);

    return NextResponse.json({
      success: true,
      data: {
        id: result.id,
        status: result.status,
        isComplete: isComplete,
        isFailed: isFailed,
        amount: result.amount,
        currency: result.currency,
        paidAt: result.paid_at || null
      }
    });

  } catch (error) {
    console.error('[Airwallex Check Status] Error:', error);
    return NextResponse.json({
      error: error.message || 'Failed to check status'
    }, { status: 500 });
  }
}

export async function POST(request) {
  // Also support POST for convenience
  const body = await request.json();
  const url = new URL(request.url);
  url.searchParams.set('id', body.id);
  url.searchParams.set('type', body.type || 'link');

  return GET(new Request(url, { headers: request.headers }));
}
