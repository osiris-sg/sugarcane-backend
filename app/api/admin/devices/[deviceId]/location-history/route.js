import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GET /api/admin/devices/[deviceId]/location-history
export async function GET(request, { params }) {
  try {
    const { deviceId } = await params;

    const history = await db.locationHistory.findMany({
      where: { deviceId },
      orderBy: { startedAt: 'desc' },
    });

    return NextResponse.json({ success: true, history });
  } catch (error) {
    console.error('Error fetching location history:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
