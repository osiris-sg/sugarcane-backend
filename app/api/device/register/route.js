import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/device/register - Pair a hardware ID with a device ID
export async function POST(request) {
  try {
    const body = await request.json();
    const { hardwareId, deviceId } = body;

    // Validate required fields
    if (!hardwareId) {
      return NextResponse.json(
        { success: false, error: 'Hardware ID is required' },
        { status: 400 }
      );
    }

    if (!deviceId) {
      return NextResponse.json(
        { success: false, error: 'Device ID is required' },
        { status: 400 }
      );
    }

    // Find the device by deviceId
    const device = await db.device.findUnique({
      where: { deviceId },
    });

    if (!device) {
      return NextResponse.json(
        { success: false, error: 'Device not found' },
        { status: 404 }
      );
    }

    // Check if hardware ID is already registered to another device
    const existingDevice = await db.device.findFirst({
      where: {
        terminalId: String(hardwareId),
        NOT: { deviceId },
      },
    });

    if (existingDevice) {
      return NextResponse.json(
        {
          success: false,
          error: `Hardware ID is already registered to ${existingDevice.location || existingDevice.deviceName} (${existingDevice.deviceId})`,
        },
        { status: 400 }
      );
    }

    // Update the device with the hardware ID (terminalId)
    const updatedDevice = await db.device.update({
      where: { deviceId },
      data: {
        terminalId: String(hardwareId),
      },
    });

    // Update the pending registration record
    await db.pendingDeviceRegistration.upsert({
      where: { hardwareId: String(hardwareId) },
      update: {
        registeredAt: new Date(),
        deviceId,
      },
      create: {
        hardwareId: String(hardwareId),
        registeredAt: new Date(),
        deviceId,
      },
    });

    console.log(`[DeviceRegister] Paired hardware ${hardwareId} with device ${deviceId} (${device.location || device.deviceName})`);

    return NextResponse.json({
      success: true,
      message: 'Device registered successfully',
      device: {
        deviceId: updatedDevice.deviceId,
        deviceName: updatedDevice.deviceName,
        location: updatedDevice.location,
        terminalId: updatedDevice.terminalId,
      },
    });
  } catch (error) {
    console.error('[DeviceRegister] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// GET /api/device/register - Get pending registrations
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const hardwareId = searchParams.get('hardwareId');

    if (hardwareId) {
      // Get specific pending registration
      const pending = await db.pendingDeviceRegistration.findUnique({
        where: { hardwareId: String(hardwareId) },
      });

      return NextResponse.json({
        success: true,
        pending,
      });
    }

    // Get all pending (unregistered) hardware IDs
    const pendingRegistrations = await db.pendingDeviceRegistration.findMany({
      where: { registeredAt: null },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      pendingRegistrations,
    });
  } catch (error) {
    console.error('[DeviceRegister] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
