import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db, getDeviceNameById, swapDeviceId } from '@/lib/db';
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
    const { deviceId: rawDeviceId, deviceName: reportedName, type, faultCode, faultName, orderId, timeBlock, priority } = body;

    if (!rawDeviceId || !type) {
      return NextResponse.json(
        { success: false, error: 'deviceId and type are required' },
        { status: 400 }
      );
    }

    // Swap device ID if needed (for mismatched devices 852346/852356)
    const deviceId = swapDeviceId(rawDeviceId);

    // Look up the correct device name and location from database
    const deviceName = await getDeviceNameById(deviceId, reportedName);
    const deviceRecord = await db.device.findUnique({
      where: { deviceId },
      select: { location: true },
    });
    const deviceLocation = deviceRecord?.location || deviceName;

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

    // Use lookup table if faultName is missing or same as faultCode
    let resolvedFaultName = faultName;
    if (faultCode && (!faultName || faultName === faultCode)) {
      resolvedFaultName = FAULT_CODE_NAMES[faultCode] || faultCode;
    }

    const now = new Date();
    const SLA_HOURS = 3;

    // Check if device has an assigned driver (SLA only applies to assigned devices)
    const deviceDriver = await db.deviceDriver.findFirst({
      where: { deviceId },
      select: { id: true },
    });
    const hasDriver = !!deviceDriver;

    // Only set SLA deadline for devices with assigned drivers
    const slaDeadline = hasDriver ? new Date(now.getTime() + SLA_HOURS * 60 * 60 * 1000) : null;

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
    // SLA only applies to devices with assigned drivers
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
        slaOutcome: hasDriver ? 'PENDING' : null,
      }
    });

    console.log(`[Issue] Created ${type} issue for ${deviceName}: ${issue.id}, incident: ${incident.id}`);

    // Send push notification for new device fault (use location for display)
    await sendIncidentNotification({
      type: 'new',
      incident,
      title: `⚠️ ${resolvedFaultName}`,
      body: deviceLocation,
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

    // Filter devices based on user role
    const { userId } = await auth();
    if (userId) {
      const dbUser = await db.user.findUnique({
        where: { clerkId: userId },
        select: {
          id: true,
          clerkId: true,
          role: true,
          roles: { select: { role: true } },
          managedDrivers: { select: { driver: { select: { id: true } } } },
        },
      });

      // Check roles
      const hasAdminRole = ['ADMIN', 'MANAGER'].includes(dbUser?.role) ||
        dbUser?.roles?.some(r => ['ADMIN', 'MANAGER'].includes(r.role));
      const hasOpsManagerRole = dbUser?.role === 'OPS_MANAGER' ||
        dbUser?.roles?.some(r => r.role === 'OPS_MANAGER');
      const hasDriverRole = dbUser?.role === 'DRIVER' ||
        dbUser?.roles?.some(r => r.role === 'DRIVER');

      // ADMIN/MANAGER: see all (no filter)
      // OPS_MANAGER: see their devices + devices of drivers they manage
      // DRIVER: see only their assigned devices
      if (!hasAdminRole && (hasOpsManagerRole || hasDriverRole)) {
        let userIdsToCheck = [dbUser.id];

        // If ops manager, also include managed drivers
        if (hasOpsManagerRole) {
          const managedDriverIds = dbUser.managedDrivers?.map(md => md.driver.id) || [];
          userIdsToCheck = [...userIdsToCheck, ...managedDriverIds];
        }

        // Get devices assigned to these users (from DeviceDriver table)
        const deviceDrivers = await db.deviceDriver.findMany({
          where: { userId: { in: userIdsToCheck } },
          select: { deviceId: true },
        });

        let assignedDeviceIds = [...new Set(deviceDrivers.map(d => d.deviceId))];

        // Fallback: also check legacy driverId field
        if (assignedDeviceIds.length === 0) {
          const legacyDevices = await db.device.findMany({
            where: {
              OR: [
                { driverId: { in: userIdsToCheck } },
                { driverId: dbUser.clerkId },
              ],
            },
            select: { deviceId: true },
          });
          assignedDeviceIds = legacyDevices.map(d => d.deviceId);
        }

        if (assignedDeviceIds.length > 0) {
          where.deviceId = { in: assignedDeviceIds };
        } else {
          // No assigned devices, return empty
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
