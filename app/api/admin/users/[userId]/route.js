import { NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Map role string to enum value
function mapRoleToEnum(role) {
  const roleMap = {
    admin: 'ADMIN',
    manager: 'MANAGER',
    franchisee: 'FRANCHISEE',
    driver: 'DRIVER',
  };
  return roleMap[role?.toLowerCase()] || 'FRANCHISEE';
}

// GET /api/admin/users/[userId] - Get a single user
export async function GET(request, { params }) {
  try {
    const { userId } = await params;

    // Try to get from DB first
    const dbUser = await db.user.findFirst({
      where: {
        OR: [
          { id: userId },
          { clerkId: userId },
        ],
      },
    });

    if (dbUser) {
      return NextResponse.json({
        success: true,
        user: dbUser,
      });
    }

    // Fallback to Clerk
    const client = await clerkClient();
    const user = await client.users.getUser(userId);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        clerkId: user.id,
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
    const { role, firstName, lastName, phone, isActive } = body;

    const client = await clerkClient();

    // Find user in DB to get clerkId
    const dbUser = await db.user.findFirst({
      where: {
        OR: [
          { id: userId },
          { clerkId: userId },
        ],
      },
    });

    const clerkId = dbUser?.clerkId || userId;

    // Update Clerk
    const clerkUpdateData = {};
    if (firstName !== undefined) clerkUpdateData.firstName = firstName;
    if (lastName !== undefined) clerkUpdateData.lastName = lastName;
    if (role !== undefined) {
      clerkUpdateData.publicMetadata = { role };
    }

    if (Object.keys(clerkUpdateData).length > 0) {
      await client.users.updateUser(clerkId, clerkUpdateData);
    }

    // Update DB
    const dbUpdateData = {};
    if (firstName !== undefined) dbUpdateData.firstName = firstName;
    if (lastName !== undefined) dbUpdateData.lastName = lastName;
    if (role !== undefined) dbUpdateData.role = mapRoleToEnum(role);
    if (phone !== undefined) dbUpdateData.phone = phone;
    if (isActive !== undefined) dbUpdateData.isActive = isActive;

    let updatedUser;
    if (dbUser) {
      updatedUser = await db.user.update({
        where: { id: dbUser.id },
        data: dbUpdateData,
      });
    }

    return NextResponse.json({
      success: true,
      user: updatedUser || { clerkId, ...dbUpdateData },
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

    // Find user in DB to get clerkId
    const dbUser = await db.user.findFirst({
      where: {
        OR: [
          { id: userId },
          { clerkId: userId },
        ],
      },
    });

    const clerkId = dbUser?.clerkId || userId;

    // Delete from Clerk
    await client.users.deleteUser(clerkId);

    // Delete from DB
    if (dbUser) {
      await db.user.delete({
        where: { id: dbUser.id },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
