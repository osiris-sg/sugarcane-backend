import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

// POST /api/Machine/ReportStock
// Called by Android app to report stock changes
export async function POST(request) {
  try {
    const body = await request.json();
    const { deviceId, deviceName, quantity, previousQty, change, reason } = body;

    // Validate required fields
    if (!deviceId || quantity === undefined) {
      return NextResponse.json(
        { success: false, error: 'deviceId and quantity are required' },
        { status: 400 }
      );
    }

    console.log(`[ReportStock] Device ${deviceId} (${deviceName}): ${previousQty} -> ${quantity} (${change > 0 ? '+' : ''}${change}) reason: ${reason}`);

    // Upsert stock level
    const stock = await db.stock.upsert({
      where: { deviceId: String(deviceId) },
      update: {
        quantity: quantity,
        deviceName: deviceName || `Device ${deviceId}`,
      },
      create: {
        deviceId: String(deviceId),
        deviceName: deviceName || `Device ${deviceId}`,
        quantity: quantity,
      },
    });

    // Log stock history if we have change info
    if (change !== undefined && reason) {
      await db.stockHistory.create({
        data: {
          deviceId: String(deviceId),
          deviceName: deviceName || `Device ${deviceId}`,
          previousQty: previousQty || 0,
          newQty: quantity,
          change: change,
          reason: reason, // "sale", "topup", "adjustment"
        },
      });
    }

    return NextResponse.json({
      success: true,
      stock: {
        deviceId: stock.deviceId,
        deviceName: stock.deviceName,
        quantity: stock.quantity,
        updatedAt: stock.updatedAt,
      },
    });
  } catch (error) {
    console.error('[ReportStock] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// GET /api/Machine/ReportStock?deviceId=123
// Get stock level for a specific device
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');

    if (deviceId) {
      // Get specific device stock
      const stock = await db.stock.findUnique({
        where: { deviceId: String(deviceId) },
      });

      if (!stock) {
        return NextResponse.json(
          { success: false, error: 'Device not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, stock });
    }

    // Get all stocks
    const stocks = await db.stock.findMany({
      orderBy: { deviceName: 'asc' },
    });

    return NextResponse.json({ success: true, stocks });
  } catch (error) {
    console.error('[ReportStock] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
