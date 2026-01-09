import { NextResponse } from 'next/server';
import { db, getDeviceNameById } from '@/lib/db';

// POST /api/temperature/alert - Receive temperature alert from device
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      deviceId,
      deviceName: reportedName,
      currentTemp1,
      currentTemp2,
      initialTemp1,
      initialTemp2,
      reason,
      alertType
    } = body;

    if (!deviceId) {
      return NextResponse.json(
        { success: false, error: 'deviceId is required' },
        { status: 400 }
      );
    }

    // Look up the correct device name from database
    const deviceName = await getDeviceNameById(deviceId, reportedName);

    // Create temperature alert record
    const alert = await db.temperatureAlert.create({
      data: {
        deviceId: String(deviceId),
        deviceName,
        currentTemp1: currentTemp1 || 0,
        currentTemp2: currentTemp2 || 0,
        initialTemp1: initialTemp1 || 0,
        initialTemp2: initialTemp2 || 0,
        reason: reason || 'Temperature anomaly detected',
        alertType: alertType || 'TEMPERATURE_RISING',
        status: 'OPEN'
      }
    });

    // Send Telegram notification
    const telegramMessage = `🌡️ *TEMPERATURE ALERT*\n\n` +
      `📍 Device: ${deviceName}\n` +
      `⚠️ Type: ${alertType}\n` +
      `📝 Reason: ${reason}\n\n` +
      `📊 Current Temps:\n` +
      `  • Refrigeration: ${currentTemp1?.toFixed(1) || 'N/A'}°C\n` +
      `  • Machine: ${currentTemp2?.toFixed(1) || 'N/A'}°C\n\n` +
      `📊 Initial Temps (5 min ago):\n` +
      `  • Refrigeration: ${initialTemp1?.toFixed(1) || 'N/A'}°C\n` +
      `  • Machine: ${initialTemp2?.toFixed(1) || 'N/A'}°C\n\n` +
      `⏰ Time: ${new Date().toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })}`;

    // Send to Telegram
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = process.env.TELEGRAM_CHAT_ID;

    if (telegramToken && telegramChatId) {
      try {
        await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: telegramChatId,
            text: telegramMessage,
            parse_mode: 'Markdown'
          })
        });
      } catch (telegramError) {
        console.error('Failed to send Telegram alert:', telegramError);
      }
    }

    return NextResponse.json({
      success: true,
      alertId: alert.id,
      message: 'Temperature alert received and logged'
    });

  } catch (error) {
    console.error('Temperature alert error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
