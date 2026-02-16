import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

// POST /api/orders/sync
// Batch sync orders from Android app
// Accepts array of orders, upserts them, returns results
export async function POST(request) {
  try {
    const body = await request.json();
    const { deviceId, deviceName, orders } = body;

    if (!orders || !Array.isArray(orders)) {
      return NextResponse.json(
        { success: false, error: 'orders array is required' },
        { status: 400 }
      );
    }

    console.log(`[OrderSync] Received ${orders.length} orders from device ${deviceId} (${deviceName})`);

    // Check if device has appVersion 3.3.0 (should also sync to OrderImport)
    // Exception: device 852379 always syncs to OrderImport regardless of version
    const ORDERIMPORT_EXCEPTION_DEVICES = ['852379'];
    const device = await db.device.findFirst({
      where: { deviceId: String(deviceId) },
      select: { appVersion: true },
    });
    const shouldSyncToOrderImport = device?.appVersion === '3.3.0' || ORDERIMPORT_EXCEPTION_DEVICES.includes(String(deviceId));

    if (shouldSyncToOrderImport) {
      console.log(`[OrderSync] Device ${deviceId} has v3.3.0, will also sync to OrderImport`);
    }

    const results = {
      synced: [],
      failed: [],
      total: orders.length,
      orderImportSynced: 0,
    };

    // Process each order
    for (const order of orders) {
      try {
        // Upsert order by orderId + deviceId (unique combination)
        const existingOrder = await db.order.findFirst({
          where: {
            orderId: String(order.orderId),
            deviceId: String(deviceId),
          },
        });

        // Parse order timestamp (original order time from device)
        let orderTime = null;
        if (order.timestamp) {
          // timestamp can be a Date string, Unix timestamp (ms), or ISO string
          const ts = order.timestamp;
          if (typeof ts === 'number') {
            orderTime = new Date(ts);
          } else if (typeof ts === 'string') {
            orderTime = new Date(ts);
          } else if (ts instanceof Date) {
            orderTime = ts;
          }
          // Validate the date
          if (orderTime && isNaN(orderTime.getTime())) {
            orderTime = null;
          }
        }

        // For FomoPay orders, try to match a completed transaction
        // payWay values: 17 = PayNow/GrabPay (MobilePay), 35 = PayNow (dedicated), 3 = Alipay, 4 = WeChat
        const FOMOPAY_WAYS = [3, 4, 17, 35];
        let fomoTransactionId = null;
        let fomoStan = null;
        const orderPayWay = order.payWay;
        const orderSuccess = order.isSuccess ?? true;

        if (orderSuccess && FOMOPAY_WAYS.includes(orderPayWay) && !existingOrder) {
          try {
            const fomoTx = await db.fomoPayTransaction.findFirst({
              where: {
                deviceId: String(deviceId),
                status: 'completed',
                linkedOrder: false,
              },
              orderBy: { createdAt: 'desc' },
            });
            if (fomoTx) {
              fomoTransactionId = fomoTx.reference;
              fomoStan = fomoTx.stan;
              await db.fomoPayTransaction.update({
                where: { id: fomoTx.id },
                data: { linkedOrder: true },
              });
            }
          } catch (e) {
            console.error(`[OrderSync] Error matching FomoPay tx:`, e.message);
          }
        }

        if (existingOrder) {
          // Update existing order
          await db.order.update({
            where: { id: existingOrder.id },
            data: {
              amount: order.payAmount || order.totalAmount || 0,
              quantity: order.totalCount || 1,
              payWay: order.payWay || 'Unknown',
              isSuccess: orderSuccess,
              deliverCount: order.deliverCount,
              payAmount: order.payAmount,
              refundAmount: order.refundAmount,
              totalCount: order.totalCount,
              orderTime: orderTime,
            },
          });
          results.synced.push({ orderId: order.orderId, action: 'updated' });
        } else {
          // Insert new order
          await db.order.create({
            data: {
              orderId: String(order.orderId),
              deviceId: String(deviceId),
              deviceName: deviceName || 'Unknown',
              amount: order.payAmount || order.totalAmount || 0,
              quantity: order.totalCount || 1,
              payWay: order.payWay || 'Unknown',
              isSuccess: orderSuccess,
              deliverCount: order.deliverCount,
              payAmount: order.payAmount,
              refundAmount: order.refundAmount,
              totalCount: order.totalCount,
              orderTime: orderTime,
              fomoTransactionId,
              fomoStan,
              fomoTid: order.fomoTid || null,           // FomoPay TID from device (audit trail)
              airwallexTid: order.airwallexTid || null, // Airwallex TID from device (audit trail)
            },
          });
          results.synced.push({ orderId: order.orderId, action: 'created' });

          // For v3.3.0 devices, also insert into OrderImport
          if (shouldSyncToOrderImport && orderTime) {
            try {
              // Check if already exists in OrderImport
              const existingImport = await db.orderImport.findFirst({
                where: {
                  orderId: String(order.orderId),
                  deviceId: String(deviceId),
                },
              });

              if (!existingImport) {
                // If not success, deliverCount = 0
                const importDeliverCount = orderSuccess ? (order.deliverCount || order.totalCount || 1) : 0;

                // Divide amounts by 100 (Order table stores in cents*100, OrderImport stores in cents)
                const importAmount = Math.round((order.payAmount || order.totalAmount || 0) / 100);
                const importPayAmount = order.payAmount ? Math.round(order.payAmount / 100) : null;
                const importRefundAmount = order.refundAmount ? Math.round(order.refundAmount / 100) : null;

                await db.orderImport.create({
                  data: {
                    orderId: String(order.orderId),
                    deviceId: String(deviceId),
                    deviceName: deviceName || 'Unknown',
                    amount: importAmount,
                    quantity: order.totalCount || 1,
                    payWay: order.payWay ? String(order.payWay) : null,
                    isSuccess: orderSuccess,
                    createdAt: orderTime, // Use orderTime as createdAt
                    deliverCount: importDeliverCount,
                    payAmount: importPayAmount,
                    refundAmount: importRefundAmount,
                    totalCount: order.totalCount,
                  },
                });
                results.orderImportSynced++;
              }
            } catch (importError) {
              console.error(`[OrderSync] Failed to sync to OrderImport:`, importError.message);
            }
          }
        }
      } catch (orderError) {
        console.error(`[OrderSync] Failed to sync order ${order.orderId}:`, orderError.message);
        results.failed.push({ orderId: order.orderId, error: orderError.message });
      }
    }

    console.log(`[OrderSync] Synced ${results.synced.length}/${results.total} orders, ${results.failed.length} failed${results.orderImportSynced > 0 ? `, ${results.orderImportSynced} to OrderImport` : ''}`);

    return NextResponse.json({
      success: true,
      message: `Synced ${results.synced.length} orders`,
      results,
    });
  } catch (error) {
    console.error('[OrderSync] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// GET /api/orders/sync?deviceId=xxx
// Get list of synced order IDs for a device (for client to compare)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');

    if (!deviceId) {
      return NextResponse.json(
        { success: false, error: 'deviceId is required' },
        { status: 400 }
      );
    }

    // Get all order IDs for this device
    const orders = await db.order.findMany({
      where: { deviceId: String(deviceId) },
      select: { orderId: true },
      orderBy: { createdAt: 'desc' },
      take: 1000, // Limit to last 1000 orders
    });

    const orderIds = orders.map(o => o.orderId);

    return NextResponse.json({
      success: true,
      deviceId,
      orderIds,
      count: orderIds.length,
    });
  } catch (error) {
    console.error('[OrderSync] GET Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
