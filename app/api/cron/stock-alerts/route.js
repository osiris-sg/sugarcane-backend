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

  console.log(`[StockAlert] Sending to ${subscribers.length} subscribers`);

  for (const subscriber of subscribers) {
    await sendTelegramMessage(subscriber.chatId, message);
  }

  return subscribers.length;
}

// Get alert level based on stock percentage
function getAlertLevel(percent) {
  if (percent <= 0) return '0';
  if (percent <= 15) return '15';
  if (percent <= 25) return '25';
  return null; // No recurring alert needed above 25%
}

// Get reminder interval in milliseconds
function getReminderInterval(alertLevel) {
  switch (alertLevel) {
    case '0': return 30 * 60 * 1000;      // 30 minutes
    case '15': return 60 * 60 * 1000;     // 1 hour
    case '25': return 2 * 60 * 60 * 1000; // 2 hours
    default: return null;
  }
}

// Get emoji for alert level
function getAlertEmoji(alertLevel) {
  switch (alertLevel) {
    case '0': return '⚫';
    case '15': return '🔴';
    case '25': return '🟠';
    default: return '🟡';
  }
}

// Main cron handler - runs every 30 minutes
export async function GET(request) {
  // Verify cron secret (optional security)
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // Allow without auth for testing, but log warning
    console.log('[StockAlert] Warning: No valid CRON_SECRET provided');
  }

  console.log('[StockAlert] Cron job started at', new Date().toISOString());

  // Skip during quiet hours (8pm to 8am Singapore time)
  if (isQuietHours()) {
    console.log('[StockAlert] Skipping - quiet hours (8pm-8am SGT)');
    return NextResponse.json({
      success: true,
      message: 'Skipped - quiet hours',
      alertsSent: 0,
      timestamp: new Date().toISOString(),
    });
  }

  try {
    // Get all stocks
    const stocks = await db.stock.findMany();
    const now = new Date();
    let alertsSent = 0;

    for (const stock of stocks) {
      const percent = Math.round((stock.quantity / stock.maxStock) * 100);
      const alertLevel = getAlertLevel(percent);

      // Skip if no recurring alert needed (above 25%)
      if (!alertLevel) {
        // Clear alert tracking if stock is back above threshold
        if (stock.alertLevel) {
          await db.stock.update({
            where: { id: stock.id },
            data: { alertLevel: null, lastAlertAt: null },
          });
        }
        continue;
      }

      const reminderInterval = getReminderInterval(alertLevel);
      const lastAlert = stock.lastAlertAt ? new Date(stock.lastAlertAt) : null;
      const timeSinceLastAlert = lastAlert ? now - lastAlert : Infinity;

      // Check if we need to send a reminder
      const needsReminder = timeSinceLastAlert >= reminderInterval;

      if (needsReminder) {
        const emoji = getAlertEmoji(alertLevel);
        const intervalText = alertLevel === '0' ? '30 min' : alertLevel === '15' ? '1 hour' : '2 hours';

        // Priority level based on stock level: 0% = HIGH (3), 15% = MED (2), 25% = LOW (1)
        let priority = 1;
        let urgency = 'Low Stock';
        if (alertLevel === '0') {
          urgency = 'Out of Stock';
          priority = 3;
        } else if (alertLevel === '15') {
          urgency = 'Critical Stock';
          priority = 2;
        }

        const message = `${emoji} ${urgency} (REMINDER) LVL ${priority}

🎯 Device ID: ${stock.deviceId}
📍 Device Name: ${stock.deviceName}
📊 Stock: ${stock.quantity}/${stock.maxStock} pcs (${percent}%)
⏰ Next reminder: ${intervalText}`;

        await sendStockAlert(message);
        alertsSent++;

        // Update last alert time
        await db.stock.update({
          where: { id: stock.id },
          data: {
            alertLevel,
            lastAlertAt: now,
          },
        });

        console.log(`[StockAlert] Sent ${alertLevel}% alert for ${stock.deviceName}`);
      }
    }

    // Log notification
    if (alertsSent > 0) {
      await db.notificationLog.create({
        data: {
          type: 'stock_reminder',
          message: `Sent ${alertsSent} recurring stock alerts`,
          recipients: alertsSent,
        },
      });
    }

    console.log(`[StockAlert] Cron job completed. Alerts sent: ${alertsSent}`);

    return NextResponse.json({
      success: true,
      alertsSent,
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
