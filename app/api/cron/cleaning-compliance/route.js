import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db/index.js';
import { sendIncidentNotification } from '../../../../lib/push-notifications.ts';
import { sendAlert } from '../../../../lib/telegram.js';

const REQUIRED_CLEANINGS_PER_MONTH = 3;

/**
 * Cleaning Compliance Cron Job
 * Runs monthly on the 28th to check cleaning compliance
 *
 * Requirements:
 * - 3 cleanings per machine per month (starting 9th Feb)
 * - If count < 3: Create Incident with type: CLEANING_COMPLIANCE, immediate SLA breach
 * - Escalate to Ops Manager + Admin immediately
 */
export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.log('[CleaningCompliance] Warning: No valid CRON_SECRET provided');
  }

  const { searchParams } = new URL(request.url);
  const forceRun = searchParams.get('force') === 'true';

  const now = new Date();
  const sgTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const currentDay = sgTime.getUTCDate();
  const currentMonth = sgTime.getUTCMonth() + 1; // 1-12
  const currentYear = sgTime.getUTCFullYear();

  console.log(`[CleaningCompliance] Cron job started at ${now.toISOString()} (Day: ${currentDay})`);

  // Only run on the 28th of each month (or if forced)
  if (currentDay !== 28 && !forceRun) {
    console.log(`[CleaningCompliance] Not the 28th (day=${currentDay}), skipping`);
    return NextResponse.json({
      success: true,
      message: 'Not the 28th of the month',
      currentDay,
    });
  }

  try {
    // Get all devices
    const devices = await db.device.findMany({
      where: { isActive: true },
    });

    let compliant = 0;
    let nonCompliant = 0;
    const nonCompliantDevices = [];

    for (const device of devices) {
      // Count cleaning logs for this device in the current month
      const cleaningCount = await db.cleaningLog.count({
        where: {
          deviceId: device.deviceId,
          month: currentMonth,
          year: currentYear,
        },
      });

      if (cleaningCount >= REQUIRED_CLEANINGS_PER_MONTH) {
        compliant++;
        console.log(`[CleaningCompliance] ${device.deviceName}: ${cleaningCount}/${REQUIRED_CLEANINGS_PER_MONTH} - COMPLIANT`);
      } else {
        nonCompliant++;

        // Check for existing open cleaning compliance incident
        const existingIncident = await db.incident.findFirst({
          where: {
            deviceId: device.deviceId,
            type: 'CLEANING_COMPLIANCE',
            status: { in: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'] },
          },
        });

        if (!existingIncident) {
          // Create incident with immediate SLA breach
          const incident = await db.incident.create({
            data: {
              type: 'CLEANING_COMPLIANCE',
              deviceId: device.deviceId,
              deviceName: device.deviceName,
              startTime: now,
              slaDeadline: now, // Already breached
              status: 'OPEN',
              slaOutcome: 'SLA_BREACHED',
              penaltyFlag: true,
              escalatedAt: now,
              resolution: null,
            },
          });

          // Create penalty record
          await db.penalty.create({
            data: {
              incidentId: incident.id,
              reason: `Cleaning compliance breach - ${cleaningCount}/${REQUIRED_CLEANINGS_PER_MONTH} cleanings in month ${currentMonth}/${currentYear}`,
            },
          });

          // Send escalation notification
          await sendIncidentNotification({
            type: 'breach',
            incident,
            title: '🧹 CLEANING COMPLIANCE BREACH',
            body: `${device.deviceName}: Only ${cleaningCount}/${REQUIRED_CLEANINGS_PER_MONTH} cleanings this month`,
          });

          // Send Telegram notification
          const telegramCleaning = `🧹 CLEANING COMPLIANCE BREACH

🎯 Device: ${device.deviceName}
📍 Device ID: ${device.deviceId}
🧽 Cleanings: ${cleaningCount}/${REQUIRED_CLEANINGS_PER_MONTH}
📅 Month: ${currentMonth}/${currentYear}

⚠️ Cleaning compliance not met!`;
          await sendAlert(telegramCleaning, 'cleaning_compliance');

          nonCompliantDevices.push({
            deviceId: device.deviceId,
            deviceName: device.deviceName,
            cleaningCount,
            incidentId: incident.id,
          });

          console.log(`[CleaningCompliance] ${device.deviceName}: ${cleaningCount}/${REQUIRED_CLEANINGS_PER_MONTH} - NON-COMPLIANT, incident created`);
        } else {
          console.log(`[CleaningCompliance] ${device.deviceName}: ${cleaningCount}/${REQUIRED_CLEANINGS_PER_MONTH} - NON-COMPLIANT (existing incident)`);
        }
      }
    }

    // Log notification
    if (nonCompliant > 0) {
      await db.notificationLog.create({
        data: {
          type: 'cleaning_compliance',
          message: `Cleaning compliance check: ${compliant} compliant, ${nonCompliant} non-compliant`,
          recipients: nonCompliant,
        },
      });
    }

    console.log(`[CleaningCompliance] Completed. Compliant: ${compliant}, Non-compliant: ${nonCompliant}`);

    return NextResponse.json({
      success: true,
      month: currentMonth,
      year: currentYear,
      totalDevices: devices.length,
      compliant,
      nonCompliant,
      nonCompliantDevices,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('[CleaningCompliance] Cron job error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
