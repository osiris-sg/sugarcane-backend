import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

// POST /api/Machine/ReportTemperature
// Called by Android app when door closes (D002) to report temperature
export async function POST(request) {
  try {
    const body = await request.json();
    const { deviceId, deviceName, refrigerationTemp, machineTemp } = body;

    // Validate required fields
    if (!deviceId) {
      return NextResponse.json(
        { success: false, error: 'deviceId is required' },
        { status: 400 }
      );
    }

    // Parse temperature values (may come as numbers or strings)
    const temp1 = parseFloat(refrigerationTemp) || 0;
    const temp2 = parseFloat(machineTemp) || 0;

    console.log(`[ReportTemperature] Device ${deviceId} (${deviceName}): refrigeration=${temp1}C, machine=${temp2}C`);

    // Store temperature reading
    const temperature = await db.temperature.create({
      data: {
        deviceId: String(deviceId),
        deviceName: deviceName || `Device ${deviceId}`,
        refrigerationTemp: temp1,
        machineTemp: temp2,
      },
    });

    return NextResponse.json({
      success: true,
      temperature: {
        id: temperature.id,
        deviceId: temperature.deviceId,
        deviceName: temperature.deviceName,
        refrigerationTemp: temperature.refrigerationTemp,
        machineTemp: temperature.machineTemp,
        createdAt: temperature.createdAt,
      },
    });
  } catch (error) {
    console.error('[ReportTemperature] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// GET /api/Machine/ReportTemperature?deviceId=123&limit=100
// Get temperature history for a specific device
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    if (deviceId) {
      // Get temperature history for specific device
      const temperatures = await db.temperature.findMany({
        where: { deviceId: String(deviceId) },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      // Get latest reading
      const latest = temperatures[0] || null;

      return NextResponse.json({
        success: true,
        deviceId,
        latest,
        history: temperatures,
        count: temperatures.length,
      });
    }

    // Get latest temperature for all devices
    const devices = await db.temperature.findMany({
      distinct: ['deviceId'],
      orderBy: { createdAt: 'desc' },
    });

    // Get most recent reading for each device
    const latestByDevice = await Promise.all(
      devices.map(async (d) => {
        const latest = await db.temperature.findFirst({
          where: { deviceId: d.deviceId },
          orderBy: { createdAt: 'desc' },
        });
        return latest;
      })
    );

    return NextResponse.json({
      success: true,
      temperatures: latestByDevice.filter(Boolean),
    });
  } catch (error) {
    console.error('[ReportTemperature] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
