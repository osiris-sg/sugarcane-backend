import { NextResponse } from 'next/server';

// Airwallex credentials
const AIRWALLEX_CLIENT_ID = process.env.AIRWALLEX_CLIENT_ID || '3gyTOclyRNKCyF_VR2w1vw';
const AIRWALLEX_API_KEY = process.env.AIRWALLEX_API_KEY || '5d1e3464a2566158f727157d84a0f403de7eb0fe701bafd72dfc562d0661fb72c3b449e761123423ffde8ebc8218a28b';

// Use production API (change to api-demo.airwallex.com for sandbox)
const AIRWALLEX_BASE_URL = process.env.AIRWALLEX_BASE_URL || 'https://api.airwallex.com';

// Cache for access token
let accessToken = null;
let tokenExpiry = 0;

// Get access token from Airwallex
async function getAccessToken() {
  // Return cached token if still valid (with 5 min buffer)
  if (accessToken && Date.now() < tokenExpiry - 5 * 60 * 1000) {
    return accessToken;
  }

  console.log('[Airwallex] Getting new access token...');

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
    console.error('[Airwallex] Auth failed:', error);
    throw new Error(`Authentication failed: ${error}`);
  }

  const data = await response.json();
  accessToken = data.token;
  // Token is valid for 30 minutes
  tokenExpiry = Date.now() + 30 * 60 * 1000;

  console.log('[Airwallex] Got access token, expires at:', new Date(tokenExpiry).toISOString());
  return accessToken;
}

// Create a Payment Intent
async function createPaymentIntent(amount, currency, orderId, returnUrl) {
  const token = await getAccessToken();

  const payload = {
    amount: amount,
    currency: currency,
    merchant_order_id: orderId,
    request_id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    return_url: returnUrl,
    metadata: {
      order_id: orderId
    }
  };

  console.log('[Airwallex] Creating payment intent:', payload);

  const response = await fetch(`${AIRWALLEX_BASE_URL}/api/v1/pa/payment_intents/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[Airwallex] Create payment intent failed:', error);
    throw new Error(`Create payment intent failed: ${error}`);
  }

  return await response.json();
}

// Create a Payment Link (easier for QR code)
async function createPaymentLink(amount, currency, orderId, title) {
  const token = await getAccessToken();

  const payload = {
    amount: amount,
    currency: currency,
    title: title || 'Sugarcane Juice',
    reusable: false,
    merchant_order_id: orderId,
    request_id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    metadata: {
      order_id: orderId
    }
  };

  console.log('[Airwallex] Creating payment link:', payload);

  const response = await fetch(`${AIRWALLEX_BASE_URL}/api/v1/pa/payment_links/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[Airwallex] Create payment link failed:', error);
    throw new Error(`Create payment link failed: ${error}`);
  }

  return await response.json();
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      amount,           // Amount in dollars (e.g., 5.00)
      currency = 'SGD', // Default to SGD
      orderId,          // Order ID from the machine
      title,            // Payment title
      method = 'link'   // 'link' for payment link, 'intent' for payment intent
    } = body;

    console.log('[Airwallex Create Payment] Request:', { amount, currency, orderId, method });

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    const merchantOrderId = orderId || `order_${Date.now()}`;

    if (method === 'link') {
      // Create payment link (easier for QR code)
      const paymentLink = await createPaymentLink(amount, currency, merchantOrderId, title);

      console.log('[Airwallex Create Payment] Payment link created:', paymentLink.id);

      return NextResponse.json({
        success: true,
        data: {
          id: paymentLink.id,
          url: paymentLink.url,
          qrCodeData: paymentLink.url, // Use URL as QR code data
          amount: paymentLink.amount,
          currency: paymentLink.currency,
          status: paymentLink.status,
          expiresAt: paymentLink.expires_at
        }
      });

    } else {
      // Create payment intent
      const returnUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://sugarcane-backend-five.vercel.app'}/api/airwallex/return`;
      const paymentIntent = await createPaymentIntent(amount, currency, merchantOrderId, returnUrl);

      console.log('[Airwallex Create Payment] Payment intent created:', paymentIntent.id);

      return NextResponse.json({
        success: true,
        data: {
          id: paymentIntent.id,
          clientSecret: paymentIntent.client_secret,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: paymentIntent.status
        }
      });
    }

  } catch (error) {
    console.error('[Airwallex Create Payment] Error:', error);
    return NextResponse.json({
      error: error.message || 'Failed to create payment'
    }, { status: 500 });
  }
}
