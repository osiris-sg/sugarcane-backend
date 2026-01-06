import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendAlert } from '@/lib/telegram';

// GET /api/maintenance/activity/[id] - Get a specific activity
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    const activity = await db.maintenanceActivity.findUnique({
      where: { id }
    });

    if (!activity) {
      return NextResponse.json(
        { success: false, error: 'Activity not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      activity
    });

  } catch (error) {
    console.error('[Activity] Error fetching activity:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// PATCH /api/maintenance/activity/[id] - Complete an activity
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, status: newStatus, notes } = body;

    // Fetch the current activity
    const activity = await db.maintenanceActivity.findUnique({
      where: { id }
    });

    if (!activity) {
      return NextResponse.json(
        { success: false, error: 'Activity not found' },
        { status: 404 }
      );
    }

    if (activity.status !== 'in_progress') {
      return NextResponse.json(
        { success: false, error: 'Activity is not in progress' },
        { status: 400 }
      );
    }

    if (action !== 'complete') {
      return NextResponse.json(
        { success: false, error: 'action must be "complete"' },
        { status: 400 }
      );
    }

    if (!newStatus || !['completed', 'unresolved'].includes(newStatus)) {
      return NextResponse.json(
        { success: false, error: 'status must be "completed" or "unresolved"' },
        { status: 400 }
      );
    }

    const now = new Date();
    const durationMs = now.getTime() - new Date(activity.startedAt).getTime();

    // Update the activity
    const updatedActivity = await db.maintenanceActivity.update({
      where: { id },
      data: {
        completedAt: now,
        durationMs,
        status: newStatus,
        notes
      }
    });

    const typeLabel = activity.activityType === 'clean_wash' ? 'Clean/Wash Down' : 'Customer Feedback';
    const durationFormatted = formatDuration(durationMs);

    console.log(`[Activity] ${typeLabel} ${newStatus} for ${activity.deviceName} in ${durationFormatted}`);

    // Send notification
    const icon = newStatus === 'completed' ? '✅' : '🚨';
    const message = `${icon} ${typeLabel.toUpperCase()} ${newStatus.toUpperCase()}

📍 ${activity.deviceName}
🎯 Device ID: ${activity.deviceId}
⏱️ Duration: ${durationFormatted}

${newStatus === 'unresolved' ? '📢 Issue escalated to manager. Machine set to Out of Service.' : ''}`;

    try {
      await sendAlert(message);
    } catch (err) {
      console.error('[Activity] Failed to send notification:', err);
    }

    return NextResponse.json({
      success: true,
      activity: updatedActivity,
      durationMs,
      durationFormatted
    });

  } catch (error) {
    console.error('[Activity] Error updating activity:', error);
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
