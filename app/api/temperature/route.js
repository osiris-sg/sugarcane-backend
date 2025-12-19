import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';

// GET /api/temperature - Get latest temperature for all devices (from Device table)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');

    // If deviceId provided, get temp for specific device
    if (deviceId) {
      const device = await prisma.device.findUnique({
        where: { deviceId: String(deviceId) },
        select: {
          deviceId: true,
          deviceName: true,
          location: true,
          refrigerationTemp: true,
          machineTemp: true,
          tempUpdatedAt: true
        }
      });

      if (!device) {
        return NextResponse.json({
          success: false,
          error: 'Device not found'
        }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        data: device
      });
    }

    // Get temperature for all active devices
    const devices = await prisma.device.findMany({
      where: { isActive: true },
      select: {
        deviceId: true,
        deviceName: true,
        location: true,
        refrigerationTemp: true,
        machineTemp: true,
        tempUpdatedAt: true
      },
      orderBy: { deviceName: 'asc' }
    });

    return NextResponse.json({
      success: true,
      data: devices,
      count: devices.length
    });

  } catch (error) {
    console.error('Get temperature error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST /api/temperature - Update temperature from device (called on D002)
export async function POST(request) {
  try {
    const body = await request.json();
    const { deviceId, deviceName, refrigerationTemp, machineTemp } = body;

    if (!deviceId) {
      return NextResponse.json(
        { success: false, error: 'deviceId is required' },
        { status: 400 }
      );
    }

    // Update device temperature
    const device = await prisma.device.update({
      where: { deviceId: String(deviceId) },
      data: {
        refrigerationTemp: refrigerationTemp ?? null,
        machineTemp: machineTemp ?? null,
        tempUpdatedAt: new Date()
      },
      select: {
        deviceId: true,
        deviceName: true,
        location: true,
        refrigerationTemp: true,
        machineTemp: true,
        tempUpdatedAt: true
      }
    });

    return NextResponse.json({
      success: true,
      data: device
    });

  } catch (error) {
    // If device doesn't exist, just log and return success (don't fail)
    if (error.code === 'P2025') {
      console.log(`Device ${request.body?.deviceId} not found in database, skipping temp update`);
      return NextResponse.json({
        success: true,
        message: 'Device not registered, temperature not stored'
      });
    }

    console.error('Report temperature error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
