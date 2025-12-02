import { getMenu, updateMenu } from '@/lib/db';
import { NextResponse } from 'next/server';

// GET /api/admin/menu - View menu
export async function GET() {
  const menu = await getMenu();
  return NextResponse.json({ success: true, data: [menu] });
}

// PUT /api/admin/menu - Update menu (price, name, etc.)
export async function PUT(request) {
  const updates = await request.json();
  const updated = await updateMenu(updates);

  console.log(`[Admin] Menu updated: $${(updated.price / 100).toFixed(2)}`);

  return NextResponse.json({ success: true, data: updated });
}
