import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Force dynamic rendering - no caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/drivers - Get all active drivers with their login PINs
// Used by vending machines to validate driver login
export async function GET() {
  try {
    const drivers = await db.user.findMany({
      where: {
        role: 'DRIVER',
        isActive: true,
        loginPin: { not: null }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        loginPin: true,
      },
      orderBy: { firstName: 'asc' }
    });

    // Format response with full name
    const formattedDrivers = drivers.map(d => ({
      id: d.id,
      name: [d.firstName, d.lastName].filter(Boolean).join(' ') || 'Unknown',
      pin: d.loginPin
    }));

    return NextResponse.json({
      success: true,
      drivers: formattedDrivers,
      count: formattedDrivers.length
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      }
    });

  } catch (error) {
    console.error('[Drivers] Error fetching drivers:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
