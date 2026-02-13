import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { spawn } from 'child_process';
import path from 'path';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/cron/stock-prediction
 * Runs at 23:59 SGT daily to predict next day's sales
 * Stores prediction in StockPrediction table
 */
export async function GET(request) {
  // Verify cron secret (optional security)
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.log('[StockPrediction Cron] Warning: No valid CRON_SECRET provided');
  }

  const now = new Date();
  console.log(`[StockPrediction Cron] Started at ${now.toISOString()}`);

  try {
    // Calculate date range for last 14 days in SGT
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 14);
    startDate.setHours(0, 0, 0, 0);

    // Fetch per-machine daily sales (SGT timezone)
    // Day runs from 22:30 to 22:29 next day
    // e.g., "Feb 13" = Feb 13 22:30 to Feb 14 22:29
    // To map orders to correct date: DATE(timestamp_sgt - INTERVAL '22 hours 30 minutes')
    const salesByMachineDay = await db.$queryRaw`
      SELECT
        "deviceId" as device_id,
        DATE(("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Singapore') - INTERVAL '22 hours 30 minutes') as date,
        SUM(COALESCE("deliverCount", "quantity")) as sold
      FROM "OrderImport"
      WHERE "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Singapore' >= ${startDate}
        AND "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Singapore' <= ${endDate}
        AND "isSuccess" = true
      GROUP BY "deviceId", DATE(("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Singapore') - INTERVAL '22 hours 30 minutes')
      ORDER BY "deviceId", date ASC
    `;

    // Format per-machine data
    const perMachineData = salesByMachineDay.map((row) => ({
      device_id: String(row.device_id),
      date: row.date instanceof Date
        ? row.date.toISOString().split('T')[0]
        : String(row.date).split('T')[0],
      sold: Number(row.sold) || 0,
    }));

    console.log(`[StockPrediction Cron] Fetched ${perMachineData.length} data points`);

    if (perMachineData.length < 7) {
      console.log('[StockPrediction Cron] Not enough data for prediction');
      return NextResponse.json({
        success: false,
        error: 'Not enough historical data',
      });
    }

    // Run Python prediction
    const prediction = await runPythonPrediction(perMachineData);

    console.log(`[StockPrediction Cron] Prediction complete: ${prediction.total_predicted} for ${prediction.predict_date}`);

    // Store prediction in database
    const predictDate = new Date(prediction.predict_date);

    await db.stockPrediction.upsert({
      where: { predictDate },
      update: {
        totalPredicted: prediction.total_predicted,
        machines: prediction.machines,
        perMachineData: prediction.predictions_per_machine,
      },
      create: {
        predictDate,
        totalPredicted: prediction.total_predicted,
        machines: prediction.machines,
        perMachineData: prediction.predictions_per_machine,
      },
    });

    console.log(`[StockPrediction Cron] Saved prediction for ${prediction.predict_date}`);

    return NextResponse.json({
      success: true,
      predictDate: prediction.predict_date,
      basedOnDate: prediction.based_on_date,
      totalPredicted: prediction.total_predicted,
      machines: prediction.machines,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('[StockPrediction Cron] Error:', error);
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
        console.error('[StockPrediction Cron] Python stderr:', stderr);
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

    const input = JSON.stringify({
      historical_data: perMachineData,
      model_path: modelPath,
      predict_date: predictDate,
    });

    python.stdin.write(input);
    python.stdin.end();
  });
}
