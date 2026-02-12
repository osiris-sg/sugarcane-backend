import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/cleaning/log - Log a cleaning activity
export async function POST(request) {
  try {
    const body = await request.json();
    const { deviceId, deviceName, userId, userName } = body;

    if (!deviceId || !userName) {
      return NextResponse.json(
        { success: false, error: 'deviceId and userName are required' },
        { status: 400 }
      );
    }

    // Get Singapore time for month/year
    const now = new Date();
    const sgTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const month = sgTime.getUTCMonth() + 1;
    const year = sgTime.getUTCFullYear();

    // Create cleaning log entry
    const cleaningLog = await db.cleaningLog.create({
      data: {
        deviceId,
        deviceName: deviceName || deviceId,
        userId,
        userName,
        loggedAt: now,
        month,
        year,
      },
    });

    console.log(`[Cleaning] Logged cleaning for ${deviceName} by ${userName}`);

    // Get total cleanings for this device this month
    const monthlyCount = await db.cleaningLog.count({
      where: {
        deviceId,
        month,
        year,
      },
    });

    return NextResponse.json({
      success: true,
      cleaningLog,
      monthlyCount,
      requiredCount: 3,
      isCompliant: monthlyCount >= 3,
    });
  } catch (error) {
    console.error('[Cleaning] Error logging cleaning:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// GET /api/cleaning/log - Get cleaning logs
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const offset = parseInt(searchParams.get('offset')) || 0;
    const limit = parseInt(searchParams.get('limit')) || 100;

    const where = {};

    if (deviceId) {
      where.deviceId = deviceId;
    }

    if (month) {
      where.month = parseInt(month);
    }

    if (year) {
      where.year = parseInt(year);
    }

    const [total, logs] = await Promise.all([
      db.cleaningLog.count({ where }),
      db.cleaningLog.findMany({
        where,
        orderBy: { loggedAt: 'desc' },
        skip: offset,
        take: limit,
      }),
    ]);

    // Get device locations for enrichment
    const deviceIds = [...new Set(logs.map(l => l.deviceId))];
    const devices = await db.device.findMany({
      where: { deviceId: { in: deviceIds } },
      select: { deviceId: true, location: true, deviceName: true },
    });
    const deviceMap = {};
    devices.forEach(d => {
      deviceMap[d.deviceId] = d.location || d.deviceName;
    });

    // Enrich logs with device location
    const enrichedLogs = logs.map(log => ({
      ...log,
      deviceName: deviceMap[log.deviceId] || log.deviceName,
    }));

    return NextResponse.json({
      success: true,
      logs: enrichedLogs,
      count: logs.length,
      total,
      offset,
      limit,
      hasMore: offset + logs.length < total,
    });
  } catch (error) {
    console.error('[Cleaning] Error fetching logs:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
