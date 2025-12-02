import { updateMenu, getAllMenus } from '@/lib/db';
import { NextResponse } from 'next/server';

// POST /api/admin/menu/update
// Body: { "machineId": "MACHINE001", "price": 500 }
// If no machineId, updates the global/default price
export async function POST(request) {
  const body = await request.json();
  const { machineId, ...updates } = body;

  const updated = await updateMenu(updates, machineId);

  console.log(`[Admin] Menu updated for ${machineId || 'global'}: $${(updated.price / 100).toFixed(2)}`);

  return NextResponse.json({ success: true, data: updated });
}

// GET /api/admin/menu/update - List all device prices
export async function GET() {
  const menus = await getAllMenus();
  return NextResponse.json({ success: true, data: menus });
}
