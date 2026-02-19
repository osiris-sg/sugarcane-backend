import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';

// GET /api/penalties - Get penalties with filters
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const incidentId = searchParams.get('incidentId');
    const appealStatus = searchParams.get('appealStatus');
    const offset = parseInt(searchParams.get('offset')) || 0;
    const limit = parseInt(searchParams.get('limit')) || 100;
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortDir = searchParams.get('sortDir') || 'desc';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where = {};

    // Role-based filtering
    const { userId: clerkId } = await auth();
    let allowedDeviceIds = null;

    if (clerkId) {
      const dbUser = await db.user.findUnique({
        where: { clerkId },
        select: {
          id: true,
          clerkId: true,
          role: true,
          roles: { select: { role: true } },
          managedDrivers: { select: { driver: { select: { id: true } } } },
        },
      });

      if (dbUser) {
        const hasAdminRole = ['ADMIN', 'MANAGER'].includes(dbUser.role) ||
          dbUser.roles?.some(r => ['ADMIN', 'MANAGER'].includes(r.role));
        const hasOpsManagerRole = dbUser.role === 'OPS_MANAGER' ||
          dbUser.roles?.some(r => r.role === 'OPS_MANAGER');
        const hasDriverRole = dbUser.role === 'DRIVER' ||
          dbUser.roles?.some(r => r.role === 'DRIVER');

        // OPS_MANAGER: see penalties for their devices + devices of drivers they manage
        // DRIVER: see only penalties for their assigned devices
        if (!hasAdminRole && (hasOpsManagerRole || hasDriverRole)) {
          let userIdsToCheck = [dbUser.id];

          if (hasOpsManagerRole) {
            const managedDriverIds = dbUser.managedDrivers?.map(md => md.driver.id) || [];
            userIdsToCheck = [...userIdsToCheck, ...managedDriverIds];
          }

          // Get devices assigned to these users
          const deviceDrivers = await db.deviceDriver.findMany({
            where: { userId: { in: userIdsToCheck } },
            select: { deviceId: true },
          });

          allowedDeviceIds = [...new Set(deviceDrivers.map(d => d.deviceId))];

          // Fallback: also check legacy driverId field
          if (allowedDeviceIds.length === 0) {
            const legacyDevices = await db.device.findMany({
              where: {
                OR: [
                  { driverId: { in: userIdsToCheck } },
                  { driverId: dbUser.clerkId },
                ],
              },
              select: { deviceId: true },
            });
            allowedDeviceIds = legacyDevices.map(d => d.deviceId);
          }
        }
      }
    }

    // If user has restricted access, filter by allowed devices
    if (allowedDeviceIds !== null) {
      if (allowedDeviceIds.length === 0) {
        // No assigned devices, return empty
        return NextResponse.json({
          success: true,
          penalties: [],
          count: 0,
          total: 0,
          offset,
          limit,
          hasMore: false,
        });
      }

      // Get incidents for allowed devices
      const allowedIncidents = await db.incident.findMany({
        where: { deviceId: { in: allowedDeviceIds } },
        select: { id: true },
      });
      const allowedIncidentIds = allowedIncidents.map(i => i.id);

      if (allowedIncidentIds.length === 0) {
        return NextResponse.json({
          success: true,
          penalties: [],
          count: 0,
          total: 0,
          offset,
          limit,
          hasMore: false,
        });
      }

      where.incidentId = { in: allowedIncidentIds };
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

    if (incidentId) {
      where.incidentId = incidentId;
    }

    if (appealStatus) {
      where.appealStatus = appealStatus;
    }

    // Build orderBy
    const validSortFields = ['createdAt', 'appealStatus'];
    const orderByField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const orderByDir = sortDir === 'asc' ? 'asc' : 'desc';

    // Get total count and paginated penalties
    const [total, penalties] = await Promise.all([
      db.penalty.count({ where }),
      db.penalty.findMany({
        where,
        orderBy: { [orderByField]: orderByDir },
        skip: offset,
        take: limit,
      }),
    ]);

    // Enrich with incident data
    const incidentIds = [...new Set(penalties.map((p) => p.incidentId))];
    const incidents = await db.incident.findMany({
      where: { id: { in: incidentIds } },
    });
    const incidentMap = new Map(incidents.map((i) => [i.id, i]));

    // Get device IDs from incidents to fetch drivers
    const deviceIds = [...new Set(incidents.map((i) => i.deviceId))];

    // Fetch drivers assigned to these devices
    const deviceDrivers = await db.deviceDriver.findMany({
      where: { deviceId: { in: deviceIds } },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
          },
        },
      },
    });

    // Create a map of deviceId -> drivers array
    const deviceDriverMap = new Map();
    for (const dd of deviceDrivers) {
      const existing = deviceDriverMap.get(dd.deviceId) || [];
      existing.push(dd.user);
      deviceDriverMap.set(dd.deviceId, existing);
    }

    const enrichedPenalties = penalties.map((penalty) => {
      const incident = incidentMap.get(penalty.incidentId) || null;
      const drivers = incident ? deviceDriverMap.get(incident.deviceId) || [] : [];
      return {
        ...penalty,
        incident,
        drivers,
      };
    });

    return NextResponse.json({
      success: true,
      penalties: enrichedPenalties,
      count: penalties.length,
      total,
      offset,
      limit,
      hasMore: offset + penalties.length < total,
    });
  } catch (error) {
    console.error('[Penalty] Error fetching penalties:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
