import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';

// GET /api/me/roles - Get current user's roles from database
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const user = await db.user.findFirst({
      where: { clerkId: userId },
      select: {
        id: true,
        role: true, // Legacy role field
        roles: {
          select: { role: true }
        },
        isActive: true,
      },
    });

    if (!user) {
      return NextResponse.json({
        success: true,
        roles: [],
        isAdmin: false,
        isDriver: false,
        isOpsManager: false,
      });
    }

    // Combine legacy role with roles table
    const allRoles = new Set();

    // Add legacy role if exists
    if (user.role) {
      allRoles.add(user.role);
    }

    // Add roles from roles table
    user.roles?.forEach(r => allRoles.add(r.role));

    const rolesArray = Array.from(allRoles);

    // Compute convenience flags
    const isAdmin = rolesArray.some(r => ['ADMIN', 'MANAGER'].includes(r));
    const isDriver = rolesArray.includes('DRIVER');
    const isOpsManager = rolesArray.includes('OPS_MANAGER');

    return NextResponse.json({
      success: true,
      roles: rolesArray,
      isAdmin,
      isDriver,
      isOpsManager,
      isActive: user.isActive,
    });
  } catch (error) {
    console.error('[Me/Roles] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
