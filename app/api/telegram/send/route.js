import { NextResponse } from 'next/server';
import { db, getDeviceNameById } from '@/lib/db';
import {
  isDayShift,
  isNightShift,
  getSubscribersForNotification,
  sendTelegramMessage,
} from '@/lib/telegram';

// In-memory cache for E50D debounce tracking
const e50dLastSeen = new Map();
const E50D_DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutes

// POST /api/telegram/send
// Called by Android app with category, message, type, deviceId, deviceName
export async function POST(request) {
  try {
    const body = await request.json();
    const { category, message: originalMessage, type, deviceId, deviceName: reportedName } = body;

    // Look up the correct device name from database
    let correctDeviceName = reportedName;
    if (deviceId) {
      correctDeviceName = await getDeviceNameById(deviceId, reportedName);
    }

    // Replace the device name in the message if it was wrong
    let message = originalMessage;
    if (reportedName && correctDeviceName && reportedName !== correctDeviceName) {
      // Replace "Device Name: <wrong>" with "Device Name: <correct>"
      message = originalMessage.replace(
        `Device Name: ${reportedName}`,
        `Device Name: ${correctDeviceName}`
      );
      console.log(`[Telegram] Corrected device name: ${reportedName} -> ${correctDeviceName}`);
    }

    const deviceName = correctDeviceName;

    if (!message) {
      return NextResponse.json(
        { error: 'Missing required field: message' },
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
        console.log(`[Telegram] E50D confirmed for ${deviceId} (second occurrence within 5 min)`);
        e50dLastSeen.delete(deviceId);
      } else {
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

    // Determine notification type for role filtering
    const notificationType = type || 'general';

    // Get subscribers based on notification type
    const subscribers = await getSubscribersForNotification(notificationType);

    console.log(`[Telegram] Type: ${notificationType}, Subscribers: ${subscribers.length}, isDayShift: ${isDayShift()}, isNightShift: ${isNightShift()}`);

    if (subscribers.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        message: 'No subscribers for this notification type/time',
      });
    }

    // Send to all matching subscribers
    let successCount = 0;
    for (const subscriber of subscribers) {
      const sent = await sendTelegramMessage(subscriber.chatId, message);
      if (sent) successCount++;
    }

    // Log the notification
    try {
      await db.notificationLog.create({
        data: {
          type: notificationType,
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
