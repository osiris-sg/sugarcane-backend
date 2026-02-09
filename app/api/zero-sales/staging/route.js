import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/zero-sales/staging - Get all staging entries
export async function GET() {
  try {
    const entries = await db.zeroSalesStaging.findMany({
      orderBy: { startedAt: 'asc' },
    });

    return NextResponse.json({
      success: true,
      entries,
      count: entries.length,
    });
  } catch (error) {
    console.error('[ZeroSalesStaging] Error fetching entries:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
