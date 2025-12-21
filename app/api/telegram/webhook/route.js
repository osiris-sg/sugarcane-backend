import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db/index.js';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Valid roles
const VALID_ROLES = ['ADMIN', 'OPSMANAGER', 'DAYOPS', 'NIGHTOPS'];

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

I'm the <b>Sugarcane Alert Bot</b>. I can notify you about device alerts, stock levels, and more.

<b>Stock Commands:</b>
/stock - View all device stock levels
/stock [deviceId] - View specific device
/stock 100 - Devices with 75-100% stock
/stock 75 - Devices with 50-75% stock
/stock 50 - Devices with 25-50% stock
/stock 25 - Devices with 15-25% stock
/stock 15 - Devices with 0-15% stock
/stock 0 - Empty devices (0%)
/storage - All machines with stock
/history - Recent stock changes
/setmax [deviceId] [max] - Set max stock

<b>Role Commands:</b>
/subscribe [role] - Subscribe with a role
/unsubscribe - Remove your subscription
/status - View your current role

<b>Available Roles:</b>
• admin - Full access (requires password)
• opsmanager - Operations manager
• dayops - Day shift operations
• nightops - Night shift operations

/help - Show this help message`;

  await sendMessage(chatId, message);
}

// Handle /help command
async function handleHelp(chatId) {
  await handleStart(chatId, null);
}

// Helper function to get stock percentage and emoji
function getStockInfo(quantity, maxStock) {
  const percent = Math.round((quantity / maxStock) * 100);
  let emoji = '🟢';
  if (percent <= 15) emoji = '⚫';
  else if (percent <= 25) emoji = '🔴';
  else if (percent <= 50) emoji = '🟡';
  return { percent, emoji };
}

// Handle /stock command - show device stock levels
// Formats: /stock, /stock [deviceId], /stock 100, /stock 75, /stock 50, /stock 25, /stock 15, /stock 0
async function handleStock(chatId, arg = null) {
  try {
    // Define percentage ranges: /stock X shows devices where (X-bracket) < percent <= X
    const percentRanges = {
      '100': { min: 75, max: 100, label: '75-100%' },
      '75': { min: 50, max: 75, label: '50-75%' },
      '50': { min: 25, max: 50, label: '25-50%' },
      '25': { min: 15, max: 25, label: '15-25%' },
      '15': { min: 0, max: 15, label: '0-15%' },
      '0': { min: -1, max: 0, label: '0% (Empty)' },
    };

    // Check if arg is a percentage filter
    if (arg && percentRanges[arg]) {
      const range = percentRanges[arg];
      const stocks = await db.stock.findMany({
        orderBy: { deviceName: 'asc' },
      });

      if (stocks.length === 0) {
        await sendMessage(chatId, '📭 No stock data available yet.');
        return;
      }

      const filtered = stocks.filter(stock => {
        const percent = Math.round((stock.quantity / stock.maxStock) * 100);
        if (arg === '0') {
          return percent === 0;
        }
        return percent > range.min && percent <= range.max;
      });

      if (filtered.length === 0) {
        await sendMessage(chatId, `📭 No devices with ${range.label} stock.`);
        return;
      }

      let message = `📊 <b>Stock Level: ${range.label}</b>\n\n`;

      for (const stock of filtered) {
        const { percent, emoji } = getStockInfo(stock.quantity, stock.maxStock);
        message += `${emoji} <b>${stock.deviceName}</b>\n`;
        message += `   Device: ${stock.deviceId}\n`;
        message += `   Stock: ${stock.quantity}/${stock.maxStock} (<b>${percent}%</b>)\n\n`;
      }

      message += `━━━━━━━━━━━━━━━━\n`;
      message += `Total: <b>${filtered.length}</b> machine${filtered.length !== 1 ? 's' : ''}`;

      await sendMessage(chatId, message);
      return;
    }

    // Check if arg is a specific device ID
    if (arg) {
      const stock = await db.stock.findUnique({
        where: { deviceId: String(arg) },
      });

      if (!stock) {
        await sendMessage(chatId, `❌ Device ${arg} not found.`);
        return;
      }

      const { percent, emoji } = getStockInfo(stock.quantity, stock.maxStock);
      const message = `📦 <b>Stock Level</b>\n\n${emoji} <b>${stock.deviceName}</b>\n🎯 Device ID: ${stock.deviceId}\n📊 Stock: <b>${stock.quantity}/${stock.maxStock}</b> pcs (<b>${percent}%</b>)\n🕒 Updated: ${stock.updatedAt.toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })}`;
      await sendMessage(chatId, message);
      return;
    }

    // Get all stocks (default)
    const stocks = await db.stock.findMany({
      orderBy: { deviceName: 'asc' },
    });

    if (stocks.length === 0) {
      await sendMessage(chatId, '📭 No stock data available yet.\n\nStock levels will appear here once devices report their inventory.');
      return;
    }

    let message = '📦 <b>Stock Levels - All Devices</b>\n\n';
    let totalStock = 0;
    let totalMax = 0;

    for (const stock of stocks) {
      const { percent, emoji } = getStockInfo(stock.quantity, stock.maxStock);
      message += `${emoji} <b>${stock.deviceName}</b>\n`;
      message += `   ${stock.quantity}/${stock.maxStock} pcs (<b>${percent}%</b>)\n\n`;
      totalStock += stock.quantity;
      totalMax += stock.maxStock;
    }

    const totalPercent = totalMax > 0 ? Math.round((totalStock / totalMax) * 100) : 0;
    message += `━━━━━━━━━━━━━━━━\n`;
    message += `📊 <b>Total:</b> ${totalStock}/${totalMax} pcs (${totalPercent}%)\n`;
    message += `🏪 <b>Devices:</b> ${stocks.length}`;

    await sendMessage(chatId, message);
  } catch (error) {
    console.error('Error fetching stock:', error);
    await sendMessage(chatId, '❌ Error fetching stock levels. Please try again later.');
  }
}

// Handle /storage command - show all machines with any stock
async function handleStorage(chatId) {
  try {
    const stocks = await db.stock.findMany({
      where: { quantity: { gt: 0 } },
      orderBy: { quantity: 'desc' },
    });

    if (stocks.length === 0) {
      await sendMessage(chatId, '📭 No machines have stock currently.');
      return;
    }

    let message = '📦 <b>Machines with Stock</b>\n\n';

    for (const stock of stocks) {
      const { percent, emoji } = getStockInfo(stock.quantity, stock.maxStock);
      message += `${emoji} <b>${stock.deviceName}</b>\n`;
      message += `   ${stock.quantity}/${stock.maxStock} pcs (<b>${percent}%</b>)\n\n`;
    }

    message += `━━━━━━━━━━━━━━━━\n`;
    message += `🏪 <b>Active Devices:</b> ${stocks.length}`;

    await sendMessage(chatId, message);
  } catch (error) {
    console.error('Error fetching storage:', error);
    await sendMessage(chatId, '❌ Error fetching storage data. Please try again later.');
  }
}

// Handle /setmax command - set max stock for a device
async function handleSetMax(chatId, deviceId, maxStock) {
  try {
    if (!deviceId || !maxStock) {
      await sendMessage(chatId, '❓ Usage: /setmax [deviceId] [maxStock]\n\nExample: /setmax 12345 80');
      return;
    }

    const max = parseInt(maxStock);
    if (isNaN(max) || max <= 0) {
      await sendMessage(chatId, '❌ Max stock must be a positive number.');
      return;
    }

    const stock = await db.stock.findUnique({
      where: { deviceId: String(deviceId) },
    });

    if (!stock) {
      await sendMessage(chatId, `❌ Device ${deviceId} not found.`);
      return;
    }

    await db.stock.update({
      where: { deviceId: String(deviceId) },
      data: { maxStock: max },
    });

    const { percent, emoji } = getStockInfo(stock.quantity, max);
    await sendMessage(chatId, `✅ Max stock updated!\n\n${emoji} <b>${stock.deviceName}</b>\n📊 Stock: ${stock.quantity}/<b>${max}</b> pcs (${percent}%)`);
  } catch (error) {
    console.error('Error setting max stock:', error);
    await sendMessage(chatId, '❌ Error updating max stock. Please try again later.');
  }
}

// Handle /history command - show recent stock changes
async function handleHistory(chatId, deviceId = null) {
  try {
    const where = deviceId ? { deviceId: String(deviceId) } : {};

    const history = await db.stockHistory.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    if (history.length === 0) {
      await sendMessage(chatId, '📭 No stock history available yet.');
      return;
    }

    let message = '📜 <b>Recent Stock Changes</b>\n\n';

    for (const entry of history) {
      const changeEmoji = entry.change > 0 ? '➕' : '➖';
      const reasonEmoji = entry.reason === 'topup' ? '📦' : entry.reason === 'sale' ? '🧃' : '🔧';
      const time = entry.createdAt.toLocaleString('en-SG', { timeZone: 'Asia/Singapore', hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });

      message += `${reasonEmoji} <b>${entry.deviceName}</b>\n`;
      message += `   ${changeEmoji} ${entry.change > 0 ? '+' : ''}${entry.change} (${entry.previousQty}→${entry.newQty}) | ${time}\n\n`;
    }

    await sendMessage(chatId, message);
  } catch (error) {
    console.error('Error fetching history:', error);
    await sendMessage(chatId, '❌ Error fetching stock history. Please try again later.');
  }
}

// Handle /status command
async function handleStatus(chatId) {
  const subscriber = await db.subscriber.findUnique({
    where: { chatId: String(chatId) },
  });

  if (!subscriber || !subscriber.role) {
    await sendMessage(chatId, '📭 You are not subscribed.\n\nUse /subscribe [role] to get started.\n\nAvailable roles: admin, opsmanager, dayops, nightops');
    return;
  }

  const roleNames = {
    'ADMIN': '👑 Admin - Full access',
    'OPSMANAGER': '📊 Operations Manager',
    'DAYOPS': '☀️ Day Ops',
    'NIGHTOPS': '🌙 Night Ops'
  };

  await sendMessage(chatId, `✅ <b>Your Role:</b>\n\n${roleNames[subscriber.role] || subscriber.role}`);
}

// Handle /subscribe command
async function handleSubscribe(chatId, role, user) {
  const chatIdStr = String(chatId);

  if (!role) {
    await sendMessage(chatId, '❓ Please specify a role:\n\n/subscribe admin\n/subscribe opsmanager\n/subscribe dayops\n/subscribe nightops');
    return;
  }

  const roleUpper = role.toUpperCase();

  if (!VALID_ROLES.includes(roleUpper)) {
    await sendMessage(chatId, '❌ Invalid role. Use:\n\n/subscribe admin\n/subscribe opsmanager\n/subscribe dayops\n/subscribe nightops');
    return;
  }

  // For admin, require password
  if (roleUpper === 'ADMIN') {
    // Create pending verification
    await db.pendingVerification.deleteMany({ where: { chatId: chatIdStr } });
    await db.pendingVerification.create({
      data: {
        chatId: chatIdStr,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      },
    });

    await sendMessage(chatId, '🔐 <b>Admin role requires password.</b>\n\nPlease reply with the password:');
    return;
  }

  // Subscribe with role
  let subscriber = await db.subscriber.findUnique({ where: { chatId: chatIdStr } });

  if (subscriber) {
    if (subscriber.role === roleUpper) {
      await sendMessage(chatId, `✅ You already have the ${role} role.`);
      return;
    }

    await db.subscriber.update({
      where: { chatId: chatIdStr },
      data: { role: roleUpper },
    });
  } else {
    await db.subscriber.create({
      data: {
        chatId: chatIdStr,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        role: roleUpper,
      },
    });
  }

  const roleNames = {
    'OPSMANAGER': 'Operations Manager',
    'DAYOPS': 'Day Ops',
    'NIGHTOPS': 'Night Ops'
  };

  await sendMessage(chatId, `✅ <b>Subscribed as ${roleNames[roleUpper]}!</b>\n\nYou will receive notifications based on your role.`);
}

// Handle /unsubscribe command
async function handleUnsubscribe(chatId) {
  const chatIdStr = String(chatId);

  const subscriber = await db.subscriber.findUnique({ where: { chatId: chatIdStr } });

  if (!subscriber || !subscriber.role) {
    await sendMessage(chatId, '❌ You are not subscribed.');
    return;
  }

  await db.subscriber.update({
    where: { chatId: chatIdStr },
    data: { role: null },
  });

  await sendMessage(chatId, '✅ You have been unsubscribed. You will no longer receive notifications.');
}

// Handle password verification for admin role
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
    await sendMessage(chatId, '⏰ Verification expired. Please use /subscribe admin again.');
    return true;
  }

  if (password !== ADMIN_PASSWORD) {
    await sendMessage(chatId, '❌ Incorrect password. Please use /subscribe admin to try again.');
    return true;
  }

  // Subscribe as admin
  let subscriber = await db.subscriber.findUnique({ where: { chatId: chatIdStr } });

  if (subscriber) {
    await db.subscriber.update({
      where: { chatId: chatIdStr },
      data: { role: 'ADMIN' },
    });
  } else {
    await db.subscriber.create({
      data: {
        chatId: chatIdStr,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        role: 'ADMIN',
      },
    });
  }

  await sendMessage(chatId, '✅ <b>Subscribed as Admin!</b>\n\nYou will receive all notifications.');
  return true;
}

// Handle callback query from inline buttons
async function handleCallbackQuery(callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const data = callbackQuery.data;
  const user = callbackQuery.from;

  console.log(`[Webhook] Callback query: ${data} from ${user.first_name}`);

  // Parse callback data: "resolve:issueId" or "unresolved:issueId" or "zs_select:issueId"
  const [action, issueId] = data.split(':');

  if (!issueId) {
    await answerCallbackQuery(callbackQuery.id, '❌ Invalid action');
    return;
  }

  try {
    // Check if user has permission to use buttons (ADMIN or OPSMANAGER only)
    const subscriber = await db.subscriber.findUnique({
      where: { chatId: String(chatId) },
    });

    if (!subscriber || (subscriber.role !== 'ADMIN' && subscriber.role !== 'OPSMANAGER')) {
      await answerCallbackQuery(callbackQuery.id, '⛔ Only Admin or OpsManager can resolve issues');
      return;
    }

    const issue = await db.issue.findUnique({ where: { id: issueId } });

    if (!issue) {
      await answerCallbackQuery(callbackQuery.id, '❌ Issue not found');
      return;
    }

    // Handle device selection from zero sales summary - show action buttons
    if (action === 'zs_select') {
      if (issue.status === 'RESOLVED' || issue.status === 'UNRESOLVED' || issue.status === 'MACHINE_OK') {
        await answerCallbackQuery(callbackQuery.id, '⚠️ Issue already closed');
        return;
      }

      const percent = issue.stockMax > 0
        ? Math.round((issue.stockQuantity / issue.stockMax) * 100)
        : 0;

      const triggeredTime = issue.triggeredAt.toLocaleString('en-SG', {
        timeZone: 'Asia/Singapore',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

      const message = `📉 <b>Zero Sales Issue</b>\n\n` +
        `📍 <b>${issue.deviceName}</b>\n` +
        `📦 Stock: ${issue.stockQuantity || 0}/${issue.stockMax || 80} (${percent}%)\n` +
        `📅 Detected: ${triggeredTime}\n\n` +
        `Select an action:`;

      const replyMarkup = {
        inline_keyboard: [[
          { text: '🟢 Machine OK', callback_data: `machine_ok:${issueId}` },
          { text: '✅ Resolved', callback_data: `resolve:${issueId}` },
          { text: '❌ Unresolved', callback_data: `unresolved:${issueId}` },
        ]]
      };

      await editMessageText(chatId, messageId, message, replyMarkup);
      await answerCallbackQuery(callbackQuery.id, `Selected: ${issue.deviceName}`);
      return;
    }

    if (issue.status === 'RESOLVED' || issue.status === 'UNRESOLVED' || issue.status === 'MACHINE_OK') {
      await answerCallbackQuery(callbackQuery.id, '⚠️ Issue already closed');
      return;
    }

    const now = new Date();
    const respondedAt = issue.respondedAt || now;
    const resolutionTimeMs = now.getTime() - new Date(respondedAt).getTime();

    if (action === 'resolve') {
      await db.issue.update({
        where: { id: issueId },
        data: {
          status: 'RESOLVED',
          resolution: 'resolved',
          resolvedAt: now,
          respondedAt: issue.respondedAt || now,
          resolutionTimeMs,
        }
      });

      // Update the message to show it's resolved
      await editMessageText(chatId, messageId,
        callbackQuery.message.text + `\n\n✅ <b>RESOLVED</b> by ${user.first_name} at ${now.toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })}`
      );
      await answerCallbackQuery(callbackQuery.id, '✅ Marked as Resolved!');

    } else if (action === 'unresolved') {
      await db.issue.update({
        where: { id: issueId },
        data: {
          status: 'UNRESOLVED',
          resolution: 'unresolved',
          resolvedAt: now,
          respondedAt: issue.respondedAt || now,
          resolutionTimeMs,
          priority: Math.min(issue.priority + 1, 3), // Escalate priority
        }
      });

      // Update the message to show it's unresolved
      await editMessageText(chatId, messageId,
        callbackQuery.message.text + `\n\n❌ <b>UNRESOLVED</b> by ${user.first_name} at ${now.toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })}\n⚠️ Escalated to LVL ${Math.min(issue.priority + 1, 3)}`
      );
      await answerCallbackQuery(callbackQuery.id, '❌ Marked as Unresolved - Escalated');

    } else if (action === 'machine_ok') {
      await db.issue.update({
        where: { id: issueId },
        data: {
          status: 'MACHINE_OK',
          resolution: 'machine_ok',
          resolvedAt: now,
          respondedAt: issue.respondedAt || now,
          resolutionTimeMs,
        }
      });

      // Update the message to show machine is OK
      await editMessageText(chatId, messageId,
        callbackQuery.message.text + `\n\n🟢 <b>MACHINE OK</b> by ${user.first_name} at ${now.toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })}`
      );
      await answerCallbackQuery(callbackQuery.id, '🟢 Marked as Machine OK!');
    }

  } catch (error) {
    console.error('[Webhook] Callback error:', error);
    await answerCallbackQuery(callbackQuery.id, '❌ Error updating issue');
  }
}

// Answer callback query (removes loading state from button)
async function answerCallbackQuery(callbackQueryId, text) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
        show_alert: false,
      }),
    });
  } catch (error) {
    console.error('Error answering callback:', error);
  }
}

// Edit message text (to update after button click)
async function editMessageText(chatId, messageId, text, replyMarkup = null) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`;
  const body = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'HTML',
  };
  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.error('Error editing message:', error);
  }
}

// Get inline keyboard buttons for an issue
function getIssueButtons(issueId) {
  return {
    inline_keyboard: [[
      { text: '🟢 Machine OK', callback_data: `machine_ok:${issueId}` },
      { text: '✅ Resolved', callback_data: `resolve:${issueId}` },
      { text: '❌ Unresolved', callback_data: `unresolved:${issueId}` },
    ]]
  };
}

// Main webhook handler
export async function POST(request) {
  try {
    const body = await request.json();
    console.log('Telegram webhook received:', JSON.stringify(body, null, 2));

    // Handle callback queries from inline buttons
    if (body.callback_query) {
      await handleCallbackQuery(body.callback_query);
      return NextResponse.json({ ok: true });
    }

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
      await handleUnsubscribe(chatId);
    } else if (text.startsWith('/stock')) {
      const parts = text.split(/\s+/);
      const arg = parts[1];
      await handleStock(chatId, arg);
    } else if (text.startsWith('/history')) {
      const parts = text.split(/\s+/);
      const deviceId = parts[1];
      await handleHistory(chatId, deviceId);
    } else if (text.startsWith('/storage')) {
      await handleStorage(chatId);
    } else if (text.startsWith('/setmax')) {
      const parts = text.split(/\s+/);
      const deviceId = parts[1];
      const maxStock = parts[2];
      await handleSetMax(chatId, deviceId, maxStock);
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
