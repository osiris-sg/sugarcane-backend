import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Simple admin key check
const checkAdminKey = (request) => {
  const adminKey = request.headers.get('x-admin-key') ||
                   new URL(request.url).searchParams.get('adminKey');
  const validKey = process.env.ADMIN_KEY || 'sugarcane123';
  return adminKey === validKey;
};

// Convert local time to UTC
function localToUTC(hour, minute, timezone) {
  // Create a date in the target timezone
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const getPart = (type) => parts.find(p => p.type === type)?.value;

  const currentYear = parseInt(getPart('year'));
  const currentMonth = parseInt(getPart('month')) - 1;
  const currentDay = parseInt(getPart('day'));
  const currentHour = parseInt(getPart('hour'));
  const currentMinute = parseInt(getPart('minute'));

  // Target date in local timezone
  let targetDate = new Date(Date.UTC(currentYear, currentMonth, currentDay, hour, minute, 0));

  // Adjust for timezone offset
  const localDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
  const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
  const offsetMs = localDate.getTime() - utcDate.getTime();

  // Create target time in UTC
  let scheduledUTC = new Date(targetDate.getTime() - offsetMs);

  // If the time has already passed today, schedule for tomorrow
  if (scheduledUTC <= now) {
    scheduledUTC = new Date(scheduledUTC.getTime() + 24 * 60 * 60 * 1000);
  }

  return scheduledUTC;
}

// GET /api/app/ota-schedule - List scheduled OTA updates
export async function GET(request) {
  if (!checkAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // SCHEDULED, TRIGGERED, CANCELLED

    const whereClause = status ? { status } : {};

    const scheduledOtas = await db.scheduledOta.findMany({
      where: whereClause,
      orderBy: { scheduledAt: 'asc' },
    });

    // Add SGT time for display
    const otasWithSGT = scheduledOtas.map(ota => ({
      ...ota,
      scheduledAtSGT: new Date(ota.scheduledAt).toLocaleString('en-SG', {
        timeZone: 'Asia/Singapore',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
      deviceCount: ota.devices.length === 0 ? 'ALL' : ota.devices.length,
    }));

    return NextResponse.json({
      success: true,
      scheduledOtas: otasWithSGT,
      count: otasWithSGT.length,
    });
  } catch (error) {
    console.error('Error fetching scheduled OTAs:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/app/ota-schedule - Schedule a new OTA update
export async function POST(request) {
  if (!checkAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      devices = [],          // Array of device IDs, empty = all devices
      hour = 3,              // Hour in SGT (default 3am)
      minute = 0,            // Minute (default 0)
      scheduledAt,           // Optional: specific UTC datetime
      notes,                 // Optional notes
    } = body;

    let scheduledUTC;

    if (scheduledAt) {
      // Use provided datetime
      scheduledUTC = new Date(scheduledAt);
    } else {
      // Calculate next occurrence of the specified time in SGT
      scheduledUTC = localToUTC(hour, minute, 'Asia/Singapore');
    }

    const scheduledOta = await db.scheduledOta.create({
      data: {
        devices: Array.isArray(devices) ? devices : [],
        scheduledAt: scheduledUTC,
        notes: notes || null,
        status: 'SCHEDULED',
      },
    });

    const scheduledAtSGT = scheduledUTC.toLocaleString('en-SG', {
      timeZone: 'Asia/Singapore',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    return NextResponse.json({
      success: true,
      message: `OTA scheduled for ${scheduledAtSGT} SGT`,
      scheduledOta: {
        ...scheduledOta,
        scheduledAtSGT,
        deviceCount: devices.length === 0 ? 'ALL' : devices.length,
      },
    });
  } catch (error) {
    console.error('Error scheduling OTA:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/app/ota-schedule - Cancel a scheduled OTA
export async function DELETE(request) {
  if (!checkAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const scheduledOta = await db.scheduledOta.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    return NextResponse.json({
      success: true,
      message: 'OTA cancelled',
      scheduledOta,
    });
  } catch (error) {
    console.error('Error cancelling OTA:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
