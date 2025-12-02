import { saveOrder } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(request) {
  const order = await request.json();
  const saved = await saveOrder(order);

  console.log('[UploadOrder] Order received:', JSON.stringify(saved, null, 2));

  return NextResponse.json({ success: true, orderId: saved.id });
}
