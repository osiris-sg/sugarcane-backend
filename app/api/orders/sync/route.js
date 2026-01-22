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

    const results = {
      synced: [],
      failed: [],
      total: orders.length,
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

        if (existingOrder) {
          // Update existing order
          await db.order.update({
            where: { id: existingOrder.id },
            data: {
              amount: order.payAmount || order.totalAmount || 0,
              quantity: order.totalCount || 1,
              payWay: order.payWay || 'Unknown',
              isSuccess: order.isSuccess ?? true,
              deliverCount: order.deliverCount,
              payAmount: order.payAmount,
              refundAmount: order.refundAmount,
              totalCount: order.totalCount,
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
              isSuccess: order.isSuccess ?? true,
              deliverCount: order.deliverCount,
              payAmount: order.payAmount,
              refundAmount: order.refundAmount,
              totalCount: order.totalCount,
            },
          });
          results.synced.push({ orderId: order.orderId, action: 'created' });
        }
      } catch (orderError) {
        console.error(`[OrderSync] Failed to sync order ${order.orderId}:`, orderError.message);
        results.failed.push({ orderId: order.orderId, error: orderError.message });
      }
    }

    console.log(`[OrderSync] Synced ${results.synced.length}/${results.total} orders, ${results.failed.length} failed`);

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
