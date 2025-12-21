import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db/index.js';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Time blocks for zero sales detection (Singapore time, UTC+8)
const TIME_BLOCKS = [
  { start: 8, end: 10, label: '8am-10am' },
  { start: 10, end: 12, label: '10am-12pm' },
  { start: 12, end: 14, label: '12pm-2pm' },
  { start: 14, end: 16, label: '2pm-4pm' },
  { start: 16, end: 18, label: '4pm-6pm' },
  { start: 18, end: 20, label: '6pm-8pm' },
];

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
      console.error(`[ZeroSales] Telegram error for ${chatId}:`, result.description);
    }
    return result.ok;
  } catch (error) {
    console.error('Error sending Telegram message:', error);
    return false;
  }
}

// Helper: Get current Singapore hour
function getSGHour() {
  const now = new Date();
  const sgTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Singapore' }));
  return sgTime.getHours();
}

// Helper: Check if day shift (8am-10pm)
function isDayShift() {
  const hour = getSGHour();
  return hour >= 8 && hour < 22;
}

// Get Singapore time (UTC+8)
function getSingaporeTime() {
  const now = new Date();
  // Add 8 hours to UTC to get Singapore time
  return new Date(now.getTime() + 8 * 60 * 60 * 1000);
}

// Get the current time block (if any)
function getCurrentTimeBlock(sgHour) {
  return TIME_BLOCKS.find(block => sgHour >= block.start && sgHour < block.end);
}

// Get the previous time block
function getPreviousTimeBlock(sgHour) {
  // Find the block that just ended
  const previousEndHour = sgHour;
  return TIME_BLOCKS.find(block => block.end === previousEndHour);
}

// Main cron handler - runs at the end of each time block
// Should run at: 10:00, 12:00, 14:00, 16:00, 18:00, 20:00 Singapore time
export async function GET(request) {
  // Verify cron secret (optional security)
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.log('[ZeroSales] Warning: No valid CRON_SECRET provided');
  }

  const now = new Date();
  const sgTime = getSingaporeTime();
  const sgHour = sgTime.getUTCHours();

  console.log(`[ZeroSales] Cron job started at ${now.toISOString()} (SG: ${sgHour}:00)`);

  // Get the time block that just ended
  const timeBlock = getPreviousTimeBlock(sgHour);

  if (!timeBlock) {
    console.log(`[ZeroSales] No time block ended at ${sgHour}:00 SG time, skipping`);
    return NextResponse.json({
      success: true,
      message: 'No time block to check',
      sgHour,
    });
  }

  console.log(`[ZeroSales] Checking time block: ${timeBlock.label}`);

  try {
    // Calculate the time range for the previous block
    const blockEndTime = new Date(sgTime);
    blockEndTime.setUTCHours(timeBlock.end, 0, 0, 0);
    // Convert back to UTC
    const blockEndUTC = new Date(blockEndTime.getTime() - 8 * 60 * 60 * 1000);

    const blockStartTime = new Date(sgTime);
    blockStartTime.setUTCHours(timeBlock.start, 0, 0, 0);
    // Convert back to UTC
    const blockStartUTC = new Date(blockStartTime.getTime() - 8 * 60 * 60 * 1000);

    console.log(`[ZeroSales] Checking orders between ${blockStartUTC.toISOString()} and ${blockEndUTC.toISOString()}`);

    // Get all active devices
    const stocks = await db.stock.findMany();
    const zeroSalesDevices = [];

    for (const stock of stocks) {
      // Check if there were any orders for this device in the time block
      const orders = await db.order.findMany({
        where: {
          deviceId: stock.deviceId,
          isSuccess: true,
          createdAt: {
            gte: blockStartUTC,
            lt: blockEndUTC,
          },
        },
      });

      if (orders.length === 0) {
        // Check if there's already an open Issue for this device
        const existingIssue = await db.issue.findFirst({
          where: {
            deviceId: stock.deviceId,
            type: 'ZERO_SALES',
            status: { in: ['OPEN', 'CHECKING'] }
          }
        });

        if (existingIssue) {
          console.log(`[ZeroSales] Skipping ${stock.deviceName} - existing issue pending (${existingIssue.id})`);
          continue;
        }

        // Create Issue record for tracking
        const issue = await db.issue.create({
          data: {
            deviceId: stock.deviceId,
            deviceName: stock.deviceName,
            type: 'ZERO_SALES',
            status: 'OPEN',
            timeBlock: timeBlock.label,
            stockQuantity: stock.quantity,
            stockMax: stock.maxStock,
            triggeredAt: new Date()
          }
        });

        zeroSalesDevices.push({
          deviceName: stock.deviceName,
          deviceId: stock.deviceId,
          quantity: stock.quantity,
          maxStock: stock.maxStock,
          issueId: issue.id
        });

        console.log(`[ZeroSales] Created issue for ${stock.deviceName} - no sales in ${timeBlock.label}. Issue ID: ${issue.id}`);
      } else {
        console.log(`[ZeroSales] ${stock.deviceName} had ${orders.length} orders in ${timeBlock.label}`);
      }
    }

    // Send consolidated summary if there are any zero sales
    if (zeroSalesDevices.length > 0) {
      // Build summary message
      let message = `📉 <b>Zero Sales Summary (${timeBlock.label})</b>\n\n`;
      message += `${zeroSalesDevices.length} device(s) with no sales:\n`;
      message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

      for (const device of zeroSalesDevices) {
        const percent = Math.round((device.quantity / device.maxStock) * 100);
        message += `📍 <b>${escapeHtml(device.deviceName)}</b>\n`;
        message += `   📦 ${device.quantity}/${device.maxStock} (${percent}%)\n\n`;
      }

      message += `━━━━━━━━━━━━━━━━━━━━━━`;

      // Get subscribers and send
      const roles = ['ADMIN'];
      if (isDayShift()) {
        roles.push('OPSMANAGER', 'DAYOPS');
      } else {
        roles.push('NIGHTOPS');
      }

      const subscribers = await db.subscriber.findMany({
        where: { role: { in: roles } },
      });

      console.log(`[ZeroSales] Sending summary to ${subscribers.length} subscribers`);

      for (const subscriber of subscribers) {
        await sendTelegramMessage(subscriber.chatId, message);
      }

      // Log notification
      await db.notificationLog.create({
        data: {
          type: 'zero_sales',
          message: `Zero sales summary: ${zeroSalesDevices.length} devices in ${timeBlock.label}`,
          recipients: subscribers.length,
        },
      });
    }

    console.log(`[ZeroSales] Cron job completed. Devices with zero sales: ${zeroSalesDevices.length}`);

    return NextResponse.json({
      success: true,
      timeBlock: timeBlock.label,
      zeroSalesCount: zeroSalesDevices.length,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('[ZeroSales] Cron job error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
