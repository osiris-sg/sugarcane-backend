import { getOrders } from '@/lib/db';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const orders = await getOrders();
  return NextResponse.json({ success: true, data: orders });
}
