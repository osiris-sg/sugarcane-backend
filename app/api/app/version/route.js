import { NextResponse } from 'next/server';

// In-memory storage for update trigger (use Redis/DB in production)
const globalForUpdate = globalThis;
if (!globalForUpdate.updateConfig) {
  globalForUpdate.updateConfig = {
    // Version string shown to users
    version: "1.0.0",

    // Version code - increment this for each release
    versionCode: 1,

    // URL to download the APK
    apkUrl: "https://sugarcane-backend-five.vercel.app/api/app/download",

    // Release notes
    releaseNotes: "Initial release",

    // Force update flag - set to true to force all devices to update
    forceUpdate: false,

    // Trigger update for specific devices (by device ID) or "all"
    triggerUpdate: null,  // null, "all", or ["deviceId1", "deviceId2"]

    // Timestamp when update was triggered
    triggerTimestamp: null,
  };
}

// GET /api/app/version
// App calls this periodically to check for updates
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const deviceId = searchParams.get('deviceId');
  const currentVersion = searchParams.get('currentVersion');

  const config = globalForUpdate.updateConfig;

  // Check if this device should update
  let shouldUpdate = false;

  if (config.triggerUpdate === "all") {
    shouldUpdate = true;
  } else if (Array.isArray(config.triggerUpdate) && deviceId) {
    shouldUpdate = config.triggerUpdate.includes(deviceId);
  }

  // Also check version code
  if (currentVersion && parseInt(currentVersion) >= config.versionCode) {
    shouldUpdate = false; // Already up to date
  }

  return NextResponse.json({
    success: true,
    version: config.version,
    versionCode: config.versionCode,
    apkUrl: config.apkUrl,
    releaseNotes: config.releaseNotes,
    forceUpdate: config.forceUpdate,
    shouldUpdate: shouldUpdate,
    triggerTimestamp: config.triggerTimestamp,
    timestamp: Date.now(),
  });
}

// POST /api/app/version
// Admin endpoint to trigger updates or update version info
export async function POST(request) {
  try {
    const body = await request.json();
    const { action, adminKey, ...data } = body;

    // Simple admin key check
    const validKey = process.env.ADMIN_KEY || 'sugarcane123';
    if (adminKey !== validKey) {
      return NextResponse.json(
        { error: 'Unauthorized. Provide correct adminKey.' },
        { status: 401 }
      );
    }

    const config = globalForUpdate.updateConfig;

    switch (action) {
      case 'trigger':
        // Trigger update for all devices or specific ones
        config.triggerUpdate = data.devices || "all";
        config.triggerTimestamp = Date.now();
        return NextResponse.json({
          success: true,
          message: `Update triggered for: ${config.triggerUpdate}`,
          triggerTimestamp: config.triggerTimestamp,
        });

      case 'clear':
        // Clear update trigger
        config.triggerUpdate = null;
        config.triggerTimestamp = null;
        return NextResponse.json({
          success: true,
          message: 'Update trigger cleared',
        });

      case 'update':
        // Update version info
        if (data.version) config.version = data.version;
        if (data.versionCode) config.versionCode = data.versionCode;
        if (data.apkUrl) config.apkUrl = data.apkUrl;
        if (data.releaseNotes) config.releaseNotes = data.releaseNotes;
        if (typeof data.forceUpdate === 'boolean') config.forceUpdate = data.forceUpdate;
        return NextResponse.json({
          success: true,
          message: 'Version info updated',
          config: config,
        });

      case 'status':
        // Get current status
        return NextResponse.json({
          success: true,
          config: config,
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: trigger, clear, update, or status' },
          { status: 400 }
        );
    }
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
