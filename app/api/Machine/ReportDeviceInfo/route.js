import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { sendPushNotificationToRoles } from '@/lib/push-notifications';

// POST /api/Machine/ReportDeviceInfo
// Called by Android app on startup to report device info
// App sends Build.SERIAL as "deviceId" in JSON
// Backend finds Device row where terminalId = Build.SERIAL
// Returns deviceId, price, and drivers for PIN login
export async function POST(request) {
  try {
    const body = await request.json();
    const { deviceId, deviceType, secret, timestamp, appVersion, appVersionCode } = body;

    // deviceId from app is actually Build.SERIAL (hardware ID)
    const hardwareId = deviceId;

    // Validate required fields
    if (!hardwareId) {
      return NextResponse.json(
        { success: false, error: 'deviceId (hardware ID) is required' },
        { status: 400 }
      );
    }

    console.log(`[ReportDeviceInfo] Hardware ${hardwareId} reported: type=${deviceType}, secret=${secret ? '***' : 'none'}, timestamp=${timestamp}, appVersion=${appVersion}, appVersionCode=${appVersionCode}`);

    // Find device where terminalId matches the hardware ID (Build.SERIAL)
    let device = await db.device.findFirst({
      where: { terminalId: String(hardwareId) },
    });

    // Update version info if device found and version provided
    if (device && (appVersion || appVersionCode)) {
      device = await db.device.update({
        where: { id: device.id },
        data: {
          appVersion: appVersion || device.appVersion,
          appVersionCode: appVersionCode ? parseInt(appVersionCode) : device.appVersionCode,
          versionUpdatedAt: new Date(),
        },
      });
      console.log(`[ReportDeviceInfo] Updated device ${device.deviceId} version to ${appVersion} (${appVersionCode})`);
    }

    // Also fetch all drivers for PIN login
    const users = await db.user.findMany({
      where: {
        loginPin: { not: null },
        isActive: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        loginPin: true,
        username: true,
      },
    });

    // Format drivers for app (same format as /api/drivers)
    const drivers = users.map(user => ({
      id: user.id,
      name: user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.username,
      pin: user.loginPin,
    }));

    if (!device) {
      console.log(`[ReportDeviceInfo] No device found with terminalId=${hardwareId}`);

      // Check if this hardware ID is already in pending registrations
      const existingPending = await db.pendingDeviceRegistration.findUnique({
        where: { hardwareId: String(hardwareId) },
      });

      if (!existingPending) {
        // First time seeing this hardware ID - create pending registration and send notification
        const pending = await db.pendingDeviceRegistration.create({
          data: {
            hardwareId: String(hardwareId),
            notifiedAt: new Date(),
          },
        });

        // Send push notification to drivers and ops managers
        await sendPushNotificationToRoles({
          title: '📱 New Device Detected',
          body: `Are you installing a new app? Hardware ID: ${hardwareId}`,
          url: `/dashboard/operations/device-registration?hardwareId=${hardwareId}`,
        }, ['DRIVER', 'OPS_MANAGER']);

        console.log(`[ReportDeviceInfo] Created pending registration for hardware ${hardwareId} and sent notification`);
      } else if (!existingPending.registeredAt) {
        // Pending registration exists but not yet registered - update last seen
        await db.pendingDeviceRegistration.update({
          where: { id: existingPending.id },
          data: { updatedAt: new Date() },
        });
        console.log(`[ReportDeviceInfo] Updated pending registration for hardware ${hardwareId}`);
      }

      return NextResponse.json({
        success: true,
        message: 'Device not registered',
        device: null,
        drivers: drivers,  // Still return drivers even if device not found
      });
    }

    console.log(`[ReportDeviceInfo] Found device: terminalId=${device.terminalId}, deviceId=${device.deviceId}, drivers=${drivers.length}`);

    // Return deviceId, price, and drivers
    return NextResponse.json({
      success: true,
      message: 'Device found',
      device: {
        deviceId: device.deviceId,  // This is the ID the machine should use
        deviceName: device.deviceName,
        isActive: device.isActive,
        terminalId: device.terminalId,  // For reference (same as hardwareId)
        price: device.price,  // Price in cents
        appVersion: device.appVersion,  // Current app version
        appVersionCode: device.appVersionCode,  // Current app version code
      },
      drivers: drivers,  // For PIN login
    });
  } catch (error) {
    console.error('[ReportDeviceInfo] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
