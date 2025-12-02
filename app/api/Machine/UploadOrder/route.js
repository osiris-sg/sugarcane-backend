import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(request) {
  const order = await request.json();
  order.id = Date.now();
  order.receivedAt = new Date().toISOString();
  db.orders.push(order);

  console.log('[UploadOrder] Order received:', JSON.stringify(order, null, 2));

  return NextResponse.json({ success: true, orderId: order.id });
}
