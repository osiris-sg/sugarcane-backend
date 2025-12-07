import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/device/config?deviceId=123
// Android app calls this to get device configuration (price, name)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');

    if (!deviceId) {
      return NextResponse.json(
        { error: 'deviceId is required' },
        { status: 400 }
      );
    }

    // Find device by deviceId
    const device = await prisma.device.findUnique({
      where: { deviceId: deviceId },
    });

    if (!device) {
      // Return default values if device not found
      return NextResponse.json({
        success: true,
        found: false,
        deviceId: deviceId,
        deviceName: "Unknown Device",
        price: 250, // Default $2.50
        message: "Device not registered, using defaults"
      });
    }

    return NextResponse.json({
      success: true,
      found: true,
      deviceId: device.deviceId,
      deviceName: device.deviceName,
      price: device.price,
      isActive: device.isActive,
    });
  } catch (error) {
    console.error('Error fetching device config:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
