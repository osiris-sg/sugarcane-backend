import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/stock-prediction
 * Returns historical sales data per machine per day
 * Query params:
 *   - days: Number of days of historical data (default 14)
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '14', 10);

    // Calculate date range
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Fetch historical sales from OrderImport per machine per day (successful only)
    // Day runs from 22:30 prev day to 22:29 current day (SGT)
    // e.g., "Feb 13" = Feb 12 22:30 to Feb 13 22:29
    // Formula: DATE(timestamp_sgt - INTERVAL '22 hours 30 minutes') + 1 day
    const salesByMachineDay = await db.$queryRaw`
      SELECT
        "deviceId" as device_id,
        DATE(("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Singapore') - INTERVAL '22 hours 30 minutes') + INTERVAL '1 day' as date,
        SUM(COALESCE("deliverCount", "quantity")) as sold
      FROM "OrderImport"
      WHERE "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Singapore' >= ${startDate}
        AND "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Singapore' <= ${endDate}
        AND "isSuccess" = true
      GROUP BY "deviceId", DATE(("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Singapore') - INTERVAL '22 hours 30 minutes')
      ORDER BY "deviceId", date ASC
    `;

    // Also get aggregated daily totals for chart (SGT timezone, 22:30-22:29 day boundary)
    // "Feb 13" = sales from Feb 12 22:30 to Feb 13 22:29
    const salesByDay = await db.$queryRaw`
      SELECT
        DATE(("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Singapore') - INTERVAL '22 hours 30 minutes') + INTERVAL '1 day' as date,
        SUM(COALESCE("deliverCount", "quantity")) as sold
      FROM "OrderImport"
      WHERE "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Singapore' >= ${startDate}
        AND "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Singapore' <= ${endDate}
        AND "isSuccess" = true
      GROUP BY DATE(("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Singapore') - INTERVAL '22 hours 30 minutes')
      ORDER BY date ASC
    `;


    // Fetch all stored predictions within date range
    const predictions = await db.stockPrediction.findMany({
      where: {
        predictDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { predictDate: 'asc' },
    });

    // Also get the latest prediction (might be for tomorrow)
    const latestPrediction = await db.stockPrediction.findFirst({
      orderBy: { predictDate: 'desc' },
    });

    // Format per-machine data
    const perMachineData = salesByMachineDay.map((row) => ({
      device_id: String(row.device_id),
      date: row.date instanceof Date
        ? row.date.toISOString().split('T')[0]
        : String(row.date).split('T')[0],
      sold: Number(row.sold) || 0,
    }));

    // Format aggregated daily data for chart
    const historicalData = salesByDay.map((row) => ({
      date: row.date instanceof Date
        ? row.date.toISOString().split('T')[0]
        : String(row.date).split('T')[0],
      sold: Number(row.sold) || 0,
    }));

    // Build predictions map by date
    const predictionsMap = {};
    for (const pred of predictions) {
      const dateStr = pred.predictDate.toISOString().split('T')[0];
      predictionsMap[dateStr] = {
        totalPredicted: pred.totalPredicted,
        totalActual: pred.totalActual,
        stockLeft: pred.stockLeft,
      };
    }

    // Add latest prediction to map (might be for tomorrow, outside date range)
    if (latestPrediction) {
      const latestDateStr = latestPrediction.predictDate.toISOString().split('T')[0];
      if (!predictionsMap[latestDateStr]) {
        predictionsMap[latestDateStr] = {
          totalPredicted: latestPrediction.totalPredicted,
          totalActual: latestPrediction.totalActual,
          stockLeft: latestPrediction.stockLeft,
        };
      }
    }

    return NextResponse.json({
      success: true,
      historicalData, // Aggregated daily for chart
      perMachineData, // Per machine per day for prediction
      predictionsMap, // All predictions by date
      dateRange: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
      },
      // Latest stored prediction from cron job
      latestPrediction: latestPrediction ? {
        predictDate: latestPrediction.predictDate.toISOString().split('T')[0],
        totalPredicted: latestPrediction.totalPredicted,
        totalActual: latestPrediction.totalActual,
        stockLeft: latestPrediction.stockLeft,
        machines: latestPrediction.machines,
        createdAt: latestPrediction.createdAt.toISOString(),
      } : null,
    });
  } catch (error) {
    console.error('[Stock Prediction] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/stock-prediction
 * Run ML prediction for next day using per-machine data
 * Body: { perMachineData: [{ device_id, date, sold }], predictDate?: string }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { perMachineData, predictDate } = body;

    if (!perMachineData || perMachineData.length < 7) {
      return NextResponse.json(
        { success: false, error: 'Need at least 7 days of historical data' },
        { status: 400 }
      );
    }

    // Call Python script for prediction
    const prediction = await runPythonPrediction(perMachineData, predictDate);

    return NextResponse.json({
      success: true,
      ...prediction,
    });
  } catch (error) {
    console.error('[Stock Prediction] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/stock-prediction
 * Update stock left for a specific date
 * Body: { date: string (YYYY-MM-DD), stockLeft: number }
 */
export async function PATCH(request) {
  try {
    const body = await request.json();
    const { date, stockLeft } = body;

    if (!date) {
      return NextResponse.json(
        { success: false, error: 'Date is required' },
        { status: 400 }
      );
    }

    if (stockLeft === undefined || stockLeft === null) {
      return NextResponse.json(
        { success: false, error: 'Stock left value is required' },
        { status: 400 }
      );
    }

    const predictDate = new Date(date);

    // Check if prediction exists for this date
    const existing = await db.stockPrediction.findUnique({
      where: { predictDate },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'No prediction found for this date' },
        { status: 404 }
      );
    }

    // Update stockLeft
    const updated = await db.stockPrediction.update({
      where: { predictDate },
      data: { stockLeft: parseInt(stockLeft, 10) },
    });

    return NextResponse.json({
      success: true,
      date: updated.predictDate.toISOString().split('T')[0],
      stockLeft: updated.stockLeft,
      totalPredicted: updated.totalPredicted,
    });
  } catch (error) {
    console.error('[Stock Prediction] PATCH Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Call Python prediction API
 */
async function runPythonPrediction(perMachineData, predictDate = null) {
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const response = await fetch(`${baseUrl}/api/predict`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      historical_data: perMachineData,
      predict_date: predictDate,
    }),
  });

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Prediction failed');
  }

  return result;
}
