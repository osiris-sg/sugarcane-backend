import { updateMenu } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(request) {
  const updates = await request.json();
  const updated = await updateMenu(updates);

  console.log(`[Admin] Menu updated: $${(updated.price / 100).toFixed(2)}`);

  return NextResponse.json({ success: true, data: updated });
}
