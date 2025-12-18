import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db/index.js';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const LOW_STOCK_THRESHOLD = 25; // Alert when stock <= 25%

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
  return sgHour === 8;
}

// Get start of today in Singapore time (midnight SGT)
function getStartOfDaySGT() {
  const now = new Date();
  const sgTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  sgTime.setUTCHours(0, 0, 0, 0);
  return new Date(sgTime.getTime() - 8 * 60 * 60 * 1000);
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

// Send stock alert to all STOCK subscribers (no buttons - just alert)
async function sendStockAlert(message) {
  const subscribers = await db.subscriber.findMany({
    where: {
      categories: { has: 'STOCK' },
    },
  });

  console.log(`[StockAlert] Sending to ${subscribers.length} subscribers`);

  for (const subscriber of subscribers) {
    await sendTelegramMessage(subscriber.chatId, message);
  }

  return subscribers.length;
}

// Get stock level description
function getStockLevel(percent) {
  if (percent <= 0) return 'Out of Stock';
  if (percent <= 15) return 'Critical Stock';
  return 'Low Stock';
}

// Get emoji for stock level
function getStockEmoji(percent) {
  if (percent <= 0) return '⚫';
  if (percent <= 15) return '🔴';
  return '🟠';
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

// Main cron handler - runs every hour
// Detects new low stock, sends initial alerts, and reminders
// At 8am: Daily summary handled by fault-reminders cron
export async function GET(request) {
  // Verify cron secret (optional security)
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.log('[StockAlert] Warning: No valid CRON_SECRET provided');
  }

  const now = new Date();
  console.log('[StockAlert] Cron job started at', now.toISOString());

  // Skip during quiet hours (10pm to 8am Singapore time)
  if (isQuietHours()) {
    console.log('[StockAlert] Skipping - quiet hours (10pm-8am SGT)');
    return NextResponse.json({
      success: true,
      message: 'Skipped - quiet hours',
      alertsSent: 0,
      timestamp: now.toISOString(),
    });
  }

  try {
    const startOfToday = getStartOfDaySGT();
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Get all stocks
    const stocks = await db.stock.findMany();
    let newAlerts = 0;
    let remindersSent = 0;
    let escalated = 0;
    let resolved = 0;

    // === 8AM: Reset daily counters and escalate LVL 2 → LVL 3 ===
    if (isFirstRunOfDay()) {
      // Escalate LVL 2 low stock to LVL 3
      const lvl2Stocks = stocks.filter(s => s.isLowStock && s.priority === 2);
      if (lvl2Stocks.length > 0) {
        await db.stock.updateMany({
          where: {
            id: { in: lvl2Stocks.map(s => s.id) },
            isLowStock: true,
            priority: 2
          },
          data: { priority: 3 }
        });
        console.log(`[StockAlert] Escalated ${lvl2Stocks.length} low stock items from LVL 2 to LVL 3`);
      }

      // Reset daily counters for all low stock
      await db.stock.updateMany({
        where: { isLowStock: true },
        data: {
          remindersTodayCount: 0,
          reminderResetDate: startOfToday
        }
      });
      console.log('[StockAlert] Reset daily reminder counters');
    }

    for (const stock of stocks) {
      const percent = Math.round((stock.quantity / stock.maxStock) * 100);
      const isLowStock = percent <= LOW_STOCK_THRESHOLD;

      // === CASE 1: New low stock detected ===
      if (isLowStock && !stock.isLowStock) {
        const emoji = getStockEmoji(percent);
        const level = getStockLevel(percent);

        await db.stock.update({
          where: { id: stock.id },
          data: {
            isLowStock: true,
            lowStockTriggeredAt: now,
            priority: 1,
            remindersTodayCount: 0,
            reminderResetDate: startOfToday,
            lastAlertAt: now
          }
        });

        const message = `${emoji} ${level} Alert LVL 1

🎯 Device ID: ${stock.deviceId}
📍 Device Name: ${stock.deviceName}
📊 Stock: ${stock.quantity}/${stock.maxStock} pcs (${percent}%)`;

        await sendStockAlert(message);
        newAlerts++;
        console.log(`[StockAlert] New low stock for ${stock.deviceName} (${percent}%)`);
      }

      // === CASE 2: Stock back above threshold - auto resolve ===
      else if (!isLowStock && stock.isLowStock) {
        await db.stock.update({
          where: { id: stock.id },
          data: {
            isLowStock: false,
            lowStockTriggeredAt: null,
            priority: 1,
            remindersTodayCount: 0,
            lastAlertAt: null
          }
        });
        resolved++;
        console.log(`[StockAlert] Resolved low stock for ${stock.deviceName} (now ${percent}%)`);
      }

      // === CASE 3: Still low stock - check if reminder needed ===
      else if (isLowStock && stock.isLowStock) {
        // Only LVL 1 gets reminders
        if (stock.priority > 1) continue;

        // Must be triggered more than 3 hours ago
        if (!stock.lowStockTriggeredAt || new Date(stock.lowStockTriggeredAt) >= threeHoursAgo) continue;

        // Must not have had a reminder in the last hour
        if (stock.lastAlertAt && new Date(stock.lastAlertAt) >= oneHourAgo) continue;

        // Check daily reminder count
        let currentTodayCount = stock.remindersTodayCount || 0;
        const lastResetDate = stock.reminderResetDate ? new Date(stock.reminderResetDate) : null;
        if (!lastResetDate || lastResetDate < startOfToday) {
          currentTodayCount = 0;
        }

        // Skip if already sent 3 reminders today
        if (currentTodayCount >= 3) {
          console.log(`[StockAlert] Skipping ${stock.deviceName} - already sent 3 reminders today`);
          continue;
        }

        const newTodayCount = currentTodayCount + 1;
        const willEscalate = newTodayCount === 3;
        const newPriority = willEscalate ? 2 : stock.priority;

        const elapsedMs = now.getTime() - new Date(stock.lowStockTriggeredAt).getTime();
        const elapsedFormatted = formatDuration(elapsedMs);
        const emoji = getStockEmoji(percent);
        const level = getStockLevel(percent);

        const message = `${emoji} ${level} (REMINDER) LVL ${newPriority}

🎯 Device ID: ${stock.deviceId}
📍 Device Name: ${stock.deviceName}
📊 Stock: ${stock.quantity}/${stock.maxStock} pcs (${percent}%)
⏱️ Open for: ${elapsedFormatted}
🔔 Reminder: ${newTodayCount}/3 today${willEscalate ? '\n\n‼️ ESCALATED - Requires immediate attention!' : ''}`;

        await sendStockAlert(message);

        const updateData = {
          lastAlertAt: now,
          remindersTodayCount: newTodayCount,
          reminderResetDate: startOfToday,
        };

        if (willEscalate) {
          updateData.priority = 2;
          escalated++;
          console.log(`[StockAlert] Escalated ${stock.deviceName} to LVL 2`);
        }

        await db.stock.update({
          where: { id: stock.id },
          data: updateData
        });

        remindersSent++;
        console.log(`[StockAlert] Sent reminder #${newTodayCount}/3 for ${stock.deviceName}`);
      }
    }

    // Log notification
    if (newAlerts > 0 || remindersSent > 0) {
      await db.notificationLog.create({
        data: {
          type: 'stock_alert',
          message: `Stock alerts: ${newAlerts} new, ${remindersSent} reminders, ${escalated} escalated`,
          recipients: newAlerts + remindersSent,
        },
      });
    }

    console.log(`[StockAlert] Completed. New: ${newAlerts}, Reminders: ${remindersSent}, Escalated: ${escalated}, Resolved: ${resolved}`);

    return NextResponse.json({
      success: true,
      newAlerts,
      remindersSent,
      escalated,
      resolved,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('[StockAlert] Cron job error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
