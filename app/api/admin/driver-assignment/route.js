import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/admin/driver-assignment - Get all drivers and their assigned devices
export async function GET() {
  try {
    // Get all users with DRIVER role (check both legacy role field AND roles table)
    const drivers = await db.user.findMany({
      where: {
        isActive: true,
        OR: [
          { role: 'DRIVER' },
          { roles: { some: { role: 'DRIVER' } } },
        ],
      },
      include: {
        assignedDevices: {
          include: {
            device: true,
          },
        },
        roles: true,
      },
      orderBy: { firstName: 'asc' },
    });

    // Get all devices
    const devices = await db.device.findMany({
      include: {
        drivers: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
      orderBy: { deviceName: 'asc' },
    });

    // Format drivers with their assigned devices from DeviceDriver table
    const formattedDrivers = drivers.map((driver) => ({
      ...driver,
      devices: driver.assignedDevices.map((dd) => dd.device),
      roles: driver.roles.map((r) => r.role),
    }));

    // Unassigned = devices with no entries in DeviceDriver table
    const unassignedDevices = devices.filter((d) => d.drivers.length === 0);

    return NextResponse.json({
      success: true,
      drivers: formattedDrivers,
      unassignedDevices,
      totalDrivers: drivers.length,
      totalDevices: devices.length,
    });
  } catch (error) {
    console.error('[DriverAssignment] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST /api/admin/driver-assignment - Assign/unassign device to driver
export async function POST(request) {
  try {
    const body = await request.json();
    const { deviceId, driverId, action } = body;

    if (!deviceId) {
      return NextResponse.json(
        { success: false, error: 'deviceId is required' },
        { status: 400 }
      );
    }

    // Handle unassign action
    if (action === 'unassign' && driverId) {
      await db.deviceDriver.deleteMany({
        where: { deviceId, userId: driverId },
      });
      return NextResponse.json({ success: true, action: 'unassigned' });
    }

    // Handle assign action (add driver to device)
    if (driverId) {
      // Use upsert to avoid duplicates
      const assignment = await db.deviceDriver.upsert({
        where: {
          deviceId_userId: { deviceId, userId: driverId },
        },
        create: { deviceId, userId: driverId },
        update: {},
      });
      return NextResponse.json({ success: true, assignment });
    }

    // If no driverId, remove all assignments for this device
    await db.deviceDriver.deleteMany({
      where: { deviceId },
    });

    return NextResponse.json({ success: true, action: 'cleared' });
  } catch (error) {
    console.error('[DriverAssignment] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
