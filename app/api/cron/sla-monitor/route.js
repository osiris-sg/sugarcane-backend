import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db/index.js';
import { sendIncidentNotification, sendEscalationNotification } from '../../../../lib/push-notifications.ts';
import { sendAlert } from '../../../../lib/telegram.js';

// SLA Configuration
const SLA_HOURS = 3;
const REMINDER_1_HOURS = 2;        // First reminder at 2 hours
const REMINDER_2_HOURS = 2.5;      // Second reminder at 2.5 hours
const POST_BREACH_REMINDER_HOURS = 1; // Hourly reminders after breach

/**
 * SLA Monitor Cron Job
 * Runs every 5 minutes to:
 * 1. Check all OPEN/ACKNOWLEDGED/IN_PROGRESS incidents
 * 2. Send reminders at 2h, 2h 30m marks
 * 3. Mark SLA breach at 3h, log penalty
 * 4. Continue hourly reminders post-breach
 * 5. Escalate to Ops Manager + Admin on breach
 */
export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.log('[SLA-Monitor] Warning: No valid CRON_SECRET provided');
  }

  const now = new Date();
  console.log(`[SLA-Monitor] Cron job started at ${now.toISOString()}`);

  try {
    // Get all open incidents with SLA deadlines (excludes ZERO_SALES which has no SLA)
    const openIncidents = await db.incident.findMany({
      where: {
        status: { in: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'] },
        slaDeadline: { not: null },
      },
    });

    let reminders2h = 0;
    let reminders2h30 = 0;
    let breaches = 0;
    let postBreachReminders = 0;

    for (const incident of openIncidents) {
      const startTime = new Date(incident.startTime);
      const elapsed = now.getTime() - startTime.getTime();
      const elapsedHours = elapsed / (60 * 60 * 1000);

      const slaDeadline = new Date(incident.slaDeadline);
      const isPastDeadline = now >= slaDeadline;

      // Track last reminder time
      const lastReminder = incident.lastReminderAt ? new Date(incident.lastReminderAt) : null;
      const hoursSinceLastReminder = lastReminder
        ? (now.getTime() - lastReminder.getTime()) / (60 * 60 * 1000)
        : Infinity;

      // === CASE 1: Already breached - send hourly reminders ===
      if (incident.slaOutcome === 'SLA_BREACHED') {
        // Don't send reminders for escalated zero sales incidents
        if (incident.type === 'ZERO_SALES' && incident.escalatedAt) {
          continue;
        }

        // Send hourly reminder if enough time has passed
        if (hoursSinceLastReminder >= POST_BREACH_REMINDER_HOURS) {
          await db.incident.update({
            where: { id: incident.id },
            data: {
              lastReminderAt: now,
              reminderCount: { increment: 1 },
            },
          });

          await sendIncidentNotification({
            type: 'reminder',
            incident,
            title: '🔴 SLA BREACHED - Ongoing',
            body: `${incident.deviceName} is still unresolved. ${Math.round(elapsedHours)}h elapsed.`,
          });

          postBreachReminders++;
          console.log(`[SLA-Monitor] Post-breach reminder for ${incident.deviceName} (${Math.round(elapsedHours)}h elapsed)`);
        }
        continue;
      }

      // === CASE 2: SLA breach happening now ===
      if (isPastDeadline && incident.slaOutcome === 'PENDING') {
        // Mark as breached
        await db.incident.update({
          where: { id: incident.id },
          data: {
            slaOutcome: 'SLA_BREACHED',
            penaltyFlag: true,
            lastReminderAt: now,
            reminderCount: { increment: 1 },
            escalatedAt: now,
          },
        });

        // Create penalty record
        await db.penalty.create({
          data: {
            incidentId: incident.id,
            reason: `SLA breach - ${incident.type} not resolved within ${SLA_HOURS} hours`,
          },
        });

        // Send breach notification (escalates to admin + ops manager)
        await sendIncidentNotification({
          type: 'breach',
          incident,
          title: '🔴 SLA BREACHED',
          body: `${incident.deviceName} has exceeded the ${SLA_HOURS}h SLA. Immediate action required.`,
        });

        // Send Telegram notification
        const telegramBreach = `🔴 SLA BREACHED

🎯 Device: ${incident.deviceName}
📍 Device ID: ${incident.deviceId}
🔧 Type: ${incident.type}
⏱️ Elapsed: ${Math.round(elapsedHours)} hours

⚠️ Immediate action required!`;
        await sendAlert(telegramBreach, 'sla_breach');

        breaches++;
        console.log(`[SLA-Monitor] SLA BREACH for ${incident.deviceName} - penalty logged`);
        continue;
      }

      // === CASE 3: Approaching SLA - send reminders ===

      // First reminder at 2 hours
      if (elapsedHours >= REMINDER_1_HOURS && incident.reminderCount === 0) {
        await db.incident.update({
          where: { id: incident.id },
          data: {
            lastReminderAt: now,
            reminderCount: 1,
          },
        });

        const remainingMinutes = Math.round((SLA_HOURS - elapsedHours) * 60);

        await sendIncidentNotification({
          type: 'reminder',
          incident,
          title: '⚠️ SLA Warning - 2h elapsed',
          body: `${incident.deviceName}: ${remainingMinutes} minutes remaining before SLA breach.`,
        });

        // Send Telegram notification
        const telegram2h = `⚠️ SLA Warning - 2h elapsed

🎯 Device: ${incident.deviceName}
🔧 Type: ${incident.type}
⏱️ Remaining: ${remainingMinutes} minutes

Please resolve before SLA breach.`;
        await sendAlert(telegram2h, 'sla_warning');

        reminders2h++;
        console.log(`[SLA-Monitor] 2h reminder for ${incident.deviceName} (${remainingMinutes}m remaining)`);
      }

      // Second reminder at 2.5 hours
      else if (elapsedHours >= REMINDER_2_HOURS && incident.reminderCount === 1) {
        await db.incident.update({
          where: { id: incident.id },
          data: {
            lastReminderAt: now,
            reminderCount: 2,
          },
        });

        const remainingMinutes = Math.round((SLA_HOURS - elapsedHours) * 60);

        await sendIncidentNotification({
          type: 'reminder',
          incident,
          title: '🟠 SLA Critical - 30min remaining',
          body: `${incident.deviceName}: Only ${remainingMinutes} minutes before SLA breach!`,
        });

        // Send Telegram notification
        const telegram2h30 = `🟠 SLA Critical - 30min remaining

🎯 Device: ${incident.deviceName}
🔧 Type: ${incident.type}
⏱️ Remaining: ${remainingMinutes} minutes

⚠️ Urgent action needed!`;
        await sendAlert(telegram2h30, 'sla_warning');

        reminders2h30++;
        console.log(`[SLA-Monitor] 2h30m reminder for ${incident.deviceName} (${remainingMinutes}m remaining)`);
      }
    }

    // Log notification
    if (reminders2h > 0 || reminders2h30 > 0 || breaches > 0 || postBreachReminders > 0) {
      await db.notificationLog.create({
        data: {
          type: 'sla_monitor',
          message: `SLA: ${reminders2h} 2h reminders, ${reminders2h30} 2h30m reminders, ${breaches} breaches, ${postBreachReminders} post-breach`,
          recipients: reminders2h + reminders2h30 + breaches + postBreachReminders,
        },
      });
    }

    console.log(`[SLA-Monitor] Completed. 2h: ${reminders2h}, 2h30m: ${reminders2h30}, Breaches: ${breaches}, Post-breach: ${postBreachReminders}`);

    return NextResponse.json({
      success: true,
      openIncidents: openIncidents.length,
      reminders2h,
      reminders2h30,
      breaches,
      postBreachReminders,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('[SLA-Monitor] Cron job error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
