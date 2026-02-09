import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

const REQUIRED_CLEANINGS_PER_MONTH = 3;

// GET /api/cleaning/compliance - Get cleaning compliance status for all devices
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const year = searchParams.get('year');

    // Default to current month in Singapore time
    const now = new Date();
    const sgTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const targetMonth = month ? parseInt(month) : sgTime.getUTCMonth() + 1;
    const targetYear = year ? parseInt(year) : sgTime.getUTCFullYear();

    // Get all active devices
    const devices = await db.device.findMany({
      where: { isActive: true },
      orderBy: { deviceName: 'asc' },
    });

    // Get cleaning logs for the target month
    const cleaningLogs = await db.cleaningLog.findMany({
      where: {
        month: targetMonth,
        year: targetYear,
      },
      orderBy: { loggedAt: 'desc' },
    });

    // Build cleaning count by device
    const cleaningByDevice = new Map();
    const logsByDevice = new Map();

    for (const log of cleaningLogs) {
      const count = cleaningByDevice.get(log.deviceId) || 0;
      cleaningByDevice.set(log.deviceId, count + 1);

      const logs = logsByDevice.get(log.deviceId) || [];
      logs.push(log);
      logsByDevice.set(log.deviceId, logs);
    }

    // Build compliance status for each device
    const deviceCompliance = devices.map((device) => {
      const cleaningCount = cleaningByDevice.get(device.deviceId) || 0;
      const isCompliant = cleaningCount >= REQUIRED_CLEANINGS_PER_MONTH;
      const logs = logsByDevice.get(device.deviceId) || [];

      return {
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        cleaningCount,
        requiredCount: REQUIRED_CLEANINGS_PER_MONTH,
        isCompliant,
        remaining: Math.max(0, REQUIRED_CLEANINGS_PER_MONTH - cleaningCount),
        logs: logs.slice(0, 5), // Last 5 logs
      };
    });

    // Summary statistics
    const compliantCount = deviceCompliance.filter((d) => d.isCompliant).length;
    const nonCompliantCount = deviceCompliance.filter((d) => !d.isCompliant).length;
    const complianceRate = devices.length > 0
      ? (compliantCount / devices.length) * 100
      : 100;

    return NextResponse.json({
      success: true,
      month: targetMonth,
      year: targetYear,
      summary: {
        totalDevices: devices.length,
        compliantCount,
        nonCompliantCount,
        complianceRate: Math.round(complianceRate * 10) / 10,
        requiredPerDevice: REQUIRED_CLEANINGS_PER_MONTH,
      },
      devices: deviceCompliance,
    });
  } catch (error) {
    console.error('[Cleaning] Error fetching compliance:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
