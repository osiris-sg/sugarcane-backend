import { NextResponse } from 'next/server';

export async function POST(request) {
  const { orderId } = await request.json();
  console.log(`[ClosePayment] OrderId: ${orderId}`);

  return NextResponse.json({ success: true });
}
