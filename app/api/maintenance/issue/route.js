import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendStockAlert } from '@/app/api/telegram/send/route';

// POST /api/maintenance/issue - Create a new issue
export async function POST(request) {
  try {
    const body = await request.json();
    const { deviceId, deviceName, type, faultCode, faultName, orderId, timeBlock } = body;

    if (!deviceId || !deviceName || !type) {
      return NextResponse.json(
        { success: false, error: 'deviceId, deviceName, and type are required' },
        { status: 400 }
      );
    }

    // Check for existing open issue of same type for this device
    const existingIssue = await db.issue.findFirst({
      where: {
        deviceId,
        type,
        status: { in: ['OPEN', 'CHECKING'] }
      }
    });

    if (existingIssue) {
      return NextResponse.json({
        success: false,
        error: 'An open issue of this type already exists for this device',
        existingIssueId: existingIssue.id
      }, { status: 409 });
    }

    // Create the issue
    const issue = await db.issue.create({
      data: {
        deviceId,
        deviceName,
        type,
        faultCode,
        faultName,
        orderId,
        timeBlock,
        status: 'OPEN',
        triggeredAt: new Date()
      }
    });

    console.log(`[Issue] Created ${type} issue for ${deviceName}: ${issue.id}`);

    return NextResponse.json({
      success: true,
      issue
    });

  } catch (error) {
    console.error('[Issue] Error creating issue:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// GET /api/maintenance/issue - Get issues (with optional filters)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');
    const status = searchParams.get('status');
    const type = searchParams.get('type');

    const where = {};

    if (deviceId) {
      where.deviceId = deviceId;
    }

    if (status) {
      // Support comma-separated statuses like "OPEN,CHECKING"
      const statuses = status.split(',');
      if (statuses.length > 1) {
        where.status = { in: statuses };
      } else {
        where.status = status;
      }
    }

    if (type) {
      where.type = type;
    }

    const issues = await db.issue.findMany({
      where,
      orderBy: { triggeredAt: 'desc' },
      take: 100
    });

    return NextResponse.json({
      success: true,
      issues,
      count: issues.length
    });

  } catch (error) {
    console.error('[Issue] Error fetching issues:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
