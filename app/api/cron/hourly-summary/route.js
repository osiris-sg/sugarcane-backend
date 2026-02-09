import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db/index.js';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Check if current time is within day shift hours (8am to 10pm Singapore time)
function isDayShift() {
  const now = new Date();
  const sgTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const sgHour = sgTime.getUTCHours();
  return sgHour >= 8 && sgHour < 22;
}

// Check if current time is within night shift hours (10pm to 8am Singapore time)
function isNightShift() {
  const now = new Date();
  const sgTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const sgHour = sgTime.getUTCHours();
  return sgHour >= 22 || sgHour < 8;
}

// Get Singapore hour for display
function getSGHour() {
  const now = new Date();
  const sgTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return sgTime.getUTCHours();
}

// Format Singapore time
function formatSGTime(date) {
  return new Date(date).toLocaleString('en-SG', {
    timeZone: 'Asia/Singapore',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

// Format duration in human readable format
function formatElapsed(ms) {
  const minutes = Math.floor(ms / (60 * 1000));
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

// Send message to Telegram
async function sendTelegramMessage(chatId, text) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
      }),
    });
    const result = await response.json();
    if (!result.ok) {
      console.error(`[HourlySummary] Telegram error for ${chatId}:`, result.description);
    }
    return result.ok;
  } catch (error) {
    console.error(`[HourlySummary] Error sending to ${chatId}:`, error);
    return false;
  }
}

// Get subscribers for hourly summary based on time
async function getSubscribersForHourlySummary() {
  const roles = [];

  if (isDayShift()) {
    roles.push('OPSMANAGER', 'DAYOPS');
  } else if (isNightShift()) {
    roles.push('NIGHTOPS');
  }

  if (roles.length === 0) {
    return [];
  }

  const subscribers = await db.subscriber.findMany({
    where: {
      role: { in: roles },
    },
  });

  return subscribers;
}

// Main cron handler - runs every hour
// Sends simplified summary nudge - details are in the app
export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.log('[HourlySummary] Warning: No valid CRON_SECRET provided');
  }

  const now = new Date();
  const sgHour = getSGHour();
  console.log(`[HourlySummary] Cron job started at ${now.toISOString()} (${sgHour}:00 SGT)`);

  try {
    // Get open incidents from new Incident model
    const openIncidents = await db.incident.findMany({
      where: {
        status: { in: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'] },
      },
      orderBy: { startTime: 'asc' },
    });

    // Also check legacy Issue table for any remaining items
    const openIssues = await db.issue.findMany({
      where: {
        status: { in: ['OPEN', 'CHECKING'] },
      },
      orderBy: { triggeredAt: 'asc' },
    });

    // Get low stock items
    const lowStockItems = await db.stock.findMany({
      where: { isLowStock: true },
      orderBy: { lowStockTriggeredAt: 'asc' },
    });

    // Count totals
    const totalOpen = openIncidents.length + openIssues.length + lowStockItems.length;
    const slaBreaches = openIncidents.filter((i) => i.slaOutcome === 'SLA_BREACHED').length;

    // Skip if nothing to report
    if (totalOpen === 0) {
      console.log('[HourlySummary] No open issues to report');
      return NextResponse.json({
        success: true,
        message: 'No open issues',
        totalOpen: 0,
        timestamp: now.toISOString(),
      });
    }

    // Find oldest issue
    let oldestTime = null;
    let oldestName = '';

    if (openIncidents.length > 0) {
      const oldest = openIncidents[0];
      oldestTime = new Date(oldest.startTime);
      oldestName = oldest.deviceName;
    } else if (openIssues.length > 0) {
      const oldest = openIssues[0];
      oldestTime = new Date(oldest.triggeredAt);
      oldestName = oldest.deviceName;
    } else if (lowStockItems.length > 0 && lowStockItems[0].lowStockTriggeredAt) {
      oldestTime = new Date(lowStockItems[0].lowStockTriggeredAt);
      oldestName = lowStockItems[0].deviceName;
    }

    const elapsed = oldestTime ? formatElapsed(now.getTime() - oldestTime.getTime()) : 'N/A';
    const oldestTimeStr = oldestTime ? formatSGTime(oldestTime) : 'N/A';

    // Build simplified summary message (as per plan)
    let message = `📋 Outstanding Faults: ${totalOpen}\n`;
    message += `• Oldest fault: ${oldestTimeStr} (${elapsed} elapsed)\n`;
    message += `• SLA breaches: ${slaBreaches}\n`;
    message += `\n(Please check app for details)`;

    // Get subscribers
    const subscribers = await getSubscribersForHourlySummary();

    console.log(`[HourlySummary] Sending to ${subscribers.length} subscribers`);

    // Send the summary
    for (const subscriber of subscribers) {
      await sendTelegramMessage(subscriber.chatId, message);
    }

    // Log notification
    await db.notificationLog.create({
      data: {
        type: 'hourly_summary',
        message: `Hourly summary: ${totalOpen} open, ${slaBreaches} breaches`,
        recipients: subscribers.length,
      },
    });

    console.log(`[HourlySummary] Sent summary: ${totalOpen} open, ${slaBreaches} breaches`);

    return NextResponse.json({
      success: true,
      totalOpen,
      slaBreaches,
      recipientCount: subscribers.length,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('[HourlySummary] Cron job error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
