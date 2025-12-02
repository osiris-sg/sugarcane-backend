import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(request) {
  const cashLog = await request.json();
  cashLog.receivedAt = new Date().toISOString();
  db.cashLogs.push(cashLog);

  console.log('[UploadCash] Cash log received:', JSON.stringify(cashLog, null, 2));

  return NextResponse.json({ success: true });
}
