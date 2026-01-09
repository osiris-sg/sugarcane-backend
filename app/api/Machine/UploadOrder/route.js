import { db, getDeviceNameById } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const data = await request.json();

    console.log('[UploadOrder] Received:', JSON.stringify(data, null, 2));

    // Extract fields from the order payload
    // The Android app sends: orderId, deviceId, deviceName, payAmount, deliverCount, totalCount, payWay, isSuccess
    const {
      orderId,
      deviceId,
      deviceName: reportedName,
      amount,           // Legacy field
      payAmount,        // New field - amount in cents (may be 100x)
      quantity,         // Legacy field
      deliverCount,     // New field - number of items delivered
      totalCount,       // New field - total items ordered
      payWay,
      isSuccess,
    } = data;

    // Determine success - null or false means failed
    const orderSuccess = isSuccess === true;

    if (!deviceId) {
      return NextResponse.json({ success: false, error: 'deviceId is required' }, { status: 400 });
    }

    // Look up device to get price
    const device = await db.device.findUnique({
      where: { deviceId },
      select: { price: true },
    });

    // Use the correct device name from database (location field)
    const deviceName = await getDeviceNameById(deviceId, reportedName);

    // Use payAmount if available, otherwise fall back to amount
    const rawAmount = payAmount ?? amount ?? 0;

    // For failed orders (isSuccess null/false), set amount to 0
    let correctedAmount = 0;
    if (orderSuccess && rawAmount > 0) {
      correctedAmount = rawAmount;
      // Fix amount if it's abnormally high (likely 100x too much)
      if (device?.price && device.price > 0) {
        const testQty = rawAmount / device.price;
        if (testQty >= 100) {
          correctedAmount = Math.round(rawAmount / 100);
          console.log(`[UploadOrder] Amount looks 100x too high, correcting: ${rawAmount} → ${correctedAmount}`);
        }
      }
    }

    // Use deliverCount if available, otherwise calculate from amount or use quantity/totalCount
    let calculatedQuantity = deliverCount ?? quantity ?? totalCount ?? 1;
    if (orderSuccess && device?.price && device.price > 0 && correctedAmount > 0) {
      calculatedQuantity = Math.round(correctedAmount / device.price);
      if (calculatedQuantity < 1) calculatedQuantity = 1;
    }
    // For failed orders, use 0 quantity
    if (!orderSuccess) {
      calculatedQuantity = 0;
    }

    console.log(`[UploadOrder] Success: ${orderSuccess}, Device price: ${device?.price || 'N/A'}, Amount: ${correctedAmount}, Qty: ${calculatedQuantity}`);

    // Save order to database
    const saved = await db.order.create({
      data: {
        orderId: orderId || `ORD-${Date.now()}`,
        deviceId,
        deviceName,
        amount: correctedAmount,
        quantity: calculatedQuantity,
        payWay: payWay || null,
        isSuccess: orderSuccess,
      },
    });

    // Update lastSaleAt on the Stock record if this is a successful sale
    if (orderSuccess) {
      await db.stock.upsert({
        where: { deviceId },
        update: {
          lastSaleAt: new Date(),
          deviceName,
        },
        create: {
          deviceId,
          deviceName,
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
