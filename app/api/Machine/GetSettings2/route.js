import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST() {
  console.log('[GetSettings2] Returning settings');
  return NextResponse.json({ success: true, data: db.settings });
}
