import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';

export async function POST() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clerkClient();

    // Get current user
    const user = await client.users.getUser(userId);

    // Update publicMetadata to mark password as changed
    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        ...user.publicMetadata,
        requirePasswordChange: false,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Password change status updated',
    });
  } catch (error) {
    console.error('Error updating password change status:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
