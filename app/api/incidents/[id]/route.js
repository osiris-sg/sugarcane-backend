import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendIncidentNotification } from '@/lib/push-notifications';
import { sendAlert } from '@/lib/telegram';

// GET /api/incidents/[id] - Get a single incident
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    const incident = await db.incident.findUnique({
      where: { id },
    });

    if (!incident) {
      return NextResponse.json(
        { success: false, error: 'Incident not found' },
        { status: 404 }
      );
    }

    // Add calculated fields
    const now = new Date();
    const startTime = new Date(incident.startTime);
    const elapsedMs = now.getTime() - startTime.getTime();
    const elapsedMinutes = Math.floor(elapsedMs / (60 * 1000));

    let slaRemainingMinutes = null;
    if (incident.slaDeadline && incident.slaOutcome === 'PENDING') {
      const deadline = new Date(incident.slaDeadline);
      slaRemainingMinutes = Math.floor((deadline.getTime() - now.getTime()) / (60 * 1000));
    }

    return NextResponse.json({
      success: true,
      incident: {
        ...incident,
        elapsedMinutes,
        slaRemainingMinutes,
      },
    });
  } catch (error) {
    console.error('[Incident] Error fetching incident:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// PATCH /api/incidents/[id] - Update an incident
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const incident = await db.incident.findUnique({
      where: { id },
    });

    if (!incident) {
      return NextResponse.json(
        { success: false, error: 'Incident not found' },
        { status: 404 }
      );
    }

    const {
      status,
      resolution,
      resolutionCategory,
      assignedOpsId,
      assignedDriverId,
    } = body;

    const now = new Date();
    const updateData = {};

    // Handle status transitions
    if (status && status !== incident.status) {
      updateData.status = status;

      switch (status) {
        case 'ACKNOWLEDGED':
          if (!incident.acknowledgedAt) {
            updateData.acknowledgedAt = now;
          }
          break;

        case 'IN_PROGRESS':
          if (!incident.inProgressAt) {
            updateData.inProgressAt = now;
          }
          break;

        case 'RESOLVED':
          updateData.resolvedAt = now;
          updateData.resolution = resolution || 'Resolved';
          updateData.resolutionCategory = resolutionCategory;

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
          break;
      }
    }

    // Handle assignment updates
    if (assignedOpsId !== undefined) {
      updateData.assignedOpsId = assignedOpsId;
    }
    if (assignedDriverId !== undefined) {
      updateData.assignedDriverId = assignedDriverId;
    }
    if (resolution !== undefined) {
      updateData.resolution = resolution;
    }
    if (resolutionCategory !== undefined) {
      updateData.resolutionCategory = resolutionCategory;
    }

    // Update the incident
    const updatedIncident = await db.incident.update({
      where: { id },
      data: updateData,
    });

    console.log(`[Incident] Updated ${id}: ${JSON.stringify(updateData)}`);

    // Send notification for resolution
    if (status === 'RESOLVED') {
      // Get device location for notifications
      const deviceRecord = await db.device.findUnique({
        where: { deviceId: updatedIncident.deviceId },
        select: { location: true },
      });
      const displayName = deviceRecord?.location || updatedIncident.deviceName;

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
${updatedIncident.slaOutcome === 'WITHIN_SLA' ? '⏱️ Resolved within SLA' : '⚠️ SLA was breached'}`;
      await sendAlert(telegramMessage, 'incident_resolved');
    }

    return NextResponse.json({
      success: true,
      incident: updatedIncident,
    });
  } catch (error) {
    console.error('[Incident] Error updating incident:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
