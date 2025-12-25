import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/admin/driver-assignment - Get all drivers and their assigned devices
export async function GET() {
  try {
    // Get all users with role="DRIVER" from database
    const drivers = await db.user.findMany({
      where: { role: 'DRIVER', isActive: true },
      orderBy: { firstName: 'asc' },
    });

    // Get all devices with their driver assignments
    const devices = await db.device.findMany({
      orderBy: { deviceName: 'asc' },
    });

    // Group devices by driver
    const driverDevices = {};
    drivers.forEach((driver) => {
      driverDevices[driver.id] = {
        ...driver,
        devices: devices.filter((d) => d.driverId === driver.id || d.driverId === driver.clerkId),
      };
    });

    const unassignedDevices = devices.filter((d) => !d.driverId);

    return NextResponse.json({
      success: true,
      drivers: Object.values(driverDevices),
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

// POST /api/admin/driver-assignment - Assign device to driver
export async function POST(request) {
  try {
    const body = await request.json();
    const { deviceId, driverId } = body;

    if (!deviceId) {
      return NextResponse.json(
        { success: false, error: 'deviceId is required' },
        { status: 400 }
      );
    }

    // Update device with driver assignment (driverId can be null to unassign)
    const device = await db.device.update({
      where: { deviceId },
      data: { driverId: driverId || null },
    });

    return NextResponse.json({
      success: true,
      device,
    });
  } catch (error) {
    console.error('[DriverAssignment] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
