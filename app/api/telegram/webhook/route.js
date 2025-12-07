import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db/index.js';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MAINTENANCE_PASSWORD = process.env.MAINTENANCE_PASSWORD || 'admin123';

// Send message to Telegram
async function sendMessage(chatId, text, options = {}) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        ...options,
      }),
    });
  } catch (error) {
    console.error('Error sending Telegram message:', error);
  }
}

// Handle /start command
async function handleStart(chatId, firstName) {
  const message = `👋 Welcome ${firstName || 'there'}!

I'm the <b>Sugarcane Alert Bot</b>. I can notify you about:

📦 <b>Stock Alerts</b> - Low stock & fault notifications
🔧 <b>Maintenance Alerts</b> - Maintenance login activity (admin only)

<b>Commands:</b>
/subscribe stock - Get stock & fault alerts
/subscribe maintenance - Get maintenance alerts (password required)
/unsubscribe stock - Stop stock alerts
/unsubscribe maintenance - Stop maintenance alerts
/status - View your subscriptions
/help - Show this help message`;

  await sendMessage(chatId, message);
}

// Handle /help command
async function handleHelp(chatId) {
  await handleStart(chatId, null);
}

// Handle /status command
async function handleStatus(chatId) {
  const subscriber = await db.subscriber.findUnique({
    where: { chatId: String(chatId) },
  });

  if (!subscriber || subscriber.categories.length === 0) {
    await sendMessage(chatId, '📭 You are not subscribed to any alerts.\n\nUse /subscribe stock or /subscribe maintenance to get started.');
    return;
  }

  const categories = subscriber.categories.map(c => {
    if (c === 'STOCK') return '📦 Stock & Fault Alerts';
    if (c === 'MAINTENANCE') return '🔧 Maintenance Alerts';
    return c;
  });

  await sendMessage(chatId, `✅ <b>Your Subscriptions:</b>\n\n${categories.join('\n')}`);
}

// Handle /subscribe command
async function handleSubscribe(chatId, category, user) {
  const chatIdStr = String(chatId);

  if (!category) {
    await sendMessage(chatId, '❓ Please specify a category:\n\n/subscribe stock\n/subscribe maintenance');
    return;
  }

  const cat = category.toUpperCase();

  if (cat !== 'STOCK' && cat !== 'MAINTENANCE') {
    await sendMessage(chatId, '❌ Invalid category. Use:\n\n/subscribe stock\n/subscribe maintenance');
    return;
  }

  // For maintenance, require password
  if (cat === 'MAINTENANCE') {
    // Create pending verification
    await db.pendingVerification.deleteMany({ where: { chatId: chatIdStr } });
    await db.pendingVerification.create({
      data: {
        chatId: chatIdStr,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      },
    });

    await sendMessage(chatId, '🔐 <b>Maintenance subscription requires admin password.</b>\n\nPlease reply with the password:');
    return;
  }

  // Subscribe to STOCK
  let subscriber = await db.subscriber.findUnique({ where: { chatId: chatIdStr } });

  if (subscriber) {
    if (subscriber.categories.includes(cat)) {
      await sendMessage(chatId, '✅ You are already subscribed to stock alerts.');
      return;
    }

    await db.subscriber.update({
      where: { chatId: chatIdStr },
      data: { categories: { push: cat } },
    });
  } else {
    await db.subscriber.create({
      data: {
        chatId: chatIdStr,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        categories: [cat],
      },
    });
  }

  await sendMessage(chatId, '✅ <b>Subscribed to Stock & Fault Alerts!</b>\n\nYou will receive notifications about:\n• Low stock warnings (50% and 25%)\n• Device faults');
}

// Handle /unsubscribe command
async function handleUnsubscribe(chatId, category) {
  const chatIdStr = String(chatId);

  if (!category) {
    await sendMessage(chatId, '❓ Please specify a category:\n\n/unsubscribe stock\n/unsubscribe maintenance');
    return;
  }

  const cat = category.toUpperCase();

  if (cat !== 'STOCK' && cat !== 'MAINTENANCE') {
    await sendMessage(chatId, '❌ Invalid category. Use:\n\n/unsubscribe stock\n/unsubscribe maintenance');
    return;
  }

  const subscriber = await db.subscriber.findUnique({ where: { chatId: chatIdStr } });

  if (!subscriber || !subscriber.categories.includes(cat)) {
    await sendMessage(chatId, `❌ You are not subscribed to ${category.toLowerCase()} alerts.`);
    return;
  }

  const newCategories = subscriber.categories.filter(c => c !== cat);

  if (newCategories.length === 0) {
    await db.subscriber.delete({ where: { chatId: chatIdStr } });
  } else {
    await db.subscriber.update({
      where: { chatId: chatIdStr },
      data: { categories: newCategories },
    });
  }

  const name = cat === 'STOCK' ? 'Stock & Fault' : 'Maintenance';
  await sendMessage(chatId, `✅ Unsubscribed from ${name} alerts.`);
}

// Handle password verification for maintenance
async function handlePasswordVerification(chatId, password, user) {
  const chatIdStr = String(chatId);

  const pending = await db.pendingVerification.findUnique({
    where: { chatId: chatIdStr },
  });

  if (!pending) {
    return false; // Not a password verification attempt
  }

  // Delete pending verification
  await db.pendingVerification.delete({ where: { chatId: chatIdStr } });

  if (pending.expiresAt < new Date()) {
    await sendMessage(chatId, '⏰ Verification expired. Please use /subscribe maintenance again.');
    return true;
  }

  if (password !== MAINTENANCE_PASSWORD) {
    await sendMessage(chatId, '❌ Incorrect password. Please use /subscribe maintenance to try again.');
    return true;
  }

  // Subscribe to maintenance
  let subscriber = await db.subscriber.findUnique({ where: { chatId: chatIdStr } });

  if (subscriber) {
    if (!subscriber.categories.includes('MAINTENANCE')) {
      await db.subscriber.update({
        where: { chatId: chatIdStr },
        data: { categories: { push: 'MAINTENANCE' } },
      });
    }
  } else {
    await db.subscriber.create({
      data: {
        chatId: chatIdStr,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        categories: ['MAINTENANCE'],
      },
    });
  }

  await sendMessage(chatId, '✅ <b>Subscribed to Maintenance Alerts!</b>\n\nYou will receive notifications about:\n• Maintenance mode logins\n• Stock top-ups');
  return true;
}

// Main webhook handler
export async function POST(request) {
  try {
    const body = await request.json();
    console.log('Telegram webhook received:', JSON.stringify(body, null, 2));

    const message = body.message;
    if (!message) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const text = message.text?.trim() || '';
    const user = message.from;

    // Check if this is a password verification attempt
    if (text && !text.startsWith('/')) {
      const handled = await handlePasswordVerification(chatId, text, user);
      if (handled) {
        return NextResponse.json({ ok: true });
      }
    }

    // Handle commands
    if (text.startsWith('/start')) {
      await handleStart(chatId, user.first_name);
    } else if (text.startsWith('/help')) {
      await handleHelp(chatId);
    } else if (text.startsWith('/status')) {
      await handleStatus(chatId);
    } else if (text.startsWith('/subscribe')) {
      const parts = text.split(/\s+/);
      const category = parts[1];
      await handleSubscribe(chatId, category, user);
    } else if (text.startsWith('/unsubscribe')) {
      const parts = text.split(/\s+/);
      const category = parts[1];
      await handleUnsubscribe(chatId, category);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET endpoint to verify webhook is set up
export async function GET() {
  return NextResponse.json({
    status: 'Telegram webhook is active',
    commands: ['/start', '/help', '/status', '/subscribe stock', '/subscribe maintenance', '/unsubscribe stock', '/unsubscribe maintenance'],
  });
}
