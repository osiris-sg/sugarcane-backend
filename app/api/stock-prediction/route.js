import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { spawn } from 'child_process';
import path from 'path';

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
    // Convert UTC to SGT (UTC+8) for proper date grouping
    const salesByMachineDay = await db.$queryRaw`
      SELECT
        "deviceId" as device_id,
        DATE("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Singapore') as date,
        SUM(COALESCE("deliverCount", "quantity")) as sold
      FROM "OrderImport"
      WHERE "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Singapore' >= ${startDate}
        AND "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Singapore' <= ${endDate}
        AND "isSuccess" = true
      GROUP BY "deviceId", DATE("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Singapore')
      ORDER BY "deviceId", date ASC
    `;

    // Also get aggregated daily totals for chart (SGT timezone)
    const salesByDay = await db.$queryRaw`
      SELECT
        DATE("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Singapore') as date,
        SUM(COALESCE("deliverCount", "quantity")) as sold
      FROM "OrderImport"
      WHERE "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Singapore' >= ${startDate}
        AND "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Singapore' <= ${endDate}
        AND "isSuccess" = true
      GROUP BY DATE("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Singapore')
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
 * Run Python prediction script
 */
function runPythonPrediction(perMachineData, predictDate = null) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), 'ml', 'predict.py');
    const modelPath = path.join(process.cwd(), 'ml', 'sales_prediction_model.joblib');

    const python = spawn('python3', [scriptPath]);

    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    python.on('close', (code) => {
      if (code !== 0) {
        console.error('[Python] stderr:', stderr);
        reject(new Error(`Python script failed: ${stderr || 'Unknown error'}`));
        return;
      }

      try {
        const result = JSON.parse(stdout);
        if (result.error) {
          reject(new Error(result.error));
        } else {
          resolve(result);
        }
      } catch (e) {
        reject(new Error(`Failed to parse Python output: ${stdout}`));
      }
    });

    // Send input data to Python script
    const input = JSON.stringify({
      historical_data: perMachineData,
      model_path: modelPath,
      predict_date: predictDate,
    });

    python.stdin.write(input);
    python.stdin.end();
  });
}
