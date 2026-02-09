import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendAlert } from '@/lib/telegram';

// GET /api/maintenance/issue/[id] - Get a specific issue
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    const issue = await db.issue.findUnique({
      where: { id }
    });

    if (!issue) {
      return NextResponse.json(
        { success: false, error: 'Issue not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      issue
    });

  } catch (error) {
    console.error('[Issue] Error fetching issue:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// PATCH /api/maintenance/issue/[id] - Update issue status (respond or resolve)
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, resolution } = body;

    // Fetch the current issue
    const issue = await db.issue.findUnique({
      where: { id }
    });

    if (!issue) {
      return NextResponse.json(
        { success: false, error: 'Issue not found' },
        { status: 404 }
      );
    }

    const now = new Date();
    let updateData = {};
    let kpis = {};

    if (action === 'respond') {
      // Staff clicked "Checking"
      if (issue.status !== 'OPEN') {
        return NextResponse.json(
          { success: false, error: 'Issue is not in OPEN status' },
          { status: 400 }
        );
      }

      const responseTimeMs = now.getTime() - new Date(issue.triggeredAt).getTime();

      updateData = {
        status: 'CHECKING',
        respondedAt: now,
        responseTimeMs
      };

      kpis = {
        responseTimeMs,
        responseTimeFormatted: formatDuration(responseTimeMs)
      };

      console.log(`[Issue] Staff responded to ${issue.type} issue ${id} in ${kpis.responseTimeFormatted}`);

    } else if (action === 'resolve') {
      // Staff clicked "Resolved" or "Unresolved"
      if (!['OPEN', 'CHECKING'].includes(issue.status)) {
        return NextResponse.json(
          { success: false, error: 'Issue is not in OPEN or CHECKING status' },
          { status: 400 }
        );
      }

      if (!resolution || !['resolved', 'unresolved'].includes(resolution)) {
        return NextResponse.json(
          { success: false, error: 'resolution must be "resolved" or "unresolved"' },
          { status: 400 }
        );
      }

      const respondedAt = issue.respondedAt || now;
      const resolutionTimeMs = now.getTime() - new Date(respondedAt).getTime();
      const responseTimeMs = issue.responseTimeMs || (now.getTime() - new Date(issue.triggeredAt).getTime());

      updateData = {
        status: resolution === 'resolved' ? 'RESOLVED' : 'UNRESOLVED',
        resolvedAt: now,
        resolutionTimeMs,
        resolution,
        // If they didn't click "Checking" first, record response time now
        respondedAt: issue.respondedAt || now,
        responseTimeMs: issue.responseTimeMs || responseTimeMs
      };

      kpis = {
        responseTimeMs: updateData.responseTimeMs,
        responseTimeFormatted: formatDuration(updateData.responseTimeMs),
        resolutionTimeMs,
        resolutionTimeFormatted: formatDuration(resolutionTimeMs),
        totalTimeMs: now.getTime() - new Date(issue.triggeredAt).getTime(),
        totalTimeFormatted: formatDuration(now.getTime() - new Date(issue.triggeredAt).getTime())
      };

      console.log(`[Issue] Issue ${id} ${resolution} in ${kpis.totalTimeFormatted}`);

      // Send notification based on resolution
      const typeLabel = issue.type === 'DEVICE_ERROR' ? 'Device Error' : 'Zero Sales';
      const icon = resolution === 'resolved' ? '✅' : '🚨';

      const message = `${icon} ${typeLabel.toUpperCase()} ${resolution.toUpperCase()}

📍 ${issue.deviceName}
🎯 Device ID: ${issue.deviceId}
${issue.faultCode ? `⚠️ Fault: ${issue.faultCode} - ${issue.faultName}` : ''}
${issue.timeBlock ? `📊 Time Block: ${issue.timeBlock}` : ''}

⏱️ Response Time: ${kpis.responseTimeFormatted}
⏱️ Resolution Time: ${kpis.resolutionTimeFormatted}
⏱️ Total Time: ${kpis.totalTimeFormatted}

${resolution === 'unresolved' ? '📢 Issue escalated to manager. Machine set to Out of Service.' : ''}`;

      try {
        await sendAlert(message);
      } catch (err) {
        console.error('[Issue] Failed to send notification:', err);
      }

    } else {
      return NextResponse.json(
        { success: false, error: 'action must be "respond" or "resolve"' },
        { status: 400 }
      );
    }

    // Update the issue
    const updatedIssue = await db.issue.update({
      where: { id },
      data: updateData
    });

    // Also update corresponding Incident (if exists)
    const matchingIncident = await db.incident.findFirst({
      where: {
        deviceId: issue.deviceId,
        type: 'ERROR_NOTIFICATION',
        faultCode: issue.faultCode,
        status: { in: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'] }
      }
    });

    if (matchingIncident) {
      let incidentUpdate = {};

      if (action === 'respond') {
        incidentUpdate = {
          status: 'ACKNOWLEDGED',
          acknowledgedAt: now,
        };
      } else if (action === 'resolve') {
        // Check if within SLA
        const wasWithinSla = matchingIncident.slaDeadline && now <= new Date(matchingIncident.slaDeadline);

        incidentUpdate = {
          status: 'RESOLVED',
          resolvedAt: now,
          resolution: resolution === 'resolved' ? 'Resolved by staff' : 'Marked unresolved by staff',
          slaOutcome: wasWithinSla ? 'WITHIN_SLA' : 'SLA_BREACHED',
        };

        // Create penalty if SLA breached and not already flagged
        if (!wasWithinSla && !matchingIncident.penaltyFlag) {
          await db.penalty.create({
            data: {
              incidentId: matchingIncident.id,
              reason: 'SLA breached - resolved after 3 hour deadline',
            }
          });
          incidentUpdate.penaltyFlag = true;
        }
      }

      await db.incident.update({
        where: { id: matchingIncident.id },
        data: incidentUpdate
      });

      console.log(`[Issue] Also updated incident ${matchingIncident.id}`);
    }

    return NextResponse.json({
      success: true,
      issue: updatedIssue,
      kpis
    });

  } catch (error) {
    console.error('[Issue] Error updating issue:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// Helper function to format milliseconds to human-readable duration
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}
