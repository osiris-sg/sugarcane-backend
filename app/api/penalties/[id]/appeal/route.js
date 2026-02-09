import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/penalties/[id]/appeal - Submit or update an appeal
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { appealNotes, action } = body;

    const penalty = await db.penalty.findUnique({
      where: { id },
    });

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
          appealNotes: appealNotes || penalty.appealNotes,
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
          appealNotes: appealNotes || penalty.appealNotes,
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
