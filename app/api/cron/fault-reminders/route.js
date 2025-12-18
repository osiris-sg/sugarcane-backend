import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db/index.js';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Check if current time is within quiet hours (10pm to 8am Singapore time)
function isQuietHours() {
  const now = new Date();
  // Get Singapore time (UTC+8)
  const sgTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const sgHour = sgTime.getUTCHours();
  // Quiet hours: 22:00 (10pm) to 08:00 (8am)
  return sgHour >= 22 || sgHour < 8;
}

// Check if this is the first run of the day (8am-9am window)
function isFirstRunOfDay() {
  const now = new Date();
  const sgTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const sgHour = sgTime.getUTCHours();
  return sgHour === 8; // 8am hour
}

// Send message to Telegram
async function sendTelegramMessage(chatId, text, replyMarkup = null) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  try {
    const body = {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    };
    if (replyMarkup) {
      body.reply_markup = replyMarkup;
    }
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.error('Error sending Telegram message:', error);
  }
}

// Send alert to all STOCK subscribers (without buttons - for summary)
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

// Send issue alert with inline buttons (for reminders)
async function sendIssueAlert(message, issueId) {
  const subscribers = await db.subscriber.findMany({
    where: {
      categories: { has: 'STOCK' },
    },
  });

  const replyMarkup = {
    inline_keyboard: [[
      { text: '👀 Checking', callback_data: `checking:${issueId}` },
      { text: '✅ Resolved', callback_data: `resolve:${issueId}` },
      { text: '❌ Unresolved', callback_data: `unresolved:${issueId}` },
    ]]
  };

  console.log(`[FaultReminders] Sending reminder with buttons to ${subscribers.length} subscribers`);

  for (const subscriber of subscribers) {
    await sendTelegramMessage(subscriber.chatId, message, replyMarkup);
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

// Get start of today in Singapore time (midnight SGT)
function getStartOfDaySGT() {
  const now = new Date();
  const sgTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  sgTime.setUTCHours(0, 0, 0, 0);
  // Convert back to UTC
  return new Date(sgTime.getTime() - 8 * 60 * 60 * 1000);
}

// Main cron handler - runs hourly to send reminders for unresolved issues
// At 8am: Send daily summary of all unresolved issues
// Rest of day: Max 3 reminders per issue, then escalate to priority 2
export async function GET(request) {
  // Verify cron secret (optional security)
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.log('[FaultReminders] Warning: No valid CRON_SECRET provided');
  }

  const now = new Date();
  console.log(`[FaultReminders] Cron job started at ${now.toISOString()}`);

  // Skip during quiet hours (10pm to 8am Singapore time)
  if (isQuietHours()) {
    console.log('[FaultReminders] Skipping - quiet hours (10pm-8am SGT)');
    return NextResponse.json({
      success: true,
      message: 'Skipped - quiet hours',
      remindersSent: 0,
      timestamp: now.toISOString(),
    });
  }

  try {
    const startOfToday = getStartOfDaySGT();

    // Get all unresolved issues (for summary or reminders)
    const allUnresolvedIssues = await db.issue.findMany({
      where: {
        status: { in: ['OPEN', 'CHECKING'] }
      },
      orderBy: [{ priority: 'desc' }, { triggeredAt: 'asc' }]
    });

    // === 8AM DAILY SUMMARY ===
    if (isFirstRunOfDay() && allUnresolvedIssues.length > 0) {
      console.log(`[FaultReminders] Sending daily summary for ${allUnresolvedIssues.length} unresolved issues`);

      // Escalate LVL 2 issues to LVL 3 (they've been unresolved for another day)
      const lvl2Issues = allUnresolvedIssues.filter(i => i.priority === 2);
      if (lvl2Issues.length > 0) {
        await db.issue.updateMany({
          where: {
            id: { in: lvl2Issues.map(i => i.id) }
          },
          data: {
            priority: 3
          }
        });
        console.log(`[FaultReminders] Escalated ${lvl2Issues.length} issues from LVL 2 to LVL 3`);

        // Update local data to reflect escalation
        for (const issue of lvl2Issues) {
          issue.priority = 3;
        }
      }

      // Group issues by type
      const deviceErrors = allUnresolvedIssues.filter(i => i.type === 'DEVICE_ERROR');
      const zeroSales = allUnresolvedIssues.filter(i => i.type === 'ZERO_SALES');

      // Count by priority for summary header
      const lvl3Count = allUnresolvedIssues.filter(i => i.priority === 3).length;
      const lvl2Count = allUnresolvedIssues.filter(i => i.priority === 2).length;
      const lvl1Count = allUnresolvedIssues.filter(i => i.priority === 1).length;

      // Build summary message
      let summary = `📋 Daily Summary - Unresolved Issues\n\n`;
      summary += `Total: ${allUnresolvedIssues.length} issue(s)`;
      if (lvl3Count > 0) summary += ` | 🔴 ${lvl3Count} HIGH`;
      if (lvl2Count > 0) summary += ` | 🟠 ${lvl2Count} MED`;
      if (lvl1Count > 0) summary += ` | 🟡 ${lvl1Count} LOW`;
      summary += `\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;

      if (deviceErrors.length > 0) {
        summary += `🚨 Device Alarms (${deviceErrors.length})\n`;
        for (const issue of deviceErrors) {
          const lvlEmoji = issue.priority === 3 ? '🔴' : issue.priority === 2 ? '🟠' : '🟡';
          summary += `${lvlEmoji} ${issue.deviceName} - ${issue.faultCode || 'Unknown'} [LVL ${issue.priority}]\n`;
        }
        summary += `\n`;
      }

      if (zeroSales.length > 0) {
        summary += `📉 Zero Sales (${zeroSales.length})\n`;
        for (const issue of zeroSales) {
          const lvlEmoji = issue.priority === 3 ? '🔴' : issue.priority === 2 ? '🟠' : '🟡';
          summary += `${lvlEmoji} ${issue.deviceName} - ${issue.timeBlock || 'Unknown'} [LVL ${issue.priority}]\n`;
        }
        summary += `\n`;
      }

      summary += `━━━━━━━━━━━━━━━━━━━━━━\n`;
      summary += `Please address these issues today.`;

      await sendStockAlert(summary);

      // Reset daily counters for all issues
      await db.issue.updateMany({
        where: {
          status: { in: ['OPEN', 'CHECKING'] }
        },
        data: {
          remindersTodayCount: 0,
          reminderResetDate: startOfToday
        }
      });

      // Log notification
      await db.notificationLog.create({
        data: {
          type: 'daily_summary',
          message: `Daily summary: ${allUnresolvedIssues.length} unresolved issues`,
          recipients: 1,
        },
      });

      return NextResponse.json({
        success: true,
        type: 'daily_summary',
        issuesCount: allUnresolvedIssues.length,
        timestamp: now.toISOString(),
      });
    }

    // === REGULAR REMINDERS (after 8am) ===
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Filter issues that need reminders (only LVL 1 issues)
    const issues = allUnresolvedIssues.filter(issue => {
      // Only send reminders for priority 1 (LVL 1) issues
      if (issue.priority > 1) return false;
      // Must be triggered more than 3 hours ago
      if (new Date(issue.triggeredAt) >= threeHoursAgo) return false;
      // Must not have had a reminder in the last hour
      if (issue.lastReminderAt && new Date(issue.lastReminderAt) >= oneHourAgo) return false;
      return true;
    });

    console.log(`[FaultReminders] Found ${issues.length} issues needing reminders`);

    let remindersSent = 0;
    let escalated = 0;

    for (const issue of issues) {
      // Check if we've already sent 3 reminders today
      const todayReminderCount = issue.remindersTodayCount || 0;
      const lastResetDate = issue.reminderResetDate ? new Date(issue.reminderResetDate) : null;

      // Reset daily counter if it's a new day
      let currentTodayCount = todayReminderCount;
      if (!lastResetDate || lastResetDate < startOfToday) {
        currentTodayCount = 0;
      }

      // Skip if already sent 3 reminders today
      if (currentTodayCount >= 3) {
        console.log(`[FaultReminders] Skipping ${issue.deviceName} - already sent 3 reminders today`);
        continue;
      }

      const elapsedMs = now.getTime() - new Date(issue.triggeredAt).getTime();
      const elapsedFormatted = formatDuration(elapsedMs);
      const newTodayCount = currentTodayCount + 1;

      // Check if this is the 3rd reminder - will escalate
      const willEscalate = newTodayCount === 3 && issue.priority < 2;
      const newPriority = willEscalate ? 2 : issue.priority;
      const priorityLevel = newPriority === 3 ? 'HIGH' : newPriority === 2 ? 'MED' : 'LOW';

      let message;
      if (issue.type === 'DEVICE_ERROR') {
        // Device Alarm Reminder format
        message = `🚨 Device Alarm (REMINDER) LVL ${newPriority}

🎯 Device ID: ${issue.deviceId}
📍 Device Name: ${issue.deviceName}
⚠️ Alarm Code: ${issue.faultCode || '-'}
💬 Alarm Name: ${issue.faultName || '-'}
⏱️ Open for: ${elapsedFormatted}
🔔 Reminder: ${newTodayCount}/3 today${willEscalate ? '\n\n‼️ ESCALATED - Requires immediate attention!' : ''}`;
      } else {
        // Zero Sales Reminder format
        message = `📉 Zero Sales (REMINDER) LVL ${newPriority}

🎯 Device ID: ${issue.deviceId}
📍 Device Name: ${issue.deviceName}
⏰ Time Block: ${issue.timeBlock || '-'}
⏱️ Open for: ${elapsedFormatted}
🔔 Reminder: ${newTodayCount}/3 today${willEscalate ? '\n\n‼️ ESCALATED - Requires immediate attention!' : ''}`;
      }

      await sendIssueAlert(message, issue.id);

      // Update reminder tracking
      const updateData = {
        lastReminderAt: now,
        reminderCount: { increment: 1 },
        remindersTodayCount: newTodayCount,
        reminderResetDate: startOfToday,
      };

      // Escalate to priority 2 if this was the 3rd reminder and not already high priority
      if (willEscalate) {
        updateData.priority = 2;
        escalated++;
        console.log(`[FaultReminders] Escalated ${issue.deviceName} to priority 2`);
      }

      await db.issue.update({
        where: { id: issue.id },
        data: updateData
      });

      remindersSent++;
      console.log(`[FaultReminders] Sent reminder #${newTodayCount}/3 today for ${issue.deviceName} (${issue.type})`);
    }

    // Log notification if any reminders sent
    if (remindersSent > 0) {
      await db.notificationLog.create({
        data: {
          type: 'fault_reminder',
          message: `Sent ${remindersSent} fault reminders${escalated > 0 ? `, escalated ${escalated} to priority 2` : ''}`,
          recipients: remindersSent,
        },
      });
    }

    console.log(`[FaultReminders] Cron job completed. Reminders sent: ${remindersSent}, Escalated: ${escalated}`);

    return NextResponse.json({
      success: true,
      remindersSent,
      escalated,
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
