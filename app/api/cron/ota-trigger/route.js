import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// This endpoint is called by cron to check and trigger scheduled OTA updates
// Set up a cron job to call this every minute or every 5 minutes

// Vercel cron authorization
const verifyCronAuth = (request) => {
  // Check for Vercel cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return true;
  }

  // Also allow admin key for manual triggers
  const adminKey = request.headers.get('x-admin-key') ||
                   new URL(request.url).searchParams.get('adminKey');
  const validKey = process.env.ADMIN_KEY || 'sugarcane123';
  return adminKey === validKey;
};

// Helper to get or create config from database
async function getConfig() {
  let config = await db.otaConfig.findUnique({
    where: { id: 'singleton' }
  });

  if (!config) {
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

export async function GET(request) {
  // Allow unauthenticated GET for Vercel cron (uses CRON_SECRET)
  const isAuthorized = verifyCronAuth(request);

  try {
    const now = new Date();

    // Find all scheduled OTAs that are due
    const dueOtas = await db.scheduledOta.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: {
          lte: now, // scheduled time is in the past or now
        },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    if (dueOtas.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No scheduled OTAs due',
        checkedAt: now.toISOString(),
        triggered: 0,
      });
    }

    // Only trigger if authorized
    if (!isAuthorized) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized - OTAs are due but not triggering without auth',
        dueCount: dueOtas.length,
      }, { status: 401 });
    }

    const triggered = [];
    let config = await getConfig();

    for (const ota of dueOtas) {
      // Trigger the OTA update
      let newTriggerUpdate;
      if (ota.devices.length === 0) {
        // All devices
        newTriggerUpdate = ["all"];
      } else {
        // Merge with existing triggers if any
        const existingDevices = config.triggerUpdate.filter(d => d !== "all");
        newTriggerUpdate = [...new Set([...existingDevices, ...ota.devices])];
      }

      // Update database
      config = await db.otaConfig.update({
        where: { id: 'singleton' },
        data: {
          triggerUpdate: newTriggerUpdate,
          triggerTimestamp: BigInt(Date.now()),
        }
      });

      // Mark as triggered in database
      await db.scheduledOta.update({
        where: { id: ota.id },
        data: {
          status: 'TRIGGERED',
          triggeredAt: now,
        },
      });

      triggered.push({
        id: ota.id,
        devices: ota.devices.length === 0 ? 'ALL' : ota.devices,
        scheduledAt: ota.scheduledAt,
        notes: ota.notes,
      });

      console.log(`[OTA Cron] Triggered OTA ${ota.id} for ${ota.devices.length === 0 ? 'ALL' : ota.devices.length} devices`);
    }

    return NextResponse.json({
      success: true,
      message: `Triggered ${triggered.length} scheduled OTA(s)`,
      checkedAt: now.toISOString(),
      triggered: triggered,
      currentTriggerState: config.triggerUpdate,
    });
  } catch (error) {
    console.error('[OTA Cron] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST endpoint for manual trigger check
export async function POST(request) {
  return GET(request);
}
