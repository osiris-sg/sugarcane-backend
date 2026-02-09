import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db, getDeviceNameById } from '@/lib/db';
import { sendIncidentNotification } from '@/lib/push-notifications';

// Fault code to name mapping (from TelegramHelper.smali)
const FAULT_CODE_NAMES = {
  'E316': 'Fruits out of stock',
  'E40F': 'Juice sprout is always off in downward position',
  'E410': 'Orange juice level sensor is always on',
  'E411': 'Juice sensor keeps going OFF',
  'E416': 'Lifting level motor reset sensor remains off',
  'E41B': 'Sugarcane breakage and blockage',
  'E41C': 'Sugarcane breaks during juicer processing',
  'E50D': 'Out of Cups',
  'E801': 'Initial position of sealer error',
  'E802': 'Sealer did not finish sealing the cups',
  'E803': 'Two sealing failures',
  // Legacy/other codes
  'E317': 'Delivery Error',
  'E31C': 'Cup Sensor Error',
  'E51A': 'Cup Drop Error',
  'E909': 'Communication Error',
  'AL48': 'Temperature Alarm',
  'Z005': 'Door Open',
  'Z014': 'Idle Status', // Filtered out
};

// In-memory cache for E50D debounce tracking
// Format: { "deviceId": timestamp }
const e50dLastSeen = new Map();
const E50D_DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutes

// POST /api/maintenance/issue - Create a new issue
export async function POST(request) {
  try {
    const body = await request.json();
    const { deviceId, deviceName: reportedName, type, faultCode, faultName, orderId, timeBlock, priority } = body;

    if (!deviceId || !type) {
      return NextResponse.json(
        { success: false, error: 'deviceId and type are required' },
        { status: 400 }
      );
    }

    // Look up the correct device name from database
    const deviceName = await getDeviceNameById(deviceId, reportedName);

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
    const [existingIssue, existingIncident] = await Promise.all([
      db.issue.findFirst({
        where: {
          deviceId,
          type,
          status: { in: ['OPEN', 'CHECKING'] }
        }
      }),
      db.incident.findFirst({
        where: {
          deviceId,
          type: 'ERROR_NOTIFICATION',
          faultCode,
          status: { in: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'] }
        }
      })
    ]);

    if (existingIssue || existingIncident) {
      return NextResponse.json({
        success: false,
        error: 'An open issue of this type already exists for this device',
        existingIssueId: existingIssue?.id,
        existingIncidentId: existingIncident?.id
      }, { status: 409 });
    }

    // Use lookup table if faultName is missing or same as faultCode
    let resolvedFaultName = faultName;
    if (faultCode && (!faultName || faultName === faultCode)) {
      resolvedFaultName = FAULT_CODE_NAMES[faultCode] || faultCode;
    }

    const now = new Date();
    const SLA_HOURS = 3;
    const slaDeadline = new Date(now.getTime() + SLA_HOURS * 60 * 60 * 1000);

    // Create the issue (legacy table)
    const issue = await db.issue.create({
      data: {
        deviceId,
        deviceName,
        type,
        faultCode,
        faultName: resolvedFaultName,
        orderId,
        timeBlock,
        priority: priority || 1, // Default to low priority
        status: 'OPEN',
        triggeredAt: now
      }
    });

    // Also create in Incident table (new unified system)
    const incident = await db.incident.create({
      data: {
        type: 'ERROR_NOTIFICATION',
        deviceId,
        deviceName,
        faultCode,
        faultName: resolvedFaultName,
        timeBlock,
        startTime: now,
        slaDeadline,
        status: 'OPEN',
        slaOutcome: 'PENDING',
      }
    });

    console.log(`[Issue] Created ${type} issue for ${deviceName}: ${issue.id}, incident: ${incident.id}`);

    // Send push notification for new device fault
    await sendIncidentNotification({
      type: 'new',
      incident,
      title: `⚠️ ${resolvedFaultName}`,
      body: deviceName,
    });

    return NextResponse.json({
      success: true,
      issue,
      incident
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
    const priority = searchParams.get('priority');
    const offset = parseInt(searchParams.get('offset')) || 0;
    const limit = parseInt(searchParams.get('limit')) || 500;
    const sortBy = searchParams.get('sortBy') || 'triggeredAt';
    const sortDir = searchParams.get('sortDir') || 'desc';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where = {};

    // Check if user is a driver - filter to only their assigned devices
    const { userId } = await auth();
    if (userId) {
      const dbUser = await db.user.findUnique({
        where: { clerkId: userId },
        select: { id: true, clerkId: true, role: true },
      });

      if (dbUser?.role === 'DRIVER') {
        // Get devices assigned to this driver
        const assignedDevices = await db.device.findMany({
          where: {
            OR: [
              { driverId: dbUser.id },
              { driverId: dbUser.clerkId },
            ],
          },
          select: { deviceId: true },
        });

        const assignedDeviceIds = assignedDevices.map(d => d.deviceId);

        if (assignedDeviceIds.length > 0) {
          where.deviceId = { in: assignedDeviceIds };
        } else {
          // Driver has no assigned devices, return empty
          return NextResponse.json({
            success: true,
            issues: [],
            count: 0,
            total: 0,
            offset,
            limit,
            hasMore: false,
          });
        }
      }
    }

    // Date range filter for triggeredAt
    if (startDate || endDate) {
      where.triggeredAt = {};
      if (startDate) {
        where.triggeredAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.triggeredAt.lt = new Date(endDate);
      }
    }

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

    if (priority) {
      where.priority = parseInt(priority);
    }

    // Build orderBy based on sort params
    const validSortFields = ['triggeredAt', 'resolvedAt', 'priority', 'status', 'deviceName', 'faultCode', 'type'];
    const orderByField = validSortFields.includes(sortBy) ? sortBy : 'triggeredAt';
    const orderByDir = sortDir === 'asc' ? 'asc' : 'desc';

    // Get total count and paginated issues in parallel
    const [total, issues] = await Promise.all([
      db.issue.count({ where }),
      db.issue.findMany({
        where,
        orderBy: { [orderByField]: orderByDir },
        skip: offset,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      success: true,
      issues,
      count: issues.length,
      total,
      offset,
      limit,
      hasMore: offset + issues.length < total,
    });

  } catch (error) {
    console.error('[Issue] Error fetching issues:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
