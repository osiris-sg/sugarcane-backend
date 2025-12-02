import { getSettings } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST() {
  const settings = await getSettings();
  console.log('[GetSettings2] Returning settings');
  return NextResponse.json({ success: true, data: settings });
}
