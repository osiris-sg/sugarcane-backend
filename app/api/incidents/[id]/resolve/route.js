import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendIncidentNotification } from '@/lib/push-notifications';
import { sendAlert } from '@/lib/telegram';

// POST /api/incidents/[id]/resolve - Resolve an incident
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { resolution, resolutionCategory, userId } = body;

    const incident = await db.incident.findUnique({
      where: { id },
    });

    if (!incident) {
      return NextResponse.json(
        { success: false, error: 'Incident not found' },
        { status: 404 }
      );
    }

    if (incident.status === 'RESOLVED') {
      return NextResponse.json(
        { success: false, error: 'Incident is already resolved' },
        { status: 400 }
      );
    }

    const now = new Date();
    const updateData = {
      status: 'RESOLVED',
      resolvedAt: now,
      resolution: resolution || 'Resolved',
      resolutionCategory,
    };

    // Determine SLA outcome if still pending
    if (incident.slaOutcome === 'PENDING' && incident.slaDeadline) {
      const deadline = new Date(incident.slaDeadline);
      updateData.slaOutcome = now <= deadline ? 'WITHIN_SLA' : 'SLA_BREACHED';

      if (updateData.slaOutcome === 'SLA_BREACHED' && !incident.penaltyFlag) {
        updateData.penaltyFlag = true;

        // Create penalty record
        await db.penalty.create({
          data: {
            incidentId: id,
            reason: `SLA breach - ${incident.type} resolved after deadline`,
          },
        });
      }
    }

    // Update assignee if provided
    if (userId) {
      updateData.assignedOpsId = userId;
    }

    const updatedIncident = await db.incident.update({
      where: { id },
      data: updateData,
    });

    // Get device location for notifications
    const deviceRecord = await db.device.findUnique({
      where: { deviceId: updatedIncident.deviceId },
      select: { location: true },
    });
    const displayName = deviceRecord?.location || updatedIncident.deviceName;

    console.log(`[Incident] Resolved ${id} by ${userId || 'unknown'}: ${resolution}`);

    // Send notifications (use location for display)
    await sendIncidentNotification({
      type: 'resolved',
      incident: updatedIncident,
      title: '✅ Incident Resolved',
      body: `${displayName}: ${resolution || 'Resolved'}`,
    });

    // Send Telegram notification (use location for display)
    const telegramMessage = `✅ Incident Resolved

🎯 Location: ${displayName}
🔧 Type: ${updatedIncident.type.replace(/_/g, ' ')}
📝 Resolution: ${resolution || 'Resolved'}
${resolutionCategory ? `📋 Category: ${resolutionCategory}` : ''}
${updatedIncident.slaOutcome === 'WITHIN_SLA' ? '⏱️ Resolved within SLA' : '⚠️ SLA was breached'}`;
    await sendAlert(telegramMessage, 'incident_resolved');

    return NextResponse.json({
      success: true,
      incident: updatedIncident,
    });
  } catch (error) {
    console.error('[Incident] Error resolving incident:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
