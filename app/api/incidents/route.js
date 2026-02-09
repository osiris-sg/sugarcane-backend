import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { sendIncidentNotification } from '@/lib/push-notifications';
import { sendAlert } from '@/lib/telegram';

const SLA_HOURS = 3;

// POST /api/incidents - Create a new incident
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      type,
      deviceId,
      deviceName,
      faultCode,
      faultName,
      timeBlock,
      stockQuantity,
      assignedOpsId,
      assignedDriverId,
    } = body;

    if (!deviceId || !type) {
      return NextResponse.json(
        { success: false, error: 'deviceId and type are required' },
        { status: 400 }
      );
    }

    // Check for existing open incident of same type for this device
    const existingIncident = await db.incident.findFirst({
      where: {
        deviceId,
        type,
        status: { in: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'] },
      },
    });

    if (existingIncident) {
      return NextResponse.json(
        {
          success: false,
          error: 'An open incident of this type already exists for this device',
          existingIncidentId: existingIncident.id,
        },
        { status: 409 }
      );
    }

    const now = new Date();
    const slaDeadline = type !== 'ZERO_SALES'
      ? new Date(now.getTime() + SLA_HOURS * 60 * 60 * 1000)
      : null;

    // Create the incident
    const incident = await db.incident.create({
      data: {
        type,
        deviceId,
        deviceName: deviceName || deviceId,
        faultCode,
        faultName,
        timeBlock,
        stockQuantity,
        assignedOpsId,
        assignedDriverId,
        startTime: now,
        slaDeadline,
        status: 'OPEN',
        slaOutcome: 'PENDING',
      },
    });

    console.log(`[Incident] Created ${type} incident for ${deviceName}: ${incident.id}`);

    // Send notifications
    await sendIncidentNotification({
      type: 'new',
      incident,
      title: `🔔 New ${type.replace(/_/g, ' ')} Incident`,
      body: `${deviceName}: ${faultName || type}`,
    });

    // Send Telegram notification
    const telegramMessage = `🔔 New Incident

🎯 Device: ${deviceName}
📍 Device ID: ${deviceId}
🔧 Type: ${type.replace(/_/g, ' ')}
${faultCode ? `⚠️ Fault: ${faultCode} - ${faultName || ''}` : ''}
${slaDeadline ? `⏱️ SLA Deadline: ${slaDeadline.toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })}` : ''}`;
    await sendAlert(telegramMessage, 'incident');

    return NextResponse.json({
      success: true,
      incident,
    });
  } catch (error) {
    console.error('[Incident] Error creating incident:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// GET /api/incidents - Get incidents with filters
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const slaOutcome = searchParams.get('slaOutcome');
    const offset = parseInt(searchParams.get('offset')) || 0;
    const limit = parseInt(searchParams.get('limit')) || 100;
    const sortBy = searchParams.get('sortBy') || 'startTime';
    const sortDir = searchParams.get('sortDir') || 'desc';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const assignedOpsId = searchParams.get('assignedOpsId');
    const assignedDriverId = searchParams.get('assignedDriverId');

    const where = {};

    // Check if user is a driver - filter to only their assigned devices
    const { userId } = await auth();
    if (userId) {
      const dbUser = await db.user.findUnique({
        where: { clerkId: userId },
        select: { id: true, clerkId: true, role: true, roles: { select: { role: true } } },
      });

      // Check if user has DRIVER role (legacy field OR roles table)
      const hasDriverRole = dbUser?.role === 'DRIVER' || dbUser?.roles?.some(r => r.role === 'DRIVER');
      // Check if user also has admin/manager role (they see all devices)
      const hasAdminRole = ['ADMIN', 'MANAGER', 'OPS_MANAGER'].includes(dbUser?.role) ||
        dbUser?.roles?.some(r => ['ADMIN', 'MANAGER', 'OPS_MANAGER'].includes(r.role));

      // Only filter if user is ONLY a driver (not also an admin/manager)
      if (hasDriverRole && !hasAdminRole) {
        // Get devices assigned to this driver (from DeviceDriver table)
        const deviceDrivers = await db.deviceDriver.findMany({
          where: { userId: dbUser.id },
          select: { deviceId: true },
        });

        let assignedDeviceIds = deviceDrivers.map(d => d.deviceId);

        // Fallback: also check legacy driverId field
        if (assignedDeviceIds.length === 0) {
          const legacyDevices = await db.device.findMany({
            where: {
              OR: [
                { driverId: dbUser.id },
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
          // Driver has no assigned devices, return empty
          return NextResponse.json({
            success: true,
            incidents: [],
            count: 0,
            total: 0,
            offset,
            limit,
            hasMore: false,
          });
        }
      }
    }

    // Date range filter
    if (startDate || endDate) {
      where.startTime = {};
      if (startDate) {
        where.startTime.gte = new Date(startDate);
      }
      if (endDate) {
        where.startTime.lt = new Date(endDate);
      }
    }

    if (deviceId) {
      where.deviceId = deviceId;
    }

    if (status) {
      const statuses = status.split(',');
      if (statuses.length > 1) {
        where.status = { in: statuses };
      } else {
        where.status = status;
      }
    }

    if (type) {
      const types = type.split(',');
      if (types.length > 1) {
        where.type = { in: types };
      } else {
        where.type = type;
      }
    }

    if (slaOutcome) {
      where.slaOutcome = slaOutcome;
    }

    if (assignedOpsId) {
      where.assignedOpsId = assignedOpsId;
    }

    if (assignedDriverId) {
      where.assignedDriverId = assignedDriverId;
    }

    // Build orderBy
    const validSortFields = ['startTime', 'resolvedAt', 'slaDeadline', 'status', 'deviceName', 'type', 'reminderCount', 'faultName', 'slaOutcome'];
    const orderByField = validSortFields.includes(sortBy) ? sortBy : 'startTime';
    const orderByDir = sortDir === 'asc' ? 'asc' : 'desc';

    // Get total count and paginated incidents
    const [total, incidents] = await Promise.all([
      db.incident.count({ where }),
      db.incident.findMany({
        where,
        orderBy: { [orderByField]: orderByDir },
        skip: offset,
        take: limit,
      }),
    ]);

    // Add calculated fields
    const enrichedIncidents = incidents.map((incident) => {
      const now = new Date();
      const startTime = new Date(incident.startTime);
      const elapsedMs = now.getTime() - startTime.getTime();
      const elapsedMinutes = Math.floor(elapsedMs / (60 * 1000));

      let slaRemainingMinutes = null;
      if (incident.slaDeadline && incident.slaOutcome === 'PENDING') {
        const deadline = new Date(incident.slaDeadline);
        slaRemainingMinutes = Math.floor((deadline.getTime() - now.getTime()) / (60 * 1000));
      }

      return {
        ...incident,
        elapsedMinutes,
        slaRemainingMinutes,
      };
    });

    return NextResponse.json({
      success: true,
      incidents: enrichedIncidents,
      count: incidents.length,
      total,
      offset,
      limit,
      hasMore: offset + incidents.length < total,
    });
  } catch (error) {
    console.error('[Incident] Error fetching incidents:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
