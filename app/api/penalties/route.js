import { NextResponse } from 'next/server';
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

    const enrichedPenalties = penalties.map((penalty) => ({
      ...penalty,
      incident: incidentMap.get(penalty.incidentId) || null,
    }));

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
