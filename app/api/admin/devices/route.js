import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Simple admin key check
const checkAdminKey = (request) => {
  const adminKey = request.headers.get('x-admin-key') ||
                   new URL(request.url).searchParams.get('adminKey');
  const validKey = process.env.ADMIN_KEY || 'sugarcane123';
  return adminKey === validKey;
};

// GET /api/admin/devices - List all devices
// No auth required for GET (dashboard uses Clerk auth at page level)
export async function GET(request) {
  try {
    const devices = await db.device.findMany({
      include: {
        group: true,  // Include group relation
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      devices: devices,
      count: devices.length,
    });
  } catch (error) {
    console.error('Error fetching devices:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/admin/devices - Create or update a device
export async function POST(request) {
  try {
    const body = await request.json();
    const { deviceId, deviceName, location, price, isActive, groupId } = body;

    if (!deviceId) {
      return NextResponse.json(
        { error: 'deviceId is required' },
        { status: 400 }
      );
    }

    // Check if device exists and if location is changing
    const existingDevice = await db.device.findUnique({
      where: { deviceId },
    });

    const now = new Date();
    const locationChanged = existingDevice &&
      location !== undefined &&
      existingDevice.location !== location;

    // If location is changing, update location history
    if (locationChanged && existingDevice.location) {
      // End the previous location record
      const previousRecord = await db.locationHistory.findFirst({
        where: { deviceId, endedAt: null },
        orderBy: { startedAt: 'desc' },
      });

      if (previousRecord) {
        const durationMs = now.getTime() - new Date(previousRecord.startedAt).getTime();
        await db.locationHistory.update({
          where: { id: previousRecord.id },
          data: { endedAt: now, durationMs },
        });
      }
    }

    // Create new location history record if location is set/changed
    if (location && (!existingDevice || locationChanged)) {
      await db.locationHistory.create({
        data: {
          deviceId,
          location,
          startedAt: now,
        },
      });
    }

    // Upsert - create if not exists, update if exists
    const device = await db.device.upsert({
      where: { deviceId: deviceId },
      update: {
        ...(deviceName !== undefined && { deviceName }),
        ...(location !== undefined && { location }),
        ...(price !== undefined && { price: parseInt(price) }),
        ...(isActive !== undefined && { isActive }),
        ...(groupId !== undefined && { groupId: groupId || null }),
      },
      create: {
        deviceId: deviceId,
        deviceName: deviceName || `Device ${deviceId}`,
        location: location || null,
        price: price ? parseInt(price) : 250, // Default $2.50
        isActive: isActive !== undefined ? isActive : true,
        groupId: groupId || null,
      },
      include: {
        group: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Device saved successfully',
      device: device,
    });
  } catch (error) {
    console.error('Error saving device:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/admin/devices - Delete a device
export async function DELETE(request) {
  if (!checkAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');

    if (!deviceId) {
      return NextResponse.json(
        { error: 'deviceId is required' },
        { status: 400 }
      );
    }

    await db.device.delete({
      where: { deviceId: deviceId },
    });

    return NextResponse.json({
      success: true,
      message: `Device ${deviceId} deleted`,
    });
  } catch (error) {
    console.error('Error deleting device:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
