import { NextResponse } from 'next/server';

export async function POST(request) {
  const { amount, orderId } = await request.json();
  console.log(`[GetPaymentQr] Amount: ${amount}, OrderId: ${orderId}`);

  // TODO: Integrate with your payment provider (Stripe, Square, etc.)
  return NextResponse.json({
    success: true,
    data: {
      qrUrl: `https://your-payment-provider.com/pay?amount=${amount}&order=${orderId}`,
      orderId: orderId
    }
  });
}
