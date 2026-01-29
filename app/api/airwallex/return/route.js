import { NextResponse } from 'next/server';

// This endpoint handles the return URL after payment completion
// The user is redirected here from Airwallex's hosted payment page

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  // Airwallex may include these parameters
  const paymentIntentId = searchParams.get('payment_intent_id');
  const status = searchParams.get('status');

  console.log('[Airwallex Return] Payment Intent:', paymentIntentId, 'Status:', status);

  // Return a simple HTML page that shows payment status
  // In a real app, you might redirect to a mobile deep link or close the browser
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Payment ${status === 'succeeded' ? 'Successful' : 'Status'}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          margin: 0;
          background: linear-gradient(135deg, #4A7A23 0%, #2d4a15 100%);
          color: white;
        }
        .container {
          text-align: center;
          padding: 40px;
          background: rgba(255,255,255,0.1);
          border-radius: 20px;
          backdrop-filter: blur(10px);
        }
        .icon {
          font-size: 80px;
          margin-bottom: 20px;
        }
        h1 {
          margin: 0 0 10px 0;
          font-size: 28px;
        }
        p {
          margin: 0;
          opacity: 0.9;
          font-size: 16px;
        }
        .success { color: #90EE90; }
        .pending { color: #FFD700; }
        .failed { color: #FF6B6B; }
      </style>
    </head>
    <body>
      <div class="container">
        ${status === 'succeeded' ? `
          <div class="icon success">✓</div>
          <h1>Payment Successful!</h1>
          <p>Thank you for your purchase.<br>Please collect your drink from the machine.</p>
        ` : status === 'failed' || status === 'cancelled' ? `
          <div class="icon failed">✗</div>
          <h1>Payment ${status === 'cancelled' ? 'Cancelled' : 'Failed'}</h1>
          <p>Please try again at the machine.</p>
        ` : `
          <div class="icon pending">⏳</div>
          <h1>Processing Payment</h1>
          <p>Please wait while we confirm your payment...</p>
        `}
      </div>
      <script>
        // Auto-close after 5 seconds if opened in a popup
        setTimeout(() => {
          if (window.opener) {
            window.close();
          }
        }, 5000);
      </script>
    </body>
    </html>
  `;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
    },
  });
}
