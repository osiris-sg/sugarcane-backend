import { NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';

// GET /api/admin/users - List all users
export async function GET() {
  try {
    const client = await clerkClient();
    const users = await client.users.getUserList({ limit: 100 });

    const formattedUsers = users.data.map(user => ({
      id: user.id,
      email: user.emailAddresses[0]?.emailAddress || '',
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      role: user.publicMetadata?.role || 'franchisee',
      imageUrl: user.imageUrl,
      createdAt: user.createdAt,
      lastSignInAt: user.lastSignInAt,
    }));

    return NextResponse.json({
      success: true,
      users: formattedUsers,
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/admin/users - Create a new user
export async function POST(request) {
  try {
    const body = await request.json();
    const { email, firstName, lastName, password, role } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const client = await clerkClient();

    // Create user in Clerk
    const user = await client.users.createUser({
      emailAddress: [email],
      firstName: firstName || '',
      lastName: lastName || '',
      password,
      publicMetadata: {
        role: role || 'franchisee',
      },
    });

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
    console.error('Error creating user:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
