import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

// POST /api/Machine/ReportDeviceInfo
// Called by Android app on startup to report device info
export async function POST(request) {
  try {
    const body = await request.json();
    const { deviceId, deviceType, secret, timestamp } = body;

    // Validate required fields
    if (!deviceId) {
      return NextResponse.json(
        { success: false, error: 'deviceId is required' },
        { status: 400 }
      );
    }

    console.log(`[ReportDeviceInfo] Device ${deviceId} reported: type=${deviceType}, secret=${secret ? '***' : 'none'}, timestamp=${timestamp}`);

    // Upsert device - create if not exists, update timestamp if exists
    const device = await db.device.upsert({
      where: { deviceId: String(deviceId) },
      update: {
        // Just touch the record to update updatedAt
        updatedAt: new Date(),
      },
      create: {
        deviceId: String(deviceId),
        deviceName: `Device ${deviceId}`,
        price: 500, // Default $5.00
        isActive: false, // Will be activated when temp is reported
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Device info recorded',
      device: {
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        isActive: device.isActive,
        updatedAt: device.updatedAt,
      },
    });
  } catch (error) {
    console.error('[ReportDeviceInfo] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
