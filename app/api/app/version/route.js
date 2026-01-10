import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Helper to get or create config from database
async function getConfig() {
  let config = await db.otaConfig.findUnique({
    where: { id: 'singleton' }
  });

  if (!config) {
    // Create default config
    config = await db.otaConfig.create({
      data: {
        id: 'singleton',
        version: '1.0.0',
        versionCode: 1,
        apkUrl: 'https://sugarcane-backend-five.vercel.app/api/app/download',
        releaseNotes: 'Initial release',
        forceUpdate: false,
        triggerUpdate: [],
        triggerTimestamp: null,
      }
    });
  }

  return config;
}

// GET /api/app/version
// App calls this periodically to check for updates
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const deviceId = searchParams.get('deviceId');
  const currentVersion = searchParams.get('currentVersion');

  const config = await getConfig();

  // Check if this device should update
  let shouldUpdate = false;

  // triggerUpdate is an array: empty = no trigger, ["all"] = all devices, or specific device IDs
  if (config.triggerUpdate.includes("all")) {
    shouldUpdate = true;
  } else if (config.triggerUpdate.length > 0 && deviceId) {
    shouldUpdate = config.triggerUpdate.includes(deviceId);
  }

  // Also check version code - if device already has this version or newer, don't update
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
    triggerTimestamp: config.triggerTimestamp ? Number(config.triggerTimestamp) : null,
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

    let config = await getConfig();

    switch (action) {
      case 'trigger':
        // Trigger update for all devices or specific ones
        const devices = data.devices || ["all"];
        const triggerUpdate = Array.isArray(devices) ? devices : [devices];

        config = await db.otaConfig.update({
          where: { id: 'singleton' },
          data: {
            triggerUpdate: triggerUpdate,
            triggerTimestamp: BigInt(Date.now()),
          }
        });

        return NextResponse.json({
          success: true,
          message: `Update triggered for: ${triggerUpdate.join(', ')}`,
          triggerTimestamp: Number(config.triggerTimestamp),
        });

      case 'clear':
        // Clear update trigger
        config = await db.otaConfig.update({
          where: { id: 'singleton' },
          data: {
            triggerUpdate: [],
            triggerTimestamp: null,
          }
        });

        return NextResponse.json({
          success: true,
          message: 'Update trigger cleared',
        });

      case 'update':
        // Update version info
        const updateData = {};
        if (data.version) updateData.version = data.version;
        if (data.versionCode) updateData.versionCode = data.versionCode;
        if (data.apkUrl) updateData.apkUrl = data.apkUrl;
        if (data.releaseNotes) updateData.releaseNotes = data.releaseNotes;
        if (typeof data.forceUpdate === 'boolean') updateData.forceUpdate = data.forceUpdate;

        config = await db.otaConfig.update({
          where: { id: 'singleton' },
          data: updateData,
        });

        return NextResponse.json({
          success: true,
          message: 'Version info updated',
          config: {
            ...config,
            triggerTimestamp: config.triggerTimestamp ? Number(config.triggerTimestamp) : null,
          },
        });

      case 'status':
        // Get current status
        return NextResponse.json({
          success: true,
          config: {
            ...config,
            triggerTimestamp: config.triggerTimestamp ? Number(config.triggerTimestamp) : null,
          },
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: trigger, clear, update, or status' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('OTA Version API Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
