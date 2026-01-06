import { db } from '@/lib/db';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Check if current time is within day shift hours (8am to 10pm Singapore time)
export function isDayShift() {
  const now = new Date();
  const sgTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const sgHour = sgTime.getUTCHours();
  return sgHour >= 8 && sgHour < 22;
}

// Check if current time is within night shift hours (10pm to 8am Singapore time)
export function isNightShift() {
  const now = new Date();
  const sgTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const sgHour = sgTime.getUTCHours();
  return sgHour >= 22 || sgHour < 8;
}

// Get subscribers based on notification type and time
// - OPSMANAGER: 8am-10pm only (including maintenance_login)
// - DAYOPS: 8am-10pm (no maintenance_login)
// - NIGHTOPS: 10pm-8am (no maintenance_login)
// - ADMIN: never gets real-time alerts (only daily summary)
export async function getSubscribersForNotification(type) {
  const roles = [];

  if (isDayShift()) {
    // Day shift (8am-10pm): OPSMANAGER and DAYOPS
    roles.push('OPSMANAGER');
    if (type !== 'maintenance_login') {
      roles.push('DAYOPS');
    }
  } else if (isNightShift()) {
    // Night shift (10pm-8am): Only NIGHTOPS (no OPSMANAGER)
    if (type !== 'maintenance_login') {
      roles.push('NIGHTOPS');
    }
  }

  if (roles.length === 0) {
    return [];
  }

  const subscribers = await db.subscriber.findMany({
    where: {
      role: { in: roles },
    },
    select: {
      chatId: true,
      role: true,
    },
  });

  return subscribers;
}

// Send message with inline keyboard
export async function sendTelegramMessageWithButtons(chatId, text, replyMarkup) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: replyMarkup,
      }),
    });

    const result = await response.json();
    return result.ok;
  } catch (error) {
    console.error(`Error sending to ${chatId}:`, error);
    return false;
  }
}

// Send message to a single chat
export async function sendTelegramMessage(chatId, text) {
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

// Helper function to send alerts based on type
export async function sendAlert(message, type = 'general') {
  try {
    const subscribers = await getSubscribersForNotification(type);

    if (subscribers.length === 0) {
      console.log(`[Telegram] No subscribers for type: ${type}`);
      return { sent: 0, total: 0 };
    }

    let successCount = 0;
    for (const subscriber of subscribers) {
      const sent = await sendTelegramMessage(subscriber.chatId, message);
      if (sent) successCount++;
    }

    return { sent: successCount, total: subscribers.length };
  } catch (error) {
    console.error('[sendAlert] Error:', error);
    throw error;
  }
}

// Send message with inline keyboard buttons (for issue resolution)
// Buttons only sent to OPSMANAGER - others get view-only message
export async function sendIssueAlert(message, issueId, type = 'fault') {
  try {
    const subscribers = await getSubscribersForNotification(type);

    if (subscribers.length === 0) {
      console.log(`[Telegram] No subscribers for type: ${type}`);
      return { sent: 0, total: 0 };
    }

    const replyMarkup = {
      inline_keyboard: [[
        { text: '🟢 Machine OK', callback_data: `machine_ok:${issueId}` },
        { text: '✅ Resolved', callback_data: `resolve:${issueId}` },
        { text: '❌ Unresolved', callback_data: `unresolved:${issueId}` },
      ]]
    };

    let successCount = 0;
    for (const subscriber of subscribers) {
      // Only OPSMANAGER and ADMIN get buttons, others get view-only
      if (subscriber.role === 'OPSMANAGER' || subscriber.role === 'ADMIN') {
        const sent = await sendTelegramMessageWithButtons(subscriber.chatId, message, replyMarkup);
        if (sent) successCount++;
      } else {
        // DAYOPS and NIGHTOPS get message without buttons
        const sent = await sendTelegramMessage(subscriber.chatId, message);
        if (sent) successCount++;
      }
    }

    return { sent: successCount, total: subscribers.length };
  } catch (error) {
    console.error('[sendIssueAlert] Error:', error);
    throw error;
  }
}
