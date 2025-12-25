import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/maintenance/users - Get all active maintenance users (for app to fetch PINs)
export async function GET(request) {
  try {
    const users = await db.maintenanceUser.findMany({
      where: {
        isActive: true
      },
      select: {
        id: true,
        name: true,
        pin: true,
        role: true
      },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json({
      success: true,
      users,
      count: users.length
    });

  } catch (error) {
    console.error('[MaintenanceUsers] Error fetching users:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST /api/maintenance/users - Create a new maintenance user
export async function POST(request) {
  try {
    const body = await request.json();
    const { name, pin, role, clerkUserId, adminKey } = body;

    // Simple admin key protection
    if (adminKey !== 'sugarcane123') {
      return NextResponse.json(
        { success: false, error: 'Invalid admin key' },
        { status: 401 }
      );
    }

    if (!name || !pin) {
      return NextResponse.json(
        { success: false, error: 'name and pin are required' },
        { status: 400 }
      );
    }

    // Validate PIN format (4 digits)
    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        { success: false, error: 'PIN must be exactly 4 digits' },
        { status: 400 }
      );
    }

    // Check if PIN already exists
    const existingUser = await db.maintenanceUser.findFirst({
      where: { pin }
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'PIN already in use by another user' },
        { status: 409 }
      );
    }

    // Create the user
    const user = await db.maintenanceUser.create({
      data: {
        name,
        pin,
        role: role || 'driver',
        clerkUserId: clerkUserId || null
      }
    });

    console.log(`[MaintenanceUsers] Created user: ${name} with PIN: ${pin}`);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        role: user.role
      }
    });

  } catch (error) {
    console.error('[MaintenanceUsers] Error creating user:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// PUT /api/maintenance/users - Update a maintenance user
export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, name, pin, role, isActive, adminKey } = body;

    // Simple admin key protection
    if (adminKey !== 'sugarcane123') {
      return NextResponse.json(
        { success: false, error: 'Invalid admin key' },
        { status: 401 }
      );
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id is required' },
        { status: 400 }
      );
    }

    // If PIN is being updated, validate format
    if (pin && !/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        { success: false, error: 'PIN must be exactly 4 digits' },
        { status: 400 }
      );
    }

    // If PIN is being updated, check if it's already in use
    if (pin) {
      const existingUser = await db.maintenanceUser.findFirst({
        where: {
          pin,
          id: { not: id }
        }
      });

      if (existingUser) {
        return NextResponse.json(
          { success: false, error: 'PIN already in use by another user' },
          { status: 409 }
        );
      }
    }

    // Build update data
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (pin !== undefined) updateData.pin = pin;
    if (role !== undefined) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;

    const user = await db.maintenanceUser.update({
      where: { id },
      data: updateData
    });

    console.log(`[MaintenanceUsers] Updated user: ${user.name}`);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        isActive: user.isActive
      }
    });

  } catch (error) {
    console.error('[MaintenanceUsers] Error updating user:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/maintenance/users - Delete a maintenance user (soft delete)
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const adminKey = searchParams.get('adminKey');

    // Simple admin key protection
    if (adminKey !== 'sugarcane123') {
      return NextResponse.json(
        { success: false, error: 'Invalid admin key' },
        { status: 401 }
      );
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id is required' },
        { status: 400 }
      );
    }

    // Soft delete by setting isActive to false
    const user = await db.maintenanceUser.update({
      where: { id },
      data: { isActive: false }
    });

    console.log(`[MaintenanceUsers] Deactivated user: ${user.name}`);

    return NextResponse.json({
      success: true,
      message: `User ${user.name} has been deactivated`
    });

  } catch (error) {
    console.error('[MaintenanceUsers] Error deleting user:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
