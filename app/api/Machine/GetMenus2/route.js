import { getMenu } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { syncTime } = body;

  const menu = await getMenu();
  let menus = [menu];

  if (syncTime) {
    const syncTimestamp = new Date(syncTime).getTime();
    menus = menus.filter(m => m.timestamp > syncTimestamp);
  }

  console.log(`[GetMenus2] Price: $${(menu.price / 100).toFixed(2)}`);

  return NextResponse.json({ success: true, data: menus });
}
