import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

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

// Send stock change notification to ops staff
async function sendStockChangeNotification(deviceName, deviceId, previousQty, newQty, change, reason, maxStock = 80) {
  // Only notify for non-sale and non-convert changes (convert uses ReportConversion endpoint)
  if (reason === 'sale' || reason === 'convert') return;

  // Build role filter based on shift
  const roles = ['ADMIN']; // ADMIN always gets notifications
  if (isDayShift()) {
    roles.push('OPSMANAGER', 'DAYOPS');
  } else {
    roles.push('NIGHTOPS');
  }

  const subscribers = await db.subscriber.findMany({
    where: {
      role: { in: roles },
    },
  });

  if (subscribers.length === 0) return;

  // Format timestamp in Singapore timezone
  const now = new Date();
  const timestamp = now.toLocaleString('en-SG', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).replace(',', '');

  // Determine change line based on positive/negative
  let changeLine;
  if (change > 0) {
    changeLine = `➕ Added: +${change} pcs`;
  } else {
    changeLine = `➖ Removed: ${change} pcs`;
  }

  const message = `✅ <b>Stock Level Updated</b>

🎯 Device ID: ${deviceId}
📍 Device Name: ${deviceName}
${changeLine}
📦 New Total: ${newQty} pcs
🕒 Time: ${timestamp}`;

  console.log(`[ReportStock] Sending ${reason} notification to ${subscribers.length} subscribers`);

  for (const subscriber of subscribers) {
    await sendTelegramMessage(subscriber.chatId, message);
  }

  // Log notification
  await db.notificationLog.create({
    data: {
      type: `stock_${reason}`,
      deviceId: String(deviceId),
      deviceName,
      message: `Stock ${change > 0 ? 'Added' : 'Removed'}: ${change > 0 ? '+' : ''}${change}, New Total: ${newQty}`,
      recipients: subscribers.length,
    },
  });
}

// POST /api/Machine/ReportStock
// Called by Android app to report stock changes
export async function POST(request) {
  try {
    const body = await request.json();
    const { deviceId, deviceName, quantity, previousQty, change, reason } = body;

    // Validate required fields
    if (!deviceId || quantity === undefined) {
      return NextResponse.json(
        { success: false, error: 'deviceId and quantity are required' },
        { status: 400 }
      );
    }

    console.log(`[ReportStock] Device ${deviceId} (${deviceName}): ${previousQty} -> ${quantity} (${change > 0 ? '+' : ''}${change}) reason: ${reason}`);

    // Upsert stock level
    const stock = await db.stock.upsert({
      where: { deviceId: String(deviceId) },
      update: {
        quantity: quantity,
        deviceName: deviceName || `Device ${deviceId}`,
      },
      create: {
        deviceId: String(deviceId),
        deviceName: deviceName || `Device ${deviceId}`,
        quantity: quantity,
        maxStock: 80,
      },
    });

    // Immediately clear low stock alert if stock is now above threshold (25%)
    const LOW_STOCK_THRESHOLD = 25;
    const percent = Math.round((quantity / stock.maxStock) * 100);

    if (percent > LOW_STOCK_THRESHOLD && stock.isLowStock) {
      await db.stock.update({
        where: { id: stock.id },
        data: {
          isLowStock: false,
          lowStockTriggeredAt: null,
          priority: 1,
          remindersTodayCount: 0,
        },
      });
      console.log(`[ReportStock] Cleared low stock alert for ${deviceName} (now ${percent}%)`);
    }

    // Log stock history if we have change info
    if (change !== undefined && reason) {
      await db.stockHistory.create({
        data: {
          deviceId: String(deviceId),
          deviceName: deviceName || `Device ${deviceId}`,
          previousQty: previousQty || 0,
          newQty: quantity,
          change: change,
          reason: reason, // "sale", "topup", "remove", "convert", "adjustment"
        },
      });

      // Send Telegram notification for non-sale changes
      await sendStockChangeNotification(
        deviceName || `Device ${deviceId}`,
        deviceId,
        previousQty || 0,
        quantity,
        change,
        reason,
        stock.maxStock
      );
    }

    return NextResponse.json({
      success: true,
      stock: {
        deviceId: stock.deviceId,
        deviceName: stock.deviceName,
        quantity: stock.quantity,
        updatedAt: stock.updatedAt,
      },
    });
  } catch (error) {
    console.error('[ReportStock] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// GET /api/Machine/ReportStock?deviceId=123
// Get stock level for a specific device
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');

    if (deviceId) {
      // Get specific device stock
      const stock = await db.stock.findUnique({
        where: { deviceId: String(deviceId) },
      });

      if (!stock) {
        return NextResponse.json(
          { success: false, error: 'Device not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, stock });
    }

    // Get all stocks
    const stocks = await db.stock.findMany({
      orderBy: { deviceName: 'asc' },
    });

    return NextResponse.json({ success: true, stocks });
  } catch (error) {
    console.error('[ReportStock] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
