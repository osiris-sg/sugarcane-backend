#!/usr/bin/env node

/**
 * Backdate Orders Script
 *
 * Imports historical order data from Excel export into the database.
 *
 * Usage:
 *   node scripts/backdate-orders.js /path/to/data.xls
 *   node scripts/backdate-orders.js /path/to/data.xls --dry-run
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const db = new PrismaClient();

// Parse command line args
const args = process.argv.slice(2);
const filePath = args.find(a => !a.startsWith('--'));
const dryRun = args.includes('--dry-run');

if (!filePath) {
  console.error('Usage: node scripts/backdate-orders.js <excel-file> [--dry-run]');
  process.exit(1);
}

/**
 * Normalize PayAmount to cents
 * If value < 100, assume it's in dollars and multiply by 100
 * If value >= 100, assume it's already in cents
 */
function normalizeAmount(value) {
  if (value === null || value === undefined || isNaN(value)) {
    return 0;
  }
  const num = parseFloat(value);
  if (num < 100) {
    // Likely in dollars (e.g., 2.8 = $2.80)
    return Math.round(num * 100);
  }
  // Already in cents (e.g., 280 = $2.80)
  return Math.round(num);
}

/**
 * Map PayWay string to code
 */
function mapPayWay(payWay) {
  if (!payWay) return null;
  const mapping = {
    'Cashless': '2',
    'Cash': '1',
    'Free': '1000',
  };
  return mapping[payWay] || payWay;
}

/**
 * Parse IsSuccess to boolean
 */
function parseSuccess(value) {
  if (value === 'Success') return true;
  if (value === 'Exception') return false;
  return false; // NaN or empty = failed
}

/**
 * Clean Order ID (remove ="..." wrapper)
 */
function cleanOrderId(id) {
  if (!id) return null;
  const str = String(id);
  // Remove ="..." wrapper
  const match = str.match(/^="?([^"]+)"?$/);
  if (match) return match[1];
  return str;
}

/**
 * Parse datetime string
 */
function parseDateTime(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  return date;
}

async function main() {
  console.log(`\n📊 Backdate Orders Script`);
  console.log(`========================`);
  console.log(`File: ${filePath}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE'}`);
  console.log('');

  // Check file exists
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  // Read file using Python (handles HTML-style .xls)
  const { execSync } = require('child_process');

  console.log('📖 Reading Excel file...');

  const pythonScript = `
import pandas as pd
import json
import sys

dfs = pd.read_html('${filePath}')
df = dfs[0]

# Convert to JSON
records = df.to_dict('records')

# Clean up NaN values
import math
for r in records:
    for k, v in r.items():
        if isinstance(v, float) and math.isnan(v):
            r[k] = None

print(json.dumps(records))
`;

  let records;
  try {
    const output = execSync(`python3 -c "${pythonScript}"`, {
      maxBuffer: 50 * 1024 * 1024,
      encoding: 'utf-8'
    });
    records = JSON.parse(output);
  } catch (error) {
    console.error('❌ Failed to read Excel file:', error.message);
    process.exit(1);
  }

  console.log(`✅ Read ${records.length} records\n`);

  // Get device names from database
  console.log('📍 Fetching device names from database...');
  const devices = await db.device.findMany({
    select: { deviceId: true, deviceName: true, location: true }
  });
  const deviceMap = {};
  devices.forEach(d => {
    deviceMap[d.deviceId] = d.location || d.deviceName || `Device ${d.deviceId}`;
  });
  console.log(`✅ Found ${devices.length} devices\n`);

  // Process records
  console.log('🔄 Processing records...');

  const orders = [];
  const stats = {
    total: records.length,
    success: 0,
    failed: 0,
    free: 0,
    skipped: 0,
    amountInDollars: 0,
    amountInCents: 0,
  };

  for (const record of records) {
    const orderId = cleanOrderId(record.Id);
    const deviceId = String(record.TerminalId);
    const createdAt = parseDateTime(record.CreateTime);
    const isSuccess = parseSuccess(record.IsSuccess);
    const payWay = mapPayWay(record.PayWay);
    const rawAmount = record.PayAmount;
    const amount = normalizeAmount(rawAmount);
    const refundAmount = record.RefundAmount ? normalizeAmount(record.RefundAmount) : null;
    const totalCount = record.TotalCount || 1;
    const deliverCount = record.DeliverCount ?? (isSuccess ? 1 : 0);

    // Track amount format
    if (rawAmount !== null && rawAmount !== undefined) {
      if (rawAmount < 100) stats.amountInDollars++;
      else stats.amountInCents++;
    }

    // Skip if no orderId or deviceId
    if (!orderId || !deviceId) {
      stats.skipped++;
      continue;
    }

    // Get device name
    const deviceName = deviceMap[deviceId] || `Device ${deviceId}`;

    if (isSuccess) stats.success++;
    else stats.failed++;
    if (payWay === '1000') stats.free++;

    orders.push({
      orderId,
      deviceId,
      deviceName,
      amount,
      payAmount: rawAmount ? Math.round(rawAmount * 100) : null, // Store raw as payAmount
      refundAmount,
      quantity: deliverCount || 1,
      totalCount,
      deliverCount,
      payWay,
      isSuccess,
      createdAt,
    });
  }

  console.log(`\n📊 Statistics:`);
  console.log(`   Total records: ${stats.total}`);
  console.log(`   Successful: ${stats.success}`);
  console.log(`   Failed: ${stats.failed}`);
  console.log(`   Free orders: ${stats.free}`);
  console.log(`   Skipped (invalid): ${stats.skipped}`);
  console.log(`   Amount in dollars format: ${stats.amountInDollars}`);
  console.log(`   Amount in cents format: ${stats.amountInCents}`);
  console.log(`   Orders to import: ${orders.length}`);

  // Show sample
  console.log(`\n📝 Sample orders (first 3):`);
  orders.slice(0, 3).forEach((o, i) => {
    console.log(`   ${i + 1}. ${o.orderId} | ${o.deviceId} | $${(o.amount / 100).toFixed(2)} | ${o.isSuccess ? 'Success' : 'Failed'} | ${o.createdAt?.toISOString()}`);
  });

  if (dryRun) {
    console.log(`\n🔍 DRY RUN - No changes made to database`);
    console.log(`   Run without --dry-run to import orders`);
    await db.$disconnect();
    return;
  }

  // Import to database
  console.log(`\n💾 Importing to database...`);

  let imported = 0;
  let duplicates = 0;
  let errors = 0;

  // Process in batches
  const batchSize = 100;
  for (let i = 0; i < orders.length; i += batchSize) {
    const batch = orders.slice(i, i + batchSize);

    for (const order of batch) {
      try {
        // Check if order already exists
        const existing = await db.order.findFirst({
          where: { orderId: order.orderId }
        });

        if (existing) {
          duplicates++;
          continue;
        }

        await db.order.create({ data: order });
        imported++;
      } catch (error) {
        errors++;
        if (errors <= 5) {
          console.error(`   ❌ Error importing ${order.orderId}: ${error.message}`);
        }
      }
    }

    // Progress
    const progress = Math.min(i + batchSize, orders.length);
    process.stdout.write(`\r   Progress: ${progress}/${orders.length} (${Math.round(progress / orders.length * 100)}%)`);
  }

  console.log(`\n\n✅ Import complete!`);
  console.log(`   Imported: ${imported}`);
  console.log(`   Duplicates skipped: ${duplicates}`);
  console.log(`   Errors: ${errors}`);

  await db.$disconnect();
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
