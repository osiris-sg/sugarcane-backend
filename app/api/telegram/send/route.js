import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db/index.js';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// In-memory cache for E50D debounce tracking
// Format: { "deviceId": timestamp }
const e50dLastSeen = new Map();
const E50D_DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutes

// Helper function to send stock/maintenance alerts
// Can be imported by other routes
export async function sendStockAlert(message, category = 'STOCK') {
  try {
    const subscribers = await db.subscriber.findMany({
      where: {
        categories: {
          has: category,
        },
      },
      select: {
        chatId: true,
      },
    });

    if (subscribers.length === 0) {
      console.log(`[Telegram] No subscribers for ${category}`);
      return { sent: 0, total: 0 };
    }

    let successCount = 0;
    for (const subscriber of subscribers) {
      const sent = await sendTelegramMessage(subscriber.chatId, message);
      if (sent) successCount++;
    }

    return { sent: successCount, total: subscribers.length };
  } catch (error) {
    console.error('[sendStockAlert] Error:', error);
    throw error;
  }
}

// Send message to a single chat
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
    return result.ok;
  } catch (error) {
    console.error(`Error sending to ${chatId}:`, error);
    return false;
  }
}

// POST /api/telegram/send
// Send notification to all subscribers of a category
export async function POST(request) {
  try {
    const body = await request.json();
    const { category, message, type, deviceId, deviceName } = body;

    if (!category || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: category, message' },
        { status: 400 }
      );
    }

    // Skip Z014 fault code
    if (message.includes('Z014')) {
      console.log('[Telegram] Skipping Z014 fault code notification');
      return NextResponse.json({
        success: true,
        sent: 0,
        skipped: true,
        reason: 'Z014 fault code filtered',
      });
    }

    // E50D debounce - only send if confirmed (second occurrence within 5 min)
    if (message.includes('E50D') && deviceId) {
      const now = Date.now();
      const lastSeen = e50dLastSeen.get(deviceId);

      if (lastSeen && (now - lastSeen) <= E50D_DEBOUNCE_MS) {
        // Second occurrence within 5 minutes - proceed to send
        console.log(`[Telegram] E50D confirmed for ${deviceId} (second occurrence within 5 min)`);
        e50dLastSeen.delete(deviceId);
      } else {
        // First occurrence or too long ago - just record and skip
        e50dLastSeen.set(deviceId, now);
        console.log(`[Telegram] E50D first occurrence for ${deviceId} - waiting for confirmation`);
        return NextResponse.json({
          success: true,
          sent: 0,
          skipped: true,
          reason: 'E50D requires confirmation within 5 minutes',
          waitingForConfirmation: true,
        });
      }
    }

    const cat = category.toUpperCase();
    if (cat !== 'STOCK' && cat !== 'MAINTENANCE') {
      return NextResponse.json(
        { error: 'Invalid category. Use STOCK or MAINTENANCE' },
        { status: 400 }
      );
    }

    // Get subscribers for this category
    const subscribers = await db.subscriber.findMany({
      where: {
        categories: {
          has: cat,
        },
      },
      select: {
        chatId: true,
      },
    });

    if (subscribers.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        message: 'No subscribers for this category',
      });
    }

    // Send to all subscribers
    let successCount = 0;
    for (const subscriber of subscribers) {
      const sent = await sendTelegramMessage(subscriber.chatId, message);
      if (sent) successCount++;
    }

    // Log the notification
    try {
      await db.notificationLog.create({
        data: {
          type: type || category.toLowerCase(),
          deviceId,
          deviceName,
          message,
          recipients: successCount,
        },
      });
    } catch (logError) {
      console.error('Error logging notification:', logError);
    }

    return NextResponse.json({
      success: true,
      sent: successCount,
      total: subscribers.length,
    });
  } catch (error) {
    console.error('Error sending notifications:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
