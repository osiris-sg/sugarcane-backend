const { PrismaClient } = require('@prisma/client');

const db = new PrismaClient();

async function backfillOrderImport() {
  const deviceId = '852379';

  console.log(`[Backfill] Starting backfill for device ${deviceId}...`);

  // Get all orders for this device
  const orders = await db.order.findMany({
    where: { deviceId },
    orderBy: { orderTime: 'asc' },
  });

  console.log(`[Backfill] Found ${orders.length} orders to backfill`);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const order of orders) {
    try {
      // Check if already exists in OrderImport
      const existing = await db.orderImport.findFirst({
        where: {
          orderId: order.orderId,
          deviceId: order.deviceId,
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      // If not success, deliverCount = 0
      const importDeliverCount = order.isSuccess ? (order.deliverCount || order.totalCount || 1) : 0;

      // Divide amounts by 100 (Order table stores in cents*100, OrderImport stores in cents)
      const importAmount = Math.round((order.amount || 0) / 100);
      const importPayAmount = order.payAmount ? Math.round(order.payAmount / 100) : null;
      const importRefundAmount = order.refundAmount ? Math.round(order.refundAmount / 100) : null;

      await db.orderImport.create({
        data: {
          orderId: order.orderId,
          deviceId: order.deviceId,
          deviceName: order.deviceName,
          amount: importAmount,
          quantity: order.quantity || 1,
          payWay: order.payWay ? String(order.payWay) : null,
          isSuccess: order.isSuccess,
          createdAt: order.orderTime || order.createdAt, // Use orderTime as createdAt
          deliverCount: importDeliverCount,
          payAmount: importPayAmount,
          refundAmount: importRefundAmount,
          totalCount: order.totalCount,
        },
      });
      created++;
    } catch (error) {
      console.error(`[Backfill] Failed to backfill order ${order.orderId}:`, error.message);
      failed++;
    }
  }

  console.log(`[Backfill] Complete!`);
  console.log(`  Created: ${created}`);
  console.log(`  Skipped (already exists): ${skipped}`);
  console.log(`  Failed: ${failed}`);
}

backfillOrderImport()
  .catch((e) => {
    console.error('[Backfill] Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
