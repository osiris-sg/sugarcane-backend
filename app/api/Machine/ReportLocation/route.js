import { db, swapDeviceId } from '@/lib/db';
import { NextResponse } from 'next/server';

// POST /api/Machine/ReportLocation
// Called by Android app 1 minute after startup to report GPS location
export async function POST(request) {
  try {
    const body = await request.json();
    const { deviceId: rawDeviceId, deviceName, latitude, longitude } = body;

    // Validate required fields
    if (!rawDeviceId) {
      return NextResponse.json(
        { success: false, error: 'deviceId is required' },
        { status: 400 }
      );
    }

    // Swap device ID if needed (for mismatched devices 852346/852356)
    const deviceId = swapDeviceId(rawDeviceId);

    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { success: false, error: 'latitude and longitude are required' },
        { status: 400 }
      );
    }

    // Parse coordinates
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { success: false, error: 'Invalid latitude or longitude values' },
        { status: 400 }
      );
    }

    console.log(`[ReportLocation] Device ${deviceId} (${deviceName}): lat=${lat}, lng=${lng}`);

    // Update Device table with GPS coordinates
    // Use upsert to create device if it doesn't exist
    const device = await db.device.upsert({
      where: { deviceId: String(deviceId) },
      update: {
        latitude: lat,
        longitude: lng,
        gpsUpdatedAt: new Date(),
        ...(deviceName && { deviceName }),
      },
      create: {
        deviceId: String(deviceId),
        deviceName: deviceName || `Device ${deviceId}`,
        latitude: lat,
        longitude: lng,
        gpsUpdatedAt: new Date(),
        price: 250, // Default $2.50
        isActive: false,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Location reported successfully',
      device: {
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        latitude: device.latitude,
        longitude: device.longitude,
        gpsUpdatedAt: device.gpsUpdatedAt,
      },
    });
  } catch (error) {
    console.error('[ReportLocation] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// GET /api/Machine/ReportLocation?deviceId=123
// Get location for a specific device or all devices with GPS data
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');

    if (deviceId) {
      // Get location for specific device
      const device = await db.device.findUnique({
        where: { deviceId: String(deviceId) },
        select: {
          deviceId: true,
          deviceName: true,
          location: true,
          latitude: true,
          longitude: true,
          gpsUpdatedAt: true,
        },
      });

      if (!device) {
        return NextResponse.json(
          { success: false, error: 'Device not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        device,
      });
    }

    // Get all devices with GPS coordinates
    const devices = await db.device.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        deviceId: true,
        deviceName: true,
        location: true,
        latitude: true,
        longitude: true,
        gpsUpdatedAt: true,
        isActive: true,
      },
      orderBy: { gpsUpdatedAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      devices,
      count: devices.length,
    });
  } catch (error) {
    console.error('[ReportLocation] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
