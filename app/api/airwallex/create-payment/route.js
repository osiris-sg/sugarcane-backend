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

// Map scheme to Airwallex payment method types
function getPaymentMethodTypes(scheme) {
  const schemeMap = {
    'APPLEPAY': ['applepay'],
    'GOOGLEPAY': ['googlepay'],
    'SAMSUNGPAY': ['card'], // Samsung Pay uses card tokenization
    'CARD': ['card'],
    'PAYNOW': ['paynow'],
    'ALIPAY': ['alipaycn', 'alipayhk'],
    'WECHATPAY': ['wechatpay'],
    'GRABPAY': ['grabpay_sg']
  };
  return schemeMap[scheme?.toUpperCase()] || null;
}

// Create a Payment Link (easier for QR code)
async function createPaymentLink(amount, currency, orderId, title, scheme) {
  const token = await getAccessToken();

  const payload = {
    amount: amount,
    currency: currency,
    title: title || 'Sugarcane Juice',
    reusable: false,
    merchant_order_id: orderId,
    request_id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    metadata: {
      order_id: orderId,
      scheme: scheme || 'ALL'
    }
  };

  // Add payment method restriction if scheme is specified
  const paymentMethods = getPaymentMethodTypes(scheme);
  if (paymentMethods) {
    payload.payment_method_types = paymentMethods;
    console.log('[Airwallex] Restricting to payment methods:', paymentMethods);
  }

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

// Get the custom payment page path based on scheme
function getPaymentPagePath(scheme) {
  const schemeMap = {
    'APPLEPAY': '/pay/applepay',
    'GOOGLEPAY': '/pay/googlepay',
    'SAMSUNGPAY': '/pay/card',
    'CARD': '/pay/card'
  };
  return schemeMap[scheme?.toUpperCase()] || '/pay/card';
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      amount,           // Amount in dollars (e.g., 5.00)
      currency = 'SGD', // Default to SGD
      orderId,          // Order ID from the machine
      title,            // Payment title
      scheme,           // Payment scheme: APPLEPAY, GOOGLEPAY, SAMSUNGPAY, etc.
      method = 'link'   // 'link' for payment link, 'intent' for payment intent
    } = body;

    console.log('[Airwallex Create Payment] Request:', { amount, currency, orderId, method, scheme });

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    const merchantOrderId = orderId || `order_${Date.now()}`;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://sugarcane-backend-five.vercel.app';

    // If scheme is specified (APPLEPAY, GOOGLEPAY, SAMSUNGPAY), use custom hosted page
    if (scheme && ['APPLEPAY', 'GOOGLEPAY', 'SAMSUNGPAY', 'CARD'].includes(scheme.toUpperCase())) {
      // Create payment intent for custom hosted page
      const returnUrl = `${baseUrl}/pay/success`;
      const paymentIntent = await createPaymentIntent(amount, currency, merchantOrderId, returnUrl);

      console.log('[Airwallex Create Payment] Payment intent created for custom page:', paymentIntent.id);

      // Build URL to our custom payment page
      const pagePath = getPaymentPagePath(scheme);
      const customUrl = `${baseUrl}${pagePath}?intent_id=${paymentIntent.id}&client_secret=${encodeURIComponent(paymentIntent.client_secret)}&currency=${currency}&amount=${amount}`;

      console.log('[Airwallex Create Payment] Custom page URL:', customUrl);

      return NextResponse.json({
        success: true,
        data: {
          id: paymentIntent.id,
          url: customUrl,
          qrCodeData: customUrl, // Use custom page URL for QR code
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: paymentIntent.status
        }
      });
    }

    if (method === 'link') {
      // Create payment link (for non-scheme payments)
      const paymentLink = await createPaymentLink(amount, currency, merchantOrderId, title, scheme);

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
      const returnUrl = `${baseUrl}/api/airwallex/return`;
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
