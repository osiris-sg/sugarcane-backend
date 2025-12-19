import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db/index.js';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const LOW_STOCK_THRESHOLD = 25; // Alert when stock <= 25%

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

// Get subscribers for stock alerts based on time
// - OPSMANAGER: 8am-10pm only
// - DAYOPS: 8am-10pm only
// - NIGHTOPS: 10pm-8am only
// - ADMIN: never (only daily summary)
async function getSubscribersForStockAlert() {
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

// Send stock alert to subscribers
async function sendStockAlert(message) {
  const subscribers = await getSubscribersForStockAlert();

  console.log(`[StockAlert] Sending to ${subscribers.length} subscribers (isDayShift: ${isDayShift()}, isNightShift: ${isNightShift()})`);

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

// Main cron handler - runs every hour
// Only detects NEW low stock and sends initial alert
// Reminders are handled by hourly-summary cron
export async function GET(request) {
  // Verify cron secret (optional security)
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.log('[StockAlert] Warning: No valid CRON_SECRET provided');
  }

  const now = new Date();
  console.log('[StockAlert] Cron job started at', now.toISOString());

  try {
    // Get all stocks
    const stocks = await db.stock.findMany();
    let newAlerts = 0;
    let resolved = 0;

    for (const stock of stocks) {
      const percent = Math.round((stock.quantity / stock.maxStock) * 100);
      const isLowStock = percent <= LOW_STOCK_THRESHOLD;

      // === CASE 1: New low stock detected - send initial alert ===
      if (isLowStock && !stock.isLowStock) {
        const emoji = getStockEmoji(percent);
        const level = getStockLevel(percent);

        await db.stock.update({
          where: { id: stock.id },
          data: {
            isLowStock: true,
            lowStockTriggeredAt: now,
            priority: 1,
          }
        });

        const message = `${emoji} ${level} Alert

🎯 Device ID: ${stock.deviceId}
📍 Device Name: ${stock.deviceName}
📊 Stock: ${stock.quantity}/${stock.maxStock} pcs (${percent}%)`;

        const recipientCount = await sendStockAlert(message);
        newAlerts++;
        console.log(`[StockAlert] New low stock for ${stock.deviceName} (${percent}%), sent to ${recipientCount} subscribers`);
      }

      // === CASE 2: Stock back above threshold - auto resolve ===
      else if (!isLowStock && stock.isLowStock) {
        await db.stock.update({
          where: { id: stock.id },
          data: {
            isLowStock: false,
            lowStockTriggeredAt: null,
            priority: 1,
          }
        });
        resolved++;
        console.log(`[StockAlert] Resolved low stock for ${stock.deviceName} (now ${percent}%)`);
      }
    }

    // Log notification
    if (newAlerts > 0) {
      await db.notificationLog.create({
        data: {
          type: 'stock_alert',
          message: `Stock alerts: ${newAlerts} new`,
          recipients: newAlerts,
        },
      });
    }

    console.log(`[StockAlert] Completed. New: ${newAlerts}, Resolved: ${resolved}`);

    return NextResponse.json({
      success: true,
      newAlerts,
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
