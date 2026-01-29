'use client';

import { useSearchParams } from 'next/navigation';

export default function SuccessPage() {
  const searchParams = useSearchParams();
  const intentId = searchParams.get('intent_id');

  return (
    <html>
      <head>
        <title>Payment Successful - Sugarcane Juice</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #134e5e 0%, #71b280 100%);
            color: white;
          }
          .container {
            text-align: center;
            padding: 40px;
          }
          .icon {
            font-size: 80px;
            margin-bottom: 20px;
          }
          .title {
            font-size: 28px;
            font-weight: bold;
            margin-bottom: 15px;
          }
          .message {
            font-size: 18px;
            opacity: 0.9;
            margin-bottom: 30px;
          }
          .note {
            font-size: 14px;
            opacity: 0.7;
            max-width: 300px;
            margin: 0 auto;
          }
        `}</style>
      </head>
      <body>
        <div className="container">
          <div className="icon">✅</div>
          <div className="title">Payment Successful!</div>
          <div className="message">Thank you for your purchase</div>
          <div className="note">
            Your fresh sugarcane juice is being prepared.
            Please collect your drink from the machine.
          </div>
        </div>
      </body>
    </html>
  );
}
