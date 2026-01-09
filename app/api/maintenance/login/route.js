import { NextResponse } from 'next/server';
import { db, getDeviceNameById } from '@/lib/db';

// Force dynamic rendering - no caching
export const dynamic = 'force-dynamic';

// POST /api/maintenance/login - Record a maintenance login
export async function POST(request) {
  try {
    const body = await request.json();
    const { deviceId, deviceName: reportedName, userId, userName, pin, loginType } = body;

    if (!deviceId || !userName || !loginType) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: deviceId, userName, loginType' },
        { status: 400 }
      );
    }

    // Look up the correct device name from database
    const deviceName = await getDeviceNameById(deviceId, reportedName);

    // Create the login record
    const login = await db.maintenanceLogin.create({
      data: {
        deviceId,
        deviceName,
        userId: userId || null,
        userName,
        pin: pin || null,
        loginType,
      },
    });

    console.log(`[MaintenanceLogin] ${userName} logged into ${deviceName} (${loginType})`);

    return NextResponse.json({
      success: true,
      id: login.id,
    });

  } catch (error) {
    console.error('[MaintenanceLogin] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// GET /api/maintenance/login - Get recent logins (optional, for dashboard)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where = deviceId ? { deviceId } : {};

    const logins = await db.maintenanceLogin.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({
      success: true,
      logins,
      count: logins.length,
    });

  } catch (error) {
    console.error('[MaintenanceLogin] Error fetching logins:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
