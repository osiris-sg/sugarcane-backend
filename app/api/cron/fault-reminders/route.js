import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db/index.js';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Send message to Telegram
async function sendTelegramMessage(chatId, text) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    });
  } catch (error) {
    console.error('Error sending Telegram message:', error);
  }
}

// Send alert to all STOCK subscribers
async function sendStockAlert(message) {
  const subscribers = await db.subscriber.findMany({
    where: {
      categories: { has: 'STOCK' },
    },
  });

  console.log(`[FaultReminders] Sending to ${subscribers.length} subscribers`);

  for (const subscriber of subscribers) {
    await sendTelegramMessage(subscriber.chatId, message);
  }

  return subscribers.length;
}

// Format milliseconds to human-readable duration
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m`;
  } else {
    return `${seconds}s`;
  }
}

// Main cron handler - runs hourly to send reminders for unresolved issues
// KPI: 3 hour window, then hourly reminders
export async function GET(request) {
  // Verify cron secret (optional security)
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.log('[FaultReminders] Warning: No valid CRON_SECRET provided');
  }

  const now = new Date();
  console.log(`[FaultReminders] Cron job started at ${now.toISOString()}`);

  try {
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Find issues that:
    // 1. Are still OPEN or CHECKING
    // 2. Were triggered more than 3 hours ago
    // 3. Haven't had a reminder in the last hour
    const issues = await db.issue.findMany({
      where: {
        status: { in: ['OPEN', 'CHECKING'] },
        triggeredAt: { lt: threeHoursAgo },
        OR: [
          { lastReminderAt: null },
          { lastReminderAt: { lt: oneHourAgo } }
        ]
      },
      orderBy: { triggeredAt: 'asc' }
    });

    console.log(`[FaultReminders] Found ${issues.length} issues needing reminders`);

    let remindersSent = 0;

    for (const issue of issues) {
      const elapsedMs = now.getTime() - new Date(issue.triggeredAt).getTime();
      const elapsedFormatted = formatDuration(elapsedMs);

      const typeLabel = issue.type === 'DEVICE_ERROR' ? 'Device Error' : 'Zero Sales';
      const statusLabel = issue.status === 'CHECKING' ? '(Staff Checking)' : '(Awaiting Response)';

      const message = `⏰ <b>REMINDER: Unresolved ${typeLabel}</b> ${statusLabel}

📍 <b>${issue.deviceName}</b>
🎯 Device ID: ${issue.deviceId}
${issue.faultCode ? `⚠️ Fault: ${issue.faultCode} - ${issue.faultName}` : ''}
${issue.timeBlock ? `📊 Time Block: ${issue.timeBlock}` : ''}
⏱️ Open for: <b>${elapsedFormatted}</b>
🔔 Reminder #${issue.reminderCount + 1}

Please respond to this issue!`;

      await sendStockAlert(message);

      // Update reminder tracking
      await db.issue.update({
        where: { id: issue.id },
        data: {
          lastReminderAt: now,
          reminderCount: { increment: 1 }
        }
      });

      remindersSent++;
      console.log(`[FaultReminders] Sent reminder #${issue.reminderCount + 1} for ${issue.deviceName} (${issue.type})`);
    }

    // Log notification if any reminders sent
    if (remindersSent > 0) {
      await db.notificationLog.create({
        data: {
          type: 'fault_reminder',
          message: `Sent ${remindersSent} fault reminders`,
          recipients: remindersSent,
        },
      });
    }

    console.log(`[FaultReminders] Cron job completed. Reminders sent: ${remindersSent}`);

    return NextResponse.json({
      success: true,
      remindersSent,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('[FaultReminders] Cron job error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
