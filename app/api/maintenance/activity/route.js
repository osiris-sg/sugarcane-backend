import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendStockAlert } from '@/app/api/telegram/send/route';

// POST /api/maintenance/activity - Start a new maintenance activity
export async function POST(request) {
  try {
    const body = await request.json();
    const { deviceId, deviceName, activityType } = body;

    if (!deviceId || !deviceName || !activityType) {
      return NextResponse.json(
        { success: false, error: 'deviceId, deviceName, and activityType are required' },
        { status: 400 }
      );
    }

    if (!['clean_wash', 'customer_feedback'].includes(activityType)) {
      return NextResponse.json(
        { success: false, error: 'activityType must be "clean_wash" or "customer_feedback"' },
        { status: 400 }
      );
    }

    // Check for existing in-progress activity
    const existingActivity = await db.maintenanceActivity.findFirst({
      where: {
        deviceId,
        activityType,
        status: 'in_progress'
      }
    });

    if (existingActivity) {
      return NextResponse.json({
        success: false,
        error: 'An activity of this type is already in progress',
        existingActivityId: existingActivity.id
      }, { status: 409 });
    }

    // Create the activity
    const activity = await db.maintenanceActivity.create({
      data: {
        deviceId,
        deviceName,
        activityType,
        startedAt: new Date(),
        status: 'in_progress'
      }
    });

    const typeLabel = activityType === 'clean_wash' ? 'Clean/Wash Down' : 'Customer Feedback';
    console.log(`[Activity] Started ${typeLabel} for ${deviceName}: ${activity.id}`);

    return NextResponse.json({
      success: true,
      activity
    });

  } catch (error) {
    console.error('[Activity] Error creating activity:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// GET /api/maintenance/activity - Get activities (with optional filters)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');
    const activityType = searchParams.get('activityType');
    const status = searchParams.get('status');

    const where = {};

    if (deviceId) {
      where.deviceId = deviceId;
    }

    if (activityType) {
      where.activityType = activityType;
    }

    if (status) {
      where.status = status;
    }

    const activities = await db.maintenanceActivity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    return NextResponse.json({
      success: true,
      activities,
      count: activities.length
    });

  } catch (error) {
    console.error('[Activity] Error fetching activities:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
