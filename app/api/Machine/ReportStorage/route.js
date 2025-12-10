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

// Send storage change notification to STOCK subscribers
async function sendStorageChangeNotification(deviceName, deviceId, previousQty, newQty, change, reason) {
  const subscribers = await db.subscriber.findMany({
    where: {
      categories: { has: 'STOCK' },
    },
  });

  if (subscribers.length === 0) return;

  // Determine emoji and title based on reason
  let emoji = '🗃️';
  let title = 'STORAGE CHANGE';
  let changeText = `${change > 0 ? '+' : ''}${change}`;

  switch (reason) {
    case 'add':
      emoji = '🗃️';
      title = 'STORAGE ADDED';
      break;
    case 'remove':
      emoji = '📤';
      title = 'STORAGE REMOVED';
      break;
    case 'convert':
      emoji = '🔄';
      title = 'STORAGE CONVERTED';
      break;
  }

  const message = `${emoji} <b>${title}</b>

📍 <b>${deviceName}</b>
🎯 Device ID: ${deviceId}
📦 Storage: <b>${previousQty} → ${newQty}</b> (${changeText})`;

  console.log(`[ReportStorage] Sending ${reason} notification to ${subscribers.length} subscribers`);

  for (const subscriber of subscribers) {
    await sendTelegramMessage(subscriber.chatId, message);
  }

  // Log notification
  await db.notificationLog.create({
    data: {
      type: `storage_${reason}`,
      deviceId: String(deviceId),
      deviceName,
      message: `${title}: ${previousQty} → ${newQty}`,
      recipients: subscribers.length,
    },
  });
}

// POST /api/Machine/ReportStorage
// Called by Android app to report storage changes
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

    console.log(`[ReportStorage] Device ${deviceId} (${deviceName}): ${previousQty} -> ${quantity} (${change > 0 ? '+' : ''}${change}) reason: ${reason}`);

    // Upsert storage level
    const storage = await db.storage.upsert({
      where: { deviceId: String(deviceId) },
      update: {
        quantity: quantity,
        deviceName: deviceName || `Device ${deviceId}`,
      },
      create: {
        deviceId: String(deviceId),
        deviceName: deviceName || `Device ${deviceId}`,
        quantity: quantity,
      },
    });

    // Log storage history if we have change info
    if (change !== undefined && reason) {
      await db.storageHistory.create({
        data: {
          deviceId: String(deviceId),
          deviceName: deviceName || `Device ${deviceId}`,
          previousQty: previousQty || 0,
          newQty: quantity,
          change: change,
          reason: reason, // "add", "remove", "convert"
        },
      });

      // Send Telegram notification
      await sendStorageChangeNotification(
        deviceName || `Device ${deviceId}`,
        deviceId,
        previousQty || 0,
        quantity,
        change,
        reason
      );
    }

    return NextResponse.json({
      success: true,
      storage: {
        deviceId: storage.deviceId,
        deviceName: storage.deviceName,
        quantity: storage.quantity,
        updatedAt: storage.updatedAt,
      },
    });
  } catch (error) {
    console.error('[ReportStorage] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// GET /api/Machine/ReportStorage?deviceId=123
// Get storage level for a specific device
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');

    if (deviceId) {
      // Get specific device storage
      const storage = await db.storage.findUnique({
        where: { deviceId: String(deviceId) },
      });

      if (!storage) {
        return NextResponse.json(
          { success: false, error: 'Device not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, storage });
    }

    // Get all storages
    const storages = await db.storage.findMany({
      orderBy: { deviceName: 'asc' },
    });

    return NextResponse.json({ success: true, storages });
  } catch (error) {
    console.error('[ReportStorage] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
