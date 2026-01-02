import { NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';

// GET /api/debug/clerk - Debug Clerk configuration
export async function GET() {
  try {
    console.log('[Debug Clerk] Checking environment...');

    const envCheck = {
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? 'SET' : 'MISSING',
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY ? 'SET' : 'MISSING',
      NEXT_PUBLIC_CLERK_SIGN_IN_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || 'NOT SET',
      NEXT_PUBLIC_CLERK_SIGN_UP_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL || 'NOT SET',
      NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL || 'NOT SET',
      NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL || 'NOT SET',
    };

    console.log('[Debug Clerk] Environment:', envCheck);

    // Try to fetch users to verify Clerk connection
    const client = await clerkClient();
    const users = await client.users.getUserList({ limit: 5 });

    console.log('[Debug Clerk] Found', users.data.length, 'users');

    const userSummary = users.data.map(u => ({
      id: u.id,
      username: u.username,
      email: u.emailAddresses[0]?.emailAddress,
      firstName: u.firstName,
      lastName: u.lastName,
      createdAt: u.createdAt,
    }));

    return NextResponse.json({
      success: true,
      environment: envCheck,
      clerkConnection: 'OK',
      users: userSummary,
    });
  } catch (error) {
    console.error('[Debug Clerk] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}
