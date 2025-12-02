import { getOrders } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  const orders = await getOrders();
  return NextResponse.json({ success: true, data: orders });
}
