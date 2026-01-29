'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function ApplePayPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  useEffect(() => {
    const intentId = searchParams.get('intent_id');
    const clientSecret = searchParams.get('client_secret');
    const currency = searchParams.get('currency') || 'SGD';
    const amount = searchParams.get('amount');

    if (!intentId || !clientSecret) {
      setError('Missing payment parameters');
      setStatus('error');
      return;
    }

    // Load Airwallex SDK
    const script = document.createElement('script');
    script.src = 'https://static.airwallex.com/components/sdk/v1/index.js';
    script.async = true;
    script.onload = async () => {
      try {
        setStatus('initializing');

        // Initialize Airwallex SDK
        const { payments } = await window.AirwallexComponentsSDK.init({
          env: 'prod', // Use 'demo' for testing
          enabledElements: ['payments'],
        });

        setStatus('redirecting');

        // Redirect to Airwallex checkout with Apple Pay only
        payments.redirectToCheckout({
          intent_id: intentId,
          client_secret: clientSecret,
          currency: currency,
          country_code: 'SG',
          methods: ['applepay'], // Only Apple Pay
          applePayRequestOptions: {
            countryCode: 'SG',
            buttonType: 'plain',
            buttonColor: 'black',
          },
          successUrl: `${window.location.origin}/pay/success?intent_id=${intentId}`,
          failUrl: `${window.location.origin}/pay/failed?intent_id=${intentId}`,
        });
      } catch (err) {
        console.error('Airwallex init error:', err);
        setError(err.message || 'Failed to initialize payment');
        setStatus('error');
      }
    };
    script.onerror = () => {
      setError('Failed to load payment SDK');
      setStatus('error');
    };
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, [searchParams]);

  return (
    <html>
      <head>
        <title>Apple Pay - Sugarcane Juice</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            color: white;
          }
          .container {
            text-align: center;
            padding: 40px;
          }
          .logo {
            font-size: 48px;
            margin-bottom: 20px;
          }
          .title {
            font-size: 24px;
            margin-bottom: 10px;
          }
          .status {
            font-size: 16px;
            opacity: 0.8;
          }
          .spinner {
            width: 40px;
            height: 40px;
            border: 3px solid rgba(255,255,255,0.3);
            border-top-color: white;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 20px auto;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          .error {
            color: #ff6b6b;
            background: rgba(255,107,107,0.1);
            padding: 15px 25px;
            border-radius: 8px;
            margin-top: 20px;
          }
        `}</style>
      </head>
      <body>
        <div className="container">
          <div className="logo"></div>
          <div className="title">Apple Pay</div>
          {status === 'loading' && (
            <>
              <div className="spinner"></div>
              <div className="status">Loading payment...</div>
            </>
          )}
          {status === 'initializing' && (
            <>
              <div className="spinner"></div>
              <div className="status">Initializing Apple Pay...</div>
            </>
          )}
          {status === 'redirecting' && (
            <>
              <div className="spinner"></div>
              <div className="status">Redirecting to Apple Pay...</div>
            </>
          )}
          {status === 'error' && (
            <div className="error">{error}</div>
          )}
        </div>
      </body>
    </html>
  );
}
