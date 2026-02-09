import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/incidents/[id]/acknowledge - Acknowledge an incident
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { userId } = body;

    const incident = await db.incident.findUnique({
      where: { id },
    });

    if (!incident) {
      return NextResponse.json(
        { success: false, error: 'Incident not found' },
        { status: 404 }
      );
    }

    if (incident.status !== 'OPEN') {
      return NextResponse.json(
        { success: false, error: 'Incident is not in OPEN status' },
        { status: 400 }
      );
    }

    const now = new Date();

    const updatedIncident = await db.incident.update({
      where: { id },
      data: {
        status: 'ACKNOWLEDGED',
        acknowledgedAt: now,
        assignedOpsId: userId || incident.assignedOpsId,
      },
    });

    console.log(`[Incident] Acknowledged ${id} by ${userId || 'unknown'}`);

    return NextResponse.json({
      success: true,
      incident: updatedIncident,
    });
  } catch (error) {
    console.error('[Incident] Error acknowledging incident:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
