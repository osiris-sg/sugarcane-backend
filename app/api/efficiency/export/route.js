import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/efficiency/export - Export incidents data as CSV
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const incidentType = searchParams.get('type');
    const assignedOpsId = searchParams.get('assignedOpsId');
    const slaOutcome = searchParams.get('slaOutcome');
    const format = searchParams.get('format') || 'csv';

    // Get devices with assigned drivers (only these count for efficiency metrics)
    const allDeviceDrivers = await db.deviceDriver.findMany({
      select: { deviceId: true },
    });
    const devicesWithDrivers = [...new Set(allDeviceDrivers.map(dd => dd.deviceId))];

    // Build where clause - only include incidents for devices with assigned drivers
    const where = {
      deviceId: { in: devicesWithDrivers },
    };

    if (startDate || endDate) {
      where.startTime = {};
      if (startDate) {
        where.startTime.gte = new Date(startDate);
      }
      if (endDate) {
        where.startTime.lt = new Date(endDate);
      }
    }

    if (incidentType) {
      where.type = incidentType;
    }

    if (assignedOpsId) {
      where.assignedOpsId = assignedOpsId;
    }

    if (slaOutcome) {
      where.slaOutcome = slaOutcome;
    }

    // Get all incidents (only for devices with assigned drivers)
    const incidents = await db.incident.findMany({
      where,
      orderBy: { startTime: 'desc' },
    });

    // Get users for name lookup
    const userIds = [
      ...new Set(
        incidents
          .flatMap((i) => [i.assignedOpsId, i.assignedDriverId])
          .filter(Boolean)
      ),
    ];
    const users = await db.user.findMany({
      where: { clerkId: { in: userIds } },
      select: { clerkId: true, firstName: true, lastName: true },
    });
    const userMap = new Map(
      users.map((u) => [u.clerkId, `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.clerkId])
    );

    // Get device drivers from DeviceDriver table for each device
    const deviceIds = [...new Set(incidents.map((i) => i.deviceId).filter(Boolean))];
    const deviceDrivers = await db.deviceDriver.findMany({
      where: { deviceId: { in: deviceIds } },
      include: {
        user: { select: { firstName: true, lastName: true } },
      },
    });
    // Map deviceId to list of driver names
    const deviceDriverMap = new Map();
    for (const dd of deviceDrivers) {
      const name = `${dd.user?.firstName || ''} ${dd.user?.lastName || ''}`.trim();
      if (!deviceDriverMap.has(dd.deviceId)) {
        deviceDriverMap.set(dd.deviceId, []);
      }
      if (name) {
        deviceDriverMap.get(dd.deviceId).push(name);
      }
    }

    // Format data for export
    const rows = incidents.map((incident) => {
      const startTime = new Date(incident.startTime);
      const acknowledgedAt = incident.acknowledgedAt ? new Date(incident.acknowledgedAt) : null;
      const resolvedAt = incident.resolvedAt ? new Date(incident.resolvedAt) : null;

      // Calculate durations
      const responseTimeMs = acknowledgedAt
        ? acknowledgedAt.getTime() - startTime.getTime()
        : null;
      const resolutionTimeMs = resolvedAt
        ? resolvedAt.getTime() - startTime.getTime()
        : null;

      return {
        id: incident.id,
        type: incident.type,
        deviceId: incident.deviceId,
        deviceName: incident.deviceName,
        status: incident.status,
        slaOutcome: incident.slaOutcome,
        penaltyFlag: incident.penaltyFlag ? 'Yes' : 'No',
        faultCode: incident.faultCode || '',
        faultName: incident.faultName || '',
        timeBlock: incident.timeBlock || '',
        startTime: startTime.toISOString(),
        acknowledgedAt: acknowledgedAt?.toISOString() || '',
        resolvedAt: resolvedAt?.toISOString() || '',
        responseTimeMinutes: responseTimeMs ? Math.round(responseTimeMs / 60000) : '',
        resolutionTimeMinutes: resolutionTimeMs ? Math.round(resolutionTimeMs / 60000) : '',
        assignedOps: userMap.get(incident.assignedOpsId) || incident.assignedOpsId || '',
        assignedDriver: userMap.get(incident.assignedDriverId) || incident.assignedDriverId || deviceDriverMap.get(incident.deviceId)?.join(', ') || '',
        resolution: incident.resolution || '',
        resolutionCategory: incident.resolutionCategory || '',
      };
    });

    if (format === 'json') {
      return NextResponse.json({
        success: true,
        data: rows,
        count: rows.length,
      });
    }

    // Generate CSV
    const headers = [
      'ID',
      'Type',
      'Device ID',
      'Device Name',
      'Status',
      'SLA Outcome',
      'Penalty',
      'Fault Code',
      'Fault Name',
      'Time Block',
      'Start Time',
      'Acknowledged At',
      'Resolved At',
      'Response Time (min)',
      'Resolution Time (min)',
      'Assigned Ops',
      'Assigned Driver',
      'Resolution',
      'Resolution Category',
    ];

    const csvRows = [headers.join(',')];

    for (const row of rows) {
      const values = [
        row.id,
        row.type,
        row.deviceId,
        `"${row.deviceName.replace(/"/g, '""')}"`,
        row.status,
        row.slaOutcome,
        row.penaltyFlag,
        row.faultCode,
        `"${row.faultName.replace(/"/g, '""')}"`,
        row.timeBlock,
        row.startTime,
        row.acknowledgedAt,
        row.resolvedAt,
        row.responseTimeMinutes,
        row.resolutionTimeMinutes,
        `"${row.assignedOps.replace(/"/g, '""')}"`,
        `"${row.assignedDriver.replace(/"/g, '""')}"`,
        `"${row.resolution.replace(/"/g, '""')}"`,
        row.resolutionCategory,
      ];
      csvRows.push(values.join(','));
    }

    const csv = csvRows.join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="incidents-export-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('[Efficiency] Error exporting data:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
