import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db/index.js';
import { sendIncidentNotification } from '../../../../lib/push-notifications.ts';
import { sendAlert } from '../../../../lib/telegram.js';

const DEFAULT_LOW_STOCK_THRESHOLD = 20; // Default alert threshold (used if not set per device)
const SLA_HOURS = 3;

// Check if current time is within day shift hours (8am to 10pm Singapore time)
function isDayShift() {
  const now = new Date();
  const sgTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const sgHour = sgTime.getUTCHours();
  return sgHour >= 8 && sgHour < 22;
}

// Check if current time is within night shift hours (10pm to 8am Singapore time)
function isNightShift() {
  const now = new Date();
  const sgTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const sgHour = sgTime.getUTCHours();
  return sgHour >= 22 || sgHour < 8;
}

// Get stock level description
function getStockLevel(quantity) {
  if (quantity <= 0) return 'Out of Stock';
  if (quantity <= 10) return 'Critical Stock';
  return 'Low Stock';
}

// Get emoji for stock level
function getStockEmoji(quantity) {
  if (quantity <= 0) return '⚫';
  if (quantity <= 10) return '🔴';
  return '🟠';
}

// Main cron handler - runs every 15 minutes
export async function GET(request) {
  // Verify cron secret (optional security)
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.log('[StockAlert] Warning: No valid CRON_SECRET provided');
  }

  const now = new Date();
  console.log('[StockAlert] Cron job started at', now.toISOString());

  try {
    // Get all stocks
    const stocks = await db.stock.findMany();

    // Get device locations for notifications
    const deviceIds = stocks.map(s => s.deviceId);
    const devices = await db.device.findMany({
      where: { deviceId: { in: deviceIds } },
      select: { deviceId: true, location: true },
    });
    const deviceLocationMap = new Map(devices.map(d => [d.deviceId, d.location]));

    // Get driver assignments - SLA/penalties only apply to devices with assigned drivers
    const deviceDrivers = await db.deviceDriver.findMany({
      where: { deviceId: { in: deviceIds } },
      select: { deviceId: true },
    });
    const devicesWithDrivers = new Set(deviceDrivers.map(dd => dd.deviceId));

    let newAlerts = 0;
    let resolved = 0;
    let immediateBreaches = 0;

    for (const stock of stocks) {
      const displayName = deviceLocationMap.get(stock.deviceId) || stock.deviceName;
      // Use per-device threshold, or fall back to default
      const threshold = stock.minStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;
      const isLowStock = stock.quantity <= threshold;
      const isOutOfStock = stock.quantity === 0;

      // === CASE 1: OUT OF STOCK - Immediate SLA breach ===
      if (isOutOfStock) {
        // Check if device has an assigned driver (SLA/penalties only apply to assigned devices)
        const hasDriver = devicesWithDrivers.has(stock.deviceId);

        // Check for existing open incident
        const existingIncident = await db.incident.findFirst({
          where: {
            deviceId: stock.deviceId,
            type: { in: ['OUT_OF_STOCK', 'LOW_STOCK'] },
            status: { in: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'] }
          }
        });

        if (!existingIncident) {
          // No existing incident - create new OUT_OF_STOCK
          // Only immediate breach/penalty for devices WITH assigned drivers
          const incident = await db.incident.create({
            data: {
              type: 'OUT_OF_STOCK',
              deviceId: stock.deviceId,
              deviceName: stock.deviceName,
              startTime: now,
              slaDeadline: hasDriver ? now : null, // Only set SLA for assigned devices
              status: 'OPEN',
              slaOutcome: hasDriver ? 'SLA_BREACHED' : 'PENDING',
              penaltyFlag: hasDriver,
              stockQuantity: 0,
            }
          });

          // Create penalty record ONLY for devices with assigned drivers
          if (hasDriver) {
            await db.penalty.create({
              data: {
                incidentId: incident.id,
                reason: 'Out of stock - immediate SLA breach',
              }
            });
          }

          // Update stock record
          await db.stock.update({
            where: { id: stock.id },
            data: {
              isLowStock: true,
              lowStockTriggeredAt: now,
              priority: 3, // Highest priority
            }
          });

          // Send push notification
          await sendIncidentNotification({
            type: 'breach',
            incident,
            title: '⚫ OUT OF STOCK - IMMEDIATE BREACH',
            body: `${displayName} is out of stock! Immediate action required.`,
          });

          // Send Telegram notification
          const telegramMessage = `⚫ OUT OF STOCK - IMMEDIATE BREACH

🎯 Device: ${displayName}
📍 Device ID: ${stock.deviceId}
📊 Stock: 0/${stock.maxStock} pcs

⚠️ Immediate action required!`;
          await sendAlert(telegramMessage, 'stock_alert');

          immediateBreaches++;
          console.log(`[StockAlert] OUT OF STOCK: ${displayName} - Created incident with immediate breach`);
        } else if (existingIncident.type === 'LOW_STOCK') {
          // Upgrade LOW_STOCK to OUT_OF_STOCK
          // Only immediate breach/penalty for devices WITH assigned drivers
          await db.incident.update({
            where: { id: existingIncident.id },
            data: {
              type: 'OUT_OF_STOCK',
              slaDeadline: hasDriver ? now : null,
              slaOutcome: hasDriver ? 'SLA_BREACHED' : 'PENDING',
              penaltyFlag: hasDriver,
              stockQuantity: 0,
            }
          });

          // Create penalty record ONLY for devices with assigned drivers and not already breached
          if (hasDriver && existingIncident.slaOutcome !== 'SLA_BREACHED') {
            await db.penalty.create({
              data: {
                incidentId: existingIncident.id,
                reason: 'Out of stock - upgraded from low stock, immediate SLA breach',
              }
            });
          }

          // Update stock record priority
          await db.stock.update({
            where: { id: stock.id },
            data: { priority: 3 }
          });

          // Send push notification
          await sendIncidentNotification({
            type: 'breach',
            incident: { ...existingIncident, type: 'OUT_OF_STOCK', stockQuantity: 0 },
            title: '⚫ OUT OF STOCK - IMMEDIATE BREACH',
            body: `${displayName} is now out of stock! Immediate action required.`,
          });

          // Send Telegram notification
          const telegramMessage = `⚫ OUT OF STOCK - IMMEDIATE BREACH

🎯 Device: ${displayName}
📍 Device ID: ${stock.deviceId}
📊 Stock: 0/${stock.maxStock} pcs

⚠️ Was low stock, now OUT OF STOCK!`;
          await sendAlert(telegramMessage, 'stock_alert');

          immediateBreaches++;
          console.log(`[StockAlert] OUT OF STOCK: ${displayName} - Upgraded from LOW_STOCK with immediate breach`);
        }
        // If existingIncident.type === 'OUT_OF_STOCK', do nothing (already handled)
      }

      // === CASE 2: Low stock (but not out) - Create alert notification only (NO SLA) ===
      else if (isLowStock && !stock.isLowStock && !isOutOfStock) {
        // Check for existing open incident (either LOW_STOCK or OUT_OF_STOCK)
        const existingIncident = await db.incident.findFirst({
          where: {
            deviceId: stock.deviceId,
            type: { in: ['LOW_STOCK', 'OUT_OF_STOCK'] },
            status: { in: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'] }
          }
        });

        if (!existingIncident) {
          // LOW_STOCK is just an alert - NO SLA, NO penalty
          // Breach only happens when stock reaches 0 (OUT_OF_STOCK)
          const incident = await db.incident.create({
            data: {
              type: 'LOW_STOCK',
              deviceId: stock.deviceId,
              deviceName: stock.deviceName,
              startTime: now,
              slaDeadline: null, // No SLA for low stock
              status: 'OPEN',
              slaOutcome: null, // No SLA tracking
              stockQuantity: stock.quantity,
            }
          });

          await db.stock.update({
            where: { id: stock.id },
            data: {
              isLowStock: true,
              lowStockTriggeredAt: now,
              priority: 1,
            }
          });

          const emoji = getStockEmoji(stock.quantity);
          const level = getStockLevel(stock.quantity);

          // Send push notification
          await sendIncidentNotification({
            type: 'new',
            incident,
            title: `${emoji} ${level} Alert`,
            body: `${displayName}: ${stock.quantity}/${stock.maxStock} pcs`,
          });

          // Note: No Telegram for LOW_STOCK - Telegram already sends 50% and 25% alerts

          newAlerts++;
          console.log(`[StockAlert] New low stock for ${displayName} (${stock.quantity} pcs)`);
        }
      }

      // === CASE 3: Stock back above threshold - auto resolve ===
      else if (!isLowStock && stock.isLowStock) {
        // Find and resolve any open incidents (both LOW_STOCK and OUT_OF_STOCK)
        const openIncidents = await db.incident.findMany({
          where: {
            deviceId: stock.deviceId,
            type: { in: ['LOW_STOCK', 'OUT_OF_STOCK'] },
            status: { in: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'] }
          }
        });

        for (const incident of openIncidents) {
          // Determine final SLA outcome:
          // - If already breached, keep it
          // - If no SLA was set (null), keep it null
          // - Otherwise, mark as within SLA
          let finalSlaOutcome = incident.slaOutcome;
          if (incident.slaOutcome === 'PENDING') {
            finalSlaOutcome = 'WITHIN_SLA';
          }
          // If slaOutcome is null (no driver), keep it null
          // If slaOutcome is 'SLA_BREACHED', keep it

          await db.incident.update({
            where: { id: incident.id },
            data: {
              status: 'RESOLVED',
              resolvedAt: now,
              resolution: 'Auto-resolved: Stock replenished',
              slaOutcome: finalSlaOutcome,
            }
          });

          // No push notification for stock replenished - auto-resolved silently
        }

        await db.stock.update({
          where: { id: stock.id },
          data: {
            isLowStock: false,
            lowStockTriggeredAt: null,
            priority: 1,
          }
        });
        resolved++;
        console.log(`[StockAlert] Resolved low stock for ${displayName} (now ${stock.quantity} pcs)`);
      }
    }

    // Log notification
    if (newAlerts > 0 || immediateBreaches > 0) {
      await db.notificationLog.create({
        data: {
          type: 'stock_alert',
          message: `Stock alerts: ${newAlerts} new, ${immediateBreaches} immediate breaches`,
          recipients: newAlerts + immediateBreaches,
        },
      });
    }

    console.log(`[StockAlert] Completed. New: ${newAlerts}, Immediate breaches: ${immediateBreaches}, Resolved: ${resolved}`);

    return NextResponse.json({
      success: true,
      newAlerts,
      immediateBreaches,
      resolved,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('[StockAlert] Cron job error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
