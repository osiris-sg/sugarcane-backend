import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Simple admin key check
const checkAdminKey = (request) => {
  const adminKey = request.headers.get('x-admin-key') ||
                   new URL(request.url).searchParams.get('adminKey');
  const validKey = process.env.ADMIN_KEY || 'sugarcane123';
  return adminKey === validKey;
};

// GET /api/admin/devices - List all devices
export async function GET(request) {
  if (!checkAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const devices = await prisma.device.findMany({
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
  if (!checkAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { deviceId, deviceName, price, isActive } = body;

    if (!deviceId) {
      return NextResponse.json(
        { error: 'deviceId is required' },
        { status: 400 }
      );
    }

    // Upsert - create if not exists, update if exists
    const device = await prisma.device.upsert({
      where: { deviceId: deviceId },
      update: {
        ...(deviceName && { deviceName }),
        ...(price !== undefined && { price: parseInt(price) }),
        ...(isActive !== undefined && { isActive }),
      },
      create: {
        deviceId: deviceId,
        deviceName: deviceName || `Device ${deviceId}`,
        price: price ? parseInt(price) : 250, // Default $2.50
        isActive: isActive !== undefined ? isActive : true,
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

    await prisma.device.delete({
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
