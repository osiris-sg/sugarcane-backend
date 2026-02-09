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
        select: { id: true, clerkId: true, role: true, roles: { select: { role: true } } },
      });

      // Check if user has DRIVER role (legacy field OR roles table)
      const hasDriverRole = dbUser?.role === 'DRIVER' || dbUser?.roles?.some(r => r.role === 'DRIVER');
      // Check if user also has admin/manager role (they see all devices)
      const hasAdminRole = ['ADMIN', 'MANAGER', 'OPS_MANAGER'].includes(dbUser?.role) ||
        dbUser?.roles?.some(r => ['ADMIN', 'MANAGER', 'OPS_MANAGER'].includes(r.role));

      // Only filter if user is ONLY a driver (not also an admin/manager)
      if (hasDriverRole && !hasAdminRole) {
        // Get devices assigned to this driver (from DeviceDriver table)
        const deviceDrivers = await db.deviceDriver.findMany({
          where: { userId: dbUser.id },
          select: { deviceId: true },
        });

        let assignedDeviceIds = deviceDrivers.map(d => d.deviceId);

        // Fallback: also check legacy driverId field
        if (assignedDeviceIds.length === 0) {
          const legacyDevices = await db.device.findMany({
            where: {
              OR: [
                { driverId: dbUser.id },
                { driverId: dbUser.clerkId },
              ],
            },
            select: { deviceId: true },
          });
          assignedDeviceIds = legacyDevices.map(d => d.deviceId);
        }

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
