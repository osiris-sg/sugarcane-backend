import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

// POST /api/Machine/ReportDeviceInfo
// Called by Android app on startup to report device info
// App sends Build.SERIAL as "deviceId" in JSON
// Backend finds Device row where terminalId = Build.SERIAL
// Returns deviceId from that row (the ID the machine should use)
export async function POST(request) {
  try {
    const body = await request.json();
    const { deviceId, deviceType, secret, timestamp } = body;

    // deviceId from app is actually Build.SERIAL (hardware ID)
    const hardwareId = deviceId;

    // Validate required fields
    if (!hardwareId) {
      return NextResponse.json(
        { success: false, error: 'deviceId (hardware ID) is required' },
        { status: 400 }
      );
    }

    console.log(`[ReportDeviceInfo] Hardware ${hardwareId} reported: type=${deviceType}, secret=${secret ? '***' : 'none'}, timestamp=${timestamp}`);

    // Find device where terminalId matches the hardware ID (Build.SERIAL)
    const device = await db.device.findFirst({
      where: { terminalId: String(hardwareId) },
    });

    if (!device) {
      console.log(`[ReportDeviceInfo] No device found with terminalId=${hardwareId}`);
      return NextResponse.json({
        success: true,
        message: 'Device not registered',
        device: null,
      });
    }

    console.log(`[ReportDeviceInfo] Found device: terminalId=${device.terminalId}, deviceId=${device.deviceId}`);

    // Return deviceId - this is what the machine will use as its terminal ID
    return NextResponse.json({
      success: true,
      message: 'Device found',
      device: {
        deviceId: device.deviceId,  // This is the ID the machine should use
        deviceName: device.deviceName,
        isActive: device.isActive,
        terminalId: device.terminalId,  // For reference (same as hardwareId)
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
