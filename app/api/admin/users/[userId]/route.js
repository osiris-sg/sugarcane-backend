import { NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Map role string to enum value
function mapRoleToEnum(role) {
  const roleMap = {
    admin: 'ADMIN',
    owner: 'ADMIN',
    manager: 'MANAGER',
    opsmanager: 'OPS_MANAGER',
    ops_manager: 'OPS_MANAGER',
    finance: 'FINANCE',
    franchisee: 'FRANCHISEE',
    driver: 'DRIVER',
    partnerships: 'PARTNERSHIPS',
    adminops: 'ADMINOPS',
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
      include: {
        group: true,
        managedDrivers: {
          include: {
            driver: {
              select: {
                id: true,
                clerkId: true,
                firstName: true,
                lastName: true,
                username: true,
              },
            },
          },
        },
        assignedOpsManagers: {
          include: {
            opsManager: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
              },
            },
          },
        },
      },
    });

    if (dbUser) {
      // Transform for frontend compatibility
      const transformedUser = {
        ...dbUser,
        assignedDrivers: dbUser.managedDrivers?.map(md => md.driver) || [],
        opsManagers: dbUser.assignedOpsManagers?.map(ao => ao.opsManager) || [],
      };

      return NextResponse.json({
        success: true,
        user: transformedUser,
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
    const { role, firstName, lastName, phone, isActive, groupId, createNewGroup, assignedDriverIds } = body;

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

    // Handle group assignment for franchisees
    let finalGroupId = groupId;
    if (createNewGroup && (role === 'franchisee' || dbUser?.role === 'FRANCHISEE')) {
      // Create a new group using user's name
      const userName = [firstName || dbUser?.firstName, lastName || dbUser?.lastName].filter(Boolean).join(' ') ||
                       dbUser?.username || 'New Franchisee';
      const newGroup = await db.group.create({
        data: { name: userName },
      });
      finalGroupId = newGroup.id;
      console.log(`[UpdateUser] Created new franchisee group: ${userName} (${newGroup.id})`);
    }

    // Update DB
    const dbUpdateData = {};
    if (firstName !== undefined) dbUpdateData.firstName = firstName;
    if (lastName !== undefined) dbUpdateData.lastName = lastName;
    if (role !== undefined) dbUpdateData.role = mapRoleToEnum(role);
    if (phone !== undefined) dbUpdateData.phone = phone;
    if (isActive !== undefined) dbUpdateData.isActive = isActive;
    if (finalGroupId !== undefined) dbUpdateData.groupId = finalGroupId || null;

    let updatedUser;
    if (dbUser) {
      updatedUser = await db.user.update({
        where: { id: dbUser.id },
        data: dbUpdateData,
        include: {
          group: true,
          managedDrivers: {
            include: {
              driver: {
                select: {
                  id: true,
                  clerkId: true,
                  firstName: true,
                  lastName: true,
                  username: true,
                },
              },
            },
          },
        },
      });

      // Handle assigned drivers for ops managers using join table
      if (assignedDriverIds !== undefined) {
        // Delete existing assignments
        await db.opsManagerDriver.deleteMany({
          where: { opsManagerId: dbUser.id },
        });

        // Create new assignments
        if (assignedDriverIds.length > 0) {
          await db.opsManagerDriver.createMany({
            data: assignedDriverIds.map(driverId => ({
              opsManagerId: dbUser.id,
              driverId,
            })),
            skipDuplicates: true,
          });
        }

        // Refetch to get updated assignments
        updatedUser = await db.user.findUnique({
          where: { id: dbUser.id },
          include: {
            group: true,
            managedDrivers: {
              include: {
                driver: {
                  select: {
                    id: true,
                    clerkId: true,
                    firstName: true,
                    lastName: true,
                    username: true,
                  },
                },
              },
            },
          },
        });
      }
    }

    // Transform for frontend compatibility
    const transformedUser = updatedUser ? {
      ...updatedUser,
      assignedDrivers: updatedUser.managedDrivers?.map(md => md.driver) || [],
    } : { clerkId, ...dbUpdateData };

    return NextResponse.json({
      success: true,
      user: transformedUser,
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
