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

// GET /api/admin/users - List all users (from DB, synced with Clerk)
export async function GET() {
  try {
    // Get users from database
    const dbUsers = await db.user.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // If no users in DB, sync from Clerk
    if (dbUsers.length === 0) {
      const client = await clerkClient();
      const clerkUsers = await client.users.getUserList({ limit: 100 });

      // Sync Clerk users to DB
      for (const user of clerkUsers.data) {
        // Skip users without username
        if (!user.username) continue;

        await db.user.upsert({
          where: { clerkId: user.id },
          update: {
            username: user.username,
            firstName: user.firstName || null,
            lastName: user.lastName || null,
            role: mapRoleToEnum(user.publicMetadata?.role),
            imageUrl: user.imageUrl || null,
            lastSignInAt: user.lastSignInAt ? new Date(user.lastSignInAt) : null,
          },
          create: {
            clerkId: user.id,
            username: user.username,
            firstName: user.firstName || null,
            lastName: user.lastName || null,
            role: mapRoleToEnum(user.publicMetadata?.role),
            imageUrl: user.imageUrl || null,
            lastSignInAt: user.lastSignInAt ? new Date(user.lastSignInAt) : null,
          },
        });
      }

      // Fetch again after sync
      const syncedUsers = await db.user.findMany({
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json({
        success: true,
        users: syncedUsers,
        synced: true,
      });
    }

    return NextResponse.json({
      success: true,
      users: dbUsers,
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/admin/users - Create a new user (in Clerk and DB)
export async function POST(request) {
  try {
    const body = await request.json();
    const { username, firstName, lastName, password, role, phone, loginPin } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Validate loginPin for drivers
    if (role === 'driver' && loginPin) {
      if (!/^\d{4}$/.test(loginPin)) {
        return NextResponse.json(
          { error: 'Login PIN must be exactly 4 digits' },
          { status: 400 }
        );
      }

      // Check if PIN is already in use
      const existingPin = await db.user.findFirst({
        where: { loginPin },
      });
      if (existingPin) {
        return NextResponse.json(
          { error: 'This PIN is already in use by another driver' },
          { status: 400 }
        );
      }
    }

    const client = await clerkClient();

    // Create user in Clerk with username
    // Set requirePasswordChange to true so user must change password on first login
    const clerkUser = await client.users.createUser({
      username,
      firstName: firstName || '',
      lastName: lastName || '',
      password,
      publicMetadata: {
        role: role || 'franchisee',
        requirePasswordChange: true,
      },
    });

    // Create user in database
    const dbUser = await db.user.create({
      data: {
        clerkId: clerkUser.id,
        username: clerkUser.username || username,
        firstName: firstName || null,
        lastName: lastName || null,
        role: mapRoleToEnum(role),
        phone: phone || null,
        imageUrl: clerkUser.imageUrl || null,
        loginPin: role === 'driver' ? loginPin || null : null,
      },
    });

    return NextResponse.json({
      success: true,
      user: dbUser,
    });
  } catch (error) {
    console.error('Error creating user:', error);

    // If Clerk user was created but DB failed, we should handle this
    // For now, just return the error
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
