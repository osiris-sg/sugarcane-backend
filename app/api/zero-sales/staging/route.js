import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';

// GET /api/zero-sales/staging - Get all staging entries
export async function GET() {
  try {
    let whereClause = {};

    // Filter devices based on user role
    const { userId } = await auth();
    if (userId) {
      const dbUser = await db.user.findUnique({
        where: { clerkId: userId },
        select: {
          id: true,
          clerkId: true,
          role: true,
          roles: { select: { role: true } },
          managedDrivers: { select: { driver: { select: { id: true } } } },
        },
      });

      // Check roles
      const hasAdminRole = ['ADMIN', 'MANAGER'].includes(dbUser?.role) ||
        dbUser?.roles?.some(r => ['ADMIN', 'MANAGER'].includes(r.role));
      const hasOpsManagerRole = dbUser?.role === 'OPS_MANAGER' ||
        dbUser?.roles?.some(r => r.role === 'OPS_MANAGER');
      const hasDriverRole = dbUser?.role === 'DRIVER' ||
        dbUser?.roles?.some(r => r.role === 'DRIVER');

      // ADMIN/MANAGER: see all (no filter)
      // OPS_MANAGER: see their devices + devices of drivers they manage
      // DRIVER: see only their assigned devices
      if (!hasAdminRole && (hasOpsManagerRole || hasDriverRole)) {
        let userIdsToCheck = [dbUser.id];

        // If ops manager, also include managed drivers
        if (hasOpsManagerRole) {
          const managedDriverIds = dbUser.managedDrivers?.map(md => md.driver.id) || [];
          userIdsToCheck = [...userIdsToCheck, ...managedDriverIds];
        }

        // Get devices assigned to these users (from DeviceDriver table)
        const deviceDrivers = await db.deviceDriver.findMany({
          where: { userId: { in: userIdsToCheck } },
          select: { deviceId: true },
        });

        let assignedDeviceIds = [...new Set(deviceDrivers.map(d => d.deviceId))];

        // Fallback: also check legacy driverId field
        if (assignedDeviceIds.length === 0) {
          const legacyDevices = await db.device.findMany({
            where: {
              OR: [
                { driverId: { in: userIdsToCheck } },
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
          // No assigned devices, return empty
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
