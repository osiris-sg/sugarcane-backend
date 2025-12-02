import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { syncTime } = body;

  let menus = db.menus;

  if (syncTime) {
    const syncTimestamp = new Date(syncTime).getTime();
    menus = menus.filter(m => m.timestamp > syncTimestamp);
  }

  console.log(`[GetMenus2] Returning ${menus.length} menu(s), price: $${(db.menus[0].price / 100).toFixed(2)}`);

  return NextResponse.json({ success: true, data: menus });
}
