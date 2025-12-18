import { NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';

// GET /api/admin/users/[userId] - Get a single user
export async function GET(request, { params }) {
  try {
    const { userId } = await params;
    const client = await clerkClient();
    const user = await client.users.getUser(userId);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        role: user.publicMetadata?.role || 'franchisee',
        imageUrl: user.imageUrl,
        createdAt: user.createdAt,
        lastSignInAt: user.lastSignInAt,
      },
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/admin/users/[userId] - Update user (role, name, etc.)
export async function PATCH(request, { params }) {
  try {
    const { userId } = await params;
    const body = await request.json();
    const { role, firstName, lastName } = body;

    const client = await clerkClient();

    const updateData = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (role !== undefined) {
      updateData.publicMetadata = { role };
    }

    const user = await client.users.updateUser(userId, updateData);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.publicMetadata?.role,
      },
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/admin/users/[userId] - Delete a user
export async function DELETE(request, { params }) {
  try {
    const { userId } = await params;
    const client = await clerkClient();

    await client.users.deleteUser(userId);

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
