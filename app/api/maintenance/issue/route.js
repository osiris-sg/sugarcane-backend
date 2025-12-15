import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendStockAlert } from '@/app/api/telegram/send/route';

// In-memory cache for E50D debounce tracking
// Format: { "deviceId": timestamp }
const e50dLastSeen = new Map();
const E50D_DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutes

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

    // Skip Z014 fault code - don't store in database
    if (faultCode === 'Z014') {
      console.log(`[Issue] Skipping Z014 fault code for ${deviceName}`);
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'Z014 fault code filtered'
      });
    }

    // Special handling for E50D (out of cups) - only report if seen twice within 5 minutes
    if (faultCode === 'E50D') {
      const now = Date.now();
      const lastSeen = e50dLastSeen.get(deviceId);

      if (lastSeen && (now - lastSeen) <= E50D_DEBOUNCE_MS) {
        // Second occurrence within 5 minutes - proceed to create issue
        console.log(`[Issue] E50D confirmed for ${deviceName} (second occurrence within 5 min)`);
        e50dLastSeen.delete(deviceId); // Clear after confirmed
      } else {
        // First occurrence or too long ago - just record timestamp and skip
        e50dLastSeen.set(deviceId, now);
        console.log(`[Issue] E50D first occurrence for ${deviceName} - waiting for confirmation within 5 min`);
        return NextResponse.json({
          success: true,
          skipped: true,
          reason: 'E50D requires confirmation within 5 minutes',
          waitingForConfirmation: true
        });
      }
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
