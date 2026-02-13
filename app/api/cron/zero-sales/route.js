import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db/index.js';
import { sendIncidentNotification } from '../../../../lib/push-notifications.ts';

// Time blocks for zero sales detection (Singapore time, UTC+8)
// 9am-11pm with 2-hour blocks
const TIME_BLOCKS = [
  { start: 9, end: 11, label: '9am-11am' },
  { start: 11, end: 13, label: '11am-1pm' },
  { start: 13, end: 15, label: '1pm-3pm' },
  { start: 15, end: 17, label: '3pm-5pm' },
  { start: 17, end: 19, label: '5pm-7pm' },
  { start: 19, end: 21, label: '7pm-9pm' },
  { start: 21, end: 23, label: '9pm-11pm' },
];

// Get Singapore date components
function getSGDateComponents() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const get = (type) => parseInt(parts.find(p => p.type === type)?.value || '0', 10);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  };
}

// Convert SGT hour to UTC Date
function getBlockTimeUTC(sgYear, sgMonth, sgDay, sgHour) {
  const sgDate = new Date(Date.UTC(sgYear, sgMonth - 1, sgDay, sgHour, 0, 0, 0));
  return new Date(sgDate.getTime() - 8 * 60 * 60 * 1000);
}

// Get the current time block (if any)
function getCurrentTimeBlock(sgHour) {
  return TIME_BLOCKS.find(block => sgHour >= block.start && sgHour < block.end);
}

// Get the previous time block
function getPreviousTimeBlock(sgHour) {
  const currentIndex = TIME_BLOCKS.findIndex(block => sgHour >= block.start && sgHour < block.end);
  if (currentIndex > 0) {
    return TIME_BLOCKS[currentIndex - 1];
  }
  if (sgHour >= 23 || sgHour < 9) {
    return TIME_BLOCKS[TIME_BLOCKS.length - 1]; // 9pm-11pm
  }
  return null;
}

// Main cron handler - runs every 15 minutes
// Flow:
// 1. At block end: Check previous block, create staging entries for devices with no sales
// 2. After 30 min: Send reminder for devices still with no sales
// 3. After 60 min: Escalate to incident
export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.log('[ZeroSales] Warning: No valid CRON_SECRET provided');
  }

  const { searchParams } = new URL(request.url);
  const forceRun = searchParams.get('force') === 'true';

  const now = new Date();
  const sgComponents = getSGDateComponents();
  const sgHour = sgComponents.hour;
  const sgMinute = sgComponents.minute;

  console.log(`[ZeroSales] Cron started at ${now.toISOString()} (SG: ${sgComponents.year}-${sgComponents.month}-${sgComponents.day} ${sgHour}:${String(sgMinute).padStart(2, '0')}, force: ${forceRun})`);

  // Skip if outside operating hours (before 9am or after 11pm, but allow until midnight for escalations)
  if (sgHour < 9 && !forceRun) {
    console.log(`[ZeroSales] Before operating hours, skipping`);
    return NextResponse.json({
      success: true,
      message: 'Before operating hours',
      sgHour,
    });
  }

  const currentBlock = getCurrentTimeBlock(sgHour);
  const previousBlock = getPreviousTimeBlock(sgHour);

  try {
    let newStagingEntries = 0;
    let stage1Reminders = 0;
    let stage2Escalations = 0;
    let resolved = 0;

    // === PART 1: At block start, check previous block for devices with no sales ===
    const isAtBlockStart = currentBlock && sgMinute < 15;
    const isJustAfter11pm = sgHour === 23 && sgMinute < 15;

    if ((isAtBlockStart || isJustAfter11pm) && previousBlock) {
      // Calculate time range for the PREVIOUS block
      let checkYear = sgComponents.year;
      let checkMonth = sgComponents.month;
      let checkDay = sgComponents.day;

      const blockStartUTC = getBlockTimeUTC(checkYear, checkMonth, checkDay, previousBlock.start);
      const blockEndUTC = getBlockTimeUTC(checkYear, checkMonth, checkDay, previousBlock.end);

      console.log(`[ZeroSales] Checking previous block: ${previousBlock.label} (${blockStartUTC.toISOString()} to ${blockEndUTC.toISOString()})`);

      // Get all active devices with zero sales alert enabled (include location for notifications)
      const devices = await db.device.findMany({
        where: { isActive: true, zeroSalesAlert: true },
        select: { deviceId: true, deviceName: true, location: true },
      });

      for (const device of devices) {
        // Check for orders in the previous block
        const ordersInBlock = await db.orderImport.findMany({
          where: {
            deviceId: device.deviceId,
            isSuccess: true,
            createdAt: {
              gte: blockStartUTC,
              lt: blockEndUTC,
            },
          },
        });

        const hadSales = ordersInBlock.length > 0;

        if (!hadSales) {
          // Check if already in staging or has open incident
          const existingStaging = await db.zeroSalesStaging.findUnique({
            where: { deviceId: device.deviceId },
          });
          const existingIncident = await db.incident.findFirst({
            where: {
              deviceId: device.deviceId,
              type: 'ZERO_SALES',
              status: { in: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'] },
            },
          });

          if (!existingStaging && !existingIncident) {
            const displayName = device.location || device.deviceName;

            // Create staging entry - block just ended with no sales
            await db.zeroSalesStaging.create({
              data: {
                deviceId: device.deviceId,
                deviceName: device.deviceName,
                timeBlock: previousBlock.label,
                stage: 0,
                startedAt: now,
                lastCheckedAt: now,
              },
            });

            // Send initial notification - block ended with no sales
            await sendIncidentNotification({
              type: 'new',
              incident: {
                id: `staging-${device.deviceId}`,
                type: 'ZERO_SALES',
                deviceId: device.deviceId,
                deviceName: device.deviceName,
              },
              title: '📊 No Sales Alert',
              body: `${displayName} had no sales in ${previousBlock.label}`,
            });

            newStagingEntries++;
            console.log(`[ZeroSales] ${displayName} had no sales in ${previousBlock.label} - added to staging`);
          }
        }
      }
    }

    // === PART 2: Process existing staging entries (30min/60min escalation) ===
    const stagingEntries = await db.zeroSalesStaging.findMany();

    // Get device locations for notifications
    const stagingDeviceIds = stagingEntries.map(e => e.deviceId);
    const stagingDevices = await db.device.findMany({
      where: { deviceId: { in: stagingDeviceIds } },
      select: { deviceId: true, location: true },
    });
    const deviceLocationMap = new Map(stagingDevices.map(d => [d.deviceId, d.location]));

    for (const entry of stagingEntries) {
      const displayName = deviceLocationMap.get(entry.deviceId) || entry.deviceName;

      // Check if device now has sales (in current block)
      const currentBlockStart = currentBlock
        ? getBlockTimeUTC(sgComponents.year, sgComponents.month, sgComponents.day, currentBlock.start)
        : now;

      const recentOrders = await db.orderImport.findMany({
        where: {
          deviceId: entry.deviceId,
          isSuccess: true,
          createdAt: { gte: currentBlockStart },
        },
      });

      const hasSalesNow = recentOrders.length > 0;

      if (hasSalesNow) {
        // Device now has sales - clear from staging
        await db.zeroSalesStaging.delete({
          where: { id: entry.id },
        });
        resolved++;
        console.log(`[ZeroSales] ${displayName} now has sales, cleared from staging`);
        continue;
      }

      // Check how long since staging started
      const stagingAge = now.getTime() - new Date(entry.startedAt).getTime();
      const thirtyMin = 30 * 60 * 1000;
      const sixtyMin = 60 * 60 * 1000;

      if (entry.stage === 0 && stagingAge >= thirtyMin) {
        // === 30 minutes - send reminder ===
        await db.zeroSalesStaging.update({
          where: { id: entry.id },
          data: {
            stage: 1,
            lastCheckedAt: now,
            notifiedAt: now,
          },
        });

        await sendIncidentNotification({
          type: 'reminder',
          incident: {
            id: `staging-${entry.deviceId}`,
            type: 'ZERO_SALES',
            deviceId: entry.deviceId,
            deviceName: entry.deviceName,
          },
          title: '📉 Still No Sales',
          body: `${displayName} still has no sales after 30 min`,
        });

        stage1Reminders++;
        console.log(`[ZeroSales] ${displayName} - 30min reminder sent`);

      } else if (entry.stage === 1 && stagingAge >= sixtyMin) {
        // === 60 minutes - escalate to incident ===
        const stock = await db.stock.findFirst({
          where: { deviceId: entry.deviceId },
        });

        const incident = await db.incident.create({
          data: {
            type: 'ZERO_SALES',
            deviceId: entry.deviceId,
            deviceName: entry.deviceName,
            startTime: new Date(entry.startedAt),
            status: 'OPEN',
            slaOutcome: 'PENDING',
            timeBlock: entry.timeBlock,
            stockQuantity: stock?.quantity || 0,
          },
        });

        // Remove from staging
        await db.zeroSalesStaging.delete({
          where: { id: entry.id },
        });

        await sendIncidentNotification({
          type: 'breach',
          incident,
          title: '🚨 No Sales - Go Check ASAP',
          body: `${displayName} has had no sales for 1 hour. Please go check now!`,
        });

        stage2Escalations++;
        console.log(`[ZeroSales] ${displayName} - escalated to incident after 60min`);

      } else {
        // Just update last checked time
        await db.zeroSalesStaging.update({
          where: { id: entry.id },
          data: { lastCheckedAt: now },
        });
      }
    }

    // Log summary
    if (newStagingEntries > 0 || stage1Reminders > 0 || stage2Escalations > 0) {
      await db.notificationLog.create({
        data: {
          type: 'zero_sales',
          message: `Zero sales: ${newStagingEntries} new, ${stage1Reminders} at 30min, ${stage2Escalations} escalated`,
          recipients: newStagingEntries + stage1Reminders + stage2Escalations,
        },
      });
    }

    console.log(`[ZeroSales] Completed. New: ${newStagingEntries}, 30min: ${stage1Reminders}, Escalated: ${stage2Escalations}, Resolved: ${resolved}`);

    return NextResponse.json({
      success: true,
      currentBlock: currentBlock?.label,
      previousBlock: previousBlock?.label,
      newStagingEntries,
      stage1Reminders,
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
