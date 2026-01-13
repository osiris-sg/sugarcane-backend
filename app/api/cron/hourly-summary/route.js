import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db/index.js';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Escape HTML special characters for Telegram
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

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

// Telegram message limit
const TELEGRAM_MAX_LENGTH = 4000; // Leave some buffer from 4096

// Split long message into chunks
function splitMessage(text, maxLength = TELEGRAM_MAX_LENGTH) {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Find a good split point (double newline preferred, then single newline)
    let splitIndex = remaining.lastIndexOf('\n\n', maxLength);
    if (splitIndex === -1 || splitIndex < maxLength / 2) {
      splitIndex = remaining.lastIndexOf('\n', maxLength);
    }
    if (splitIndex === -1 || splitIndex < maxLength / 2) {
      splitIndex = maxLength;
    }

    chunks.push(remaining.substring(0, splitIndex));
    remaining = remaining.substring(splitIndex).trimStart();
  }

  return chunks;
}

// Send message to Telegram (handles long messages by splitting)
async function sendTelegramMessage(chatId, text) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const chunks = splitMessage(text);

  let allSuccess = true;
  for (let i = 0; i < chunks.length; i++) {
    const chunk = i > 0 ? `(cont'd)\n${chunks[i]}` : chunks[i];

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: chunk,
          parse_mode: 'HTML',
        }),
      });
      const result = await response.json();
      if (!result.ok) {
        console.error(`[HourlySummary] Telegram error for ${chatId}:`, result.description);
        allSuccess = false;
      } else if (i === 0) {
        console.log(`[HourlySummary] Sent to ${chatId}${chunks.length > 1 ? ` (${chunks.length} parts)` : ''}`);
      }
    } catch (error) {
      console.error(`[HourlySummary] Error sending to ${chatId}:`, error);
      allSuccess = false;
    }
  }

  return allSuccess;
}

// Get subscribers for hourly summary based on time
// - OPSMANAGER: 8am-10pm only
// - DAYOPS: 8am-10pm only
// - NIGHTOPS: 10pm-8am only
// - ADMIN: never (only daily summary)
async function getSubscribersForHourlySummary() {
  const roles = [];

  if (isDayShift()) {
    // Day shift (8am-10pm): OPSMANAGER and DAYOPS
    roles.push('OPSMANAGER', 'DAYOPS');
  } else if (isNightShift()) {
    // Night shift (10pm-8am): Only NIGHTOPS
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

// Format milliseconds to human-readable duration
function formatDuration(ms) {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  } else {
    return `${hours}h`;
  }
}

// Calculate priority based on how long issue has been open
// LVL 1: 0-24 hours
// LVL 2: 24-48 hours
// LVL 3: 48+ hours
function calculatePriority(triggeredAt) {
  const now = new Date();
  const hoursOpen = (now.getTime() - new Date(triggeredAt).getTime()) / (1000 * 60 * 60);

  if (hoursOpen >= 48) return 3;
  if (hoursOpen >= 24) return 2;
  return 1;
}

// Get priority emoji
function getPriorityEmoji(priority) {
  if (priority === 3) return '🔴';
  if (priority === 2) return '🟠';
  return '🟡';
}

// Main cron handler - runs every hour
// Sends ONE consolidated summary of ALL open issues
// Sent to: OPSMANAGER (8am-10pm), DAYOPS (8am-10pm), NIGHTOPS (10pm-8am)
// ADMIN only gets daily summary at 8am
export async function GET(request) {
  // Verify cron secret (optional security)
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.log('[HourlySummary] Warning: No valid CRON_SECRET provided');
  }

  const now = new Date();
  const sgHour = getSGHour();
  console.log(`[HourlySummary] Cron job started at ${now.toISOString()} (${sgHour}:00 SGT)`);

  try {
    // === Collect all open issues ===

    // 1. Device Alarms & Zero Sales (from Issue table)
    const openIssues = await db.issue.findMany({
      where: {
        status: { in: ['OPEN', 'CHECKING'] }
      },
      orderBy: { triggeredAt: 'asc' }
    });

    // 2. Low Stock (from Stock table)
    const lowStockItems = await db.stock.findMany({
      where: { isLowStock: true },
      orderBy: { lowStockTriggeredAt: 'asc' }
    });

    // Update priorities based on time open
    for (const issue of openIssues) {
      const newPriority = calculatePriority(issue.triggeredAt);
      if (newPriority !== issue.priority) {
        await db.issue.update({
          where: { id: issue.id },
          data: { priority: newPriority }
        });
        issue.priority = newPriority;
        console.log(`[HourlySummary] Updated ${issue.deviceName} priority to LVL ${newPriority}`);
      }
    }

    for (const stock of lowStockItems) {
      if (stock.lowStockTriggeredAt) {
        const newPriority = calculatePriority(stock.lowStockTriggeredAt);
        if (newPriority !== stock.priority) {
          await db.stock.update({
            where: { id: stock.id },
            data: { priority: newPriority }
          });
          stock.priority = newPriority;
          console.log(`[HourlySummary] Updated ${stock.deviceName} stock priority to LVL ${newPriority}`);
        }
      }
    }

    // Count totals
    const deviceAlarms = openIssues.filter(i => i.type === 'DEVICE_ERROR');
    const zeroSales = openIssues.filter(i => i.type === 'ZERO_SALES');
    const totalOpen = openIssues.length + lowStockItems.length;

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

    // Count by priority
    const allItems = [
      ...openIssues.map(i => ({ priority: i.priority })),
      ...lowStockItems.map(s => ({ priority: s.priority }))
    ];
    const lvl3Count = allItems.filter(i => i.priority === 3).length;
    const lvl2Count = allItems.filter(i => i.priority === 2).length;
    const lvl1Count = allItems.filter(i => i.priority === 1).length;

    // === Build summary message ===
    let message = `📋 Hourly Summary (${sgHour}:00)\n\n`;
    message += `Total: ${totalOpen} open issue(s)`;
    if (lvl3Count > 0) message += ` | 🔴 ${lvl3Count}`;
    if (lvl2Count > 0) message += ` | 🟠 ${lvl2Count}`;
    if (lvl1Count > 0) message += ` | 🟡 ${lvl1Count}`;
    message += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;

    // Device Alarms
    if (deviceAlarms.length > 0) {
      message += `\n🚨 <b>Device Alarms (${deviceAlarms.length})</b>\n`;
      for (const issue of deviceAlarms) {
        const emoji = getPriorityEmoji(issue.priority);
        const duration = formatDuration(now.getTime() - new Date(issue.triggeredAt).getTime());
        const triggeredTime = new Date(issue.triggeredAt).toLocaleString('en-SG', {
          timeZone: 'Asia/Singapore',
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
        message += `${emoji} <b>${escapeHtml(issue.deviceName)}</b>\n`;
        message += `${escapeHtml(issue.faultName) || 'Unknown fault'} (${escapeHtml(issue.faultCode) || '-'})\n`;
        message += `📅 ${triggeredTime} | 🕐 ${duration} ago\n\n`;
      }
    }

    // Zero Sales
    if (zeroSales.length > 0) {
      message += `\n📉 <b>Zero Sales (${zeroSales.length})</b>\n`;
      for (const issue of zeroSales) {
        const emoji = getPriorityEmoji(issue.priority);
        const duration = formatDuration(now.getTime() - new Date(issue.triggeredAt).getTime());
        const triggeredTime = new Date(issue.triggeredAt).toLocaleString('en-SG', {
          timeZone: 'Asia/Singapore',
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
        message += `${emoji} <b>${escapeHtml(issue.deviceName)}</b>\n`;
        if (issue.stockQuantity !== null && issue.stockMax !== null) {
          const percent = Math.round((issue.stockQuantity / issue.stockMax) * 100);
          message += `📦 ${issue.stockQuantity}/${issue.stockMax} (${percent}%)\n`;
        }
        message += `📅 ${triggeredTime} | 🕐 ${duration} ago\n\n`;
      }
    }

    // Low Stock
    if (lowStockItems.length > 0) {
      message += `\n📦 <b>Low Stock (${lowStockItems.length})</b>\n`;
      for (const stock of lowStockItems) {
        const emoji = getPriorityEmoji(stock.priority);
        const percent = Math.round((stock.quantity / stock.maxStock) * 100);
        const duration = stock.lowStockTriggeredAt
          ? formatDuration(now.getTime() - new Date(stock.lowStockTriggeredAt).getTime())
          : '-';
        const triggeredTime = stock.lowStockTriggeredAt
          ? new Date(stock.lowStockTriggeredAt).toLocaleString('en-SG', {
              timeZone: 'Asia/Singapore',
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            })
          : '-';
        message += `${emoji} <b>${escapeHtml(stock.deviceName)}</b>\n`;
        message += `📦 ${stock.quantity}/${stock.maxStock} (${percent}%)\n`;
        message += `📅 ${triggeredTime} | 🕐 ${duration} ago\n\n`;
      }
    }

    message += `━━━━━━━━━━━━━━━━━━━━━━`;
    message += `\n🔴 &gt;48h | 🟠 &gt;24h | 🟡 &lt;24h`;

    // Get subscribers based on time of day
    const subscribers = await getSubscribersForHourlySummary();

    console.log(`[HourlySummary] Sending to ${subscribers.length} subscribers (isDayShift: ${isDayShift()}, isNightShift: ${isNightShift()})`);

    // Send the summary
    for (const subscriber of subscribers) {
      await sendTelegramMessage(subscriber.chatId, message);
    }

    // Log notification
    await db.notificationLog.create({
      data: {
        type: 'hourly_summary',
        message: `Hourly summary: ${deviceAlarms.length} alarms, ${zeroSales.length} zero sales, ${lowStockItems.length} low stock`,
        recipients: subscribers.length,
      },
    });

    console.log(`[HourlySummary] Sent summary: ${deviceAlarms.length} alarms, ${zeroSales.length} zero sales, ${lowStockItems.length} low stock`);

    return NextResponse.json({
      success: true,
      totalOpen,
      deviceAlarms: deviceAlarms.length,
      zeroSales: zeroSales.length,
      lowStock: lowStockItems.length,
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
