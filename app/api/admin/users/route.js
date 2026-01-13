import { NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Map role string to enum value
function mapRoleToEnum(role) {
  const roleMap = {
    admin: 'ADMIN',
    manager: 'MANAGER',
    finance: 'FINANCE',
    franchisee: 'FRANCHISEE',
    driver: 'DRIVER',
    partnerships: 'PARTNERSHIPS',
  };
  return roleMap[role?.toLowerCase()] || 'FRANCHISEE';
}

// GET /api/admin/users - List all users (from DB, with fresh lastSignInAt from Clerk)
export async function GET() {
  try {
    // Get users from database with their group info
    const dbUsers = await db.user.findMany({
      include: { group: true },
      orderBy: { createdAt: 'desc' },
    });

    const client = await clerkClient();

    // If no users in DB, sync from Clerk
    if (dbUsers.length === 0) {
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
        include: { group: true },
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json({
        success: true,
        users: syncedUsers,
        synced: true,
      });
    }

    // Fetch fresh lastSignInAt from Clerk for all users
    const clerkIds = dbUsers.map(u => u.clerkId).filter(Boolean);
    const clerkUsersMap = {};

    // Fetch Clerk users in batches (Clerk API returns user list)
    if (clerkIds.length > 0) {
      try {
        const clerkUsers = await client.users.getUserList({
          userId: clerkIds,
          limit: 100
        });

        for (const clerkUser of clerkUsers.data) {
          clerkUsersMap[clerkUser.id] = {
            lastSignInAt: clerkUser.lastSignInAt,
            imageUrl: clerkUser.imageUrl,
          };
        }
      } catch (clerkError) {
        console.error('Error fetching Clerk users:', clerkError);
        // Continue with DB data if Clerk fetch fails
      }
    }

    // Merge Clerk data with DB data
    const usersWithClerkData = dbUsers.map(dbUser => ({
      ...dbUser,
      lastSignInAt: clerkUsersMap[dbUser.clerkId]?.lastSignInAt || dbUser.lastSignInAt,
      imageUrl: clerkUsersMap[dbUser.clerkId]?.imageUrl || dbUser.imageUrl,
    }));

    return NextResponse.json({
      success: true,
      users: usersWithClerkData,
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

    // Validate username format (lowercase, no spaces, no @)
    if (username.includes('@')) {
      return NextResponse.json(
        { error: 'Username cannot contain @. Use a simple username like "johndoe"' },
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

    // Create user in Clerk
    // Set requirePasswordChange to true so user must change password on first login
    const clerkUserData = {
      firstName: firstName || '',
      lastName: lastName || '',
      password,
      publicMetadata: {
        role: role || 'franchisee',
        requirePasswordChange: true,
      },
    };

    clerkUserData.username = username;

    console.log('[CreateUser] Creating Clerk user:', username);

    const clerkUser = await client.users.createUser(clerkUserData);

    // For franchisee role, create a Group (franchisee business) and link the user
    let groupId = null;
    if (role === 'franchisee') {
      // Create franchisee name from firstName + lastName, or fallback to username
      const franchiseeName = [firstName, lastName].filter(Boolean).join(' ') || username;

      // Create the Group (franchisee)
      const group = await db.group.create({
        data: {
          name: franchiseeName,
        },
      });
      groupId = group.id;
      console.log(`[CreateUser] Created franchisee group: ${franchiseeName} (${group.id})`);
    }

    // Create user in database
    const dbUsername = clerkUser.username || username;

    const dbUser = await db.user.create({
      data: {
        clerkId: clerkUser.id,
        username: dbUsername,
        firstName: firstName || null,
        lastName: lastName || null,
        role: mapRoleToEnum(role),
        phone: phone || null,
        imageUrl: clerkUser.imageUrl || null,
        loginPin: role === 'driver' ? loginPin || null : null,
        groupId: groupId,
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
