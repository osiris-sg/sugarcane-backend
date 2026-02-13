import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// PATCH /api/admin/devices/[deviceId] - Update specific device fields
export async function PATCH(request, { params }) {
  try {
    const { deviceId } = await params;
    const body = await request.json();

    if (!deviceId) {
      return NextResponse.json(
        { error: 'deviceId is required' },
        { status: 400 }
      );
    }

    // Find the device first
    const existingDevice = await db.device.findFirst({
      where: { deviceId },
    });

    if (!existingDevice) {
      return NextResponse.json(
        { error: 'Device not found' },
        { status: 404 }
      );
    }

    // Build update data from allowed fields
    const updateData = {};

    if (body.zeroSalesAlert !== undefined) {
      updateData.zeroSalesAlert = body.zeroSalesAlert;
    }

    if (body.isActive !== undefined) {
      updateData.isActive = body.isActive;
    }

    if (body.location !== undefined) {
      updateData.location = body.location;
    }

    if (body.deviceName !== undefined) {
      updateData.deviceName = body.deviceName;
    }

    // Update the device
    const updatedDevice = await db.device.update({
      where: { deviceId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      device: updatedDevice,
    });
  } catch (error) {
    console.error('Error updating device:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
