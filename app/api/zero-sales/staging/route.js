import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';

// GET /api/zero-sales/staging - Get all staging entries
export async function GET() {
  try {
    let whereClause = {};

    // Check if user is a driver - filter to only their assigned devices
    const { userId } = await auth();
    if (userId) {
      const dbUser = await db.user.findUnique({
        where: { clerkId: userId },
        select: { id: true, clerkId: true, role: true },
      });

      if (dbUser?.role === 'DRIVER') {
        // Get devices assigned to this driver
        const assignedDevices = await db.device.findMany({
          where: {
            OR: [
              { driverId: dbUser.id },
              { driverId: dbUser.clerkId },
            ],
          },
          select: { deviceId: true },
        });

        const assignedDeviceIds = assignedDevices.map(d => d.deviceId);

        if (assignedDeviceIds.length > 0) {
          whereClause = { deviceId: { in: assignedDeviceIds } };
        } else {
          // Driver has no assigned devices, return empty
          return NextResponse.json({
            success: true,
            entries: [],
            count: 0,
          });
        }
      }
    }

    const entries = await db.zeroSalesStaging.findMany({
      where: whereClause,
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
