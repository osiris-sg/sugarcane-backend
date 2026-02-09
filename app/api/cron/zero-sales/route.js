import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db/index.js';
import { sendIncidentNotification } from '../../../../lib/push-notifications.ts';

// Time blocks for zero sales detection (Singapore time, UTC+8)
// New: 9am-11pm with 2-hour blocks
const TIME_BLOCKS = [
  { start: 9, end: 11, label: '9am-11am' },
  { start: 11, end: 13, label: '11am-1pm' },
  { start: 13, end: 15, label: '1pm-3pm' },
  { start: 15, end: 17, label: '3pm-5pm' },
  { start: 17, end: 19, label: '5pm-7pm' },
  { start: 19, end: 21, label: '7pm-9pm' },
  { start: 21, end: 23, label: '9pm-11pm' },
];

// Resolution categories for zero sales (also defined in /lib/constants for UI use)
const ZERO_SALES_RESOLUTION_CATEGORIES = [
  'payment_system_error',
  'app_error',
  'power_off',
  'location_issue',
  'others',
];

// Escape HTML special characters for Telegram
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Helper: Get current Singapore hour
function getSGHour() {
  const now = new Date();
  const sgTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Singapore' }));
  return sgTime.getHours();
}

// Get Singapore time (UTC+8)
function getSingaporeTime() {
  const now = new Date();
  return new Date(now.getTime() + 8 * 60 * 60 * 1000);
}

// Get the current time block (if any)
function getCurrentTimeBlock(sgHour) {
  return TIME_BLOCKS.find(block => sgHour >= block.start && sgHour < block.end);
}

// Check if we're within operating hours (9am-11pm)
function isWithinOperatingHours(sgHour) {
  return sgHour >= 9 && sgHour < 23;
}

// Main cron handler - runs every 15 minutes
// Handles the 30min/60min escalation flow for zero sales
export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.log('[ZeroSales] Warning: No valid CRON_SECRET provided');
  }

  const { searchParams } = new URL(request.url);
  const forceRun = searchParams.get('force') === 'true';

  const now = new Date();
  const sgTime = getSingaporeTime();
  const sgHour = sgTime.getUTCHours();

  console.log(`[ZeroSales] Cron job started at ${now.toISOString()} (SG: ${sgHour}:00, force: ${forceRun})`);

  // Check if within operating hours (9am-11pm)
  if (!isWithinOperatingHours(sgHour) && !forceRun) {
    console.log(`[ZeroSales] Outside operating hours (9am-11pm), skipping`);
    return NextResponse.json({
      success: true,
      message: 'Outside operating hours',
      sgHour,
    });
  }

  const timeBlock = getCurrentTimeBlock(sgHour);
  if (!timeBlock && !forceRun) {
    console.log(`[ZeroSales] No active time block at ${sgHour}:00 SG time`);
    return NextResponse.json({
      success: true,
      message: 'No active time block',
      sgHour,
    });
  }

  const currentBlockLabel = timeBlock?.label || 'test-block';

  try {
    // Calculate time range for current block start
    const blockStartTime = new Date(sgTime);
    if (timeBlock) {
      blockStartTime.setUTCHours(timeBlock.start, 0, 0, 0);
    }
    const blockStartUTC = new Date(blockStartTime.getTime() - 8 * 60 * 60 * 1000);

    console.log(`[ZeroSales] Processing time block: ${currentBlockLabel}`);

    // Get all active devices
    const devices = await db.device.findMany({
      where: { isActive: true },
      select: { deviceId: true, deviceName: true },
    });

    // Get stock data for quantity info
    const stocks = await db.stock.findMany({
      select: { deviceId: true, quantity: true, maxStock: true },
    });
    const stockMap = new Map(stocks.map(s => [s.deviceId, s]));

    let newStagingEntries = 0;
    let stage1Escalations = 0;
    let stage2Escalations = 0;
    let resolved = 0;

    for (const device of devices) {
      const stock = stockMap.get(device.deviceId);

      // Check for orders since block start
      const recentOrders = await db.order.findMany({
        where: {
          deviceId: device.deviceId,
          isSuccess: true,
          createdAt: { gte: blockStartUTC },
        },
      });

      const hasSales = recentOrders.length > 0;

      // Get existing staging entry for this device
      const stagingEntry = await db.zeroSalesStaging.findUnique({
        where: { deviceId: device.deviceId },
      });

      // === CASE 1: Device has sales - clear staging if exists ===
      if (hasSales) {
        if (stagingEntry) {
          await db.zeroSalesStaging.delete({
            where: { id: stagingEntry.id },
          });
          console.log(`[ZeroSales] Device ${device.deviceName} has sales, cleared from staging`);
          resolved++;
        }
        continue;
      }

      // === Device has NO sales - handle staging/escalation ===

      // Check for existing open incident (don't create duplicates)
      const existingIncident = await db.incident.findFirst({
        where: {
          deviceId: device.deviceId,
          type: 'ZERO_SALES',
          status: { in: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'] },
        },
      });

      if (existingIncident) {
        // Already an incident - check if 1h has passed for escalation
        const incidentAge = now.getTime() - new Date(existingIncident.startTime).getTime();
        const oneHour = 60 * 60 * 1000;

        if (incidentAge >= oneHour && !existingIncident.escalatedAt) {
          // Escalate to ops manager
          await db.incident.update({
            where: { id: existingIncident.id },
            data: { escalatedAt: now },
          });

          await sendIncidentNotification({
            type: 'escalation',
            incident: existingIncident,
            title: '⚠️ Zero Sales Escalation',
            body: `${device.deviceName} has had no sales for over 1 hour`,
          });

          console.log(`[ZeroSales] Escalated incident for ${device.deviceName} to ops manager`);
        }
        continue;
      }

      // No existing incident - handle staging
      if (!stagingEntry) {
        // === STAGE 0: Initial detection - create staging entry ===
        await db.zeroSalesStaging.create({
          data: {
            deviceId: device.deviceId,
            deviceName: device.deviceName,
            timeBlock: currentBlockLabel,
            stage: 0,
            startedAt: now,
            lastCheckedAt: now,
          },
        });

        // Send initial push notification (PWA only, no Telegram) - informational
        await sendIncidentNotification({
          type: 'new',
          incident: {
            id: `staging-${device.deviceId}`,
            type: 'ZERO_SALES',
            deviceId: device.deviceId,
            deviceName: device.deviceName,
          },
          title: '📊 No Sales Notice',
          body: `Just to let you know - ${device.deviceName} had no sales in ${currentBlockLabel}`,
        });

        newStagingEntries++;
        console.log(`[ZeroSales] Stage 0: ${device.deviceName} added to staging`);
      } else {
        // Check how long since staging started
        const stagingAge = now.getTime() - new Date(stagingEntry.startedAt).getTime();
        const thirtyMin = 30 * 60 * 1000;
        const sixtyMin = 60 * 60 * 1000;

        if (stagingEntry.stage === 0 && stagingAge >= thirtyMin) {
          // === STAGE 1: 30 minutes - send reminder ===
          await db.zeroSalesStaging.update({
            where: { id: stagingEntry.id },
            data: {
              stage: 1,
              lastCheckedAt: now,
              notifiedAt: now,
            },
          });

          // Send 30min reminder push notification (PWA only, no Telegram)
          await sendIncidentNotification({
            type: 'reminder',
            incident: {
              id: `staging-${device.deviceId}`,
              type: 'ZERO_SALES',
              deviceId: device.deviceId,
              deviceName: device.deviceName,
            },
            title: '📉 Still No Sales',
            body: `${device.deviceName} still has no sales after 30 min`,
          });

          stage1Escalations++;
          console.log(`[ZeroSales] Stage 1: ${device.deviceName} - 30min reminder sent`);
        } else if (stagingEntry.stage === 1 && stagingAge >= sixtyMin) {
          // === STAGE 2: 60 minutes - escalate to incident ===

          // Create incident (no SLA for zero sales)
          const incident = await db.incident.create({
            data: {
              type: 'ZERO_SALES',
              deviceId: device.deviceId,
              deviceName: device.deviceName,
              startTime: new Date(stagingEntry.startedAt),
              status: 'OPEN',
              slaOutcome: 'PENDING', // No SLA for zero sales, but track anyway
              timeBlock: currentBlockLabel,
              stockQuantity: stock?.quantity || 0,
            },
          });

          // Remove from staging
          await db.zeroSalesStaging.delete({
            where: { id: stagingEntry.id },
          });

          // Send urgent notification (PWA only, no Telegram)
          await sendIncidentNotification({
            type: 'breach',
            incident,
            title: '🚨 No Sales - Go Check ASAP',
            body: `${device.deviceName} has had no sales for 1 hour. Please go check now!`,
          });

          stage2Escalations++;
          console.log(`[ZeroSales] Stage 2: ${device.deviceName} escalated to incident`);
        } else {
          // Update last checked time
          await db.zeroSalesStaging.update({
            where: { id: stagingEntry.id },
            data: { lastCheckedAt: now },
          });
        }
      }
    }

    // Clean up stale staging entries from previous time blocks
    const staleEntries = await db.zeroSalesStaging.findMany({
      where: {
        timeBlock: { not: currentBlockLabel },
      },
    });

    for (const entry of staleEntries) {
      await db.zeroSalesStaging.delete({
        where: { id: entry.id },
      });
      console.log(`[ZeroSales] Cleaned up stale staging entry for ${entry.deviceName}`);
    }

    // Log notification
    if (newStagingEntries > 0 || stage1Escalations > 0 || stage2Escalations > 0) {
      await db.notificationLog.create({
        data: {
          type: 'zero_sales',
          message: `Zero sales: ${newStagingEntries} new, ${stage1Escalations} at 30min, ${stage2Escalations} escalated`,
          recipients: newStagingEntries + stage1Escalations + stage2Escalations,
        },
      });
    }

    console.log(`[ZeroSales] Completed. New: ${newStagingEntries}, 30min: ${stage1Escalations}, Escalated: ${stage2Escalations}, Resolved: ${resolved}`);

    return NextResponse.json({
      success: true,
      timeBlock: currentBlockLabel,
      newStagingEntries,
      stage1Escalations,
      stage2Escalations,
      resolved,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('[ZeroSales] Cron job error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
