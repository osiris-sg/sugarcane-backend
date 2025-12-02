import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

// GET /api/admin/menu - View all menus
export async function GET() {
  return NextResponse.json({ success: true, data: db.menus });
}

// PUT /api/admin/menu - Update menu by no (in body)
export async function PUT(request) {
  const { no, price, name, name2, isVisible } = await request.json();

  const menu = db.menus.find(m => m.no === (no || 1));
  if (!menu) {
    return NextResponse.json({ success: false, error: 'Menu not found' }, { status: 404 });
  }

  if (price !== undefined) menu.price = price;
  if (name !== undefined) menu.name = name;
  if (name2 !== undefined) menu.name2 = name2;
  if (isVisible !== undefined) menu.isVisible = isVisible;
  menu.timestamp = Date.now();

  console.log(`[Admin] Menu updated: $${(menu.price / 100).toFixed(2)}`);

  return NextResponse.json({ success: true, data: menu });
}
