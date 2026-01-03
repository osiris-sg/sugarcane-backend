import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const data = await request.json();

    console.log('[UploadOrder] Received:', JSON.stringify(data, null, 2));

    // Extract fields from the order payload
    // The Android app sends: orderId, deviceId, deviceName, amount, quantity, payWay, isSuccess
    const {
      orderId,
      deviceId,
      deviceName,
      amount,
      quantity = 1,
      payWay,
      isSuccess = true,
    } = data;

    if (!deviceId) {
      return NextResponse.json({ success: false, error: 'deviceId is required' }, { status: 400 });
    }

    // Look up device to get price for quantity calculation
    const device = await db.device.findUnique({
      where: { deviceId },
      select: { price: true },
    });

    // Calculate quantity based on amount and device price
    // If device not found or price is 0, default to quantity from payload or 1
    let calculatedQuantity = quantity;
    if (device?.price && device.price > 0 && amount > 0) {
      calculatedQuantity = Math.round(amount / device.price);
      // Ensure at least 1 if there's an amount
      if (calculatedQuantity < 1) calculatedQuantity = 1;
    }

    console.log(`[UploadOrder] Device price: ${device?.price || 'N/A'}, Amount: ${amount}, Calculated qty: ${calculatedQuantity}`);

    // Save order to database
    const saved = await db.order.create({
      data: {
        orderId: orderId || `ORD-${Date.now()}`,
        deviceId,
        deviceName: deviceName || deviceId,
        amount: amount || 0,
        quantity: calculatedQuantity,
        payWay: payWay || null,
        isSuccess: isSuccess !== false,
      },
    });

    // Update lastSaleAt on the Stock record if this is a successful sale
    if (isSuccess !== false) {
      await db.stock.upsert({
        where: { deviceId },
        update: {
          lastSaleAt: new Date(),
          deviceName: deviceName || deviceId,
        },
        create: {
          deviceId,
          deviceName: deviceName || deviceId,
          quantity: 0,
          maxStock: 80,
          lastSaleAt: new Date(),
        },
      });

      console.log(`[UploadOrder] Updated lastSaleAt for device ${deviceId}`);

      // Auto-resolve any open ZERO_SALES issues for this device
      const openZeroSalesIssues = await db.issue.findMany({
        where: {
          deviceId,
          type: 'ZERO_SALES',
          status: { in: ['OPEN', 'CHECKING'] },
        },
      });

      if (openZeroSalesIssues.length > 0) {
        const now = new Date();
        for (const issue of openZeroSalesIssues) {
          const resolutionTimeMs = issue.respondedAt
            ? now.getTime() - new Date(issue.respondedAt).getTime()
            : null;

          await db.issue.update({
            where: { id: issue.id },
            data: {
              status: 'RESOLVED',
              resolution: 'auto_resolved_by_sale',
              resolvedAt: now,
              resolutionTimeMs,
            },
          });

          console.log(`[UploadOrder] Auto-resolved zero sales issue for ${deviceId} (${issue.timeBlock})`);
        }
      }
    }

    console.log('[UploadOrder] Order saved:', saved.id);

    return NextResponse.json({ success: true, orderId: saved.id });
  } catch (error) {
    console.error('[UploadOrder] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
