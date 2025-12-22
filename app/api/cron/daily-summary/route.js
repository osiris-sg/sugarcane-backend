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

// Send message to Telegram
async function sendTelegramMessage(chatId, text) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    });
    const result = await response.json();
    if (!result.ok) {
      console.error(`[DailySummary] Telegram error for ${chatId}:`, result.description);
    }
    return result.ok;
  } catch (error) {
    console.error('Error sending Telegram message:', error);
    return false;
  }
}

// Send to ALL subscribers with a role (daily summary goes to everyone)
async function sendToAllRoles(message) {
  const subscribers = await db.subscriber.findMany({
    where: {
      role: { not: null },
    },
  });

  console.log(`[DailySummary] Sending to ${subscribers.length} subscribers (all roles)`);

  for (const subscriber of subscribers) {
    await sendTelegramMessage(subscriber.chatId, message);
  }

  return subscribers.length;
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

// Main cron handler - runs at 8am SGT daily
// Sends summary to ALL roles
export async function GET(request) {
  // Verify cron secret (optional security)
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.log('[DailySummary] Warning: No valid CRON_SECRET provided');
  }

  const now = new Date();
  console.log(`[DailySummary] Cron job started at ${now.toISOString()}`);

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
        }
      }
    }

    // Count totals
    const deviceAlarms = openIssues.filter(i => i.type === 'DEVICE_ERROR');
    const zeroSales = openIssues.filter(i => i.type === 'ZERO_SALES');
    const totalOpen = openIssues.length + lowStockItems.length;

    // Count by priority
    const allItems = [
      ...openIssues.map(i => ({ priority: i.priority })),
      ...lowStockItems.map(s => ({ priority: s.priority }))
    ];
    const lvl3Count = allItems.filter(i => i.priority === 3).length;
    const lvl2Count = allItems.filter(i => i.priority === 2).length;
    const lvl1Count = allItems.filter(i => i.priority === 1).length;

    // === Build daily summary message ===
    let message = `☀️ <b>Daily Summary (8am)</b>\n\n`;

    if (totalOpen === 0) {
      message += `✅ All clear! No open issues.\n`;
    } else {
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
    }

    // Send the summary to ALL roles
    const recipientCount = await sendToAllRoles(message);

    // Log notification
    await db.notificationLog.create({
      data: {
        type: 'daily_summary',
        message: `Daily summary: ${deviceAlarms.length} alarms, ${zeroSales.length} zero sales, ${lowStockItems.length} low stock`,
        recipients: recipientCount,
      },
    });

    console.log(`[DailySummary] Sent to ${recipientCount} subscribers`);

    return NextResponse.json({
      success: true,
      totalOpen,
      deviceAlarms: deviceAlarms.length,
      zeroSales: zeroSales.length,
      lowStock: lowStockItems.length,
      recipientCount,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('[DailySummary] Cron job error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
