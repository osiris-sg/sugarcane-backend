import { db, getDeviceNameById, swapDeviceId } from '@/lib/db';
import { NextResponse } from 'next/server';
import { sendAlert } from '@/lib/telegram';

export async function POST(request) {
  try {
    const data = await request.json();

    console.log('[UploadOrder] Received:', JSON.stringify(data, null, 2));

    // Extract fields from the order payload
    // The Android app sends: orderId, deviceId, deviceName, payAmount, deliverCount, totalCount, payWay, isSuccess
    const {
      orderId,
      deviceId: rawDeviceId,
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

    if (!rawDeviceId) {
      return NextResponse.json({ success: false, error: 'deviceId is required' }, { status: 400 });
    }

    // Swap device ID if needed (for mismatched device IDs)
    const deviceId = swapDeviceId(rawDeviceId);
    if (deviceId !== rawDeviceId) {
      console.log(`[UploadOrder] Swapped device ID: ${rawDeviceId} -> ${deviceId}`);
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

    // For FomoPay orders, look up the most recent completed transaction for this device
    // payWay values: 17 = PayNow/GrabPay (MobilePay), 35 = PayNow (dedicated), 3 = Alipay, 4 = WeChat
    const FOMOPAY_WAYS = [3, 4, 17, 35];
    let fomoTransactionId = null;
    let fomoStan = null;
    if (orderSuccess && FOMOPAY_WAYS.includes(payWay)) {
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

          // Mark as linked so it won't be matched again
          await db.fomoPayTransaction.update({
            where: { id: fomoTx.id },
            data: { linkedOrder: true },
          });

          console.log(`[UploadOrder] Linked FomoPay transaction: ref=${fomoTransactionId}, stan=${fomoStan}`);
        } else {
          console.log(`[UploadOrder] No unlinked FomoPay transaction found for device ${deviceId}`);
        }
      } catch (e) {
        console.error(`[UploadOrder] Error looking up FomoPay transaction:`, e.message);
      }
    }

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
        fomoTransactionId,
        fomoStan,
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

    // Check for consecutive failed transactions (only if this was a failed order)
    if (!orderSuccess) {
      try {
        // Get the last 11 orders for this device to check if we just hit 10 consecutive failures
        const recentOrders = await db.order.findMany({
          where: { deviceId },
          orderBy: { createdAt: 'desc' },
          take: 11,
          select: { isSuccess: true },
        });

        // Only send alert when we hit EXACTLY 10 consecutive failures
        // (first 10 are failed, and either there's no 11th order OR the 11th was successful)
        if (recentOrders.length >= 10) {
          const first10 = recentOrders.slice(0, 10);
          const allFirst10Failed = first10.every(o => o.isSuccess === false);

          // Check if the 11th order (if exists) was successful - meaning this is a new streak
          const eleventhOrder = recentOrders[10];
          const isNewStreak = !eleventhOrder || eleventhOrder.isSuccess === true;

          if (allFirst10Failed && isNewStreak) {
            // Send Telegram alert
            const alertMessage = `⚠️ <b>Payment Processor Alert</b>\n\n` +
              `Machine: <b>${deviceName}</b>\n` +
              `Device ID: <code>${deviceId}</code>\n\n` +
              `🔴 <b>10 consecutive failed transactions detected!</b>\n\n` +
              `The payment processor for this machine might have an issue. Please check the device.`;

            await sendAlert(alertMessage, 'fault');
            console.log(`[UploadOrder] Sent consecutive failure alert for device ${deviceId}`);
          }
        }
      } catch (alertError) {
        console.error('[UploadOrder] Error checking consecutive failures:', alertError);
        // Don't fail the request if alert fails
      }
    }

    return NextResponse.json({ success: true, orderId: saved.id });
  } catch (error) {
    console.error('[UploadOrder] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
