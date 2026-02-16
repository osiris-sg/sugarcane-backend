import { NextResponse } from 'next/server';
import { db, getDeviceNameById } from '@/lib/db';

// Force dynamic rendering - no caching
export const dynamic = 'force-dynamic';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Send message to Telegram
async function sendTelegramMessage(chatId, text) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    });
  } catch (error) {
    console.error('Error sending Telegram message:', error);
  }
}

// Helper: Get current Singapore hour
function getSGHour() {
  const now = new Date();
  const sgTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Singapore' }));
  return sgTime.getHours();
}

// Helper: Check if day shift (8am-10pm)
function isDayShift() {
  const hour = getSGHour();
  return hour >= 8 && hour < 22;
}

// Send maintenance login notification
async function sendMaintenanceLoginNotification(deviceId, deviceName, userName, loginType) {
  // Build role filter based on shift
  const roles = ['ADMIN'];
  if (isDayShift()) {
    roles.push('OPSMANAGER', 'DAYOPS');
  } else {
    roles.push('NIGHTOPS');
  }

  const subscribers = await db.subscriber.findMany({
    where: {
      role: { in: roles },
    },
  });

  if (subscribers.length === 0) return;

  // Format timestamp in Singapore timezone
  const now = new Date();
  const timestamp = now.toLocaleString('en-SG', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).replace(',', '');

  const message = `🔐 <b>Maintenance Login</b>

🎯 Device ID: ${deviceId}
📍 Device Name: ${deviceName}
👤 User: ${userName}
🕒 Login Time: ${timestamp}

✅ Maintenance mode activated`;

  console.log(`[MaintenanceLogin] Sending notification to ${subscribers.length} subscribers`);

  for (const subscriber of subscribers) {
    await sendTelegramMessage(subscriber.chatId, message);
  }
}

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

    // Send Telegram notification
    await sendMaintenanceLoginNotification(deviceId, deviceName, userName, loginType);

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

// GET /api/maintenance/login - Get logins with pagination and filters
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');
    const deviceIds = searchParams.get('deviceIds'); // Comma-separated list
    const loginType = searchParams.get('loginType');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Build where clause
    const where = {};

    // Device filter (single or multiple)
    if (deviceIds) {
      where.deviceId = { in: deviceIds.split(',') };
    } else if (deviceId) {
      where.deviceId = deviceId;
    }

    // Login type filter
    if (loginType && loginType !== 'all') {
      where.loginType = loginType;
    }

    // Date range filter
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lt = new Date(endDate);
      }
    }

    // Search filter (device name, device ID, user name)
    if (search) {
      where.OR = [
        { deviceName: { contains: search, mode: 'insensitive' } },
        { deviceId: { contains: search, mode: 'insensitive' } },
        { userName: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get total count for pagination
    const totalCount = await db.maintenanceLogin.count({ where });
    const totalPages = Math.ceil(totalCount / limit);

    // Get paginated logins
    const logins = await db.maintenanceLogin.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return NextResponse.json({
      success: true,
      logins,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
      },
    });

  } catch (error) {
    console.error('[MaintenanceLogin] Error fetching logins:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
