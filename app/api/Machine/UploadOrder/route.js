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

    // Save order to database
    const saved = await db.order.create({
      data: {
        orderId: orderId || `ORD-${Date.now()}`,
        deviceId,
        deviceName: deviceName || deviceId,
        amount: amount || 0,
        quantity,
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
    }

    console.log('[UploadOrder] Order saved:', saved.id);

    return NextResponse.json({ success: true, orderId: saved.id });
  } catch (error) {
    console.error('[UploadOrder] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
