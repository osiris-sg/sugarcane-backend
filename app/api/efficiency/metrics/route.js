import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/efficiency/metrics - Get efficiency KPIs
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const incidentType = searchParams.get('type');
    const assignedOpsId = searchParams.get('assignedOpsId');
    const period = searchParams.get('period') || 'week'; // week, month, all

    // Calculate date range
    let dateFilter = {};
    const now = new Date();

    if (startDate && endDate) {
      dateFilter = {
        startTime: {
          gte: new Date(startDate),
          lt: new Date(endDate),
        },
      };
    } else if (period === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      dateFilter = { startTime: { gte: weekAgo } };
    } else if (period === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      dateFilter = { startTime: { gte: monthAgo } };
    }

    // Build where clause
    const where = { ...dateFilter };
    if (incidentType) {
      where.type = incidentType;
    }
    if (assignedOpsId) {
      where.assignedOpsId = assignedOpsId;
    }

    // Get all incidents for the period
    const incidents = await db.incident.findMany({
      where,
    });

    // Calculate metrics
    const totalIncidents = incidents.length;
    const resolvedIncidents = incidents.filter((i) => i.status === 'RESOLVED');
    const withinSla = incidents.filter((i) => i.slaOutcome === 'WITHIN_SLA').length;
    const slaBreach = incidents.filter((i) => i.slaOutcome === 'SLA_BREACHED').length;
    const pending = incidents.filter((i) => i.slaOutcome === 'PENDING').length;

    // Calculate SLA compliance rate (excluding pending)
    const decidedCount = withinSla + slaBreach;
    const slaComplianceRate = decidedCount > 0 ? (withinSla / decidedCount) * 100 : 100;

    // Calculate average response time (time to acknowledge)
    const acknowledgedIncidents = incidents.filter(
      (i) => i.acknowledgedAt && i.startTime
    );
    const avgResponseTimeMs =
      acknowledgedIncidents.length > 0
        ? acknowledgedIncidents.reduce((sum, i) => {
            return sum + (new Date(i.acknowledgedAt).getTime() - new Date(i.startTime).getTime());
          }, 0) / acknowledgedIncidents.length
        : 0;
    const avgResponseTimeMinutes = Math.round(avgResponseTimeMs / (60 * 1000));

    // Calculate average resolution time
    const avgResolutionTimeMs =
      resolvedIncidents.length > 0
        ? resolvedIncidents.reduce((sum, i) => {
            return sum + (new Date(i.resolvedAt).getTime() - new Date(i.startTime).getTime());
          }, 0) / resolvedIncidents.length
        : 0;
    const avgResolutionTimeMinutes = Math.round(avgResolutionTimeMs / (60 * 1000));

    // Breakdown by type
    const byType = {};
    const incidentTypes = ['ERROR_NOTIFICATION', 'OUT_OF_STOCK', 'ZERO_SALES', 'CLEANING_COMPLIANCE', 'MANUAL_ERROR'];
    for (const type of incidentTypes) {
      const typeIncidents = incidents.filter((i) => i.type === type);
      const typeWithinSla = typeIncidents.filter((i) => i.slaOutcome === 'WITHIN_SLA').length;
      const typeBreach = typeIncidents.filter((i) => i.slaOutcome === 'SLA_BREACHED').length;
      const typeDecided = typeWithinSla + typeBreach;

      byType[type] = {
        total: typeIncidents.length,
        withinSla: typeWithinSla,
        breach: typeBreach,
        complianceRate: typeDecided > 0 ? (typeWithinSla / typeDecided) * 100 : 100,
      };
    }

    // Cleaning compliance metrics
    const sgTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const currentMonth = sgTime.getUTCMonth() + 1;
    const currentYear = sgTime.getUTCFullYear();

    const devices = await db.device.findMany({ where: { isActive: true } });
    const cleaningLogs = await db.cleaningLog.findMany({
      where: { month: currentMonth, year: currentYear },
    });

    const cleaningByDevice = new Map();
    for (const log of cleaningLogs) {
      const count = cleaningByDevice.get(log.deviceId) || 0;
      cleaningByDevice.set(log.deviceId, count + 1);
    }

    const compliantDevices = devices.filter(
      (d) => (cleaningByDevice.get(d.deviceId) || 0) >= 3
    ).length;
    const cleaningComplianceRate =
      devices.length > 0 ? (compliantDevices / devices.length) * 100 : 100;

    return NextResponse.json({
      success: true,
      period,
      dateRange: {
        start: dateFilter.startTime?.gte || null,
        end: dateFilter.startTime?.lt || now,
      },
      metrics: {
        totalIncidents,
        resolvedCount: resolvedIncidents.length,
        pendingCount: totalIncidents - resolvedIncidents.length,
        slaCompliance: {
          withinSla,
          breached: slaBreach,
          pending,
          complianceRate: Math.round(slaComplianceRate * 10) / 10,
        },
        responseTimes: {
          avgResponseMinutes: avgResponseTimeMinutes,
          avgResolutionMinutes: avgResolutionTimeMinutes,
        },
        byType,
        cleaningCompliance: {
          totalDevices: devices.length,
          compliantDevices,
          complianceRate: Math.round(cleaningComplianceRate * 10) / 10,
          currentMonth,
          currentYear,
        },
      },
    });
  } catch (error) {
    console.error('[Efficiency] Error fetching metrics:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
