import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { sendPushNotificationToAdmins } from '@/lib/push-notifications';

// POST /api/penalties/[id]/appeal - Submit or update an appeal
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { appealNotes, action } = body;
    // For approve/reject, appealNotes contains admin remarks

    // Get current user info for notification
    const { userId: clerkId } = await auth();
    let currentUser = null;
    if (clerkId) {
      currentUser = await db.user.findUnique({
        where: { clerkId },
        select: { firstName: true, lastName: true, username: true },
      });
    }

    const penalty = await db.penalty.findUnique({
      where: { id },
    });

    // Get incident details for notification
    let incident = null;
    if (penalty?.incidentId) {
      incident = await db.incident.findUnique({
        where: { id: penalty.incidentId },
        select: { deviceName: true, deviceId: true, type: true },
      });
    }

    if (!penalty) {
      return NextResponse.json(
        { success: false, error: 'Penalty not found' },
        { status: 404 }
      );
    }

    let updateData = {};

    switch (action) {
      case 'submit':
        // Submit a new appeal
        if (penalty.appealStatus !== 'none') {
          return NextResponse.json(
            { success: false, error: 'Appeal already submitted' },
            { status: 400 }
          );
        }
        updateData = {
          appealStatus: 'pending',
          appealNotes: appealNotes || '',
        };

        // Send notification to admins about the new appeal
        const userName = currentUser
          ? (currentUser.firstName && currentUser.lastName
              ? `${currentUser.firstName} ${currentUser.lastName}`
              : currentUser.username || 'A user')
          : 'A user';
        const deviceName = incident?.deviceName || 'Unknown device';

        await sendPushNotificationToAdmins({
          title: '📝 New Penalty Appeal',
          body: `${userName} submitted an appeal for ${deviceName}`,
          url: '/dashboard/operations/penalties?appealStatus=pending',
          tag: `appeal-${id}`,
          data: { penaltyId: id, type: 'appeal_submitted' },
        });
        break;

      case 'approve':
        // Approve the appeal (admin only)
        if (penalty.appealStatus !== 'pending') {
          return NextResponse.json(
            { success: false, error: 'No pending appeal to approve' },
            { status: 400 }
          );
        }
        updateData = {
          appealStatus: 'approved',
          adminRemarks: appealNotes || null, // Store admin remarks separately
        };

        // Clear penalty flag on incident
        await db.incident.update({
          where: { id: penalty.incidentId },
          data: { penaltyFlag: false },
        });
        break;

      case 'reject':
        // Reject the appeal (admin only)
        if (penalty.appealStatus !== 'pending') {
          return NextResponse.json(
            { success: false, error: 'No pending appeal to reject' },
            { status: 400 }
          );
        }
        updateData = {
          appealStatus: 'rejected',
          adminRemarks: appealNotes || null, // Store admin remarks separately
        };
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action. Use: submit, approve, or reject' },
          { status: 400 }
        );
    }

    const updatedPenalty = await db.penalty.update({
      where: { id },
      data: updateData,
    });

    console.log(`[Penalty] ${action} appeal for ${id}: ${JSON.stringify(updateData)}`);

    return NextResponse.json({
      success: true,
      penalty: updatedPenalty,
    });
  } catch (error) {
    console.error('[Penalty] Error handling appeal:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
