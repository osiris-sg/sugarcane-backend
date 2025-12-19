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

// Send conversion notification to STOCK subscribers
async function sendConversionNotification(deviceName, deviceId, amount, oldStorage, newStorage, oldStock, newStock) {
  const subscribers = await db.subscriber.findMany({
    where: {
      categories: { has: 'STOCK' },
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

  const message = `🔄 <b>Storage Converted to Stock</b>

🎯 Device ID: ${deviceId}
📍 Device Name: ${deviceName}
📦 Converted: ${amount} pcs
🗃️ Storage: ${oldStorage} → ${newStorage} pcs
📦 Stock: ${oldStock} → ${newStock} pcs
🕒 Time: ${timestamp}`;

  console.log(`[ReportConversion] Sending notification to ${subscribers.length} subscribers`);

  for (const subscriber of subscribers) {
    await sendTelegramMessage(subscriber.chatId, message);
  }

  // Log notification
  await db.notificationLog.create({
    data: {
      type: 'conversion',
      deviceId: String(deviceId),
      deviceName,
      message: `Converted ${amount} pcs: Storage ${oldStorage}→${newStorage}, Stock ${oldStock}→${newStock}`,
      recipients: subscribers.length,
    },
  });
}

// POST /api/Machine/ReportConversion
// Called by Android app when converting storage to stock
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      deviceId,
      deviceName,
      amount,           // Amount being converted
      oldStorage,       // Storage before conversion
      newStorage,       // Storage after conversion
      oldStock,         // Stock before conversion
      newStock          // Stock after conversion
    } = body;

    // Validate required fields
    if (!deviceId || amount === undefined) {
      return NextResponse.json(
        { success: false, error: 'deviceId and amount are required' },
        { status: 400 }
      );
    }

    console.log(`[ReportConversion] Device ${deviceId} (${deviceName}): Converting ${amount} pcs - Storage: ${oldStorage} → ${newStorage}, Stock: ${oldStock} → ${newStock}`);

    // Update storage level
    await db.storage.upsert({
      where: { deviceId: String(deviceId) },
      update: {
        quantity: newStorage,
        deviceName: deviceName || `Device ${deviceId}`,
      },
      create: {
        deviceId: String(deviceId),
        deviceName: deviceName || `Device ${deviceId}`,
        quantity: newStorage,
      },
    });

    // Update stock level
    await db.stock.upsert({
      where: { deviceId: String(deviceId) },
      update: {
        quantity: newStock,
        deviceName: deviceName || `Device ${deviceId}`,
      },
      create: {
        deviceId: String(deviceId),
        deviceName: deviceName || `Device ${deviceId}`,
        quantity: newStock,
        maxStock: 80,
      },
    });

    // Log storage history
    await db.storageHistory.create({
      data: {
        deviceId: String(deviceId),
        deviceName: deviceName || `Device ${deviceId}`,
        previousQty: oldStorage,
        newQty: newStorage,
        change: -amount,
        reason: 'convert',
      },
    });

    // Log stock history
    await db.stockHistory.create({
      data: {
        deviceId: String(deviceId),
        deviceName: deviceName || `Device ${deviceId}`,
        previousQty: oldStock,
        newQty: newStock,
        change: amount,
        reason: 'convert',
      },
    });

    // Send single combined Telegram notification
    await sendConversionNotification(
      deviceName || `Device ${deviceId}`,
      deviceId,
      amount,
      oldStorage,
      newStorage,
      oldStock,
      newStock
    );

    return NextResponse.json({
      success: true,
      conversion: {
        deviceId,
        amount,
        storage: { old: oldStorage, new: newStorage },
        stock: { old: oldStock, new: newStock },
      },
    });
  } catch (error) {
    console.error('[ReportConversion] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
