import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/admin/groups - List all groups with device count
export async function GET(request) {
  try {
    const groups = await db.group.findMany({
      include: {
        _count: {
          select: { devices: true }
        },
        devices: {
          select: {
            id: true,
            deviceId: true,
            deviceName: true,
          }
        }
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      success: true,
      groups: groups.map(g => ({
        ...g,
        deviceCount: g._count.devices,
      })),
      count: groups.length,
    });
  } catch (error) {
    console.error('Error fetching groups:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/admin/groups - Create a new group
export async function POST(request) {
  try {
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      );
    }

    const group = await db.group.create({
      data: { name },
    });

    return NextResponse.json({
      success: true,
      message: 'Group created successfully',
      group,
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Group name already exists' },
        { status: 409 }
      );
    }
    console.error('Error creating group:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/admin/groups - Delete a group
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('id');

    if (!groupId) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      );
    }

    // First, unassign all devices from this group
    await db.device.updateMany({
      where: { groupId },
      data: { groupId: null },
    });

    // Then delete the group
    await db.group.delete({
      where: { id: groupId },
    });

    return NextResponse.json({
      success: true,
      message: 'Group deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting group:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/admin/groups - Assign devices to a group
export async function PATCH(request) {
  try {
    const body = await request.json();
    const { groupId, deviceIds } = body;

    if (!groupId) {
      return NextResponse.json(
        { error: 'groupId is required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(deviceIds)) {
      return NextResponse.json(
        { error: 'deviceIds must be an array' },
        { status: 400 }
      );
    }

    // Update devices to belong to this group
    await db.device.updateMany({
      where: { id: { in: deviceIds } },
      data: { groupId },
    });

    return NextResponse.json({
      success: true,
      message: `${deviceIds.length} device(s) assigned to group`,
    });
  } catch (error) {
    console.error('Error assigning devices:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
