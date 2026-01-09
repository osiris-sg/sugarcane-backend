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

    // Detect format: new format has payAmount, old format has amount
    const isNewFormat = payAmount !== undefined;

    let correctedAmount = 0;
    let finalQuantity = 0;
    let rawAmountStored = null;

    if (orderSuccess) {
      if (isNewFormat) {
        // New format: payAmount is cents * 100 (28000 = 280 cents = $2.80)
        rawAmountStored = payAmount;
        correctedAmount = payAmount ? Math.round(payAmount / 100) : 0;
        finalQuantity = deliverCount ?? 1;
        console.log(`[UploadOrder] New format - Raw: ${payAmount} → ${correctedAmount} cents, Qty: ${finalQuantity}`);
      } else {
        // Old format: amount is already in cents (280 = $2.80)
        correctedAmount = amount || 0;
        finalQuantity = quantity ?? 1;
        console.log(`[UploadOrder] Old format - Amount: ${correctedAmount} cents, Qty: ${finalQuantity}`);
      }
    }

    console.log(`[UploadOrder] Success: ${orderSuccess}, Format: ${isNewFormat ? 'new' : 'old'}, Amount: ${correctedAmount}, Qty: ${finalQuantity}`);

    // Save order to database with all fields
    const saved = await db.order.create({
      data: {
        orderId: orderId || `ORD-${Date.now()}`,
        deviceId,
        deviceName,
        amount: correctedAmount,
        payAmount: rawAmountStored,
        refundAmount: data.refundAmount || null,
        quantity: finalQuantity,
        totalCount: totalCount || null,
        deliverCount: deliverCount ?? null,
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
